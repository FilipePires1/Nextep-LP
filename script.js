// ===== THEME TOGGLE =====
const themeToggle = document.getElementById('themeToggle');
themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
});

// ===== HEADER SCROLL =====
const header = document.getElementById('header');
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});

// ===== MOBILE MENU =====
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mobileNav = document.getElementById('mobileNav');
const closeMobileNav = document.getElementById('closeMobileNav');
const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');

mobileMenuBtn.addEventListener('click', () => mobileNav.classList.add('active'));
closeMobileNav.addEventListener('click', () => mobileNav.classList.remove('active'));
mobileNavLinks.forEach(link => {
    link.addEventListener('click', () => mobileNav.classList.remove('active'));
});

// ===== SMOOTH SCROLL =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

// ===== REVEAL ON SCROLL =====
const revealElements = document.querySelectorAll('.reveal, .reveal-stagger');
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, { threshold: 0.1 });

revealElements.forEach(el => revealObserver.observe(el));

// ===== FAQ ACCORDION =====
const faqItems = document.querySelectorAll('.faq-item');
faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    question.addEventListener('click', () => {
        const isActive = item.classList.contains('active');
        faqItems.forEach(i => i.classList.remove('active'));
        if (!isActive) {
            item.classList.add('active');
        }
    });
});

// ============================================================================
// ===== PARTICLE WAVE BACKGROUND - HERO SECTION =====
// ============================================================================

(function() {
    const canvas = document.getElementById('heroCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const hero = document.querySelector('.hero');

    let width, height;
    let particles = [];
    let time = 0;
    let isVisible = true;

    const config = {
        particleCount: 0,
        baseRadius: 1.2,
        maxRadius: 2.5,
        connectionDistance: 80,
        waveAmplitude: 40,
        waveFrequency: 0.008,
        waveSpeed: 0.02,
        mouseInfluence: 120,
        mouseForce: 0.3,
        colorLight: '192, 192, 200',
        colorDark: '192, 192, 200',
    };

    let mouse = { x: -1000, y: -1000, active: false };
    hero.addEventListener('mousemove', (e) => {
        const rect = hero.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
        mouse.active = true;
    });
    hero.addEventListener('mouseleave', () => {
        mouse.active = false;
    });

    function resize() {
        const dpr = Math.min(window.devicePixelRatio, 2);
        width = hero.offsetWidth;
        height = hero.offsetHeight;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const area = width * height;
        config.particleCount = Math.floor(area / 2800);
        initParticles();
    }

    class Particle {
        constructor() {
            this.reset();
        }

        reset() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.baseX = this.x;
            this.baseY = this.y;
            this.vx = (Math.random() - 0.5) * 0.3;
            this.vy = (Math.random() - 0.5) * 0.3;
            this.radius = config.baseRadius + Math.random() * (config.maxRadius - config.baseRadius);
            this.opacity = 0.15 + Math.random() * 0.5;
            this.phase = Math.random() * Math.PI * 2;
            this.driftSpeed = 0.2 + Math.random() * 0.4;
            this.driftPhase = Math.random() * Math.PI * 2;
        }

        update(scrollY) {
            const waveY = Math.sin(this.x * config.waveFrequency + time + this.phase) * config.waveAmplitude;
            const scrollWave = Math.sin(this.x * 0.004 + scrollY * 0.01 + this.phase) * (scrollY * 0.15);

            this.driftPhase += this.driftSpeed * 0.01;
            const driftX = Math.sin(this.driftPhase) * 0.5;
            const driftY = Math.cos(this.driftPhase * 0.7) * 0.3;

            let mouseFx = 0, mouseFy = 0;
            if (mouse.active) {
                const dx = this.x - mouse.x;
                const dy = this.y - mouse.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < config.mouseInfluence && dist > 0) {
                    const force = (config.mouseInfluence - dist) / config.mouseInfluence;
                    mouseFx = (dx / dist) * force * config.mouseForce * 3;
                    mouseFy = (dy / dist) * force * config.mouseForce * 3;
                }
            }

            const scrollOffset = scrollY * 0.08 * (this.y / height);

            this.x += this.vx + driftX + mouseFx;
            this.y = this.baseY + waveY + scrollWave + scrollOffset + driftY + mouseFy;

            if (this.x < -10) this.x = width + 10;
            if (this.x > width + 10) this.x = -10;
            if (this.y < -50) this.baseY = height + 50;
            if (this.y > height + 50) this.baseY = -50;
        }

        draw(ctx, isLight) {
            const color = isLight ? config.colorLight : config.colorDark;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${color}, ${this.opacity})`;
            ctx.fill();
        }
    }

    function initParticles() {
        particles = [];
        for (let i = 0; i < config.particleCount; i++) {
            particles.push(new Particle());
        }
    }

    function drawConnections(ctx, isLight) {
        const color = isLight ? config.colorLight : config.colorDark;
        const maxDist = config.connectionDistance;

        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < maxDist) {
                    const opacity = (1 - dist / maxDist) * 0.12;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(${color}, ${opacity})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }
    }

    function drawWaveLines(ctx, isLight, scrollY) {
        const color = isLight ? config.colorLight : config.colorDark;
        const lines = 5;

        for (let l = 0; l < lines; l++) {
            ctx.beginPath();
            const lineOffset = l * (height / lines) + Math.sin(time * 0.3 + l) * 30;
            const scrollOffset = scrollY * 0.05 * (l / lines);

            for (let x = 0; x <= width; x += 3) {
                const y = lineOffset + scrollOffset +
                    Math.sin(x * 0.006 + time * 0.5 + l * 1.2) * 25 +
                    Math.sin(x * 0.012 + time * 0.3 + l) * 15 +
                    scrollY * 0.1 * Math.sin(x * 0.003 + l);

                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }

            const opacity = 0.03 + (l / lines) * 0.04;
            ctx.strokeStyle = `rgba(${color}, ${opacity})`;
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }

    function animate() {
        if (!isVisible) {
            requestAnimationFrame(animate);
            return;
        }

        const isLight = document.body.classList.contains('light-theme');
        const scrollY = window.scrollY;
        time += config.waveSpeed;

        ctx.clearRect(0, 0, width, height);
        drawWaveLines(ctx, isLight, scrollY);

        particles.forEach(p => {
            p.update(scrollY);
            p.draw(ctx, isLight);
        });

        drawConnections(ctx, isLight);
        requestAnimationFrame(animate);
    }

    const heroObserver = new IntersectionObserver((entries) => {
        isVisible = entries[0].isIntersecting;
    }, { threshold: 0 });
    heroObserver.observe(hero);

    resize();
    animate();
    window.addEventListener('resize', resize);
})();