/**
 * pagamento.js
 * ------------------------------------------------------------------
 * Integração dos botões de plano com o backend de pagamento (index.html).
 *
 * Importa a função pagar() de auth.js e conecta todos os botões
 * .btn-plan[data-plan-id] ao fluxo Stripe Checkout.
 *
 * Se o usuário não estiver logado, pagar() redireciona para login.html.
 * ------------------------------------------------------------------
 */

import { pagar } from './auth.js';

// Conecta todos os botões de plano ao backend real.
document.querySelectorAll('.btn-plan[data-plan-id]').forEach(btn => {
  btn.addEventListener('click', () => {
    const planId = btn.dataset.planId;
    pagar(planId, btn);
  });
});
