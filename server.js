require("dotenv").config();

const express = require("express");
const path = require("path");
const Stripe = require("stripe");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const supabase = require("./supabaseClient");

const app = express();

/* ============================================================
   ⚙️ CONFIGURAÇÃO
   ============================================================ */

// Falha rápido e com erro claro no boot se faltar configuração essencial.
const REQUIRED_ENV_VARS = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"];
const missingEnvVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

if (missingEnvVars.length > 0) {
  console.error(`❌ Variáveis de ambiente faltando: ${missingEnvVars.join(", ")}`);
  process.exit(1);
}

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// URL base usada nos redirects do Checkout. Em produção, defina BASE_URL
// (ex.: https://seusite.com) — sem isso, cai no localhost (apenas dev).
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

// ---------------------------------------------------------------
// 🗂️ CATÁLOGO DE PLANOS
//
// Cada plano referencia um Price criado no Stripe Dashboard.
// Crie os Products/Prices no Dashboard, anote os price_id (price_xxx)
// e defina-os no .env — nunca hard-coded aqui.
//
// Exemplo de .env:
//   STRIPE_PRICE_MENSAL=price_xxx
//   STRIPE_PRICE_TRIMESTRAL=price_xxx
//   STRIPE_PRICE_SEMESTRAL=price_xxx
//   STRIPE_PRICE_ANUAL=price_xxx
//
// Enquanto os IDs não existirem, as variáveis ficam indefinidas e
// o checkout retorna 400 para o plano solicitado.
// ---------------------------------------------------------------
const PLANS = {
  mensal: {
    priceId: process.env.STRIPE_PRICE_MENSAL,
    name: "Plano Mensal"
  },
  trimestral: {
    priceId: process.env.STRIPE_PRICE_TRIMESTRAL,
    name: "Plano Trimestral"
  },
  semestral: {
    priceId: process.env.STRIPE_PRICE_SEMESTRAL,
    name: "Plano Semestral"
  },
  anual: {
    priceId: process.env.STRIPE_PRICE_ANUAL,
    name: "Plano Anual"
  }
};

// Logger com formato consistente para facilitar debug em produção.
function log(level, message, meta = {}) {
  const ts = new Date().toISOString();
  const icon = { info: "ℹ️", warn: "⚠️", error: "❌", success: "✅" }[level] || "";
  const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : "";
  console.log(`[${ts}] ${icon} ${message} ${metaStr}`.trim());
}

// Validações de dados.
function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Soma 1 mês a uma data. Usado apenas como FALLBACK do período de
// cobrança, para o caso (raro) de falharmos ao buscar o período real
// direto no Stripe — ver getBillingPeriod() abaixo.
function addOneMonth(date) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + 1);
  return result;
}

/* ============================================================
   💾 LÓGICA DE NEGÓCIO
   ============================================================ */

/**
 * Busca o período de cobrança atual direto na Subscription do Stripe
 * (fonte da verdade real). Se a busca falhar por qualquer motivo (rede,
 * id ausente/inválido), cai para uma aproximação de 1 mês a partir do
 * timestamp do evento, em vez de travar a ativação por completo.
 */
async function getBillingPeriod(subscriptionId, eventTimestampSec) {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    return {
      periodStart: new Date(subscription.current_period_start * 1000),
      periodEnd: new Date(subscription.current_period_end * 1000)
    };
  } catch (err) {
    log("warn", "Falha ao buscar período real da assinatura no Stripe, usando aproximação de 1 mês", {
      subscription_id: subscriptionId,
      error: err.message
    });
    const periodStart = new Date(eventTimestampSec * 1000);
    return { periodStart, periodEnd: addOneMonth(periodStart) };
  }
}

/**
 * Ativa (ou renova) a assinatura do usuário na tabela subscriptions.
 *
 * Idempotente: o período vem da própria Subscription do Stripe (ou, em
 * fallback, do timestamp do EVENTO), nunca do horário em que o webhook
 * é processado.
 *
 * Requer constraint UNIQUE em subscriptions.user_id (uma linha por usuário).
 */
async function activateSubscription({ user_id, plan, sessionId, subscriptionId, customerId, eventTimestampSec }) {
  const { periodStart, periodEnd } = await getBillingPeriod(subscriptionId, eventTimestampSec);

  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id,
      status: "active",
      plan: plan || "mensal", // fallback caso metadata não chegue
      stripe_session_id: sessionId,
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: customerId,
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
      canceled_at: null, // limpa um cancelamento anterior, em caso de reassinatura
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id" }
  );

  if (error) {
    log("error", "Falha ao ativar assinatura no Supabase", {
      user_id,
      session_id: sessionId,
      error: error.message
    });
    throw error; // propaga para o webhook responder 500 e o Stripe reentregar
  }

  log("success", "Assinatura ativada/renovada", {
    user_id,
    plan,
    subscription_id: subscriptionId,
    current_period_end: periodEnd.toISOString()
  });
}

