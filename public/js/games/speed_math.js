/* -------------------------------------------------------------
   GAME: ASTRO MATH (Processing Speed)
   Architecture: Background meteors fall as decoration.
   The equation is STATIC and centered. Buttons are STATIC at bottom.
   ------------------------------------------------------------- */
import { sound } from '../sound.js';

export default class SpeedMath {
    constructor(canvas, ctx, controller) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.controller = controller;
        this.animationFrameId = null;
        this.equation = "";
        this.answers = [];
        this.correctIndex = 0;
        this.handleClickBound = this.handleClick.bind(this);

        // Background meteor system
        this.bgMeteors = [];
        this.particles = [];
        this.frameCount = 0;

        // Feedback flash
        this.flashColor = null;
        this.flashAlpha = 0;
    }

    init() {
        this.canvas.addEventListener('mousedown', this.handleClickBound);
        this.initBgMeteors();
        this.startLevel();
        this.loop();
    }

    initBgMeteors() {
        // Pre-populate background with meteors at random positions
        for (let i = 0; i < 12; i++) {
            this.bgMeteors.push(this.createBgMeteor(true));
        }
    }

    createBgMeteor(randomY = false) {
        const size = 10 + Math.random() * 22;
        const speed = 1.2 + Math.random() * 2.5;
        return {
            x: Math.random() * 900,
            y: randomY ? Math.random() * 500 : -size * 2,
            size,
            speed,
            angle: Math.PI / 4 + (Math.random() - 0.5) * 0.4, // roughly top-left to bottom-right
            alpha: 0.15 + Math.random() * 0.25,
            tailLength: 30 + Math.random() * 60
        };
    }

    startLevel() {
        let maxNum = 10 + Math.floor(this.controller.gameTime / 10) * 5;

        let opRand = Math.random();
        let a, b, ans, opStr;

        if (this.controller.gameTime > 30 && opRand < 0.2) {
            a = Math.floor(Math.random() * (maxNum / 1.5)) + 1;
            b = Math.floor(Math.random() * 10) + 1;
            ans = a * b;
            opStr = 'x';
        } else if (opRand < 0.6) {
            // Subtraction
            a = Math.floor(Math.random() * maxNum) + 1;
            b = Math.floor(Math.random() * maxNum) + 1;
            if (a < b) [a, b] = [b, a];
            ans = a - b;
            opStr = '-';
        } else {
            // Addition
            a = Math.floor(Math.random() * maxNum) + 1;
            b = Math.floor(Math.random() * maxNum) + 1;
            ans = a + b;
            opStr = '+';
        }

        this.equation = `${a} ${opStr} ${b} = ?`;
        this.answers = [];
        this.correctIndex = Math.floor(Math.random() * 3);

        for (let i = 0; i < 3; i++) {
            if (i === this.correctIndex) {
                this.answers.push(ans);
            } else {
                let fake = ans + (Math.floor(Math.random() * 6) + 1) * (Math.random() > 0.5 ? 1 : -1);
                while (this.answers.includes(fake) || fake === ans) fake++;
                this.answers.push(fake);
            }
        }

        this.controller.totalStimuli++;
    }

    triggerFlash(color) {
        this.flashColor = color;
        this.flashAlpha = 0.35;
    }

    createExplosion(x, y, color) {
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 5;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                color
            });
        }
    }

    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = 800 / rect.width;
        const scaleY = 500 / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        const boxW = 140, boxH = 72;
        const totalW = boxW * 3 + 40 * 2;
        const startX = (800 - totalW) / 2;
        const by = 400;

        for (let i = 0; i < 3; i++) {
            const bx = startX + i * (boxW + 40);
            if (x > bx && x < bx + boxW && y > by && y < by + boxH) {
                if (i === this.correctIndex) {
                    this.createExplosion(bx + boxW / 2, by + boxH / 2, '#34d399');
                    this.triggerFlash('#22c55e');
                    this.controller.correctResponses++;
                    this.controller.addScore(15);
                    sound.playSuccess();
                } else {
                    this.createExplosion(bx + boxW / 2, by + boxH / 2, '#ef4444');
                    this.triggerFlash('#ef4444');
                    this.controller.registerError();
                }
                this.startLevel();
                break;
            }
        }
    }

    drawBgMeteors() {
        // Spawn new background meteors occasionally
        if (this.frameCount % 18 === 0) {
            this.bgMeteors.push(this.createBgMeteor(false));
        }

        for (let i = this.bgMeteors.length - 1; i >= 0; i--) {
            const m = this.bgMeteors[i];
            m.x += Math.cos(m.angle) * m.speed;
            m.y += Math.sin(m.angle) * m.speed;

            // Remove if off screen
            if (m.y > 560 || m.x > 860) {
                this.bgMeteors.splice(i, 1);
                continue;
            }

            this.ctx.save();
            this.ctx.globalAlpha = m.alpha;

            // Draw tail (gradient line)
            const tailX = m.x - Math.cos(m.angle) * m.tailLength;
            const tailY = m.y - Math.sin(m.angle) * m.tailLength;
            const grad = this.ctx.createLinearGradient(tailX, tailY, m.x, m.y);
            grad.addColorStop(0, 'rgba(255,255,255,0)');
            grad.addColorStop(0.7, 'rgba(147,197,253,0.4)');
            grad.addColorStop(1, 'rgba(255,255,255,0.9)');
            this.ctx.strokeStyle = grad;
            this.ctx.lineWidth = m.size * 0.35;
            this.ctx.lineCap = 'round';
            this.ctx.beginPath();
            this.ctx.moveTo(tailX, tailY);
            this.ctx.lineTo(m.x, m.y);
            this.ctx.stroke();

            // Draw meteor head glow
            const headGrad = this.ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.size);
            headGrad.addColorStop(0, 'rgba(255,255,255,0.95)');
            headGrad.addColorStop(0.4, 'rgba(147,197,253,0.7)');
            headGrad.addColorStop(1, 'rgba(56,189,248,0)');
            this.ctx.fillStyle = headGrad;
            this.ctx.beginPath();
            this.ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.restore();
        }
    }

    drawEquation() {
        const cx = 400;
        const cy = 200;

        // Equation glow background pill
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
        this.ctx.shadowColor = 'rgba(56,189,248,0.4)';
        this.ctx.shadowBlur = 30;
        this.ctx.beginPath();
        this.ctx.roundRect(cx - 200, cy - 50, 400, 100, 20);
        this.ctx.fill();
        this.ctx.restore();

        // Equation border
        this.ctx.strokeStyle = 'rgba(56,189,248,0.3)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.roundRect(cx - 200, cy - 50, 400, 100, 20);
        this.ctx.stroke();

        // Equation text
        this.ctx.save();
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 58px Outfit, Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.shadowColor = '#38bdf8';
        this.ctx.shadowBlur = 18;
        this.ctx.fillText(this.equation, cx, cy);
        this.ctx.restore();
    }

    drawButtons() {
        const boxW = 140, boxH = 72;
        const totalW = boxW * 3 + 40 * 2;
        const startX = (800 - totalW) / 2;
        const by = 400;

        for (let i = 0; i < 3; i++) {
            const bx = startX + i * (boxW + 40);

            // Button shadow
            this.ctx.save();
            this.ctx.shadowColor = 'rgba(56,189,248,0.5)';
            this.ctx.shadowBlur = 20;

            // Button gradient
            const grad = this.ctx.createLinearGradient(bx, by, bx, by + boxH);
            grad.addColorStop(0, '#38bdf8');
            grad.addColorStop(1, '#818cf8');
            this.ctx.fillStyle = grad;
            this.ctx.beginPath();
            this.ctx.roundRect(bx, by, boxW, boxH, 16);
            this.ctx.fill();
            this.ctx.restore();

            // Button border shimmer
            this.ctx.strokeStyle = 'rgba(255,255,255,0.35)';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.roundRect(bx, by, boxW, boxH, 16);
            this.ctx.stroke();

            // Answer text
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = 'bold 38px Outfit, Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.shadowColor = 'rgba(0,0,0,0.4)';
            this.ctx.shadowBlur = 6;
            this.ctx.fillText(this.answers[i], bx + boxW / 2, by + boxH / 2);
            this.ctx.shadowBlur = 0;
        }
    }

    drawParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.15; // slight gravity
            p.life -= 0.04;

            if (p.life <= 0) { this.particles.splice(i, 1); continue; }

            this.ctx.globalAlpha = p.life;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, 5 * p.life, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.globalAlpha = 1;
        }
    }

    loop() {
        if (!this.controller.isPlaying) return;
        this.frameCount++;
        this.ctx.clearRect(0, 0, 800, 500);

        // 1. Background falling meteors
        this.drawBgMeteors();

        // 2. Screen flash feedback
        if (this.flashAlpha > 0) {
            this.ctx.save();
            this.ctx.globalAlpha = this.flashAlpha;
            this.ctx.fillStyle = this.flashColor;
            this.ctx.fillRect(0, 0, 800, 500);
            this.ctx.restore();
            this.flashAlpha = Math.max(0, this.flashAlpha - 0.035);
        }

        // 3. Static equation display
        this.drawEquation();

        // 4. Static answer buttons
        this.drawButtons();

        // 5. Particle effects
        this.drawParticles();

        // 6. Hint label
        this.ctx.fillStyle = 'rgba(148,163,184,0.7)';
        this.ctx.font = '17px Outfit, Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Toca la respuesta correcta', 400, 370);

        this.animationFrameId = requestAnimationFrame(this.loop.bind(this));
    }

    destroy() {
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        this.canvas.removeEventListener('mousedown', this.handleClickBound);
    }
}
