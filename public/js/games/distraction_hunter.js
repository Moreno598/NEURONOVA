/* -------------------------------------------------------------
   GAME: CAZADORES DE DISTRACCIONES (Selective Attention)
   ------------------------------------------------------------- */

export default class DistractionHunter {
    constructor(canvas, ctx, controller) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.controller = controller;
        this.animationFrameId = null;
        
        this.targets = [];
        this.distractors = [];
        this.particles = [];
        
        this.spawnTimer = 0;
        this.spawnRate = 120; // frame count between spawns
        this.speedMultiplier = 1.0;
        
        this.handleClickBound = this.handleClick.bind(this);
    }

    init() {
        this.canvas.addEventListener('mousedown', this.handleClickBound);
        
        // Setup difficulty parameters
        if (this.controller.difficulty === 'easy') {
            this.spawnRate = 140;
            this.speedMultiplier = 0.75;
        } else if (this.controller.difficulty === 'hard') {
            this.spawnRate = 90;
            this.speedMultiplier = 1.35;
        }

        this.loop();
    }

    adjustPacing(slowDown) {
        if (slowDown) {
            this.speedMultiplier = Math.max(0.5, this.speedMultiplier - 0.2);
            this.spawnRate = Math.min(200, this.spawnRate + 30);
        }
    }

    spawnObjects() {
        this.spawnTimer++;
        const currentSpawnRate = Math.max(30, this.spawnRate - (this.controller.gameTime * 1.5));
        
        if (this.spawnTimer >= currentSpawnRate) {
            this.spawnTimer = 0;
            
            // Spawn Target (Energy Spark)
            this.targets.push({
                x: Math.random() * (800 - 60) + 30,
                y: Math.random() * (500 - 60) + 30,
                radius: 20 + Math.random() * 8,
                pulse: 0,
                pulseSpeed: 0.05 + Math.random() * 0.05,
                color: 'hsl(195, 100%, 65%)',
                life: Math.max(60, 180 - (this.controller.gameTime * 2)) // Less time to click
            });
            this.controller.totalStimuli++;

            // Spawn Distractor (Asteroid or fake spark)
            if (Math.random() < 0.7) {
                const angle = Math.random() * Math.PI * 2;
                const dynamicSpeedMultiplier = this.speedMultiplier + (this.controller.gameTime * 0.03);
                const speed = (1 + Math.random() * 2) * dynamicSpeedMultiplier;
                this.distractors.push({
                    x: Math.random() * 800,
                    y: -30,
                    vx: Math.cos(angle) * speed,
                    vy: Math.abs(Math.sin(angle) * speed) + 0.5, // always drift downwards
                    radius: 15 + Math.random() * 15,
                    isAsteroid: Math.random() > 0.4,
                    color: Math.random() > 0.4 ? 'hsl(0, 80%, 55%)' : '#64748b',
                    wiggle: Math.random() * 10
                });
            }
        }
    }

    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) * (800 / rect.width);
        const mouseY = (e.clientY - rect.top) * (500 / rect.height);
        
        let targetClicked = false;
        let distractorClicked = false;

        // Check if target clicked
        for (let i = this.targets.length - 1; i >= 0; i--) {
            const t = this.targets[i];
            const dist = Math.hypot(mouseX - t.x, mouseY - t.y);
            if (dist <= t.radius + 10) {
                targetClicked = true;
                this.targets.splice(i, 1);
                this.controller.addScore(15);
                this.controller.correctResponses++;
                this.createExplosion(t.x, t.y, 'hsl(195, 100%, 65%)');
                break;
            }
        }

        if (!targetClicked) {
            // Check if distractor clicked
            for (let i = this.distractors.length - 1; i >= 0; i--) {
                const d = this.distractors[i];
                const dist = Math.hypot(mouseX - d.x, mouseY - d.y);
                if (dist <= d.radius + 10) {
                    distractorClicked = true;
                    this.distractors.splice(i, 1);
                    this.controller.registerError();
                    this.createExplosion(d.x, d.y, 'hsl(0, 80%, 50%)');
                    break;
                }
            }
        }

        // Impulsive clicking in empty space
        if (!targetClicked && !distractorClicked) {
            // Register an empty click, but don't count it as a major error unless spamming
            this.createExplosion(mouseX, mouseY, 'hsla(0, 0%, 50%, 0.3)', 3);
            this.controller.impulseClicks++;
            
            if (this.controller.impulseClicks % 5 === 0) {
                this.controller.registerError();
            }
        }
    }

    createExplosion(x, y, color, count = 15) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 4;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: 1 + Math.random() * 3,
                color,
                alpha: 1,
                decay: 0.02 + Math.random() * 0.02
            });
        }
    }

    loop() {
        if (!this.controller.isPlaying) return;

        this.ctx.clearRect(0, 0, 800, 500);

        // Render Background Grid
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        this.ctx.lineWidth = 1;
        const gridSize = 40;
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

        // Spawn targets/distractors
        this.spawnObjects();

        // Update & Render Targets
        for (let i = this.targets.length - 1; i >= 0; i--) {
            const t = this.targets[i];
            t.life--;
            t.pulse += t.pulseSpeed;

            if (t.life <= 0) {
                this.targets.splice(i, 1);
                // Inattention: Target disappeared without clicking
                continue;
            }

            const currentRadius = t.radius + Math.sin(t.pulse) * 4;
            
            // Draw outer energy rings
            this.ctx.strokeStyle = t.color;
            this.ctx.lineWidth = 2;
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = t.color;
            
            this.ctx.beginPath();
            this.ctx.arc(t.x, t.y, currentRadius + 6, 0, Math.PI * 2);
            this.ctx.stroke();

            // Draw core
            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(t.x, t.y, currentRadius - 5, 0, Math.PI * 2);
            this.ctx.fill();

            // Draw life timer circle ring
            const maxLife = Math.max(60, 180 - (this.controller.gameTime * 2));
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(t.x, t.y, currentRadius + 12, -Math.PI / 2, (Math.PI * 2) * (t.life / maxLife) - Math.PI / 2);
            this.ctx.stroke();
        }

        // Update & Render Distractors
        for (let i = this.distractors.length - 1; i >= 0; i--) {
            const d = this.distractors[i];
            d.x += d.vx;
            d.y += d.vy;
            d.wiggle += 0.05;

            // Remove if off screen
            if (d.y > 500 + 40 || d.x < -40 || d.x > 800 + 40) {
                this.distractors.splice(i, 1);
                continue;
            }

            this.ctx.shadowBlur = 0; // reset shadow
            
            if (d.isAsteroid) {
                // Draw floating gray rock
                this.ctx.fillStyle = '#4a5568';
                this.ctx.strokeStyle = '#2d3748';
                this.ctx.lineWidth = 2;
                
                this.ctx.beginPath();
                this.ctx.arc(d.x + Math.sin(d.wiggle) * 2, d.y, d.radius, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.stroke();
                
                // Draw craters
                this.ctx.fillStyle = '#2d3748';
                this.ctx.beginPath();
                this.ctx.arc(d.x + Math.sin(d.wiggle) * 2 - d.radius/3, d.y - d.radius/3, d.radius/4, 0, Math.PI * 2);
                this.ctx.fill();
            } else {
                // Fake energy spark (Red warning decoy)
                this.ctx.shadowBlur = 10;
                this.ctx.shadowColor = d.color;
                this.ctx.fillStyle = d.color;
                this.ctx.beginPath();
                this.ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }

        // Update & Render Particles
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
            this.ctx.shadowBlur = 5;
            this.ctx.shadowColor = p.color;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        }

        this.ctx.shadowBlur = 0; // standard reset

        // Request next frame
        this.animationFrameId = requestAnimationFrame(this.loop.bind(this));
    }

    destroy() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        this.canvas.removeEventListener('mousedown', this.handleClickBound);
    }
}
