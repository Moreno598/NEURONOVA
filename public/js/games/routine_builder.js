/* -------------------------------------------------------------
   GAME: CONSTRUCTOR DE RUTINAS (Planning & Organization)
   ------------------------------------------------------------- */

import { sound } from '../sound.js';
import { coach } from '../neurocoach.js';

export default class RoutineBuilder {
    constructor(canvas, ctx, controller) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.controller = controller;
        
        this.activities = [
            { id: 'study', name: '✏️ Estudiar', energyCost: -30, value: 25, allowedTimes: ['morning', 'afternoon'] },
            { id: 'break', name: '🤸 Pausa Activa', energyCost: 20, value: 10, allowedTimes: ['morning', 'afternoon', 'evening'] },
            { id: 'play', name: '🎮 Recreo / Videojuego', energyCost: 10, value: 15, allowedTimes: ['afternoon', 'evening'] },
            { id: 'sleep', name: '💤 Dormir', energyCost: 40, value: 20, allowedTimes: ['night'] }
        ];

        this.timeSlots = [
            { id: 'morning', name: '🌅 Mañana (9:00 - 13:00)', assigned: null },
            { id: 'afternoon', name: '☀️ Tarde (13:00 - 17:00)', assigned: null },
            { id: 'evening', name: '🌇 Atardecer (17:00 - 21:00)', assigned: null },
            { id: 'night', name: '🌌 Noche (21:00 - 5:00)', assigned: null }
        ];

        this.selectedActivityIdx = -1;
        this.energy = 50; // starts mid energy
        this.routineBalance = 100;
        this.dayCount = 1;
        this.animationFrameId = null;
        
        this.isDragging = false;
        this.dragX = 0;
        this.dragY = 0;

