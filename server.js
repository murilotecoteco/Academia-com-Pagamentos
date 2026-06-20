require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const Stripe = require("stripe");

const supabase = require("./supabaseClient");

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

//
// 🔥 WEBHOOK (TEM QUE VIR ANTES DO express.json)
//
app.post(
  "/webhook",
  bodyParser.raw({ type: "application/json" }),
  async (req, res) => {

    const sig = req.headers["stripe-signature"];

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("❌ Webhook inválido:", err.message);
      return res.status(400).send("Webhook Error");
    }

    //
    // 💰 PAGAMENTO CONFIRMADO
    //
    if (event.type === "checkout.session.completed") {

      const session = event.data.object;

      const sessionId = session.id;
      const email = session.customer_details?.email;
      const amount = session.amount_total;

      // 🔥 IMPORTANTE: USER ID DO STRIPE
      const user_id = session.metadata?.user_id;

      console.log("💰 Pagamento confirmado!");
      console.log("Cliente:", email);
      console.log("User ID:", user_id);
      console.log("Valor:", amount);

      //
      // 🔍 VERIFICAR DUPLICAÇÃO
      //
      const { data: existing } = await supabase
        .from("payments")
        .select("*")
        .eq("session_id", sessionId)
        .single();

      if (existing) {
        console.log("⚠️ Pagamento já registrado");
        return res.json({ received: true });
      }

      //
      // 💾 SALVAR NO SUPABASE (COM USER ID)
      //
      const { error } = await supabase
        .from("payments")
        .insert([
          {
            session_id: sessionId,
            email,
            amount,
            user_id,
            status: "paid"
          }
        ]);

      if (error) {
        console.error("❌ Erro Supabase:", error.message);
      } else {
        console.log("✅ Pagamento salvo com user_id!");
      }
    }

    res.json({ received: true });
  }
);

//
// 🌐 MIDDLEWARE
//
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

//
// 🏠 HOME
//
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

//
// 💳 CREATE CHECKOUT (COM USER ID)
//
app.post("/create-checkout-session", async (req, res) => {
  try {

    const { user_id, email } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: "User ID obrigatório" });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",

      line_items: [
        {
          price_data: {
            currency: "brl",
            product_data: {
              name: "Plano Mensal Academia"
            },
            unit_amount: 9990
          },
          quantity: 1
        }
      ],

      // 🔥 ENVIANDO USER ID PRO STRIPE
      metadata: {
        user_id,
        email
      },

      success_url: "http://localhost:3000/sucesso.html",
      cancel_url: "http://localhost:3000/cancelado.html"
    });

    res.json({ url: session.url });

  } catch (error) {
    console.error("Erro Stripe:", error.message);
    res.status(500).json({ error: error.message });
  }
});

//
// 🚀 START SERVER
//
app.listen(3000, () => {
  console.log("🚀 Servidor rodando em http://localhost:3000");
});