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
   CAROUSEL
========================= */
let carouselIndex = 0;
let carouselSlides = [];
let carouselTrackEl = null;
let carouselDotsEl = null;

function updateCarousel() {
  if (!carouselTrackEl || carouselSlides.length === 0) return;

  const slideWidth = carouselSlides[0].getBoundingClientRect().width;
  const gap = parseFloat(getComputedStyle(carouselTrackEl).gap) || 0;

  carouselTrackEl.style.transform = `translateX(-${carouselIndex * (slideWidth + gap)}px)`;

  if (carouselDotsEl) {
    carouselDotsEl.querySelectorAll('.carousel-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === carouselIndex);
    });
  }
}

function moveCarousel(direction) {
  if (carouselSlides.length === 0) return;

  carouselIndex += direction;
  if (carouselIndex < 0) carouselIndex = carouselSlides.length - 1;
  if (carouselIndex >= carouselSlides.length) carouselIndex = 0;

  updateCarousel();
}

function goToSlide(index) {
  carouselIndex = index;
  updateCarousel();
}

document.addEventListener('DOMContentLoaded', () => {

  window.addEventListener('scroll', () => {
    const header = document.getElementById('siteHeader');
    if (header) {
      header.classList.toggle('scrolled', window.scrollY > 40);
    }
  });

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
     CAROUSEL INIT
  ========================= */
  carouselTrackEl = document.getElementById('carousel');
  carouselDotsEl = document.getElementById('carouselDots');

  if (carouselTrackEl) {
    carouselSlides = Array.from(carouselTrackEl.querySelectorAll('.carousel-slide'));

    if (carouselDotsEl && carouselSlides.length > 0) {
      carouselSlides.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
        dot.type = 'button';
        dot.setAttribute('aria-label', 'Ir para slide ' + (i + 1));
        dot.addEventListener('click', () => goToSlide(i));
        carouselDotsEl.appendChild(dot);
      });
    }

    updateCarousel();
    window.addEventListener('resize', updateCarousel);
  }

  /* =========================
     CONTACT BUTTON
  ========================= */
  const btnForm = document.querySelector('.btn-form');

  if (btnForm) {
    btnForm.addEventListener('click', function () {
      const nameInput = document.querySelector('.contact-right input[type="text"]');
      const phoneInput = document.querySelector('.contact-right input[type="tel"]');
      const selectInput = document.querySelector('.contact-right select');
      const textareaInput = document.querySelector('.contact-right textarea');

      const name = nameInput?.value?.trim() || '';
      const phone = phoneInput?.value?.trim() || '';
      const interest = selectInput?.value || '';
      const message = textareaInput?.value?.trim() || '';

      if (!name || !phone) {
        this.textContent = 'PREENCHA NOME E WHATSAPP';
        this.style.background = '#e74c3c';

        setTimeout(() => {
          this.textContent = 'ENVIAR MENSAGEM';
          this.style.background = '';
        }, 2500);
        return;
      }

      const waMessage = `Olá! Meu nome é ${name}.\nTelefone: ${phone}\nInteresse: ${interest}\nMensagem: ${message}`;
      const waUrl = `https://wa.me/5544998381478?text=${encodeURIComponent(waMessage)}`;

      this.textContent = '✓ REDIRECIONANDO...';
      this.style.background = '#25d366';

      setTimeout(() => {
        window.open(waUrl, '_blank');
        this.textContent = 'ENVIAR MENSAGEM';
        this.style.background = '';
      }, 500);
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


  /* =========================
     MOBILE MENU
  ========================= */
  const mobileToggle = document.getElementById('mobileToggle');
  if (mobileToggle) {
    mobileToggle.addEventListener('click', toggleMenu);
  }

  /* =========================
     CAROUSEL BUTTONS
  ========================= */
  const prevBtn = document.getElementById('carouselPrev');
  const nextBtn = document.getElementById('carouselNext');
  if (prevBtn) prevBtn.addEventListener('click', () => moveCarousel(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => moveCarousel(1));

  /* =========================
     VIDEO CONTAINER
  ========================= */
  const videoContainer = document.getElementById('mainVideoContainer');
  if (videoContainer) {
    videoContainer.addEventListener('click', () => openMainVideo(videoContainer));
  }

  /* =========================
     FAQ BUTTONS
  ========================= */
  document.querySelectorAll('.faq-question[data-faq-toggle]').forEach(btn => {
    btn.addEventListener('click', () => toggleFaq(btn));
  });

  /* =========================
     DYNAMIC COPYRIGHT YEAR
  ========================= */
  const footerYear = document.getElementById('footerYear');
  if (footerYear) {
    footerYear.textContent = new Date().getFullYear();
  }

});