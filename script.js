// Pre-Register modal: open our custom waitlist modal, submit to Mailchimp via JSONP
(function () {
  const modal = document.getElementById('rsvpModal');
  const formView = document.getElementById('rsvpFormView');
  const successView = document.getElementById('rsvpSuccessView');
  const form = document.getElementById('rsvpForm');
  const submitBtn = document.getElementById('rsvpSubmit');
  const errorEl = document.getElementById('rsvpError');
  if (!modal || !form) return;

  // Mailchimp JSONP endpoint (same list as the Webflow form on overthetopxp.com)
  const MAILCHIMP_BASE = 'https://gabrielgalarza.us18.list-manage.com/subscribe/post-json';
  const MC_PARAMS = {
    u: '770afc94ea851d5a95b24c393',
    id: '2da8ac5900',
    f_id: '0031a3e6f0',
    tags: '2993184'
  };

  function openModal() {
    formView.hidden = false;
    successView.hidden = true;
    errorEl.hidden = true;
    submitBtn.disabled = false;
    submitBtn.textContent = 'Confirm';
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-rsvp-open');
    // Focus first input for keyboard users
    const firstInput = form.querySelector('input[type="text"]');
    if (firstInput) setTimeout(() => firstInput.focus(), 30);
  }
  function closeModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-rsvp-open');
  }

  document.querySelectorAll('[data-rsvp-open]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openModal();
      if (window.amplitude) {
        const section = btn.closest('section');
        window.amplitude.track('cta_pre_register_clicked', {
          location: section ? section.id || 'unknown' : 'nav'
        });
      }
    });
  });
  document.querySelectorAll('[data-rsvp-close]').forEach((el) => {
    el.addEventListener('click', closeModal);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
  });

  function showError(msg) {
    errorEl.textContent = msg || 'Something went wrong. Please try again.';
    errorEl.hidden = false;
    submitBtn.disabled = false;
    submitBtn.textContent = 'Confirm';
  }

  // JSONP submission so we can stay in the modal and show success/error inline
  function submitToMailchimp(data) {
    return new Promise((resolve, reject) => {
      const cb = 'mcCb_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      window[cb] = (response) => {
        delete window[cb];
        if (scriptEl.parentNode) scriptEl.parentNode.removeChild(scriptEl);
        resolve(response);
      };
      const params = new URLSearchParams({ ...MC_PARAMS, ...data, c: cb });
      const scriptEl = document.createElement('script');
      scriptEl.src = MAILCHIMP_BASE + '?' + params.toString();
      scriptEl.onerror = () => {
        delete window[cb];
        if (scriptEl.parentNode) scriptEl.parentNode.removeChild(scriptEl);
        reject(new Error('Network error'));
      };
      document.body.appendChild(scriptEl);
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;

    const fullName = form.FULLNAME.value.trim();
    const email = form.EMAIL.value.trim();
    const phone = form.PHONE.value.trim();

    if (!fullName || !email || !phone) {
      showError('Please fill in all fields.');
      return;
    }

    // Split full name into first + last for Mailchimp
    const parts = fullName.split(/\s+/);
    const fname = parts[0] || '';
    const lname = parts.slice(1).join(' ') || '';

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting…';

    try {
      const response = await submitToMailchimp({
        FNAME: fname,
        LNAME: lname,
        EMAIL: email,
        PHONE: phone
      });
      if (response && response.result === 'success') {
        formView.hidden = true;
        successView.hidden = false;
        if (window.amplitude) {
          window.amplitude.track('rsvp_submitted', { email_provided: true });
        }
      } else {
        // Mailchimp returns "Member Exists" errors with result: error, msg: ...
        const msg = (response && response.msg) || 'Something went wrong.';
        // Friendlier "already subscribed" message
        if (/already/i.test(msg) || /is already a list/i.test(msg)) {
          formView.hidden = true;
          successView.hidden = false;
        } else {
          showError(msg.replace(/<[^>]+>/g, ''));
        }
      }
    } catch (err) {
      showError('Network error. Please try again or email experienceott@gmail.com.');
    }
  });
})();

