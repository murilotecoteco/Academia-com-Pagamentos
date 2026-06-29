require("dotenv").config();

const express = require("express");
const path = require("path");
const Stripe = require("stripe");

const supabase = require("./supabaseClient");

const app = express();

/* ============================================================
   ⚙️ CONFIGURAÇÃO
   ============================================================ */

// Falha rápido e com erro claro no boot se faltar configuração essencial,
// em vez de o erro aparecer só quando o Stripe for chamado em produção.
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

// Logger com formato consistente para facilitar debug em produção.
function log(level, message, meta = {}) {
  const ts = new Date().toISOString();
  const icon = { info: "ℹ️", warn: "⚠️", error: "❌", success: "✅" }[level] || "";
  const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : "";
  console.log(`[${ts}] ${icon} ${message} ${metaStr}`.trim());
}

// Validações de dados recebidos do frontend.
function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUserId(user_id) {
  return typeof user_id === "string" && user_id.trim().length > 0;
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
 * é processado — reprocessar o mesmo evento (reentrega do Stripe) sempre
 * produz o mesmo resultado, em vez de "esticar" a assinatura a cada retry.
 *
 * Requer constraint UNIQUE em subscriptions.user_id (uma linha por usuário):
 *   ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_user_id_key UNIQUE (user_id);
 *
 * Colunas assumidas na tabela subscriptions — ajuste os nomes abaixo se o
 * seu schema real for diferente:
 *   user_id, status, plan, stripe_session_id, stripe_subscription_id,
 *   stripe_customer_id, current_period_start, current_period_end,
 *   canceled_at, updated_at
 *
 *   ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
 *   ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_customer_id text;
 *   ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS canceled_at timestamptz;
 *   CREATE INDEX IF NOT EXISTS subscriptions_stripe_subscription_id_idx
 *     ON subscriptions (stripe_subscription_id);
 *   CREATE INDEX IF NOT EXISTS subscriptions_stripe_customer_id_idx
 *     ON subscriptions (stripe_customer_id);
 */
async function activateSubscription({ user_id, sessionId, subscriptionId, customerId, eventTimestampSec }) {
  const { periodStart, periodEnd } = await getBillingPeriod(subscriptionId, eventTimestampSec);

  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id,
      status: "active",
      plan: "mensal",
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

  log("info", "checkout.session.completed recebido", {
    event_id: eventId,
    session_id: sessionId,
    subscription_id: subscriptionId,
    user_id,
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

  // Upsert idempotente do pagamento: evita duplicidade mesmo se o Stripe
  // reenviar o mesmo evento (entrega "at least once").
  //
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
  // existia (reentrega do Stripe). Isso evita um cenário real de bug:
  // pagamento salvo com sucesso → ativação da assinatura falha →
  // Stripe reentrega o evento → pagamento (já existente) faria a gente
  // pular a ativação se ela só rodasse no caminho "inserido pela primeira vez".
  if (user_id) {
    await activateSubscription({ user_id, sessionId, subscriptionId, customerId, eventTimestampSec });
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
 * Dispara quando uma Subscription do Stripe é cancelada de fato — pelo
 * Dashboard, pela API, pelo Customer Portal, ou (dependendo da config.
 * de "smart retries") após esgotarem as tentativas de cobrança de uma
 * fatura em atraso.
 *
 * Identificação do usuário, em ordem de preferência:
 *   1) metadata.user_id da própria Subscription (gravado na criação do
 *      checkout via `subscription_data.metadata`) — é a forma mais
 *      direta e funciona mesmo se a Subscription for cancelada por um
 *      caminho que não passa pelo nosso backend (ex.: Customer Portal).
 *   2) stripe_subscription_id salvo no Supabase em activateSubscription.
 *   3) stripe_customer_id salvo no Supabase em activateSubscription.
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
    throw error; // propaga para o webhook responder 500 e o Stripe reentregar
  }

  if (!data || data.length === 0) {
    // Não é necessariamente um erro: pode ser uma Subscription de teste,
    // ou um evento referente a uma assinatura que nunca foi ativada aqui.
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

/* ============================================================
   🔥 WEBHOOK (PRECISA VIR ANTES DE express.json())
   ============================================================ */

// No Dashboard/CLI do Stripe, este endpoint precisa estar inscrito em:
//   - checkout.session.completed
//   - customer.subscription.deleted
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
      } else {
        // Outros tipos de evento podem ser tratados aqui no futuro
        // (ex.: invoice.payment_failed para cobranças recusadas,
        // customer.subscription.updated para mudanças de plano/status).
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
      // 500 faz o Stripe reentregar o evento automaticamente depois,
      // em vez de marcarmos como recebido um evento que falhou ao processar.
      return res.status(500).json({ error: "Erro ao processar evento." });
    }
  }
);

/* ============================================================
   🌐 MIDDLEWARE (sempre depois da rota /webhook)
   ============================================================ */

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* ============================================================
   🌍 ROTAS
   ============================================================ */

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/create-checkout-session", async (req, res) => {
  try {
    const { user_id, email } = req.body ?? {};

    if (!isValidUserId(user_id)) {
      return res.status(400).json({ error: "user_id inválido ou ausente." });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "email inválido ou ausente." });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],

      // Preço e produto definidos aqui no servidor, nunca a partir do
      // corpo da requisição — evita que o cliente manipule o valor cobrado.
      // Para um catálogo mais "gerenciável" em produção, considere criar
      // o Price uma vez no Dashboard do Stripe e usar
      // `price: process.env.STRIPE_PRICE_ID` no lugar de `price_data`.
      line_items: [
        {
          price_data: {
            currency: "brl",
            product_data: {
              name: "Plano Mensal Academia"
            },
            unit_amount: 9990,
            recurring: { interval: "month" }
          },
          quantity: 1
        }
      ],

      success_url: `${BASE_URL}/sucesso.html`,
      cancel_url: `${BASE_URL}/cancelado.html`,

      // 🔥 Liga o usuário à sessão de duas formas redundantes:
      // client_reference_id é um campo nativo do Stripe (sempre string,
      // sobrevive mesmo se algo der errado com metadata) e metadata
      // guarda também o e-mail.
      client_reference_id: String(user_id),
      metadata: {
        user_id: String(user_id),
        email: String(email)
      },

      // 🔑 Grava o user_id também na própria Subscription (não só na
      // Session). Essencial: o evento customer.subscription.deleted
      // entrega o objeto Subscription, sem qualquer referência à Session
      // original — sem isso não haveria como saber de quem é a
      // assinatura cancelada.
      subscription_data: {
        metadata: {
          user_id: String(user_id)
        }
      }
    });

    log("info", "Sessão de checkout criada", { session_id: session.id, user_id });
    res.json({ url: session.url });
  } catch (error) {
    log("error", "Erro ao criar sessão de checkout no Stripe", { error: error.message });
    // Não expõe detalhes internos do erro para o cliente.
    res.status(500).json({ error: "Não foi possível iniciar o pagamento." });
  }
});

/* ============================================================
   🛑 INICIALIZAÇÃO
   ============================================================ */

// Rede de segurança global — evita que um erro não tratado em qualquer
// parte do código derrube o processo de forma silenciosa.
process.on("unhandledRejection", (reason) => {
  log("error", "unhandledRejection", { reason: reason?.message || String(reason) });
});

process.on("uncaughtException", (err) => {
  log("error", "uncaughtException — encerrando processo", { error: err.message });
  // Deixe um gerenciador de processos (pm2, Docker restart policy, systemd)
  // reiniciar o servidor automaticamente após esse exit.
  process.exit(1);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});