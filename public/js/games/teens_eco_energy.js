/* -------------------------------------------------------------
   GAME: TEENS ECO ENERGY (Control de Impulsos Go/No-Go)
   ------------------------------------------------------------- */
import { sound } from '../sound.js';

export default class TeensEcoEnergy {
    constructor(canvas, ctx, controller) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.controller = controller;
        this.animationFrameId = null;
        this.devices = [];
        this.handleClickBound = this.handleClick.bind(this);
        this.lastSpawn = 0;
        this.particles = [];
        this.speedMultiplier = 1;
    }

    init() {
        this.canvas.addEventListener('mousedown', this.handleClickBound);
        this.loop();
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

        let clicked = false;
        for (let i = this.devices.length - 1; i >= 0; i--) {
            let dev = this.devices[i];
            const dist = Math.hypot(x - dev.x, y - dev.y);
            if (dist < 45) {
                clicked = true;
                if (dev.isWaste) {
                    this.controller.correctResponses++;
                    this.controller.addScore(25);
                    sound.playSuccess();
                    this.createParticles(dev.x, dev.y, '#ef4444');
                } else {
                    this.controller.registerError();
                    this.createParticles(dev.x, dev.y, '#22c55e');
                }
                this.devices.splice(i, 1);
                break;
            }
        }
        
        if (!clicked) {
            this.controller.registerError(); // Missed click penalties
        }
    }

    loop(timestamp) {
        if (!this.controller.isPlaying) return;
        this.ctx.clearRect(0, 0, 800, 500);

        // Background removed to show CSS animated background
        // const bgGrad = this.ctx.createLinearGradient(0, 0, 0, 500);
        // bgGrad.addColorStop(0, '#020617');
        // bgGrad.addColorStop(1, '#0f172a');
        // this.ctx.fillStyle = bgGrad;
        // this.ctx.fillRect(0, 0, 800, 500);

        if (!timestamp) timestamp = 0;
        
        // Difficulty scaling (speed increases over time)
        this.speedMultiplier = 1 + (this.controller.gameTime * 0.05);
        let spawnDelay = Math.max(400, 1500 - (this.controller.gameTime * 30));

        // Spawn devices
        if (timestamp - this.lastSpawn > spawnDelay) {
            const isWaste = Math.random() > 0.4; // 60% chance of being waste
            const wasteEmojis = ['🔌', '💡', '📺', '💻', '🔋'];
            const ecoEmojis = ['🌱', '🚲', '☀️', '🌬️', '🌲'];
            
            this.devices.push({
                x: 100 + Math.random() * 600,
                y: 100 + Math.random() * 300,
                isWaste: isWaste,
                emoji: isWaste ? wasteEmojis[Math.floor(Math.random() * wasteEmojis.length)] : ecoEmojis[Math.floor(Math.random() * ecoEmojis.length)],
                timer: 0,
                maxTime: Math.max(50, 120 - (this.controller.gameTime * 2)) // Less time to react as game progresses
            });
            this.controller.totalStimuli++;
            this.lastSpawn = timestamp;
        }

        // Draw Devices
        for (let i = this.devices.length - 1; i >= 0; i--) {
            let dev = this.devices[i];
            dev.timer += 1 * this.speedMultiplier;

            if (dev.timer > dev.maxTime) {
                if (dev.isWaste) {
                    this.controller.registerError(); // Failed to turn off waste
                } else {
                    this.controller.correctResponses++; // Successfully ignored efficient device
                }
                this.devices.splice(i, 1);
                continue;
            }

            this.ctx.save();
            this.ctx.translate(dev.x, dev.y);
            
            // Draw Box
            this.ctx.fillStyle = dev.isWaste ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)';
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 45, 0, Math.PI * 2);
            this.ctx.fill();

            // Draw Emoji
            this.ctx.font = '40px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(dev.emoji, 0, 2); 
            
            // Draw Timer Ring
            this.ctx.strokeStyle = dev.isWaste ? '#ef4444' : '#22c55e';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            const angle = (dev.timer / dev.maxTime) * Math.PI * 2;
            this.ctx.arc(0, 0, 45, -Math.PI/2, -Math.PI/2 + angle);
            this.ctx.stroke();

            this.ctx.restore();
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
        this.ctx.fillText("¡Apaga (toca) SOLO los dispositivos rojos (derroche)! Ignora los verdes.", 400, 40);

        this.animationFrameId = requestAnimationFrame(this.loop.bind(this));
    }

    destroy() {
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        this.canvas.removeEventListener('mousedown', this.handleClickBound);
    }
}
