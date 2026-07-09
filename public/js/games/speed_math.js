/* -------------------------------------------------------------
   GAME: ASTRO MATH (Processing Speed)
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
    }

    init() {
        this.canvas.addEventListener('mousedown', this.handleClickBound);
        this.startLevel();
        this.loop();
    }

    startLevel() {
        let maxNum = 10 + Math.floor(this.controller.gameTime / 10) * 5;
        
        let opRand = Math.random();
        let a, b, ans, opStr;
        
        if (this.controller.gameTime > 30 && opRand < 0.2) {
            // Multiplication for higher difficulty
            a = Math.floor(Math.random() * (maxNum / 1.5)) + 1;
            b = Math.floor(Math.random() * 10) + 1;
            ans = a * b;
            opStr = 'x';
        } else if (opRand < 0.6) { // ~50% of the remaining time
            // Subtraction
            a = Math.floor(Math.random() * maxNum) + 1;
            b = Math.floor(Math.random() * maxNum) + 1;
            if (a < b) [a, b] = [b, a]; // ensure positive
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
                let fake = ans + (Math.floor(Math.random() * 5) + 1) * (Math.random() > 0.5 ? 1 : -1);
                while(this.answers.includes(fake) || fake === ans) fake++;
                this.answers.push(fake);
            }
        }
        
        // Meteorite properties
        this.meteorY = -50;
        this.meteorX = Math.random() * 400 + 200; // Between 200 and 600
        this.fallSpeed = 0.5 + (60 - this.controller.gameTime) / 40; // Starts at 0.5, goes up to ~2.0
        
        // Explosion particle array
        if (!this.particles) this.particles = [];

        this.controller.totalStimuli++;
    }

    createExplosion(x, y, color) {
        for (let i = 0; i < 15; i++) {
            this.particles.push({
                x: x, y: y,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                life: 1.0,
                color: color
            });
        }
    }

    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = 800 / rect.width;
        const scaleY = 500 / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        let boxW = 120, boxH = 70, startX = 220, gap = 180;
        for (let i = 0; i < 3; i++) {
            let bx = startX + (i * gap) - boxW/2;
            let by = 420 - boxH/2;
            
            if (x > bx && x < bx + boxW && y > by && y < by + boxH) {
                if (i === this.correctIndex) {
                    this.createExplosion(this.meteorX, this.meteorY, '#34d399'); // green success explosion
                    this.controller.correctResponses++;
                    this.controller.addScore(15);
                    sound.playSuccess();
                } else {
                    this.createExplosion(this.meteorX, this.meteorY, '#ef4444'); // red error explosion
                    this.controller.registerError();
                }
                this.startLevel();
                break;
            }
        }
    }

    loop() {
        if (!this.controller.isPlaying) return;
        this.ctx.clearRect(0, 0, 800, 500);

        // Update and draw Meteor
        this.meteorY += this.fallSpeed;
        
        // Draw the meteor
        this.ctx.font = '60px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('☄️', this.meteorX, this.meteorY - 20);

        // Draw the equation glowing inside the meteor
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 32px Outfit';
        this.ctx.shadowColor = '#f87171';
        this.ctx.shadowBlur = 15;
        this.ctx.fillText(this.equation, this.meteorX, this.meteorY + 25);
        this.ctx.shadowBlur = 0; // reset

        // If meteor hits the ground (y = 400 approx)
        if (this.meteorY > 400) {
            this.createExplosion(this.meteorX, 400, '#ef4444');
            this.controller.registerError();
            this.startLevel();
        }

        // Update and draw particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.05;
            
            this.ctx.globalAlpha = Math.max(0, p.life);
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.globalAlpha = 1.0;

            if (p.life <= 0) this.particles.splice(i, 1);
        }

        // Draw buttons at the bottom
        let boxW = 120, boxH = 70, startX = 220, gap = 180;
        for (let i = 0; i < 3; i++) {
            let bx = startX + (i * gap) - boxW/2;
            let by = 420 - boxH/2;
            
            // Gradient button
            let grad = this.ctx.createLinearGradient(bx, by, bx, by + boxH);
            grad.addColorStop(0, '#38bdf8');
            grad.addColorStop(1, '#818cf8');
            this.ctx.fillStyle = grad;
            
            this.ctx.beginPath();
            this.ctx.roundRect(bx, by, boxW, boxH, 15);
            this.ctx.fill();
            
            // Button border glow
            this.ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = 'bold 36px Outfit';
            this.ctx.shadowColor = 'rgba(0,0,0,0.5)';
            this.ctx.shadowBlur = 5;
            this.ctx.fillText(this.answers[i], bx + boxW/2, by + boxH/2 + 12);
            this.ctx.shadowBlur = 0;
        }

        this.animationFrameId = requestAnimationFrame(this.loop.bind(this));
    }

    destroy() {
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        this.canvas.removeEventListener('mousedown', this.handleClickBound);
    }
}
