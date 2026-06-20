document.addEventListener('DOMContentLoaded', () => {

  window.addEventListener('scroll', () => {
    const header = document.getElementById('siteHeader');
    if (header) {
      header.classList.toggle('scrolled', window.scrollY > 40);
    }
  });

  function toggleMenu() {
    const menu = document.getElementById('navMenu');
    if (menu) menu.classList.toggle('open');
  }

  function openMainVideo(el) {
    if (!el) return;

    el.innerHTML = `
      <iframe 
        src="https://www.youtube.com/embed/5Lb6Rh8ZqQ4?autoplay=1"
        style="width:100%;height:500px;border:none;display:block;"
        allowfullscreen>
      </iframe>
    `;
  }

  function toggleFaq(btn) {
    if (!btn) return;

    const item = btn.parentElement;
    if (!item) return;

    const answer = item.querySelector('.faq-answer');
    const isOpen = item.classList.contains('open');

    document.querySelectorAll('.faq-item.open').forEach(other => {
      if (other !== item) {
        other.classList.remove('open');
        const ans = other.querySelector('.faq-answer');
        if (ans) ans.style.maxHeight = null;
      }
    });

    if (!answer) return;

    if (isOpen) {
      item.classList.remove('open');
      answer.style.maxHeight = null;
    } else {
      item.classList.add('open');
      answer.style.maxHeight = answer.scrollHeight + 'px';
    }
  }

  /* =========================
     REVEAL ANIMATION
  ========================= */
  const revealEls = document.querySelectorAll('.reveal');

  if (revealEls.length > 0) {
    const revealObs = new IntersectionObserver(entries => {
      entries.forEach((e, i) => {
        if (e.isIntersecting) {
          e.target.style.transitionDelay = (i % 4) * 0.1 + 's';
          e.target.classList.add('visible');
          revealObs.unobserve(e.target);
        }
      });
    }, { threshold: 0.1 });

    revealEls.forEach(el => revealObs.observe(el));
  }

  /* =========================
     COUNT ANIMATION
  ========================= */
  const countEls = document.querySelectorAll('.stat-number[data-target]');

  if (countEls.length > 0) {
    const countObs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const el = e.target;
          const target = parseInt(el.getAttribute('data-target'));
          if (!target) return;

          let current = 0;
          const step = target / 60;

          const timer = setInterval(() => {
            current += step;

            if (current >= target) {
              current = target;
              clearInterval(timer);
            }

            const isThousands = target >= 1000;

            el.textContent = isThousands
              ? '+' + Math.floor(current).toLocaleString('pt-BR')
              : '+' + Math.floor(current);

          }, 25);

          countObs.unobserve(el);
        }
      });
    }, { threshold: 0.5 });

    countEls.forEach(el => countObs.observe(el));
  }

  /* =========================
     CONTACT BUTTON
  ========================= */
  const btnForm = document.querySelector('.btn-form');

  if (btnForm) {
    btnForm.addEventListener('click', function () {
      const inputs = document.querySelectorAll('.contact-right input, .contact-right textarea');

      let ok = true;
      inputs.forEach(i => {
        if (!i.value.trim()) ok = false;
      });

      if (ok) {
        this.textContent = '✓ MENSAGEM ENVIADA!';
        this.style.background = '#25d366';

        setTimeout(() => {
          this.textContent = 'ENVIAR MENSAGEM';
          this.style.background = '';
        }, 3000);

      } else {
        this.textContent = 'PREENCHA TODOS OS CAMPOS';
        this.style.background = '#e74c3c';

        setTimeout(() => {
          this.textContent = 'ENVIAR MENSAGEM';
          this.style.background = '';
        }, 2500);
      }
    });
  }

  /* =========================
     RIPPLE EFFECT
  ========================= */
  function addRipple(e) {
    const btn = e.currentTarget;
    if (!btn) return;

    const circle = document.createElement('span');
    const diameter = Math.max(btn.clientWidth, btn.clientHeight);
    const radius = diameter / 2;

    circle.style.width = circle.style.height = diameter + 'px';
    circle.style.left = (e.clientX - btn.offsetLeft - radius) + 'px';
    circle.style.top = (e.clientY - btn.offsetTop - radius) + 'px';
    circle.classList.add('ripple');

    const ripple = btn.querySelector('.ripple');
    if (ripple) ripple.remove();

    btn.appendChild(circle);
  }

  const rippleBtns = document.querySelectorAll(
    '.btn-primary, .btn-ghost, .btn-plan, .header-cta, .header-login-btn, .btn-form'
  );

  rippleBtns.forEach(btn => {
    btn.addEventListener('click', addRipple);
  });

});