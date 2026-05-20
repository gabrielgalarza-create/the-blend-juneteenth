// Tappable programming cards: toggle .is-open, pause parent rail auto-scroll, fire Amplitude event
document.querySelectorAll('[data-card]').forEach((card) => {
  card.addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    if (e.target.closest('.rail__nav')) return;
    if (card.hasAttribute('aria-hidden')) return;
    const wasOpen = card.classList.contains('is-open');
    card.classList.toggle('is-open');

    // Pause the parent rail's auto-scroll permanently once a card is opened
    const rail = card.closest('[data-rail]');
    if (rail && rail.__stopAuto) rail.__stopAuto(true);

    if (!wasOpen && window.amplitude) {
      const title = card.querySelector('.card__title');
      window.amplitude.track('programming_card_expanded', {
        zone: title ? title.textContent.trim() : 'unknown'
      });
    }
  });
});

// Carousel rails: arrow nav + gentle auto-scroll until user interacts
document.querySelectorAll('[data-rail]').forEach((rail) => {
  const viewport = rail.querySelector('.rail__viewport');
  const track = rail.querySelector('.rail__track');
  const prevBtn = rail.querySelector('.rail__nav--prev');
  const nextBtn = rail.querySelector('.rail__nav--next');
  if (!viewport || !track) return;

  let autoTimer = null;
  let stopped = false;

  const stepSize = () => {
    const card = track.querySelector('.card--rail');
    if (!card) return viewport.clientWidth * 0.8;
    const styles = getComputedStyle(track);
    const gap = parseFloat(styles.columnGap || styles.gap || '16');
    return card.offsetWidth + gap;
  };

  const updateArrows = () => {
    if (!prevBtn || !nextBtn) return;
    const max = viewport.scrollWidth - viewport.clientWidth - 2;
    const atStart = viewport.scrollLeft <= 2;
    const atEnd = viewport.scrollLeft >= max;
    prevBtn.style.opacity = atStart ? '0.3' : '1';
    nextBtn.style.opacity = atEnd ? '0.3' : '1';
    prevBtn.disabled = atStart;
    nextBtn.disabled = atEnd;
  };

  const startAuto = () => {
    if (stopped || autoTimer) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    autoTimer = setInterval(() => {
      const max = viewport.scrollWidth - viewport.clientWidth - 2;
      if (viewport.scrollLeft >= max) {
        viewport.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        viewport.scrollBy({ left: stepSize(), behavior: 'smooth' });
      }
    }, 4200);
  };

  const stopAuto = (permanent) => {
    if (autoTimer) clearInterval(autoTimer);
    autoTimer = null;
    if (permanent) stopped = true;
  };
  rail.__stopAuto = stopAuto;

  prevBtn?.addEventListener('click', () => {
    stopAuto(true);
    viewport.scrollBy({ left: -stepSize(), behavior: 'smooth' });
  });
  nextBtn?.addEventListener('click', () => {
    stopAuto(true);
    viewport.scrollBy({ left: stepSize(), behavior: 'smooth' });
  });

  rail.addEventListener('mouseenter', () => stopAuto(false));
  rail.addEventListener('mouseleave', () => { if (!stopped) startAuto(); });
  viewport.addEventListener('touchstart', () => stopAuto(true), { passive: true });
  viewport.addEventListener('wheel', () => stopAuto(true), { passive: true });

  viewport.addEventListener('scroll', updateArrows, { passive: true });
  updateArrows();

  // Start auto after a brief delay so the page settles first
  setTimeout(startAuto, 2000);
});

// Reveal-on-scroll for non-marquee cards (marquee cards animate via the track)
const io = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
      io.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.partner, .stat, .aud, .vendor').forEach((el) => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(14px)';
  el.style.transition = 'opacity .5s ease, transform .5s ease';
  io.observe(el);
});

// Custom Amplitude tracking for high-signal interactions
(function () {
  function track(name, props) {
    if (window.amplitude && typeof window.amplitude.track === 'function') {
      window.amplitude.track(name, props || {});
    }
  }

  // Pre-register CTA clicks (any of the pre-register buttons or links)
  document.querySelectorAll(
    '[data-rsvp-open], a[href="#register"], a[href*="overthetopxp.com/sffitfest"]'
  ).forEach((el) => {
    el.addEventListener('click', () => {
      const section = el.closest('section');
      track('cta_pre_register_clicked', {
        location: section ? section.id || 'unknown' : 'nav',
        text: el.textContent.trim()
      });
    });
  });

  // Nav link clicks (which sections people are jumping to)
  document.querySelectorAll('.nav__links a').forEach((el) => {
    el.addEventListener('click', () => {
      track('nav_link_clicked', { section: el.getAttribute('href') });
    });
  });

  // Hero secondary CTA
  const heroSee = document.querySelector('.hero__ctas a[href="#programming"]');
  if (heroSee) {
    heroSee.addEventListener('click', () => track('hero_see_programming_clicked'));
  }

  // Partner email link
  const sponsorEmail = document.querySelector('a[href^="mailto:gabrgalarza"]');
  if (sponsorEmail) {
    sponsorEmail.addEventListener('click', () => track('sponsor_email_clicked'));
  }
})();

