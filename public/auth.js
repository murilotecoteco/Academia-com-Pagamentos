/**
 * auth.js
 * ------------------------------------------------------------------
 * Camada de autenticação e pagamento do frontend.
 *
 * Responsabilidades:
 *  - Cadastro e login de usuários via Supabase Auth
 *  - Logout e obtenção do usuário autenticado (ponto único: getCurrentUser)
 *  - Início do fluxo de pagamento via Stripe Checkout, chamando o backend
 *    em POST /create-checkout-session
 *  - Feedback de status para o usuário, com fallback seguro caso o
 *    elemento de status não exista no DOM
 *
 * Seções: INTERFACE → USUÁRIO → AUTENTICAÇÃO → PAGAMENTO → EVENTOS
 * ------------------------------------------------------------------
 */

import { supabase } from "./supabase.js";

/* ============================================================
   INTERFACE — referências de DOM, status e validação de formulário
   ============================================================ */

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const statusEl = document.getElementById("status");

const btnRegister = document.getElementById("btn-register");
const btnLogin = document.getElementById("btn-login");
const btnGetUser = document.getElementById("btn-getuser");
const btnLogout = document.getElementById("btn-logout");
const btnPagar = document.getElementById("btn-pagar");

// Tamanho mínimo de senha — deve ser igual ou maior que o mínimo
// configurado em Supabase > Authentication > Policies (padrão: 6).
const MIN_PASSWORD_LENGTH = 6;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Exibe uma mensagem de status para o usuário.
 * Se #status não existir no DOM, usa console.log/alert como fallback
 * seguro (nunca lança erro por elemento ausente).
 */
function setStatus(message, type = "") {
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = type;
    return;
  }

  if (type === "error") {
    console.error(message);
    alert(message);
  } else {
    console.log(message);
  }
}

/**
 * Lê e valida e-mail/senha dos campos do formulário:
 *  - presença dos dois campos
 *  - formato de e-mail
 *  - tamanho mínimo de senha
 * Retorna null (já exibindo o status de erro) se algo for inválido.
 */
function getCredentials() {
  const email = emailInput?.value?.trim();
  const password = passwordInput?.value;

  if (!email || !password) {
    setStatus("Preencha e-mail e senha.", "error");
    return null;
  }

  if (!EMAIL_REGEX.test(email)) {
    setStatus("Informe um e-mail válido.", "error");
    return null;
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    setStatus(`A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`, "error");
    return null;
  }

  return { email, password };
}

/* ============================================================
   USUÁRIO — ponto único de acesso ao usuário autenticado
   ============================================================ */

/**
 * Única função do arquivo que chama supabase.auth.getUser().
 * Usada por todas as rotinas que precisam saber quem está logado
 * (verificação de usuário, logout e pagamento), evitando chamadas
 * duplicadas e lógica de validação repetida.
 *
 * @param {boolean} silent - se true, não exibe status de erro (quem chamou decide a mensagem)
 * @returns {Promise<object|null>} usuário autenticado ou null
 */
async function getCurrentUser(silent = false) {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    if (!silent) setStatus("Nenhum usuário logado.", "error");
    return null;
  }

  return data.user;
}

/* ============================================================
   AUTENTICAÇÃO — cadastro, login, logout e verificação
   ============================================================ */

async function registerUser() {
  const creds = getCredentials();
  if (!creds) return;

  setStatus("Criando conta...");

  const { data, error } = await supabase.auth.signUp({
    email: creds.email,
    password: creds.password
  });

  if (error) {
    setStatus("Erro ao criar conta: " + error.message, "error");
    return;
  }

  console.log("Cadastro:", data.user);
  setStatus("Conta criada com sucesso!", "success");
}

async function loginUser() {
  const creds = getCredentials();
  if (!creds) return;

  setStatus("Fazendo login...");

  const { data, error } = await supabase.auth.signInWithPassword({
    email: creds.email,
    password: creds.password
  });

  if (error) {
    setStatus("Erro ao fazer login: " + error.message, "error");
    return;
  }

  console.log("Login:", data.user);
  setStatus("Login realizado!", "success");
}

async function logoutUser() {
  // Usa getCurrentUser para confirmar que existe sessão antes de sair,
  // evitando uma chamada de signOut desnecessária quando já não há usuário.
  const user = await getCurrentUser(true);

  if (!user) {
    setStatus("Nenhum usuário logado para sair.", "error");
    return;
  }

  const { error } = await supabase.auth.signOut();

  if (error) {
    setStatus("Erro ao sair: " + error.message, "error");
    return;
  }

  setStatus("Logout realizado.", "success");
}

/**
 * Handler de UI para mostrar o usuário atual.
 * Toda a lógica de obtenção/validação vive em getCurrentUser();
 * aqui só cuidamos da mensagem específica deste botão.
 */
async function showCurrentUser() {
  const user = await getCurrentUser();
  if (!user) return; // getCurrentUser já exibiu o status de erro

  setStatus(`Logado: ${user.email}`, "success");
}

/* ============================================================
   PAGAMENTO — Stripe Checkout
   ============================================================ */

// Evita que cliques duplicados no botão de pagamento criem mais de
// uma sessão de checkout ao mesmo tempo (cada clique gera um session_id
// diferente no Stripe, então a deduplicação do backend não pega isso).
let isProcessingPayment = false;

async function pagar() {
  if (isProcessingPayment) return;

  const user = await getCurrentUser(true);
  if (!user) {
    setStatus("Faça login primeiro.", "error");
    return;
  }

  isProcessingPayment = true;
  if (btnPagar) btnPagar.disabled = true;
  setStatus("Redirecionando para o pagamento...");

  try {
    let response;
    try {
      response = await fetch("/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          email: user.email
        })
      });
    } catch (networkError) {
      console.error(networkError);
      setStatus("Erro de conexão ao iniciar o pagamento.", "error");
      return;
    }

    if (!response.ok) {
      setStatus(`Erro ao criar checkout (HTTP ${response.status}).`, "error");
      return;
    }

    let result;
    try {
      result = await response.json();
    } catch (parseError) {
      console.error(parseError);
      setStatus("Resposta inválida do servidor de pagamento.", "error");
      return;
    }

    if (!result?.url) {
      setStatus("Erro ao criar checkout: URL não recebida.", "error");
      return;
    }

    window.location.href = result.url;
  } finally {
    isProcessingPayment = false;
    if (btnPagar) btnPagar.disabled = false;
  }
}

/* ============================================================
   EVENTOS — ligação das funções com a interface
   ============================================================ */

btnRegister?.addEventListener("click", registerUser);
btnLogin?.addEventListener("click", loginUser);
btnGetUser?.addEventListener("click", showCurrentUser);
btnLogout?.addEventListener("click", logoutUser);
btnPagar?.addEventListener("click", pagar);