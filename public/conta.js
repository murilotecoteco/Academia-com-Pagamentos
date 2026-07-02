/**
 * conta.js
 * ------------------------------------------------------------------
 * Lógica da página "Minha Conta" (minha-conta.html):
 *  - Confirma que há um usuário logado (redireciona para login.html
 *    caso contrário)
 *  - Busca os dados da assinatura em GET /minha-assinatura
 *  - Abre o Portal do Cliente Stripe via POST /create-portal-session
 *    (troca de cartão, faturas, dados cadastrais, cancelamento agendado
 *    para o fim do período — tudo configurado do lado do Stripe)
 * ------------------------------------------------------------------
 */

import { supabase } from "./supabase.js";

const userEmailEl = document.getElementById("user-email");
const cardLoadingEl = document.getElementById("card-loading");
const cardEmptyEl = document.getElementById("card-empty");
const cardSubEl = document.getElementById("card-subscription");

const planNameEl = document.getElementById("sub-plan");
const statusBadgeEl = document.getElementById("sub-status");
const periodLabelEl = document.getElementById("sub-period-label");
const periodEndEl = document.getElementById("sub-period-end");
const cancelNoticeEl = document.getElementById("sub-cancel-notice");

const btnPortal = document.getElementById("btn-portal");
const btnLogout = document.getElementById("btn-logout");
const portalStatusEl = document.getElementById("portal-status");

const PLAN_LABELS = {
  mensal: "Plano Mensal",
  trimestral: "Plano Trimestral",
  semestral: "Plano Semestral",
  anual: "Plano Anual"
};

const STATUS_LABELS = {
  active: { label: "Ativa", className: "badge-active" },
  trialing: { label: "Período de teste", className: "badge-active" },
  past_due: { label: "Pagamento pendente", className: "badge-warning" },
  canceled: { label: "Cancelada", className: "badge-canceled" },
  unpaid: { label: "Não paga", className: "badge-warning" },
  incomplete: { label: "Incompleta", className: "badge-warning" },
  incomplete_expired: { label: "Expirada", className: "badge-canceled" }
};

function formatDate(isoString) {
  if (!isoString) return "—";
  const date = new Date(isoString);
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function setPortalStatus(message, type = "") {
  if (!portalStatusEl) return;
  portalStatusEl.textContent = message;
  portalStatusEl.className = type;
}

function showEmptyState() {
  cardLoadingEl?.classList.add("hidden");
  cardSubEl?.classList.add("hidden");
  cardEmptyEl?.classList.remove("hidden");
}

function showSubscription(sub) {
  cardLoadingEl?.classList.add("hidden");
  cardEmptyEl?.classList.add("hidden");
  cardSubEl?.classList.remove("hidden");

  if (planNameEl) planNameEl.textContent = PLAN_LABELS[sub.plan] || sub.plan || "—";

  const statusInfo = STATUS_LABELS[sub.status] || { label: sub.status, className: "badge-warning" };
  if (statusBadgeEl) {
    statusBadgeEl.textContent = statusInfo.label;
    statusBadgeEl.className = `sub-badge ${statusInfo.className}`;
  }

  const isCanceled = sub.status === "canceled";
  // Cancelamento agendado pelo Portal: ainda ativo, mas não vai renovar.
  const isScheduledToCancel = !isCanceled && sub.cancel_at_period_end === true;

  if (periodEndEl) {
    periodEndEl.textContent = isCanceled
      ? formatDate(sub.canceled_at)
      : formatDate(sub.current_period_end);
  }

  if (periodLabelEl) {
    if (isCanceled) {
      periodLabelEl.textContent = "Cancelada em";
    } else if (isScheduledToCancel) {
      periodLabelEl.textContent = "Acesso até";
    } else {
      periodLabelEl.textContent = "Próxima cobrança";
    }
  }

  if (cancelNoticeEl) {
    cancelNoticeEl.classList.toggle("hidden", !isCanceled && !isScheduledToCancel);
    if (isScheduledToCancel) {
      cancelNoticeEl.textContent = "Cancelamento agendado — sem novas cobranças, acesso liberado até a data acima.";
    }
  }
}

/**
 * Redireciona o usuário para o Portal do Cliente Stripe, onde ele pode
 * trocar o cartão, ver/baixar faturas, atualizar dados cadastrais e
 * cancelar a assinatura (efetivado apenas no fim do período pago).
 */
async function abrirPortal(btnEl) {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData?.session;

  if (!session?.access_token) {
    window.location.href = "/login.html";
    return;
  }

  const originalText = btnEl?.textContent;
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.textContent = "Abrindo portal...";
  }
  setPortalStatus("");

  try {
    const response = await fetch("/create-portal-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`
      }
    });

    let result;
    try {
      result = await response.json();
    } catch (_) {
      result = null;
    }

    if (!response.ok) {
      setPortalStatus(result?.error || `Erro ao abrir o portal (HTTP ${response.status}).`, "error");
      return;
    }

    if (!result?.url) {
      setPortalStatus("Erro ao abrir o portal: URL não recebida.", "error");
      return;
    }

    window.location.href = result.url;
  } catch (err) {
    console.error(err);
    setPortalStatus("Erro de conexão. Verifique sua internet e tente novamente.", "error");
  } finally {
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.textContent = originalText;
    }
  }
}

async function carregarAssinatura(accessToken) {
  try {
    const response = await fetch("/minha-assinatura", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (response.status === 404) {
      showEmptyState();
      return;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const sub = await response.json();
    showSubscription(sub);
  } catch (err) {
    console.error(err);
    showEmptyState();
  }
}

async function init() {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData?.session;

  if (!session?.user) {
    window.location.href = "/login.html";
    return;
  }

  if (userEmailEl) userEmailEl.textContent = session.user.email;

  await carregarAssinatura(session.access_token);
}

btnPortal?.addEventListener("click", () => abrirPortal(btnPortal));

btnLogout?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "/login.html";
});

init();