        this.handleMouseDownBound = this.handleMouseDown.bind(this);
        this.handleMouseMoveBound = this.handleMouseMove.bind(this);
        this.handleMouseUpBound = this.handleMouseUp.bind(this);
    }

    init() {
        this.canvas.addEventListener('mousedown', this.handleMouseDownBound);
        window.addEventListener('mousemove', this.handleMouseMoveBound);
        window.addEventListener('mouseup', this.handleMouseUpBound);
        this.controller.totalStimuli = 4; // 4 slots to fill per day
        this.loop();
    }

    adjustPacing(slowDown) {
        // Pacing adjustments for organization are simulated in game complexity,
        // e.g. reducing the baseline fatigue drain.
    }

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        // The game virtual size is 800x500. Map the CSS pixels to the virtual space.
        const mouseX = (e.clientX - rect.left) * (800 / rect.width);
        const mouseY = (e.clientY - rect.top) * (500 / rect.height);

        // 1. Check if an activity card was selected from left
        const cardWidth = 180;
        const cardHeight = 50;
        const startX = 30;
        
        for (let i = 0; i < this.activities.length; i++) {
            const cardX = startX;
            const cardY = 110 + i * (cardHeight + 15);
            
            if (mouseX >= cardX && mouseX <= cardX + cardWidth &&
                mouseY >= cardY && mouseY <= cardY + cardHeight) {
                this.selectedActivityIdx = i;
                this.isDragging = true;
                this.dragX = mouseX;
                this.dragY = mouseY;
                sound.playPop();
                return;
            }
        }

        // 2. Check if clicking an already assigned slot to drag it out
        const slotWidth = 460;
        const slotHeight = 60;
        const slotX = 270;
        
        for (let i = 0; i < this.timeSlots.length; i++) {
            const sY = 110 + i * (slotHeight + 16);
            if (mouseX >= slotX && mouseX <= slotX + slotWidth &&
                mouseY >= sY && mouseY <= sY + slotHeight) {
                
                if (this.timeSlots[i].assigned) {
                    const act = this.timeSlots[i].assigned;
                    this.selectedActivityIdx = this.activities.findIndex(a => a.id === act.id);
                    this.timeSlots[i].assigned = null;
                    this.calculateBalance();
                    this.isDragging = true;
                    this.dragX = mouseX;
                    this.dragY = mouseY;
                    sound.playPop();
                }
                return;
            }
        }
    }

    handleMouseMove(e) {
        if (!this.isDragging || this.selectedActivityIdx === -1) return;
        const rect = this.canvas.getBoundingClientRect();
        this.dragX = (e.clientX - rect.left) * (800 / rect.width);
        this.dragY = (e.clientY - rect.top) * (500 / rect.height);
    }

    handleMouseUp(e) {
        if (!this.isDragging) return;
        this.isDragging = false;
        
        const mouseX = this.dragX;
        const mouseY = this.dragY;

        const slotWidth = 460;
        const slotHeight = 60;
        const slotX = 270;
        
        let droppedOnSlot = false;
        for (let i = 0; i < this.timeSlots.length; i++) {
            const sY = 110 + i * (slotHeight + 16);
            
            if (mouseX >= slotX && mouseX <= slotX + slotWidth &&
                mouseY >= sY && mouseY <= sY + slotHeight) {
                
                const activity = this.activities[this.selectedActivityIdx];
                this.timeSlots[i].assigned = { ...activity };
                this.calculateBalance();
                sound.playPop();
                droppedOnSlot = true;
                
                const filled = this.timeSlots.every(slot => slot.assigned !== null);
                if (filled) {
                    this.validateRoutine();
                }
                break;
            }
        }
        
        this.selectedActivityIdx = -1;
    }

    calculateBalance() {
        let currentEnergy = 50;
        let penalty = 0;
        let studyChain = 0;

        for (let i = 0; i < this.timeSlots.length; i++) {
            const slot = this.timeSlots[i];
            if (!slot.assigned) continue;

            const act = slot.assigned;
            
            // Check allowed time slot (Time awareness)
            if (!act.allowedTimes.includes(slot.id)) {
                penalty += 20; // major penalty for sleeping in afternoon or study at night
            }

            // Energy math
            currentEnergy += act.energyCost;
            currentEnergy = Math.max(0, Math.min(100, currentEnergy));

            // Check study fatigue (Fatiga por hiperfoco desorganizado)
            if (act.id === 'study') {
                studyChain++;
                if (studyChain >= 2) {
                    penalty += 25; // studying consecutively causes fatigue
                }
            } else {
                studyChain = 0; // broken
            }
        }

        this.energy = currentEnergy;
        this.routineBalance = Math.max(0, 100 - penalty);
    }

    validateRoutine() {
        // All slots are filled. Assess success
        const accuracy = this.routineBalance;
        
        this.ctx.fillStyle = '#ffffff';
        
        if (this.routineBalance >= 70) {
            // Success
            this.controller.correctResponses += 4; // 4 slots successfully aligned
            this.controller.addScore(40);
            coach.speak("¡Rutina balanceada! Buen trabajo organizando las tareas y descansos.");
            
            // Clear routine for next level/day
            setTimeout(() => {
                this.dayCount++;
                this.timeSlots.forEach(s => s.assigned = null);
                this.energy = 50;
                this.routineBalance = 100;
            }, 1500);
        } else {
            // Failure / Bad balance
            this.controller.registerError();
            coach.speak("Esta rutina causa fatiga o desorden. Recuerda evitar estudiar seguido y respeta el sueño.");
            
            // Highlight errors by letting user edit
            setTimeout(() => {
                // Clear misaligned items to help them redo
                this.timeSlots.forEach(s => {
                    if (s.assigned && !s.assigned.allowedTimes.includes(s.id)) {
                        s.assigned = null;
                    }
                });
                this.calculateBalance();
            }, 2000);
        }
    }

    loop() {
        if (!this.controller.isPlaying) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Header Title
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 20px Outfit';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Día ${this.dayCount}: Organiza la Rutina Espacial`, 30, 45);

        // Subtitle instructions
        this.ctx.font = '14px Outfit';
        this.ctx.fillStyle = 'rgba(255,255,255,0.4)';
        this.ctx.fillText("Selecciona tarea izq. → asigna al bloque horario.", 30, 70);

        // Draw HUD inside canvas (Energy and Balance)
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '600 14px Outfit';
        this.ctx.fillText(`Energía: ${this.energy}%`, 350, 45);
        
        // Draw Energy Bar
        this.ctx.fillStyle = 'rgba(255,255,255,0.1)';
        this.ctx.fillRect(440, 32, 100, 16);
        const energyColor = this.energy > 70 ? '#22c55e' : (this.energy > 30 ? '#fbbf24' : '#ef4444');
        this.ctx.fillStyle = energyColor;
        this.ctx.fillRect(440, 32, 100 * (this.energy / 100), 16);

        // Draw Balance
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillText(`Balance de Rutina: ${this.routineBalance}%`, 570, 45);

        // Canvas can't use CSS variables - use direct color values
        const COL_PURPLE = '#a78bfa';
        const COL_BLUE   = '#38bdf8';
        const COL_GREEN  = '#22c55e';
        const COL_YELLOW = '#fbbf24';
        const COL_MUTED  = 'rgba(255,255,255,0.45)';
        const COL_CARD   = 'rgba(255,255,255,0.05)';
        const COL_BORDER = 'rgba(255,255,255,0.12)';

        // Draw Left Available Cards List
        this.ctx.font = 'bold 15px Outfit';
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillText("Tareas Disponibles", 30, 95);

        const cardWidth = 180;
        const cardHeight = 50;
        
        this.activities.forEach((act, idx) => {
            const cardX = 30;
            const cardY = 110 + idx * (cardHeight + 15);
            const isSelected = this.selectedActivityIdx === idx;
            const isBeingDragged = isSelected && this.isDragging;

            this.ctx.globalAlpha = isBeingDragged ? 0.3 : 1.0;
            
            // Draw Card Body
            this.ctx.fillStyle = isSelected ? COL_PURPLE : COL_CARD;
            this.ctx.strokeStyle = isSelected ? '#ffffff' : COL_BORDER;
            this.ctx.lineWidth = isSelected ? 3 : 1.5;
            
            this.ctx.beginPath();
            this.ctx.roundRect(cardX, cardY, cardWidth, cardHeight, 10);
            this.ctx.fill();
            this.ctx.stroke();

            // Text
            this.ctx.fillStyle = '#ffffff';
            this.ctx.textAlign = 'left';
            this.ctx.font = 'bold 14px Outfit';
            this.ctx.fillText(act.name, cardX + 15, cardY + 28);
            
            this.ctx.globalAlpha = 1.0;
        });

        // Draw Time slots (Dropzones)
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 15px Outfit';
        this.ctx.fillText("Agenda del Día", 270, 95);

        const slotWidth = 460;
        const slotHeight = 60;
        const slotX = 270;

        this.timeSlots.forEach((slot, idx) => {
            const sY = 110 + idx * (slotHeight + 16);
            const hasAssigned = slot.assigned !== null;

            // Draw Drop Slot
            this.ctx.fillStyle = hasAssigned ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255,255,255,0.02)';
            this.ctx.strokeStyle = hasAssigned ? COL_BLUE : COL_BORDER;
            this.ctx.lineWidth = hasAssigned ? 2.5 : 1;
            
            this.ctx.beginPath();
            this.ctx.roundRect(slotX, sY, slotWidth, slotHeight, 12);
            this.ctx.fill();
            this.ctx.stroke();

            // Slot name
            this.ctx.fillStyle = COL_MUTED;
            this.ctx.font = '500 12px Outfit';
            this.ctx.fillText(slot.name, slotX + 15, sY + 22);

            // Assigned item details
            if (hasAssigned) {
                const actName = slot.assigned.name;
                
                // Draw card inside slot
                this.ctx.fillStyle = COL_BLUE;
                this.ctx.beginPath();
                this.ctx.roundRect(slotX + 180, sY + 12, 260, 36, 8);
                this.ctx.fill();

                this.ctx.fillStyle = '#ffffff';
                this.ctx.font = 'bold 14px Outfit';
                this.ctx.fillText(actName, slotX + 200, sY + 34);

                // Draw delete cross
                this.ctx.fillStyle = 'rgba(255,255,255,0.7)';
                this.ctx.font = '12px sans-serif';
                this.ctx.fillText('✕', slotX + 415, sY + 34);
            } else {
                this.ctx.fillStyle = 'rgba(255,255,255,0.15)';
                this.ctx.font = '13px Outfit';
                this.ctx.fillText("Selecciona una tarea y haz clic aquí", slotX + 180, sY + 38);
            }
        });

        // Warnings and Alerts
        if (this.energy < 20) {
            this.ctx.fillStyle = '#ef4444';
            this.ctx.font = 'bold 13px Outfit';
            this.ctx.fillText("⚠️ ¡Advertencia: Fatiga crítica! Añade pausas activas.", 30, 420);
        }

        // Draw dragged card on top
        if (this.isDragging && this.selectedActivityIdx !== -1) {
            const act = this.activities[this.selectedActivityIdx];
            const dW = 180;
            const dH = 50;
            const dX = this.dragX - dW / 2;
            const dY = this.dragY - dH / 2;

            // Shadow for float effect
            this.ctx.shadowColor = 'rgba(167, 139, 250, 0.4)';
            this.ctx.shadowBlur = 15;
            this.ctx.shadowOffsetY = 5;

            this.ctx.fillStyle = COL_PURPLE;
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 3;
            
            this.ctx.beginPath();
            this.ctx.roundRect(dX, dY, dW, dH, 10);
            this.ctx.fill();
            this.ctx.stroke();

            this.ctx.shadowColor = 'transparent'; // reset shadow
            
            this.ctx.fillStyle = '#ffffff';
            this.ctx.textAlign = 'left';
            this.ctx.font = 'bold 14px Outfit';
            this.ctx.fillText(act.name, dX + 15, dY + 28);
        }

        this.animationFrameId = requestAnimationFrame(this.loop.bind(this));
    }

    destroy() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        this.canvas.removeEventListener('mousedown', this.handleMouseDownBound);
        window.removeEventListener('mousemove', this.handleMouseMoveBound);
        window.removeEventListener('mouseup', this.handleMouseUpBound);
    }
}
