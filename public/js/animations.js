/**
 * NEUROSPARK — Animation Engine v4 (Lean & Fast)
 * Cursor: default OS cursor (removed completely)
 * Remaining: particles, scroll-reveal, tilt, counters, magnetic
 */

'use strict';

/* ── Scroll state flag ── */
let _scrolling = false;
let _scrollTimer = null;

window.addEventListener('scroll', () => {
    if (!_scrolling) {
        _scrolling = true;
        document.body.classList.add('ns-scrolling');
    }
    clearTimeout(_scrollTimer);
    _scrollTimer = setTimeout(() => {
        _scrolling = false;
        document.body.classList.remove('ns-scrolling');
        window.dispatchEvent(new Event('nsScrollStop'));
    }, 120);
}, { passive: true });

const ric = window.requestIdleCallback
    ? cb => requestIdleCallback(cb, { timeout: 200 })
    : cb => setTimeout(cb, 80);

/* ─────────────────────────────────────────────
   1. PARTICLE CANVAS
   - 20 dots, no connection lines
   - Pauses completely during scroll
   - Uses globalAlpha batched per color
───────────────────────────────────────────── */
(function initParticles() {
    const canvas = document.createElement('canvas');
    canvas.id = 'ns-particles';
    canvas.style.cssText = [
        'position:fixed', 'top:0', 'left:0',
        'width:100%', 'height:100%',
        'z-index:0', 'pointer-events:none',
        'opacity:0.4', 'transform:translateZ(0)',
        'will-change:transform'
    ].join(';');
    document.body.insertBefore(canvas, document.body.firstChild);

    const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
    let W = canvas.width  = window.innerWidth;
    let H = canvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
        W = canvas.width  = window.innerWidth;
        H = canvas.height = window.innerHeight;
    }, { passive: true });

    const COLS = [[139,92,246],[96,165,250],[52,211,153],[251,191,36]];

    const pts = Array.from({ length: 20 }, () => {
        const c = COLS[Math.floor(Math.random() * COLS.length)];
        return {
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            r: Math.random() * 1.8 + 0.6,
            vx: (Math.random() - 0.5) * 0.25,
            vy: -(Math.random() * 0.4 + 0.1),
            phase: Math.random() * Math.PI * 2,
            rgb: `${c[0]},${c[1]},${c[2]}`
        };
    });

    let running = true;
    document.addEventListener('visibilitychange', () => {
        const shouldRun = !document.hidden && !_scrolling;
        if (shouldRun && !running) {
            running = true;
            loop();
        } else if (document.hidden) {
            running = false;
        }
    });

    window.addEventListener('nsScrollStop', () => {
        if (!document.hidden && !running) {
            running = true;
            loop();
        }
    });

    function loop() {
        if (!running) return;

        if (_scrolling) {
            // Halt completely. nsScrollStop event will restart it.
            running = false;
            return;
        }

        ctx.clearRect(0, 0, W, H);

        pts.forEach(p => {
            p.phase += 0.018;
            p.x += p.vx;
            p.y += p.vy;
            if (p.y < -5) { p.y = H + 5; p.x = Math.random() * W; }
            if (p.x < -5 || p.x > W + 5) { p.x = Math.random() * W; }

            ctx.globalAlpha = Math.sin(p.phase) * 0.18 + 0.38;
            ctx.fillStyle = `rgb(${p.rgb})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, 6.2832);
            ctx.fill();
        });

        ctx.globalAlpha = 1;
        requestAnimationFrame(loop);
    }
    loop();
})();

/* ─────────────────────────────────────────────
   2. SCROLL REVEAL — IntersectionObserver only
   Zero cost on scroll (no scroll listener)
───────────────────────────────────────────── */
(function initReveal() {
    const SEL = [
        '.game-card','.profile-card','.stat-card',
        '.chart-card','.rec-item','.task-item',
        '.store-item','.section-title','.landing-subtitle'
    ].join(',');

    const io = new IntersectionObserver(entries => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                e.target.classList.add('visible');
                io.unobserve(e.target);
            }
        });
    }, { threshold: 0.08 });

    let pending = false;
    function scan() {
        document.querySelectorAll(SEL).forEach(el => {
            if (!el.classList.contains('reveal')) {
                el.classList.add('reveal');
                io.observe(el);
            }
        });
        pending = false;
    }

    scan();
    new MutationObserver(() => {
        if (pending) return;
        pending = true;
        ric(scan);
    }).observe(document.body, { childList: true, subtree: true });
})();

/* ─────────────────────────────────────────────
   3. TILT 3D — lerp loop, stops when idle
   Only runs while mouse is inside card
───────────────────────────────────────────── */
(function initTilt() {
    const MAX = 7;

    let pending = false;
    function scan() {
        document.querySelectorAll(
            '.game-card:not([data-tilt]),.profile-card:not([data-tilt]),.stat-card:not([data-tilt])'
        ).forEach(card => {
            card.dataset.tilt = '1';

            let rX = 0, rY = 0, tX = 0, tY = 0;
            let raf = null, inside = false;

            function tick() {
                if (!inside) return;
                rX += (tX - rX) * 0.1;
                rY += (tY - rY) * 0.1;
                card.style.transform = `perspective(700px) rotateX(${rX.toFixed(2)}deg) rotateY(${rY.toFixed(2)}deg) scale3d(1.03,1.03,1.03)`;
                raf = requestAnimationFrame(tick);
            }

            card.addEventListener('mouseenter', () => {
                if (_scrolling) return;
                inside = true;
                card.style.transition = 'none';
                cancelAnimationFrame(raf);
                tick();
            }, { passive: true });

            card.addEventListener('mousemove', e => {
                if (!inside || _scrolling) return;
                const r = card.getBoundingClientRect();
                tY =  ((e.clientX - r.left - r.width  / 2) / (r.width  / 2)) * MAX;
                tX = -((e.clientY - r.top  - r.height / 2) / (r.height / 2)) * MAX;
            }, { passive: true });

            card.addEventListener('mouseleave', () => {
                inside = false;
                cancelAnimationFrame(raf); raf = null;
                tX = tY = rX = rY = 0;
                card.style.transition = 'transform 0.5s cubic-bezier(0.22,1,0.36,1)';
                card.style.transform = '';
            }, { passive: true });
        });
        pending = false;
    }

    scan();
    new MutationObserver(() => {
        if (pending) return;
        pending = true;
        ric(scan);
    }).observe(document.body, { childList: true, subtree: true });
})();

/* ─────────────────────────────────────────────
   4. NUMBER COUNTERS
───────────────────────────────────────────── */
(function initCounters() {
    function run(el, target) {
        const t0 = performance.now(), dur = 1000;
        (function tick(now) {
            const p = Math.min((now - t0) / dur, 1);
            el.textContent = Math.round((1 - Math.pow(2, -10 * p)) * target);
            if (p < 1) requestAnimationFrame(tick);
        })(t0);
    }

    let pending = false;
    function scan() {
        document.querySelectorAll('.stat-value:not([data-counted])').forEach(el => {
            const n = parseInt(el.textContent.replace(/\D/g, ''), 10);
            if (!isNaN(n) && n > 0) {
                el.dataset.counted = '1';
                new IntersectionObserver(([e], obs) => {
                    if (e.isIntersecting) { run(el, n); obs.disconnect(); }
                }, { threshold: 0.5 }).observe(el);
            }
        });
        pending = false;
    }

    scan();
    new MutationObserver(() => {
        if (pending) return;
        pending = true;
        ric(scan);
    }).observe(document.body, { childList: true, subtree: true });
})();

/* ─────────────────────────────────────────────
   5. MAGNETIC BUTTONS — disabled during scroll
───────────────────────────────────────────── */
(function initMagnetic() {
    let pending = false;
    function scan() {
        document.querySelectorAll(
            '.play-btn:not([data-mag]),.profile-select-btn:not([data-mag])'
        ).forEach(btn => {
            btn.dataset.mag = '1';
            let inside = false, cx = 0, cy = 0, tx = 0, ty = 0, raf = null;

            function tick() {
                if (!inside) return;
                cx += (tx - cx) * 0.12;
                cy += (ty - cy) * 0.12;
                btn.style.transform = `translate(${cx.toFixed(1)}px,${cy.toFixed(1)}px) scale(1.05)`;
                raf = requestAnimationFrame(tick);
            }

            btn.addEventListener('mouseenter', () => {
                if (_scrolling) return;
                inside = true;
                btn.style.transition = 'none';
                cancelAnimationFrame(raf);
                tick();
            }, { passive: true });

            btn.addEventListener('mousemove', e => {
                if (!inside || _scrolling) return;
                const r = btn.getBoundingClientRect();
                tx = (e.clientX - r.left - r.width  / 2) * 0.25;
                ty = (e.clientY - r.top  - r.height / 2) * 0.25;
            }, { passive: true });

            btn.addEventListener('mouseleave', () => {
                inside = false;
                cancelAnimationFrame(raf); raf = null;
                tx = ty = cx = cy = 0;
                btn.style.transition = 'transform 0.4s cubic-bezier(0.22,1,0.36,1)';
                btn.style.transform = '';
            }, { passive: true });
        });
        pending = false;
    }

    scan();
    new MutationObserver(() => {
        if (pending) return;
        pending = true;
        ric(scan);
    }).observe(document.body, { childList: true, subtree: true });
})();