/**
 * Processa um evento checkout.session.completed: salva o pagamento (de
 * forma idempotente) e, se houver user_id, ativa a assinatura do usuário.
 */
async function handleCheckoutCompleted(session, eventId, eventTimestampSec) {
  const sessionId = session.id;
  const email = session.customer_details?.email ?? null;
  const amount = session.amount_total;
  const paymentStatus = session.payment_status;
  const subscriptionId = session.subscription ?? null;
  const customerId = session.customer ?? null;

  // user_id pode vir em metadata (preferencial) ou em client_reference_id
  // (fallback), gravados na criação da sessão de checkout.
  const user_id = session.metadata?.user_id || session.client_reference_id || null;

  // plan gravado em metadata na criação da sessão
  const plan = session.metadata?.plan || null;

  log("info", "checkout.session.completed recebido", {
    event_id: eventId,
    session_id: sessionId,
    subscription_id: subscriptionId,
    user_id,
    plan,
    email,
    amount,
    payment_status: paymentStatus
  });

  if (!user_id) {
    log("warn", "Sessão sem user_id em metadata/client_reference_id", { session_id: sessionId });
  }

  if (paymentStatus !== "paid") {
    log("warn", "payment_status diferente de 'paid', ignorando", {
      session_id: sessionId,
      payment_status: paymentStatus
    });
    return;
  }

  // Upsert idempotente do pagamento.
  // IMPORTANTE: exige constraint UNIQUE na coluna session_id.
  //   ALTER TABLE payments ADD CONSTRAINT payments_session_id_key UNIQUE (session_id);
  const { data: inserted, error: paymentError } = await supabase
    .from("payments")
    .upsert(
      { session_id: sessionId, email, amount, user_id, status: "paid" },
      { onConflict: "session_id", ignoreDuplicates: true }
    )
    .select();

  if (paymentError) {
    log("error", "Falha ao salvar pagamento no Supabase", {
      session_id: sessionId,
      error: paymentError.message
    });
    throw paymentError;
  }

  if (!inserted || inserted.length === 0) {
    log("warn", "Pagamento já existia — ignorado por idempotência", { session_id: sessionId });
  } else {
    log("success", "Pagamento salvo com sucesso", { session_id: sessionId });
  }

  // A ativação da assinatura roda SEMPRE, mesmo quando o pagamento já
  // existia (reentrega do Stripe).
  if (user_id) {
    await activateSubscription({ user_id, plan, sessionId, subscriptionId, customerId, eventTimestampSec });
  } else {
    log("warn", "Assinatura não ativada: pagamento sem user_id vinculado", {
      session_id: sessionId
    });
  }
}

/**
 * Processa um evento customer.subscription.deleted: marca a assinatura
 * como cancelada na tabela subscriptions.
 *
 * Identificação do usuário, em ordem de preferência:
 *   1) metadata.user_id da própria Subscription
 *   2) stripe_subscription_id salvo no Supabase
 *   3) stripe_customer_id salvo no Supabase
 */
