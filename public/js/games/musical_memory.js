/* -------------------------------------------------------------
   GAME: MEMORIA MUSICAL ADAPTATIVA (Auditory Working Memory)
   ------------------------------------------------------------- */

import { sound } from '../sound.js';

export default class MemoryTones {
    constructor(canvas, ctx, controller) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.controller = controller;
        this.animationFrameId = null;

        this.pads = [];
        this.sequence = [];
        this.userSequence = [];
        
        this.gameState = 'showing'; // 'showing', 'input', 'success', 'failure'
        this.playbackIndex = 0;
        this.playbackTimer = 0;
        this.playbackSpeed = 40; // frames per note
        this.playbackGap = 18;
        this.activePadIndex = -1;
        
        this.sequenceLength = 3;
        this.round = 1;
        
        this.handleClickBound = this.handleClick.bind(this);
    }

    init() {
        this.canvas.addEventListener('mousedown', this.handleClickBound);

        // Define 4 musical sound pads in quarters of the space
        const halfW = 800 / 2;
        const halfH = 500 / 2;
        const padding = 15;
        
        // Pad 1: Red/Top-Left (C4)
        this.pads.push({
            id: 0,
            x: padding,
            y: 50,
            w: halfW - padding * 1.5,
            h: halfH - 60,
            color: '#ef4444',
            glowColor: 'rgba(239, 68, 68, 0.4)',
            freq: 261.63,
            label: "🔴 Do (C4)"
        });

        // Pad 2: Green/Top-Right (E4)
        this.pads.push({
            id: 1,
            x: halfW + padding * 0.5,
            y: 50,
            w: halfW - padding * 1.5,
            h: halfH - 60,
            color: '#22c55e',
            glowColor: 'rgba(34, 197, 94, 0.4)',
            freq: 329.63,
            label: "🟢 Mi (E4)"
        });

        // Pad 3: Blue/Bottom-Left (G4)
        this.pads.push({
            id: 2,
            x: padding,
            y: halfH + 10,
            w: halfW - padding * 1.5,
            h: halfH - 60,
            color: '#38bdf8',
            glowColor: 'rgba(56, 189, 248, 0.4)',
            freq: 392.00,
            label: "🔵 Sol (G4)"
        });

        // Pad 4: Yellow/Bottom-Right (C5)
        this.pads.push({
            id: 3,
            x: halfW + padding * 0.5,
            y: halfH + 10,
            w: halfW - padding * 1.5,
            h: halfH - 60,
            color: '#fbbf24',
            glowColor: 'rgba(251, 191, 36, 0.4)',
            freq: 523.25,
            label: "🟡 Do (C5)"
        });

        if (this.controller.difficulty === 'easy') {
            this.sequenceLength = 2;
            this.playbackSpeed = 50;
        } else if (this.controller.difficulty === 'hard') {
            this.sequenceLength = 4;
            this.playbackSpeed = 30;
        }

        this.generateSequence();
        this.startSequencePlayback();
        this.loop();
    }

    generateSequence() {
        this.sequence = [];
        for (let i = 0; i < this.sequenceLength; i++) {
            this.sequence.push(Math.floor(Math.random() * 4));
        }
        this.controller.totalStimuli = this.sequence.length;
    }

    startSequencePlayback() {
        this.gameState = 'showing';
        this.playbackIndex = 0;
        this.playbackTimer = 0;
        this.activePadIndex = -1;
        this.userSequence = [];
    }

    adjustPacing(slowDown) {
        if (slowDown) {
            this.playbackSpeed = Math.min(70, this.playbackSpeed + 8);
        }
    }

    handleClick(e) {
        if (this.gameState !== 'input') return;

        const rect = this.canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) * (800 / rect.width);
        const mouseY = (e.clientY - rect.top) * (500 / rect.height);
        
        let clickedPad = -1;
        for (let i = 0; i < this.pads.length; i++) {
            const pad = this.pads[i];
            if (mouseX >= pad.x && mouseX <= pad.x + pad.w &&
                mouseY >= pad.y && mouseY <= pad.y + pad.h) {
                clickedPad = i;
                break;
            }
        }

        if (clickedPad !== -1) {
            this.flashPad(clickedPad);
            this.userSequence.push(clickedPad);
            
            const step = this.userSequence.length - 1;
            
            // Check note correctness
            if (this.userSequence[step] === this.sequence[step]) {
                this.controller.correctResponses++;
                
                if (this.userSequence.length === this.sequence.length) {
                    // Sequence completed successfully
                    this.gameState = 'success';
                    this.controller.addScore(20 * this.round);
                    setTimeout(() => {
                        this.round++;
                        this.sequenceLength++;
                        this.playbackSpeed = Math.max(15, this.playbackSpeed - 2); // Faster playback
                        this.generateSequence();
                        this.startSequencePlayback();
                    }, 1200);
                }
            } else {
                // Mistake
                this.gameState = 'failure';
                this.controller.registerError();
                
                // Flash incorrect visual display
                this.activePadIndex = this.sequence[step];
                setTimeout(() => {
                    this.activePadIndex = -1;
                    this.startSequencePlayback(); // replay sequence
                }, 1500);
            }
        }
    }

    flashPad(index) {
        const pad = this.pads[index];
        this.activePadIndex = index;
        sound.playTone(pad.freq, 0.4, 'triangle');
        
        setTimeout(() => {
            if (this.activePadIndex === index && this.gameState !== 'showing') {
                this.activePadIndex = -1;
            }
        }, 300);
    }

    loop() {
        if (!this.controller.isPlaying) return;

        this.ctx.clearRect(0, 0, 800, 500);

        // Update sequence play
        if (this.gameState === 'showing') {
            this.playbackTimer++;
            const totalFrameTime = this.playbackSpeed + this.playbackGap;
            
            if (this.playbackTimer < this.playbackSpeed) {
                this.activePadIndex = this.sequence[this.playbackIndex];
                
                if (this.playbackTimer === 1) {
                    const pad = this.pads[this.activePadIndex];
                    sound.playTone(pad.freq, (this.playbackSpeed / 60), 'triangle');
                }
            } else if (this.playbackTimer < totalFrameTime) {
                this.activePadIndex = -1;
            } else {
                this.playbackTimer = 0;
                this.playbackIndex++;
                
                if (this.playbackIndex >= this.sequence.length) {
                    this.gameState = 'input';
                    this.activePadIndex = -1;
                }
            }
        }

        // Render Pad Buttons
        this.pads.forEach((pad, idx) => {
            const isActive = this.activePadIndex === idx;
            
            this.ctx.save();
            
            // Neon Glow styling
            if (isActive) {
                this.ctx.shadowBlur = 35;
                this.ctx.shadowColor = pad.color;
                this.ctx.fillStyle = pad.color;
                
                if (this.gameState === 'failure') {
                    this.ctx.shadowColor = '#ef4444';
                    this.ctx.fillStyle = '#ef4444';
                }
            } else {
                this.ctx.shadowBlur = 0;
                this.ctx.fillStyle = 'rgba(21, 29, 43, 0.85)';
            }
            
            this.ctx.strokeStyle = isActive ? '#ffffff' : 'rgba(255,255,255,0.1)';
            this.ctx.lineWidth = isActive ? 3 : 1.5;

            // Rounded rectangle pad body
            this.ctx.beginPath();
            this.ctx.roundRect(pad.x, pad.y, pad.w, pad.h, 16);
            this.ctx.fill();
            this.ctx.stroke();
            
            // Pad inside text
            this.ctx.fillStyle = isActive ? '#000000' : '#ffffff';
            this.ctx.font = 'bold 15px Outfit';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(pad.label, pad.x + pad.w/2, pad.y + pad.h/2);

            this.ctx.restore();
        });

        // Instructions banner
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 16px Outfit';
        this.ctx.textAlign = 'center';
        
        if (this.gameState === 'showing') {
            this.ctx.fillText("Escucha los tonos musicales...", 800 / 2, 28);
        } else if (this.gameState === 'input') {
            this.ctx.fillText("¡Tu turno! Repite las notas musicales.", 800 / 2, 28);
        } else if (this.gameState === 'success') {
            this.ctx.fillStyle = '#22c55e';
            this.ctx.fillText("¡Excelente oído! Sumando dificultad...", 800 / 2, 28);
        } else if (this.gameState === 'failure') {
            this.ctx.fillStyle = '#ef4444';
            this.ctx.fillText("¡Oh, te perdiste! Observa el tono correcto...", 800 / 2, 28);
        }

        this.animationFrameId = requestAnimationFrame(this.loop.bind(this));
    }

    destroy() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        this.canvas.removeEventListener('mousedown', this.handleClickBound);
    }
}
