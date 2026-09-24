/* ===================================================================
   NexTep Solutions — Main JavaScript
   =================================================================== */

(function () {
  'use strict';

  /* ===== HEADER SCROLL ===== */
  const header = document.getElementById('header');
  if (header) {
    const onScroll = () => {
      header.classList.toggle('scrolled', window.scrollY > 50);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ===== MOBILE MENU ===== */
  const menuToggle = document.getElementById('menuToggle');
  const mobileNav = document.getElementById('mobileNav');
  if (menuToggle && mobileNav) {
    menuToggle.addEventListener('click', () => {
      menuToggle.classList.toggle('active');
      mobileNav.classList.toggle('active');
      document.body.style.overflow = mobileNav.classList.contains('active') ? 'hidden' : '';
    });
    mobileNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        menuToggle.classList.remove('active');
        mobileNav.classList.remove('active');
        document.body.style.overflow = '';
      });
    });
  }

  /* ===== SMOOTH SCROLL ===== */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        const offset = 80;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  /* ===== REVEAL ON SCROLL ===== */
  const revealElements = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-stagger');
  if (revealElements.length) {
    const revealObserver = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );
    revealElements.forEach(el => revealObserver.observe(el));
  }

  /* ===== FAQ ACCORDION ===== */
  document.querySelectorAll('.faq-item').forEach(item => {
    const btn = item.querySelector('.faq-question');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const wasActive = item.classList.contains('active');
      item.closest('.faq').querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));
      if (!wasActive) item.classList.add('active');
    });
  });

  /* ===== FILTER BUTTONS ===== */
  document.querySelectorAll('.filters').forEach(filterGroup => {
    filterGroup.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        filterGroup.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.dataset.filter;
        const target = filterGroup.dataset.target;
        if (!target) return;
        document.querySelectorAll(target).forEach(card => {
          if (filter === 'all' || card.dataset.category === filter) {
            card.style.display = '';
            card.style.opacity = '0';
            requestAnimationFrame(() => {
              card.style.transition = 'opacity 0.4s ease';
              card.style.opacity = '1';
            });
          } else {
            card.style.display = 'none';
          }
        });
      });
    });
  });

  /* ===== MODAL ===== */
  window.openModal = function (id) {
    const overlay = document.getElementById(id);
    if (overlay) {
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  };
  window.closeModal = function (id) {
    const overlay = document.getElementById(id);
    if (overlay) {
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  };
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  });

  /* ===== TOAST ===== */
  window.showToast = function (message, type = 'success') {
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = 'toast toast--' + type;
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });
    setTimeout(() => toast.classList.remove('show'), 4000);
  };

  /* ===== FORM HANDLING ===== */
  // URL do Google Apps Script (Deploy > Web App > copie a URL aqui)
  const FORMS_ENDPOINT = 'COLE_AQUI_A_URL_DO_SEU_APPS_SCRIPT';

  document.querySelectorAll('form[data-type]').forEach(form => {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const type = form.dataset.type;
      const data = Object.fromEntries(new FormData(form));
      data._type = type;
      data._timestamp = new Date().toISOString();
      data._page = window.location.pathname;

      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn?.textContent;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando...';
      }

      try {
        await fetch(FORMS_ENDPOINT, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(data)
        });
      } catch (err) {
        console.error('[NexTep] Falha no envio:', err);
      }

      console.log('[NexTep] Form submission:', data);
      form.reset();
      const messages = {
        lead: 'Recebemos sua mensagem. Nossa equipe entrará em contato em breve.',
        candidate: 'Recebemos sua candidatura. Nosso time poderá entrar em contato caso seu perfil avance no processo.',
        partner: 'Proposta de parceria enviada. Entraremos em contato em breve.',
        contact: 'Mensagem enviada com sucesso. Responderemos em breve.'
      };
      showToast(messages[type] || 'Enviado com sucesso!');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
  });

  /* ===== HERO CANVAS ===== */
  const canvas = document.getElementById('heroCanvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    const hero = canvas.closest('.hero');
    let w, h, particles = [], time = 0, isVisible = true;

    const cfg = {
      count: 0,
      baseR: 1.2,
      maxR: 2.5,
      connDist: 90,
      waveAmp: 35,
      waveFreq: 0.008,
      waveSpd: 0.015,
      mouseInf: 130,
      mouseFrc: 0.25,
      color: '59, 130, 246'
    };

    let mouse = { x: -999, y: -999, on: false };
    hero.addEventListener('mousemove', e => {
      const r = hero.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
      mouse.on = true;
    });
    hero.addEventListener('mouseleave', () => { mouse.on = false; });

    function resize() {
      const dpr = Math.min(devicePixelRatio, 2);
      w = hero.offsetWidth;
      h = hero.offsetHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cfg.count = Math.floor((w * h) / 3200);
      init();
    }

    class P {
      constructor() { this.reset(); }
      reset() {
        this.x = Math.random() * w;
        this.y = Math.random() * h;
        this.bx = this.x;
        this.by = this.y;
        this.vx = (Math.random() - 0.5) * 0.3;
        this.vy = (Math.random() - 0.5) * 0.3;
        this.r = cfg.baseR + Math.random() * (cfg.maxR - cfg.baseR);
        this.o = 0.12 + Math.random() * 0.4;
        this.ph = Math.random() * Math.PI * 2;
        this.ds = 0.2 + Math.random() * 0.3;
        this.dp = Math.random() * Math.PI * 2;
      }
      update(sy) {
        const wy = Math.sin(this.x * cfg.waveFreq + time + this.ph) * cfg.waveAmp;
        const sw = Math.sin(this.x * 0.004 + sy * 0.01 + this.ph) * (sy * 0.12);
        this.dp += this.ds * 0.01;
        const dx = Math.sin(this.dp) * 0.4;
        const dy = Math.cos(this.dp * 0.7) * 0.25;
        let mx = 0, my = 0;
        if (mouse.on) {
          const ddx = this.x - mouse.x, ddy = this.y - mouse.y;
          const dist = Math.sqrt(ddx * ddx + ddy * ddy);
          if (dist < cfg.mouseInf && dist > 0) {
            const f = (cfg.mouseInf - dist) / cfg.mouseInf;
            mx = (ddx / dist) * f * cfg.mouseFrc * 3;
            my = (ddy / dist) * f * cfg.mouseFrc * 3;
          }
        }
        const so = sy * 0.07 * (this.y / h);
        this.x += this.vx + dx + mx;
        this.y = this.by + wy + sw + so + dy + my;
        if (this.x < -10) this.x = w + 10;
        if (this.x > w + 10) this.x = -10;
        if (this.y < -50) this.by = h + 50;
        if (this.y > h + 50) this.by = -50;
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${cfg.color}, ${this.o})`;
        ctx.fill();
      }
    }

    function init() {
      particles = [];
      for (let i = 0; i < cfg.count; i++) particles.push(new P());
    }

    function connections() {
      const max = cfg.connDist;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < max) {
            const o = (1 - d / max) * 0.1;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(${cfg.color}, ${o})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
    }

    function waveLines(sy) {
      const lines = 5;
      for (let l = 0; l < lines; l++) {
        ctx.beginPath();
        const lo = l * (h / lines) + Math.sin(time * 0.3 + l) * 25;
        const so = sy * 0.04 * (l / lines);
        for (let x = 0; x <= w; x += 3) {
          const y = lo + so +
            Math.sin(x * 0.006 + time * 0.5 + l * 1.2) * 20 +
            Math.sin(x * 0.012 + time * 0.3 + l) * 12;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        const o = 0.02 + (l / lines) * 0.03;
        ctx.strokeStyle = `rgba(${cfg.color}, ${o})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    function animate() {
      if (!isVisible) { requestAnimationFrame(animate); return; }
      const sy = window.scrollY;
      time += cfg.waveSpd;
      ctx.clearRect(0, 0, w, h);
      waveLines(sy);
      particles.forEach(p => { p.update(sy); p.draw(); });
      connections();
      requestAnimationFrame(animate);
    }

    const obs = new IntersectionObserver(e => { isVisible = e[0].isIntersecting; }, { threshold: 0 });
    obs.observe(hero);
    resize();
    animate();
    window.addEventListener('resize', resize);
  }

  /* ===== COUNTER ANIMATION ===== */
  const counters = document.querySelectorAll('[data-count]');
  if (counters.length) {
    const counterObserver = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !entry.target.dataset.counted) {
            entry.target.dataset.counted = 'true';
            const target = entry.target;
            const value = target.dataset.count;
            const suffix = target.dataset.suffix || '';
            const prefix = target.dataset.prefix || '';
            const num = parseInt(value.replace(/\D/g, ''), 10);
            const duration = 1500;
            const start = performance.now();
            function step(now) {
              const progress = Math.min((now - start) / duration, 1);
              const eased = 1 - Math.pow(1 - progress, 3);
              target.textContent = prefix + Math.floor(num * eased) + suffix;
              if (progress < 1) requestAnimationFrame(step);
              else target.textContent = prefix + value + suffix;
            }
            requestAnimationFrame(step);
          }
        });
      },
      { threshold: 0.5 }
    );
    counters.forEach(c => counterObserver.observe(c));
  }

})();
