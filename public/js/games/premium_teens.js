export default class PremiumTeensGame {
    constructor(canvas, ctx, engine) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.engine = engine;
        this.items = [];
        this.score = 0;
        this.baseTime = 1000;
    }

    init() {
        if (window.sound) window.sound.playSuccess();
        this.canvas.addEventListener('click', this.onClick.bind(this));
        
        this.gameLoop = setInterval(() => {
            if (!this.engine.isPlaying) return;
            this.draw();
        }, 1000 / 60);

        this.spawnLoop = setInterval(() => {
            if (!this.engine.isPlaying) return;
            this.spawnItem();
        }, this.baseTime);
    }

    spawnItem() {
        if (this.items.length > 5) return;
        
        const isBad = Math.random() < 0.4;
        
        // Ensure no overlap using a grid-like placement
        const cols = 5;
        const rows = 3;
        const cellW = 800 / cols;
        const cellH = 500 / rows;
        
        let cx, cy, valid;
        let attempts = 0;
        do {
            valid = true;
            const c = Math.floor(Math.random() * cols);
            const r = Math.floor(Math.random() * rows);
            cx = c * cellW + cellW/2;
            cy = r * cellH + cellH/2;
            
            for (let it of this.items) {
                if (Math.hypot(it.x - cx, it.y - cy) < 50) valid = false;
            }
            attempts++;
        } while(!valid && attempts < 10);
        
        if (valid) {
            const id = Math.random().toString();
            const lifeTime = this.baseTime * 1.5 * (this.engine.activeEffects?.slowMode ? 1.5 : 1);
            
            const item = {
                id,
                x: cx,
                y: cy,
                radius: 0,
                targetRadius: 40,
                type: isBad ? 'bad' : 'good',
                birth: Date.now(),
                lifeTime
            };
            this.items.push(item);
            
            // Auto remove after lifetime
            setTimeout(() => {
                const idx = this.items.findIndex(i => i.id === id);
                if (idx > -1) {
                    if (this.items[idx].type === 'good') {
                        // Missed a good one!
                        this.score = Math.max(0, this.score - 2);
                    }
                    this.items.splice(idx, 1);
                }
            }, lifeTime);
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, 800, 500);

        // Score
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 24px Outfit, sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Puntos: ${this.score}`, 20, 40);

        const now = Date.now();

        // Draw items
        for (const item of this.items) {
            const age = now - item.birth;
            let progress = age / item.lifeTime;
            if (progress > 1) progress = 1;

            // Pulse animation
            const scale = 1 + Math.sin(progress * Math.PI) * 0.2;
            item.radius = item.targetRadius * scale * Math.min(1, progress * 5); // intro scale

            this.ctx.save();
            this.ctx.translate(item.x, item.y);
            
            this.ctx.shadowBlur = 20;
            
            if (item.type === 'good') {
                this.ctx.shadowColor = '#22c55e';
                this.ctx.fillStyle = '#22c55e';
            } else {
                this.ctx.shadowColor = '#ef4444';
                this.ctx.fillStyle = '#ef4444';
            }

            this.ctx.beginPath();
            this.ctx.arc(0, 0, item.radius, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Inner core
            this.ctx.fillStyle = 'white';
            this.ctx.beginPath();
            this.ctx.arc(0, 0, item.radius * 0.4, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.restore();
        }
    }

    onClick(e) {
        if (!this.engine.isPlaying) return;
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        const dpr = window.devicePixelRatio || 1;
        const vx = x / dpr;
        const vy = y / dpr;

        for (let i = this.items.length - 1; i >= 0; i--) {
            const item = this.items[i];
            const dist = Math.hypot(vx - item.x, vy - item.y);
            if (dist < item.radius + 10) {
                if (item.type === 'bad') {
                    if (this.engine.activeEffects?.shieldActive && !this.engine.shieldUsed) {
                        this.engine.shieldUsed = true;
                        if (window.sound) window.sound.playSuccess();
                    } else {
                        if (window.sound) window.sound.playError();
                        this.score = Math.max(0, this.score - 10);
                    }
                } else {
                    if (window.sound) window.sound.playPop();
                    this.score += 10;
                    
                    // Increase speed slightly
                    this.baseTime = Math.max(400, this.baseTime - 20);
                    clearInterval(this.spawnLoop);
                    this.spawnLoop = setInterval(() => {
                        if (!this.engine.isPlaying) return;
                        this.spawnItem();
                    }, this.baseTime);
                }
                this.items.splice(i, 1);
                this.draw();
                break;
            }
        }
    }

    destroy() {
        clearInterval(this.gameLoop);
        clearInterval(this.spawnLoop);
        this.canvas.removeEventListener('click', this.onClick);

        // If exited manually, navigate home cleanly
        if (this._exitedManually) {
            const app = typeof getApp === 'function' ? getApp() : window.neuroApp;
            if (app) app.renderHome();
            return;
        }

        // Natural finish — show premium results card via engine
        const finalScore = this.score * (this.engine.activeEffects?.multiplier || 1);
        const coinsEarned = Math.floor(finalScore / 5) * (this.engine.activeEffects?.coinBonus || 1);
        
        this.engine.showResults({
            score: Math.floor(finalScore),
            coins: Math.floor(coinsEarned),
            metrics: {
                attention: Math.min(100, 50 + this.score / 5),
                impulsivity: Math.min(100, 60 + this.score / 10)
            }
        });
    }
}
