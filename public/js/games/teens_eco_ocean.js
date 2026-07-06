/* -------------------------------------------------------------
   GAME: TEENS ECO OCEAN (Búsqueda Visual Dinámica)
   ------------------------------------------------------------- */
import { sound } from '../sound.js';

export default class TeensEcoOcean {
    constructor(canvas, ctx, controller) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.controller = controller;
        this.animationFrameId = null;
        this.objects = [];
        this.handleClickBound = this.handleClick.bind(this);
        this.particles = [];
        this.speedMultiplier = 1;
    }

    init() {
        this.canvas.addEventListener('mousedown', this.handleClickBound);
        // Initial spawn
        for (let i = 0; i < 8; i++) {
            this.spawnObject();
        }
        this.loop();
    }

    spawnObject() {
        const isPlastic = Math.random() > 0.5;
        const plasticEmojis = ['🥤', '🛍️', '🧴', '🥡', '🚯'];
        const fishEmojis = ['🐟', '🐠', '🐢', '🐙', '🐬'];

        this.objects.push({
            x: Math.random() * 800,
            y: Math.random() * 500,
            vx: (Math.random() - 0.5) * 3,
            vy: (Math.random() - 0.5) * 3,
            isPlastic: isPlastic,
            emoji: isPlastic ? plasticEmojis[Math.floor(Math.random() * plasticEmojis.length)] : fishEmojis[Math.floor(Math.random() * fishEmojis.length)],
            color: isPlastic ? '#ef4444' : '#38bdf8'
        });
        this.controller.totalStimuli++;
    }

    createParticles(x, y, color) {
        for (let i = 0; i < 15; i++) {
            this.particles.push({
                x: x, y: y,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                life: 1, color: color
            });
        }
    }

    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = 800 / rect.width;
        const scaleY = 500 / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        for (let i = this.objects.length - 1; i >= 0; i--) {
            let obj = this.objects[i];
            const dist = Math.hypot(x - obj.x, y - obj.y);
            if (dist < 40) {
                if (obj.isPlastic) {
                    this.controller.correctResponses++;
                    this.controller.addScore(25);
                    sound.playSuccess();
                    this.createParticles(obj.x, obj.y, obj.color);
                    this.objects.splice(i, 1);
                    this.spawnObject(); // replace
                } else {
                    this.controller.registerError(); // Penalized for hitting fish
                    sound.playError();
                }
                break;
            }
        }
    }

    loop() {
        if (!this.controller.isPlaying) return;
        this.ctx.clearRect(0, 0, 800, 500);

        // Background
        const bgGrad = this.ctx.createLinearGradient(0, 0, 0, 500);
        bgGrad.addColorStop(0, '#0c4a6e');
        bgGrad.addColorStop(1, '#082f49');
        this.ctx.fillStyle = bgGrad;
        this.ctx.fillRect(0, 0, 800, 500);

        // Speed increases over time
        this.speedMultiplier = 1 + (this.controller.gameTime * 0.05);

        // Update and draw objects
        for (let obj of this.objects) {
            obj.x += obj.vx * this.speedMultiplier;
            obj.y += obj.vy * this.speedMultiplier;

            // Bounce off walls
            if (obj.x < 20 || obj.x > 780) obj.vx *= -1;
            if (obj.y < 20 || obj.y > 480) obj.vy *= -1;

            this.ctx.save();
            this.ctx.translate(obj.x, obj.y);
            
            // Highlight for plastics
            if (obj.isPlastic) {
                this.ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
                this.ctx.beginPath();
                this.ctx.arc(0, 0, 35, 0, Math.PI * 2);
                this.ctx.fill();
                
                this.ctx.strokeStyle = '#ef4444';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
            } else {
                this.ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
                this.ctx.beginPath();
                this.ctx.arc(0, 0, 35, 0, Math.PI * 2);
                this.ctx.fill();
            }

            // Draw Emoji
            this.ctx.font = '40px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(obj.emoji, 0, 2); 
            this.ctx.restore();
        }

        // Periodically spawn new plastic if count is low
        const plasticCount = this.objects.filter(o => o.isPlastic).length;
        if (plasticCount < 3 && Math.random() < 0.02) {
            this.spawnObject();
        }

        // Draw Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.05;
            
            if (p.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }
            
            this.ctx.globalAlpha = p.life;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, 4 * p.life, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.globalAlpha = 1;
        }

        this.ctx.fillStyle = '#cbd5e1';
        this.ctx.font = '18px Outfit';
        this.ctx.textAlign = 'center';
        this.ctx.fillText("¡Toca solo los plásticos rojos! Ignora a los peces azules.", 400, 40);

        this.animationFrameId = requestAnimationFrame(this.loop.bind(this));
    }

    destroy() {
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        this.canvas.removeEventListener('mousedown', this.handleClickBound);
    }
}
