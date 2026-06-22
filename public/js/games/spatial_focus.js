/* -------------------------------------------------------------
   GAME: VIAJE DE ENFOQUE ESPACIAL (Sustained Attention / Spatial Sequence)
   ------------------------------------------------------------- */

import { sound } from '../sound.js';

export default class SpatialFocus {
    constructor(canvas, ctx, controller) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.controller = controller;
        this.animationFrameId = null;

        this.nodes = [];
        this.sequence = [];
        this.userSequence = [];
        
        this.gameState = 'showing'; // 'showing', 'input', 'success', 'failure'
        this.playbackIndex = 0;
        this.playbackTimer = 0;
        this.playbackSpeed = 35; // frames per node
        this.playbackGap = 15;    // gap frames
        this.activeNodeIndex = -1;
        
        this.round = 1;
        this.sequenceLength = 3;
        
        this.handleClickBound = this.handleClick.bind(this);
    }

    init() {
        this.canvas.addEventListener('mousedown', this.handleClickBound);
        
        // Define coordinates for a 3x3 grid of celestial stargates
        const colWidth = 800 / 4;
        const rowHeight = 500 / 4;
        const frequencies = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25, 587.33]; // C4 to D5 tones
        
        let index = 0;
        for (let row = 1; row <= 3; row++) {
            for (let col = 1; col <= 3; col++) {
                this.nodes.push({
                    id: index,
                    x: col * colWidth,
                    y: row * rowHeight,
                    radius: 32,
                    color: `hsl(${(index * 40) % 360}, 85%, 65%)`,
                    freq: frequencies[index],
                    name: `Portal ${index + 1}`
                });
                index++;
            }
        }
        
        if (this.controller.difficulty === 'easy') {
            this.sequenceLength = 2;
            this.playbackSpeed = 45;
        } else if (this.controller.difficulty === 'hard') {
            this.sequenceLength = 4;
            this.playbackSpeed = 25;
        }
        
        this.generateSequence();
        this.startSequencePlayback();
        this.loop();
    }

    generateSequence() {
        this.sequence = [];
        for (let i = 0; i < this.sequenceLength; i++) {
            const randomNode = Math.floor(Math.random() * this.nodes.length);
            this.sequence.push(randomNode);
        }
        this.controller.totalStimuli = this.sequence.length;
    }

    startSequencePlayback() {
        this.gameState = 'showing';
        this.playbackIndex = 0;
        this.playbackTimer = 0;
        this.activeNodeIndex = -1;
        this.userSequence = [];
    }

    adjustPacing(slowDown) {
        if (slowDown) {
            this.playbackSpeed = Math.min(60, this.playbackSpeed + 10);
            this.playbackGap = Math.min(30, this.playbackGap + 5);
        }
    }

    handleClick(e) {
        if (this.gameState !== 'input') return;

        const rect = this.canvas.getBoundingClientRect();
        const scaleX = 800 / rect.width;
        const scaleY = 500 / rect.height;
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;
        
        let clickedNode = -1;
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            const dist = Math.hypot(mouseX - node.x, mouseY - node.y);
            if (dist <= node.radius) {
                clickedNode = i;
                break;
            }
        }

        if (clickedNode !== -1) {
            this.flashNode(clickedNode);
            this.userSequence.push(clickedNode);
            
            const step = this.userSequence.length - 1;
            
            // Check correctness
            if (this.userSequence[step] === this.sequence[step]) {
                // Correct click
                this.controller.correctResponses++;
                if (this.userSequence.length === this.sequence.length) {
                    // Sequence completed successfully
                    this.gameState = 'success';
                    this.controller.addScore(25 * this.round);
                    setTimeout(() => {
                        this.round++;
                        this.sequenceLength++;
                        this.generateSequence();
                        this.startSequencePlayback();
                    }, 1000);
                }
            } else {
                // Mistake
                this.gameState = 'failure';
                this.controller.registerError();
                
                // Show red ring indicator on target node
                this.activeNodeIndex = this.sequence[step];
                setTimeout(() => {
                    this.activeNodeIndex = -1;
                    // Replay current sequence
                    this.startSequencePlayback();
                }, 1200);
            }
        }
    }

    flashNode(index) {
        const node = this.nodes[index];
        this.activeNodeIndex = index;
        sound.playTone(node.freq, 0.3, 'sine');
        
        setTimeout(() => {
            if (this.activeNodeIndex === index && this.gameState !== 'showing') {
                this.activeNodeIndex = -1;
            }
        }, 300);
    }

    loop() {
        if (!this.controller.isPlaying) return;

        this.ctx.clearRect(0, 0, 800, 500);

        // Render Connections (Constellation lines connecting sequence)
        if (this.gameState === 'showing' || this.gameState === 'success') {
            this.ctx.strokeStyle = 'rgba(167, 139, 250, 0.15)';
            this.ctx.lineWidth = 4;
            this.ctx.beginPath();
            for (let i = 0; i < this.sequence.length - 1; i++) {
                const n1 = this.nodes[this.sequence[i]];
                const n2 = this.nodes[this.sequence[i+1]];
                this.ctx.moveTo(n1.x, n1.y);
                this.ctx.lineTo(n2.x, n2.y);
            }
            this.ctx.stroke();
        }

        // Update Sequence Playback
        if (this.gameState === 'showing') {
            this.playbackTimer++;
            const totalFrameTime = this.playbackSpeed + this.playbackGap;
            
            if (this.playbackTimer < this.playbackSpeed) {
                this.activeNodeIndex = this.sequence[this.playbackIndex];
                
                // Trigger synth on first frame of display
                if (this.playbackTimer === 1) {
                    const node = this.nodes[this.activeNodeIndex];
                    sound.playTone(node.freq, (this.playbackSpeed / 60), 'sine');
                }
            } else if (this.playbackTimer < totalFrameTime) {
                this.activeNodeIndex = -1;
            } else {
                this.playbackTimer = 0;
                this.playbackIndex++;
                
                if (this.playbackIndex >= this.sequence.length) {
                    this.gameState = 'input';
                    this.activeNodeIndex = -1;
                }
            }
        }

        // Render Nodes
        this.nodes.forEach((node, idx) => {
            const isActive = this.activeNodeIndex === idx;
            
            this.ctx.save();
            
            if (isActive) {
                this.ctx.shadowBlur = 25;
                this.ctx.shadowColor = node.color;
                this.ctx.fillStyle = node.color;
                
                // If it's a failure flash, show red outer circle
                if (this.gameState === 'failure') {
                    this.ctx.shadowColor = '#ef4444';
                    this.ctx.fillStyle = '#ef4444';
                }
            } else {
                this.ctx.shadowBlur = 0;
                this.ctx.fillStyle = 'rgba(30, 41, 59, 0.7)';
            }
            
            // Draw node outer ring
            this.ctx.strokeStyle = isActive ? '#ffffff' : node.color;
            this.ctx.lineWidth = isActive ? 3 : 2;
            
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
            
            // Node core
            this.ctx.fillStyle = isActive ? '#ffffff' : 'rgba(255,255,255,0.07)';
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, node.radius - 12, 0, Math.PI * 2);
            this.ctx.fill();

            // Label text inside nodes for cognitive reference
            this.ctx.fillStyle = isActive ? '#000000' : '#ffffff';
            this.ctx.font = 'bold 16px Outfit';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(node.id + 1, node.x, node.y);
            
            this.ctx.restore();
        });

        // Instructional banner drawing on screen
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 16px Outfit';
        this.ctx.textAlign = 'center';
        
        if (this.gameState === 'showing') {
            this.ctx.fillText("Mira la secuencia espacial...", 800 / 2, 30);
        } else if (this.gameState === 'input') {
            this.ctx.fillText("¡Tu turno! Repite el patrón en orden.", 800 / 2, 30);
        } else if (this.gameState === 'success') {
            this.ctx.fillStyle = 'hsl(145, 65%, 45%)';
            this.ctx.fillText("¡Excelente secuencia! Siguiente ronda...", 800 / 2, 30);
        } else if (this.gameState === 'failure') {
            this.ctx.fillStyle = '#ef4444';
            this.ctx.fillText("¡Error! Observa la secuencia corregida...", 800 / 2, 30);
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
