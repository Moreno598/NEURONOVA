/* -------------------------------------------------------------
   GAME: SEMÁFORO EMOCIONAL (Impulse Control - Go / No-Go Task)
   ------------------------------------------------------------- */

import { sound } from '../sound.js';
import { coach } from '../neurocoach.js';

export default class StoplightSelfRegulation {
    constructor(canvas, ctx, controller) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.controller = controller;
        this.animationFrameId = null;

        this.portalState = 'idle'; // 'green' (Go), 'yellow' (Go fast), 'red' (No-Go), 'idle'
        this.stateTimer = 0;
        this.stateDuration = 90; // frames
        
        this.hasResponded = false;
        this.particles = [];
        this.feedbackText = "";
        this.feedbackColor = "#ffffff";
        this.feedbackTimer = 0;
        
        this.speedMultiplier = 1.0;
        
        // Listeners
        this.handleClickBound = this.handleClick.bind(this);
        this.handleKeyDownBound = this.handleKeyDown.bind(this);
    }

    init() {
        this.canvas.addEventListener('mousedown', this.handleClickBound);
        window.addEventListener('keydown', this.handleKeyDownBound);
        
        if (this.controller.difficulty === 'easy') {
            this.stateDuration = 120; // slow
            this.speedMultiplier = 0.8;
        } else if (this.controller.difficulty === 'hard') {
            this.stateDuration = 70; // fast
            this.speedMultiplier = 1.25;
        }
        
        this.triggerNextState();
        this.loop();
    }

    triggerNextState() {
        this.hasResponded = false;
        this.stateTimer = 0;
        
        // Randomize next state
        const rand = Math.random();
        if (rand < 0.45) {
            this.portalState = 'green';
            this.controller.totalStimuli++;
        } else if (rand < 0.7) {
            this.portalState = 'yellow';
            this.controller.totalStimuli++;
        } else {
            this.portalState = 'red';
            this.controller.totalStimuli++;
        }
        
        // Randomize duration slightly to prevent anticipatory clicking (ADHD focus support)
        this.stateDuration = Math.round((70 + Math.random() * 50) / this.speedMultiplier);
    }

    adjustPacing(slowDown) {
        if (slowDown) {
            this.speedMultiplier = Math.max(0.6, this.speedMultiplier - 0.15);
        }
    }

    handleAction() {
        if (this.hasResponded) return; // already acted in this cycle
        this.hasResponded = true;
        
        const timestamp = Date.now();
        
        if (this.portalState === 'green' || this.portalState === 'yellow') {
            // Success
            this.controller.correctResponses++;
            const points = this.portalState === 'yellow' ? 20 : 10;
            this.controller.addScore(points);
            this.showFeedback("¡ACIERTO!", '#22c55e');
            this.createExplosion(800 / 2, 500 / 2, 'hsl(145, 65%, 45%)', 20);
        } else if (this.portalState === 'red') {
            // Failure (Impulsive Click)
            this.controller.registerError();
            this.showFeedback("¡ALTO! ERA ROJO", '#ef4444');
            this.createExplosion(800 / 2, 500 / 2, '#ef4444', 30);
        } else {
            // Clicked in idle
            this.controller.impulseClicks++;
        }
    }

    handleClick(e) {
        this.handleAction();
    }

    handleKeyDown(e) {
        if (e.code === 'Space') {
            e.preventDefault();
            this.handleAction();
        }
    }

    showFeedback(text, color) {
        this.feedbackText = text;
        this.feedbackColor = color;
        this.feedbackTimer = 30; // frames to display
    }

    createExplosion(x, y, color, count = 15) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 5;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: 2 + Math.random() * 4,
                color,
                alpha: 1,
                decay: 0.03
            });
        }
    }

    loop() {
        if (!this.controller.isPlaying) return;

        this.ctx.clearRect(0, 0, 800, 500);

        // Grid Background
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
        this.ctx.lineWidth = 1;
        const gridSize = 50;
        for (let x = 0; x < 800; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, 500);
            this.ctx.stroke();
        }
        for (let y = 0; y < 500; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(800, y);
            this.ctx.stroke();
        }

        // Draw Portal Ring
        const cx = 800 / 2;
        const cy = 500 / 2;
        const portalRadius = 85;

        // Canvas-compatible direct color values (CSS vars don't work on canvas)
        let color = '#475569';
        let glow = 'rgba(71, 85, 105, 0.2)';
        let titleText = "PREPARANDO...";
        
        if (this.portalState === 'green') {
            color = '#22c55e';
            glow = 'rgba(34, 197, 94, 0.5)';
            titleText = "¡PULSA ESPACIO / CLIC!";
        } else if (this.portalState === 'yellow') {
            color = '#fbbf24';
            glow = 'rgba(251, 191, 36, 0.5)';
            titleText = "¡RÁPIDO, PRESIONA!";
        } else if (this.portalState === 'red') {
            color = '#ef4444';
            glow = 'rgba(239, 68, 68, 0.5)';
            titleText = "¡ALTO! ¡NO TOQUES!";
        }

        // Draw glowing aura
        this.ctx.save();
        this.ctx.shadowBlur = 35;
        this.ctx.shadowColor = color;
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 10;
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, portalRadius, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.restore();

        // Draw outer metallic shell
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, portalRadius + 8, 0, Math.PI * 2);
        this.ctx.stroke();

        // Portal Core Animation
        this.ctx.fillStyle = 'rgba(13, 17, 23, 0.9)';
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, portalRadius - 4, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw animated energy spirals inside the core
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        for (let angle = 0; angle < Math.PI * 2; angle += 0.2) {
            const startR = portalRadius - 30;
            const endR = portalRadius - 10;
            const sa = angle + (this.stateTimer * 0.05);
            this.ctx.moveTo(cx + Math.cos(sa) * startR, cy + Math.sin(sa) * startR);
            this.ctx.lineTo(cx + Math.cos(sa + 0.3) * endR, cy + Math.sin(sa + 0.3) * endR);
        }
        this.ctx.stroke();

        // Text instruction inside core
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 15px Outfit';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(titleText, cx, cy);

        // Update State Timer
        this.stateTimer++;
        
        // Progress ring around the portal
        this.ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, portalRadius + 16, -Math.PI/2, (Math.PI*2)*(this.stateTimer/this.stateDuration) - Math.PI/2);
        this.ctx.stroke();

        if (this.stateTimer >= this.stateDuration) {
            // Check omission (if green/yellow but user did not click)
            if (!this.hasResponded && (this.portalState === 'green' || this.portalState === 'yellow')) {
                // Register error for omission
                this.controller.registerError();
                this.showFeedback("¡MUY LENTO!", '#ea580c');
            }
            this.triggerNextState();
        }

        // Render Feedback texts
        if (this.feedbackTimer > 0) {
            this.feedbackTimer--;
            this.ctx.fillStyle = this.feedbackColor;
            this.ctx.font = 'extrabold 22px Outfit';
            this.ctx.fillText(this.feedbackText, cx, cy - portalRadius - 40);
        }

        // Render Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.alpha -= p.decay;

            if (p.alpha <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            this.ctx.save();
            this.ctx.globalAlpha = p.alpha;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        }

        this.animationFrameId = requestAnimationFrame(this.loop.bind(this));
    }

    destroy() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        this.canvas.removeEventListener('mousedown', this.handleClickBound);
        window.removeEventListener('keydown', this.handleKeyDownBound);
    }
}
