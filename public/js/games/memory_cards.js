/* -------------------------------------------------------------
   GAME: CARTAS DE MEMORIA (Visual Memory)
   ------------------------------------------------------------- */
import { sound } from '../sound.js';

export default class MemoryCards {
    constructor(canvas, ctx, controller) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.controller = controller;
        this.animationFrameId = null;
        this.cards = [];
        this.flipped = [];
        this.matched = 0;
        this.grid = { rows: 3, cols: 4, width: 80, height: 100, gap: 20 };
        this.isProcessing = false;

        this.handleClickBound = this.handleClick.bind(this);
    }

    init() {
        this.canvas.addEventListener('mousedown', this.handleClickBound);
        this.startLevel();
        this.loop();
    }

    startLevel() {
        this.cards = [];
        this.flipped = [];
        this.matched = 0;
        this.isProcessing = false;
        
        if (this.controller.gameTime > 60) {
            this.grid = { rows: 4, cols: 5, width: 60, height: 80, gap: 15 };
        } else if (this.controller.gameTime > 30) {
            this.grid = { rows: 4, cols: 4, width: 70, height: 90, gap: 15 };
        } else {
            this.grid = { rows: 3, cols: 4, width: 80, height: 100, gap: 20 };
        }
        
        let pairs = (this.grid.rows * this.grid.cols) / 2;
        let icons = ['👽', '🚀', '⭐', '🌎', '☄️', '🛸', '🛰️', '🪐', '🌙', '🌌'];
        
        // Randomly pick icons for pairs
        let selectedIcons = [];
        while(selectedIcons.length < pairs) {
            let rand = icons[Math.floor(Math.random() * icons.length)];
            if (!selectedIcons.includes(rand)) selectedIcons.push(rand);
        }
        
        let deck = [...selectedIcons, ...selectedIcons];
        deck.sort(() => Math.random() - 0.5); // shuffle

        let startX = (800 - (this.grid.cols * (this.grid.width + this.grid.gap) - this.grid.gap)) / 2;
        let startY = (500 - (this.grid.rows * (this.grid.height + this.grid.gap) - this.grid.gap)) / 2;

        let index = 0;
        for (let r = 0; r < this.grid.rows; r++) {
            for (let c = 0; c < this.grid.cols; c++) {
                this.cards.push({
                    x: startX + c * (this.grid.width + this.grid.gap),
                    y: startY + r * (this.grid.height + this.grid.gap),
                    w: this.grid.width,
                    h: this.grid.height,
                    icon: deck[index],
                    isFlipped: false,
                    isMatched: false
                });
                index++;
            }
        }
    }

    handleClick(e) {
        if (this.isProcessing) return;
        const rect = this.canvas.getBoundingClientRect();
        
        // Use logic from game controller scale
        const scaleX = 800 / rect.width;
        const scaleY = 500 / rect.height;
        
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        for (let i = 0; i < this.cards.length; i++) {
            let card = this.cards[i];
            if (!card.isFlipped && !card.isMatched && x > card.x && x < card.x + card.w && y > card.y && y < card.y + card.h) {
                card.isFlipped = true;
                this.flipped.push(card);
                sound.playPop();
                this.controller.totalStimuli++;

                if (this.flipped.length === 2) {
                    this.isProcessing = true;
                    setTimeout(() => this.checkMatch(), 800);
                }
                break;
            }
        }
    }

    checkMatch() {
        if (this.flipped[0].icon === this.flipped[1].icon) {
            this.flipped[0].isMatched = true;
            this.flipped[1].isMatched = true;
            this.matched += 2;
            this.controller.correctResponses++;
            this.controller.addScore(20);
            sound.playSuccess();
        } else {
            this.flipped[0].isFlipped = false;
            this.flipped[1].isFlipped = false;
            this.controller.registerError();
        }
        this.flipped = [];
        this.isProcessing = false;

        if (this.matched === this.cards.length) {
            setTimeout(() => this.startLevel(), 1000);
        }
    }

    loop() {
        if (!this.controller.isPlaying) return;
        this.ctx.clearRect(0, 0, 800, 500);

        this.cards.forEach(card => {
            this.ctx.save();
            if (card.isFlipped || card.isMatched) {
                this.ctx.fillStyle = card.isMatched ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255,255,255,0.1)';
                this.ctx.strokeStyle = card.isMatched ? '#22c55e' : '#38bdf8';
            } else {
                this.ctx.fillStyle = '#1e293b';
                this.ctx.strokeStyle = '#475569';
            }
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.roundRect(card.x, card.y, card.w, card.h, 10);
            this.ctx.fill();
            this.ctx.stroke();

            if (card.isFlipped || card.isMatched) {
                this.ctx.fillStyle = '#ffffff';
                this.ctx.font = '40px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(card.icon, card.x + card.w/2, card.y + card.h/2);
            }
            this.ctx.restore();
        });

        this.animationFrameId = requestAnimationFrame(this.loop.bind(this));
    }

    destroy() {
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        this.canvas.removeEventListener('mousedown', this.handleClickBound);
    }
}
