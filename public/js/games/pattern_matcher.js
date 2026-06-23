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
        let types = ['circle', 'square', 'triangle', 'star'];
        let colors = ['#38bdf8', '#a78bfa', '#facc15', '#22c55e', '#ef4444'];
        
        let baseType = types[Math.floor(Math.random() * types.length)];
        let baseColor = colors[Math.floor(Math.random() * colors.length)];
        
        let diffType = baseType;
        let diffColor = baseColor;
        
        if (Math.random() > 0.5) {
            // different type
            while (diffType === baseType) diffType = types[Math.floor(Math.random() * types.length)];
        } else {
            // different color
            while (diffColor === baseColor) diffColor = colors[Math.floor(Math.random() * colors.length)];
        }

        let diffIndex = Math.floor(Math.random() * 4);
        
        let positions = [
            {x: 200, y: 250}, {x: 333, y: 250}, {x: 466, y: 250}, {x: 600, y: 250}
        ];

        for (let i = 0; i < 4; i++) {
            this.shapes.push({
                x: positions[i].x,
                y: positions[i].y,
                type: i === diffIndex ? diffType : baseType,
                color: i === diffIndex ? diffColor : baseColor,
                isDiff: i === diffIndex,
                radius: 40
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
        this.ctx.fillStyle = s.color;
        this.ctx.beginPath();
        if (s.type === 'circle') {
            this.ctx.arc(s.x, s.y, s.radius, 0, Math.PI*2);
        } else if (s.type === 'square') {
            this.ctx.rect(s.x - s.radius, s.y - s.radius, s.radius*2, s.radius*2);
        } else if (s.type === 'triangle') {
            this.ctx.moveTo(s.x, s.y - s.radius);
            this.ctx.lineTo(s.x + s.radius, s.y + s.radius);
            this.ctx.lineTo(s.x - s.radius, s.y + s.radius);
        } else if (s.type === 'star') {
            for(let i=0; i<5; i++) {
                this.ctx.lineTo(Math.cos((18 + i*72)/180*Math.PI)*s.radius + s.x,
                                -Math.sin((18 + i*72)/180*Math.PI)*s.radius + s.y);
                this.ctx.lineTo(Math.cos((54 + i*72)/180*Math.PI)*s.radius/2 + s.x,
                                -Math.sin((54 + i*72)/180*Math.PI)*s.radius/2 + s.y);
            }
        }
        this.ctx.fill();
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
