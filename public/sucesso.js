/**
 * sucesso.js
 * ------------------------------------------------------------------
 * Script da página de confirmação de pagamento (sucesso.html).
 *
 * O session_id enviado pelo Stripe na URL NÃO é exibido ao usuário
 * por razões de segurança e UX — ele é apenas registrado em console
 * para fins de debug, sem aparecer na interface.
 * ------------------------------------------------------------------
 */

const params = new URLSearchParams(window.location.search);
const sessionId = params.get('session_id');

if (sessionId) {
  // Registra apenas no console (visível ao desenvolvedor via DevTools),
  // nunca na interface pública.
  console.debug('[sucesso] session_id:', sessionId);
}