// Tappable programming cards: toggle .is-open, fire Amplitude event
document.querySelectorAll('[data-card]').forEach((card) => {
  card.addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    if (e.target.closest('.rail__nav')) return;
    if (card.hasAttribute('aria-hidden')) return;
    const wasOpen = card.classList.contains('is-open');
    card.classList.toggle('is-open');

    if (!wasOpen && window.amplitude) {
      const title = card.querySelector('.card__title');
      window.amplitude.track('programming_card_expanded', {
        zone: title ? title.textContent.trim() : 'unknown'
      });
    }
  });
});

// Carousel rails: continuous auto-scroll that seamlessly loops + arrow nav.
// We duplicate the track contents in JS so once the user (or auto-scroll)
// reaches the end of the original set, we silently jump scroll position
// back to the start of the duplicate set, giving an infinite-loop feel.
document.querySelectorAll('[data-rail]').forEach((rail) => {
  const viewport = rail.querySelector('.rail__viewport');
  const track = rail.querySelector('.rail__track');
  const prevBtn = rail.querySelector('.rail__nav--prev');
  const nextBtn = rail.querySelector('.rail__nav--next');
  if (!viewport || !track) return;

  // Clone all cards once to enable seamless looping. Clones are marked
  // aria-hidden so card-click handlers ignore them.
  const originals = Array.from(track.children);
  let originalsWidth = 0; // computed after layout
  originals.forEach((card) => {
    const clone = card.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    clone.setAttribute('tabindex', '-1');
    track.appendChild(clone);
  });

  const measure = () => {
    // Width of one original set (including the gap that follows it)
    const styles = getComputedStyle(track);
    const gap = parseFloat(styles.columnGap || styles.gap || '16') || 0;
    let w = 0;
    originals.forEach((c) => { w += c.offsetWidth + gap; });
    originalsWidth = w;
  };

  const stepSize = () => {
    const card = track.querySelector('.card--rail');
    if (!card) return viewport.clientWidth * 0.8;
    const styles = getComputedStyle(track);
    const gap = parseFloat(styles.columnGap || styles.gap || '16') || 0;
    return card.offsetWidth + gap;
  };

  // If scroll position has passed the originals set, wrap silently to
  // the equivalent position within the originals set (no smooth scroll).
  const normalize = () => {
    if (!originalsWidth) return;
    if (viewport.scrollLeft >= originalsWidth) {
      viewport.scrollLeft = viewport.scrollLeft - originalsWidth;
    } else if (viewport.scrollLeft < 0) {
      viewport.scrollLeft = viewport.scrollLeft + originalsWidth;
    }
  };

  let autoTimer = null;
  let hoverPaused = false;

  const tick = () => {
    if (hoverPaused) return;
    viewport.scrollBy({ left: stepSize(), behavior: 'smooth' });
  };

  const startAuto = () => {
    if (autoTimer) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    autoTimer = setInterval(tick, 4200);
  };

  const stopAuto = () => {
    if (autoTimer) clearInterval(autoTimer);
    autoTimer = null;
  };

  // Wrap after each smooth-scroll completes (~ 600ms is generous)
  let normalizeTimer = null;
  viewport.addEventListener('scroll', () => {
    clearTimeout(normalizeTimer);
    normalizeTimer = setTimeout(normalize, 500);
  }, { passive: true });

  prevBtn?.addEventListener('click', () => {
    viewport.scrollBy({ left: -stepSize(), behavior: 'smooth' });
  });
  nextBtn?.addEventListener('click', () => {
    viewport.scrollBy({ left: stepSize(), behavior: 'smooth' });
  });

  // Pause only while pointer is over the rail; resume on leave.
  // Auto-scroll never stops permanently — it always resumes.
  rail.addEventListener('mouseenter', () => { hoverPaused = true; });
  rail.addEventListener('mouseleave', () => { hoverPaused = false; });

  // Re-measure on resize
  window.addEventListener('resize', () => {
    requestAnimationFrame(measure);
  });

  // Wait for images to settle so widths are accurate
  if (document.readyState === 'complete') {
    measure();
  } else {
    window.addEventListener('load', measure, { once: true });
  }
  // Fallback in case the load event has already fired
  setTimeout(measure, 600);

  setTimeout(startAuto, 1800);
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

