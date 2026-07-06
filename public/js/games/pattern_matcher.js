/* -------------------------------------------------------------
   GAME: PATTERN MATCHER (Cognitive Flexibility)
   ------------------------------------------------------------- */
import { sound } from '../sound.js';

export default class PatternMatcher {
    constructor(canvas, ctx, controller) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.controller = controller;
        this.animationFrameId = null;
        this.shapes = [];
        this.handleClickBound = this.handleClick.bind(this);
    }

    init() {
        this.canvas.addEventListener('mousedown', this.handleClickBound);
        this.startLevel();
        this.loop();
    }

    startLevel() {
        this.shapes = [];
        let emojis = ['👽', '👾', '🛸', '🚀', '🪐', '☄️', '🌌'];
        
        let baseEmoji = emojis[Math.floor(Math.random() * emojis.length)];
        let diffEmoji = baseEmoji;
        
        // Find a different emoji
        while (diffEmoji === baseEmoji) diffEmoji = emojis[Math.floor(Math.random() * emojis.length)];

        // Difficulty scaling: increase number of shapes as time goes on
        let numShapes = 4 + Math.floor(this.controller.gameTime / 20);
        numShapes = Math.min(numShapes, 8); // cap at 8 shapes

        let diffIndex = Math.floor(Math.random() * numShapes);
        
        let startX = 100;
        let endX = 700;
        let stepX = (endX - startX) / (numShapes - 1);

        for (let i = 0; i < numShapes; i++) {
            // Slight vertical randomness to make it harder
            let yOffset = (Math.random() - 0.5) * 100;
            this.shapes.push({
                x: startX + stepX * i,
                y: 250 + yOffset,
                emoji: i === diffIndex ? diffEmoji : baseEmoji,
                isDiff: i === diffIndex,
                radius: 40 // collision radius
            });
        }
        
        this.controller.totalStimuli++;
    }

    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = 800 / rect.width;
        const scaleY = 500 / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        for (let i = 0; i < this.shapes.length; i++) {
            let s = this.shapes[i];
            let dist = Math.hypot(x - s.x, y - s.y);
            if (dist < s.radius * 1.5) {
                if (s.isDiff) {
                    this.controller.correctResponses++;
                    this.controller.addScore(15);
                    sound.playSuccess();
                } else {
                    this.controller.registerError();
                }
                this.startLevel();
                break;
            }
        }
    }

    drawShape(s) {
        this.ctx.font = '60px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // Dynamic rotation to increase difficulty
        const rotation = (this.controller.gameTime > 30) ? (Math.random() * 0.2 - 0.1) : 0;
        
        this.ctx.save();
        this.ctx.translate(s.x, s.y);
        this.ctx.rotate(rotation);
        
        // Add a subtle glow for better visibility
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = 'rgba(56, 189, 248, 0.4)';
        
        this.ctx.fillText(s.emoji, 0, 0);
        this.ctx.restore();
    }

    loop() {
        if (!this.controller.isPlaying) return;
        this.ctx.clearRect(0, 0, 800, 500);

        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '24px Outfit';
        this.ctx.textAlign = 'center';
        this.ctx.fillText("Selecciona la figura diferente", 400, 100);

        this.shapes.forEach(s => this.drawShape(s));

        this.animationFrameId = requestAnimationFrame(this.loop.bind(this));
    }

    destroy() {
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        this.canvas.removeEventListener('mousedown', this.handleClickBound);
    }
}
