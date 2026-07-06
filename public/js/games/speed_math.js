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
        
        if (this.controller.gameTime > 30 && opRand < 0.3) {
            // Multiplication for higher difficulty
            a = Math.floor(Math.random() * (maxNum / 1.5)) + 1;
            b = Math.floor(Math.random() * 10) + 1;
            ans = a * b;
            opStr = 'x';
        } else if (opRand < 0.65) {
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
        
        this.controller.totalStimuli++;
    }

    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = 800 / rect.width;
        const scaleY = 500 / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        let boxW = 100, boxH = 60, startX = 250, gap = 100;
        for (let i = 0; i < 3; i++) {
            let bx = startX + (i * gap) - boxW/2;
            let by = 300 - boxH/2;
            
            if (x > bx && x < bx + boxW && y > by && y < by + boxH) {
                if (i === this.correctIndex) {
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

    loop() {
        if (!this.controller.isPlaying) return;
        this.ctx.clearRect(0, 0, 800, 500);

        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 48px Outfit';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(this.equation, 400, 200);

        let boxW = 80, boxH = 60, startX = 250, gap = 150;
        for (let i = 0; i < 3; i++) {
            let bx = startX + (i * gap) - boxW/2;
            let by = 300 - boxH/2;
            
            this.ctx.fillStyle = '#38bdf8';
            this.ctx.beginPath();
            this.ctx.roundRect(bx, by, boxW, boxH, 10);
            this.ctx.fill();
            
            this.ctx.fillStyle = '#0f172a';
            this.ctx.font = 'bold 32px Outfit';
            this.ctx.fillText(this.answers[i], bx + boxW/2, by + boxH/2 + 10);
        }

        this.animationFrameId = requestAnimationFrame(this.loop.bind(this));
    }

    destroy() {
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        this.canvas.removeEventListener('mousedown', this.handleClickBound);
    }
}
