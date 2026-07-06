/* -------------------------------------------------------------
   GAME: ECO WATER (Atención Sostenida y Reacción)
   ------------------------------------------------------------- */
import { sound } from '../sound.js';

export default class EcoWater {
    constructor(canvas, ctx, controller) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.controller = controller;
        this.animationFrameId = null;
        this.pipes = [];
        this.handleClickBound = this.handleClick.bind(this);
        this.lastSpawn = 0;
        this.particles = [];
    }

    init() {
        this.canvas.addEventListener('mousedown', this.handleClickBound);
        
        // Setup 3x3 grid of pipes
        for(let row = 0; row < 3; row++) {
            for(let col = 0; col < 3; col++) {
                this.pipes.push({
                    x: 200 + col * 200,
                    y: 150 + row * 120,
                    leaking: false,
                    leakTimer: 0
                });
            }
        }
        
        this.loop();
    }

    createParticles(x, y) {
        for (let i = 0; i < 15; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 8,
                vy: -Math.random() * 8,
                life: 1,
                color: '#38bdf8'
            });
        }
    }

    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = 800 / rect.width;
        const scaleY = 500 / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        for (let pipe of this.pipes) {
            const dist = Math.hypot(x - pipe.x, y - pipe.y);
            if (dist < 50 && pipe.leaking) {
                pipe.leaking = false;
                this.controller.correctResponses++;
                this.controller.addScore(20);
                sound.playSuccess();
                this.createParticles(pipe.x, pipe.y);
                break;
            }
        }
    }

    loop(timestamp) {
        if (!this.controller.isPlaying) return;
        this.ctx.clearRect(0, 0, 800, 500);

        // Background
        const bgGrad = this.ctx.createLinearGradient(0, 0, 0, 500);
        bgGrad.addColorStop(0, '#0f172a');
        bgGrad.addColorStop(1, '#1e293b');
        this.ctx.fillStyle = bgGrad;
        this.ctx.fillRect(0, 0, 800, 500);

        if (!timestamp) timestamp = 0;
        // Calculate spawn delay: starts at 1500ms, decreases as gameTime increases (min 400ms)
        let currentSpawnDelay = Math.max(400, 1500 - (this.controller.gameTime * 25));

        // Spawn leaks
        if (timestamp - this.lastSpawn > currentSpawnDelay) {
            let safePipes = this.pipes.filter(p => !p.leaking);
            if (safePipes.length > 0) {
                let p = safePipes[Math.floor(Math.random() * safePipes.length)];
                p.leaking = true;
                p.leakTimer = 0;
                this.controller.totalStimuli++;
            }
            this.lastSpawn = timestamp;
        }

        // Draw Pipes
        for (let pipe of this.pipes) {
            this.ctx.save();
            this.ctx.translate(pipe.x, pipe.y);
            
            // Pipe structure
            this.ctx.fillStyle = '#64748b';
            this.ctx.beginPath();
            this.ctx.roundRect(-40, -15, 80, 30, 4);
            this.ctx.fill();
            this.ctx.fillStyle = '#475569';
            this.ctx.fillRect(-40, -15, 80, 15);
            
            this.ctx.fillStyle = '#94a3b8';
            this.ctx.fillRect(-15, -25, 30, 50);

            // Leak Animation
            if (pipe.leaking) {
                pipe.leakTimer += 0.1;
                this.ctx.fillStyle = `rgba(56, 189, 248, ${0.5 + Math.sin(pipe.leakTimer)*0.3})`;
                this.ctx.beginPath();
                this.ctx.arc(0, 0, 35, 0, Math.PI * 2);
                this.ctx.fill();
                
                this.ctx.fillStyle = '#ffffff';
                this.ctx.font = '24px "Font Awesome 6 Free"';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText('\uf043', 0, 0); // fa-droplet
            }

            this.ctx.restore();
        }

        // Draw Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.5; // gravity
            p.life -= 0.05;
            
            if (p.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }
            
            this.ctx.globalAlpha = p.life;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, 5 * p.life, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.globalAlpha = 1;
        }

        this.ctx.fillStyle = '#94a3b8';
        this.ctx.font = '18px Outfit';
        this.ctx.textAlign = 'center';
        this.ctx.fillText("¡Toca las tuberías que gotean rápido!", 400, 50);

        this.animationFrameId = requestAnimationFrame(this.loop.bind(this));
    }

    destroy() {
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        this.canvas.removeEventListener('mousedown', this.handleClickBound);
    }
}
