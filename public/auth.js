import { supabase } from "./supabase.js";

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const statusEl = document.getElementById("status");

function setStatus(message, type = "") {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = type;
}

function getCredentials() {
  const email = emailInput?.value.trim();
  const password = passwordInput?.value;

  if (!email || !password) {
    setStatus("Preencha e-mail e senha.", "error");
    return null;
  }

  return { email, password };
}

//
// 👤 CADASTRO
//
async function registerUser() {
  const creds = getCredentials();
  if (!creds) return;

  setStatus("Criando conta...");

  const { data, error } = await supabase.auth.signUp({
    email: creds.email,
    password: creds.password
  });

  if (error) {
    console.error(error);
    setStatus("Erro: " + error.message, "error");
    return;
  }

  setStatus("Conta criada! Verifique seu e-mail se necessário.", "success");
  console.log("Cadastro:", data.user);
}

//
// 🔑 LOGIN
//
async function loginUser() {
  const creds = getCredentials();
  if (!creds) return;

  setStatus("Fazendo login...");

  const { data, error } = await supabase.auth.signInWithPassword({
    email: creds.email,
    password: creds.password
  });

  if (error) {
    console.error(error);
    setStatus("Erro login: " + error.message, "error");
    return;
  }

  setStatus("Login OK! User ID: " + data.user.id, "success");
  console.log("Login:", data.user);
}

//
// 👀 USER ATUAL
//
async function getUser() {
  setStatus("Buscando usuário...");

  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    setStatus("Nenhum usuário logado.", "error");
    return null;
  }

  setStatus(
    "Logado:\n" + data.user.email + "\nID: " + data.user.id,
    "success"
  );

  console.log("User:", data.user);
  return data.user;
}

//
// 🚪 LOGOUT
//
async function logoutUser() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    setStatus("Erro logout: " + error.message, "error");
    return;
  }

  setStatus("Logout realizado.", "success");
}

//
// 💳 PAGAMENTO STRIPE
//
async function pagar() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    setStatus("Você precisa estar logado para pagar.", "error");
    return;
  }

  const res = await fetch("/create-checkout-session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      user_id: user.id,
      email: user.email
    })
  });

  const data = await res.json();

  if (!data.url) {
    setStatus("Erro ao criar pagamento.", "error");
    return;
  }

  window.location.href = data.url;
}

//
// 🔘 EVENTS
//
document.getElementById("btn-register")?.addEventListener("click", registerUser);
document.getElementById("btn-login")?.addEventListener("click", loginUser);
document.getElementById("btn-getuser")?.addEventListener("click", getUser);
document.getElementById("btn-logout")?.addEventListener("click", logoutUser);
document.getElementById("btn-pagar")?.addEventListener("click", pagar);