async function handleSubscriptionDeleted(subscription, eventId) {
  const subscriptionId = subscription.id;
  const customerId = subscription.customer ?? null;
  const user_id = subscription.metadata?.user_id || null;

  log("info", "customer.subscription.deleted recebido", {
    event_id: eventId,
    subscription_id: subscriptionId,
    customer_id: customerId,
    user_id
  });

  let query = supabase.from("subscriptions").update({
    status: "canceled",
    canceled_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  if (user_id) {
    query = query.eq("user_id", user_id);
  } else if (subscriptionId) {
    query = query.eq("stripe_subscription_id", subscriptionId);
  } else if (customerId) {
    query = query.eq("stripe_customer_id", customerId);
  } else {
    log("warn", "Evento subscription.deleted sem identificadores utilizáveis, ignorado", {
      event_id: eventId
    });
    return;
  }

  const { data, error } = await query.select();

  if (error) {
    log("error", "Falha ao cancelar assinatura no Supabase", {
      subscription_id: subscriptionId,
      error: error.message
    });
    throw error;
  }

  if (!data || data.length === 0) {
    log("warn", "Nenhuma assinatura correspondente encontrada para cancelar", {
      subscription_id: subscriptionId,
      customer_id: customerId,
      user_id
    });
    return;
  }

  log("success", "Assinatura marcada como cancelada", {
    user_id: data[0]?.user_id,
    subscription_id: subscriptionId
  });
}

/**
 * Processa customer.subscription.updated: sincroniza status e período
 * da assinatura quando ela é alterada (ex.: trial → active, downgrade/upgrade).
 */
async function handleSubscriptionUpdated(subscription, eventId) {
  const subscriptionId = subscription.id;
  const customerId = subscription.customer ?? null;
  const user_id = subscription.metadata?.user_id || null;
  const status = subscription.status; // active, past_due, canceled, etc.

  log("info", "customer.subscription.updated recebido", {
    event_id: eventId,
    subscription_id: subscriptionId,
    status,
    user_id
  });

  const periodStart = subscription.current_period_start
    ? new Date(subscription.current_period_start * 1000).toISOString()
    : undefined;
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : undefined;

  const updatePayload = {
    status,
    updated_at: new Date().toISOString(),
    ...(periodStart && { current_period_start: periodStart }),
    ...(periodEnd && { current_period_end: periodEnd })
  };

  let query = supabase.from("subscriptions").update(updatePayload);

  if (user_id) {
    query = query.eq("user_id", user_id);
  } else if (subscriptionId) {
    query = query.eq("stripe_subscription_id", subscriptionId);
  } else if (customerId) {
    query = query.eq("stripe_customer_id", customerId);
  } else {
    log("warn", "Evento subscription.updated sem identificadores utilizáveis, ignorado", {
      event_id: eventId
    });
    return;
  }

  const { error } = await query;

  if (error) {
    log("error", "Falha ao atualizar assinatura no Supabase", {
      subscription_id: subscriptionId,
      error: error.message
    });
    throw error;
  }

  log("success", "Assinatura atualizada", { subscription_id: subscriptionId, status });
}

/**
 * Processa invoice.payment_failed: marca a assinatura como past_due
 * e registra na tabela payments (status: "failed").
 */
async function handlePaymentFailed(invoice, eventId) {
  const customerId = invoice.customer ?? null;
  const subscriptionId = invoice.subscription ?? null;
  const sessionId = invoice.id; // usa invoice.id como chave de idempotência
  const email = invoice.customer_email ?? null;
  const amount = invoice.amount_due ?? 0;

  log("info", "invoice.payment_failed recebido", {
    event_id: eventId,
    invoice_id: sessionId,
    subscription_id: subscriptionId,
    customer_id: customerId
  });

  // Salva o pagamento falho no histórico
  const { error: paymentError } = await supabase
    .from("payments")
    .upsert(
      { session_id: sessionId, email, amount, user_id: null, status: "failed" },
      { onConflict: "session_id", ignoreDuplicates: true }
    );

  if (paymentError) {
    log("warn", "Falha ao salvar pagamento falho no Supabase", {
      invoice_id: sessionId,
      error: paymentError.message
    });
  }

  // Marca assinatura como past_due
  let query = supabase
    .from("subscriptions")
    .update({ status: "past_due", updated_at: new Date().toISOString() });

  if (subscriptionId) {
    query = query.eq("stripe_subscription_id", subscriptionId);
  } else if (customerId) {
    query = query.eq("stripe_customer_id", customerId);
  } else {
    log("warn", "invoice.payment_failed sem identificadores utilizáveis", { event_id: eventId });
    return;
  }

  const { error } = await query;
  if (error) {
    log("error", "Falha ao marcar assinatura como past_due", {
      subscription_id: subscriptionId,
      error: error.message
    });
    throw error;
  }

  log("success", "Assinatura marcada como past_due após falha de pagamento", {
    subscription_id: subscriptionId
  });
}

/* ============================================================
   🔥 WEBHOOK (PRECISA VIR ANTES DE express.json())
   ============================================================ */

// No Dashboard/CLI do Stripe, este endpoint precisa estar inscrito em:
//   - checkout.session.completed
//   - customer.subscription.deleted
//   - customer.subscription.updated
//   - invoice.payment_failed
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];

    if (!sig) {
      log("error", "Requisição ao webhook sem header stripe-signature");
      return res.status(400).send("Webhook Error: missing signature");
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      log("error", "Assinatura do webhook inválida", { error: err.message });
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      log("info", "Evento Stripe recebido", { event_id: event.id, type: event.type });

      if (event.type === "checkout.session.completed") {
        await handleCheckoutCompleted(event.data.object, event.id, event.created);
      } else if (event.type === "customer.subscription.deleted") {
        await handleSubscriptionDeleted(event.data.object, event.id);
      } else if (event.type === "customer.subscription.updated") {
        await handleSubscriptionUpdated(event.data.object, event.id);
      } else if (event.type === "invoice.payment_failed") {
        await handlePaymentFailed(event.data.object, event.id);
      } else {
        log("info", "Evento Stripe ignorado (tipo não tratado)", {
          event_id: event.id,
          type: event.type
        });
      }

      return res.status(200).json({ received: true });
    } catch (err) {
      log("error", "Erro ao processar evento do webhook", {
        event_id: event.id,
        error: err.message
      });
      // 500 faz o Stripe reentregar o evento automaticamente.
      return res.status(500).json({ error: "Erro ao processar evento." });
    }
  }
);

