export default class PremiumKidsGame {
    constructor(canvas, ctx, engine) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.engine = engine;
        this.items = [];
        this.score = 0;
        this.lastSpawn = 0;
        this.baseSpeed = 2;
    }

    init() {
        if (window.sound) window.sound.playSuccess();
        this.canvas.addEventListener('click', this.onClick.bind(this));
        
        // Spawn loop
        this.gameLoop = setInterval(() => {
            if (!this.engine.isPlaying) return;
            this.update();
            this.draw();
        }, 1000 / 60);

        this.spawnLoop = setInterval(() => {
            if (!this.engine.isPlaying) return;
            this.spawnItem();
        }, 800);
    }

    spawnItem() {
        const isBad = Math.random() < 0.3;
        const isGold = !isBad && Math.random() < 0.2;
        const radius = isBad ? 25 : (isGold ? 20 : 30);
        
        this.items.push({
            x: Math.random() * (800 - radius * 2) + radius,
            y: -50,
            radius,
            type: isBad ? 'bad' : (isGold ? 'gold' : 'good'),
            speed: this.baseSpeed + Math.random() * 2,
            rot: 0,
            rotSpeed: (Math.random() - 0.5) * 0.1
        });
    }

    update() {
        for (let i = this.items.length - 1; i >= 0; i--) {
            const item = this.items[i];
            item.y += item.speed * (this.engine.activeEffects?.slowMode ? 0.7 : 1);
            item.rot += item.rotSpeed;
            if (item.y > 600) {
                this.items.splice(i, 1);
            }
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, 800, 500);

        // Score
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 24px Outfit, sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Puntos: ${this.score}`, 20, 40);

        // Draw items
        for (const item of this.items) {
            this.ctx.save();
            this.ctx.translate(item.x, item.y);
            this.ctx.rotate(item.rot);
            
            this.ctx.shadowBlur = 15;
            
            if (item.type === 'good') {
                this.ctx.shadowColor = '#38bdf8';
                this.ctx.fillStyle = '#38bdf8';
                this.drawStar(0, 0, 5, item.radius, item.radius / 2);
                this.ctx.fill();
            } else if (item.type === 'gold') {
                this.ctx.shadowColor = '#fcd34d';
                this.ctx.fillStyle = '#fcd34d';
                this.drawStar(0, 0, 5, item.radius, item.radius / 2);
                this.ctx.fill();
            } else {
                this.ctx.shadowColor = '#ef4444';
                this.ctx.fillStyle = '#ef4444';
                this.ctx.beginPath();
                this.ctx.arc(0, 0, item.radius, 0, Math.PI * 2);
                this.ctx.fill();
            }
            this.ctx.restore();
        }
    }

    drawStar(cx, cy, spikes, outerRadius, innerRadius) {
        let rot = Math.PI / 2 * 3;
        let x = cx;
        let y = cy;
        let step = Math.PI / spikes;

        this.ctx.beginPath();
        this.ctx.moveTo(cx, cy - outerRadius);
        for (let i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerRadius;
            y = cy + Math.sin(rot) * outerRadius;
            this.ctx.lineTo(x, y);
            rot += step;

            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            this.ctx.lineTo(x, y);
            rot += step;
        }
        this.ctx.lineTo(cx, cy - outerRadius);
        this.ctx.closePath();
    }

    onClick(e) {
        if (!this.engine.isPlaying) return;
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        // The game virtual size is 800x500
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
                        this.score = Math.max(0, this.score - 5);
                        this.baseSpeed = Math.max(2, this.baseSpeed - 0.5);
                    }
                } else {
                    if (window.sound) window.sound.playPop();
                    this.score += (item.type === 'gold' ? 5 : 1);
                    this.baseSpeed += 0.05;
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
        
        // Final score logic
        const finalScore = this.score * (this.engine.activeEffects?.multiplier || 1);
        const coinsEarned = Math.floor(finalScore / 2) * (this.engine.activeEffects?.coinBonus || 1);
        
        this.engine.showResults({
            score: Math.floor(finalScore),
            coins: Math.floor(coinsEarned),
            metrics: {
                attention: Math.min(100, 60 + this.score),
                impulsivity: Math.min(100, 50 + this.score / 2)
            }
        });
    }
}
