// Tappable programming cards: toggle .is-open, pause parent marquee, fire Amplitude event
document.querySelectorAll('[data-card]').forEach((card) => {
  card.addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    if (card.hasAttribute('aria-hidden')) return; // ignore duplicate marquee clones
    const wasOpen = card.classList.contains('is-open');
    card.classList.toggle('is-open');

    // Pause the parent marquee track while any card is open
    const track = card.closest('.card-track');
    if (track) {
      const anyOpen = track.querySelector('.card.is-open');
      track.classList.toggle('is-paused', !!anyOpen);
    }

    if (!wasOpen && window.amplitude) {
      const title = card.querySelector('.card__title');
      window.amplitude.track('programming_card_expanded', {
        zone: title ? title.textContent.trim() : 'unknown'
      });
    }
  });
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