/* ============================================================
   🌐 MIDDLEWARE (sempre depois da rota /webhook)
   ============================================================ */

// Segurança: cabeçalhos HTTP seguros (CSP, HSTS, X-Frame-Options, etc.)
app.use(
  helmet({
    // Permite carregar fontes do Google Fonts e scripts do CDN do Supabase
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: [
          "'self'",
          "data:",
          "https://images.unsplash.com",
          "https://media.istockphoto.com",
          "https://maps.google.com",
          "https://maps.gstatic.com",
          "https://*.googleapis.com",
          "https://*.gstatic.com"
        ],
        frameSrc: ["https://maps.google.com", "https://www.google.com"],
        connectSrc: [
          "'self'",
          "https://*.supabase.co",
          "https://maps.google.com",
          "https://www.google.com"
        ]
      }
    }
  })
);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* ============================================================
   🌍 ROTAS
   ============================================================ */

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Rate limit: máximo 10 tentativas por minuto por IP na rota de checkout,
// para evitar abuso (criação de dezenas de sessões por segundo).
const checkoutLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições. Aguarde um momento e tente novamente." }
});

app.post("/create-checkout-session", checkoutLimiter, async (req, res) => {
  try {
    // ---------------------------------------------------------------
    // TAREFA 5: Validar JWT antes de qualquer outra coisa.
    // O user_id e email vêm do token, nunca do body — assim um cliente
    // malicioso não pode se passar por outro usuário.
    // ---------------------------------------------------------------
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return res.status(401).json({ error: "Não autenticado. Token ausente." });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authData?.user) {
      log("warn", "Token JWT inválido na rota de checkout", {
        error: authError?.message
      });
      return res.status(401).json({ error: "Não autenticado. Token inválido ou expirado." });
    }

    const user_id = authData.user.id;
    const email = authData.user.email;

    // ---------------------------------------------------------------
    // TAREFA 3: Validar o plano contra a allowlist do servidor.
    // O price_id nunca vem do body — apenas o nome do plano,
    // e o servidor resolve o price_id correspondente.
    // ---------------------------------------------------------------
    const { plan_id } = req.body ?? {};

    if (!plan_id || !PLANS[plan_id]) {
      return res.status(400).json({
        error: `Plano inválido. Escolha um de: ${Object.keys(PLANS).join(", ")}.`
      });
    }

    const plan = PLANS[plan_id];

    if (!plan.priceId) {
      log("warn", "Price ID não configurado para o plano", { plan_id });
      return res.status(503).json({
        error: `O plano "${plan_id}" ainda não está disponível. Tente novamente em breve.`
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],

      // price referencia o Price criado no Stripe Dashboard — o valor
      // e o intervalo de cobrança estão definidos lá, não aqui.
      line_items: [
        {
          price: plan.priceId,
          quantity: 1
        }
      ],

      success_url: `${BASE_URL}/sucesso.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/cancelado.html`,

      // Liga o usuário à sessão de duas formas redundantes.
      client_reference_id: String(user_id),
      metadata: {
        user_id: String(user_id),
        email: String(email),
        plan: plan_id // gravado no Supabase pelo webhook
      },

      // Grava user_id e plan na própria Subscription (não só na Session).
      // Essencial para o evento customer.subscription.deleted, que entrega
      // o objeto Subscription sem referência à Session original.
      subscription_data: {
        metadata: {
          user_id: String(user_id),
          plan: plan_id
        }
      },

      // Pré-preenche o e-mail no checkout para melhor UX
      customer_email: email
    });

    log("info", "Sessão de checkout criada", {
      session_id: session.id,
      user_id,
      plan: plan_id
    });
    res.json({ url: session.url });
  } catch (error) {
    log("error", "Erro ao criar sessão de checkout no Stripe", { error: error.message });
    res.status(500).json({ error: "Não foi possível iniciar o pagamento." });
  }
});

/* ============================================================
   🛑 INICIALIZAÇÃO
   ============================================================ */

// Rede de segurança global — evita que um erro não tratado derrube o processo.
process.on("unhandledRejection", (reason) => {
  log("error", "unhandledRejection", { reason: reason?.message || String(reason) });
});

process.on("uncaughtException", (err) => {
  log("error", "uncaughtException — encerrando processo", { error: err.message });
  process.exit(1);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});