/* eslint-disable */
// NEUROSPARK GAME ENGINE (Game Runner & Difficulty Coordinator)
// -------------------------------------------------------------

import { sound } from './sound.js';
import { coach } from './neurocoach.js';
import { i18n } from './i18n.js';

// Use late-binding bridge to avoid circular imports with app.js
const getApp = () => window.neuroApp;

class GameController {
    constructor() {
        this.activeGame = null;
        this.currentGameId = '';
        this.canvas = null;
        this.ctx = null;
        this.gameInterval = null;
        this.gameTime = 0;
        this.gameScore = 0;
        this.gameErrors = 0;
        this.isPlaying = false;
        this.difficulty = 'medium'; // easy, medium, hard
        
        // Performance Tracking variables
        this.reactionTimes = [];
        this.totalStimuli = 0;
        this.correctResponses = 0;
        this.impulseClicks = 0;
    }

    launch(gameId) {
        this.currentGameId = gameId;
        this.isPlaying = true;
        this.gameTime = 0;
        this.gameScore = 0;
        this.gameErrors = 0;
        this.reactionTimes = [];
        this.totalStimuli = 0;
        this.correctResponses = 0;
        this.impulseClicks = 0;
        
        // Auto adapt difficulty from history of this game
        this.adaptDifficulty(gameId);

        // Load the view in the app
        const mount = document.getElementById('app-view-mount');
        mount.innerHTML = `
            <div class="game-space-view">
                <div class="game-space-header">
                    <button class="exit-game-btn" id="btn-exit-game">
                        <i class="fa-solid fa-arrow-left"></i> ${i18n.t('hudExit')}
                    </button>
                    <div class="game-hud-stats">
                        <div class="hud-item" title="${i18n.t('hudTime')}">
                            <i class="fa-solid fa-clock text-blue"></i>
                            <span id="game-hud-time">60s</span>
                        </div>
                        <div class="hud-item" title="${i18n.t('hudScore')}">
                            <i class="fa-solid fa-coins gold-text"></i>
                            <span id="game-hud-score">0</span>
                        </div>
                        <div class="hud-item" title="${i18n.t('hudLevel')}">
                            <i class="fa-solid fa-gauge-high text-purple"></i>
                            <span id="game-hud-diff" class="difficulty-badge diff-${this.difficulty}">
                                ${this.difficulty.toUpperCase()}
                            </span>
                        </div>
                        <div class="hud-item" title="${i18n.t('hudErrors')}">
                            <i class="fa-solid fa-circle-exclamation" style="color: #ef4444;"></i>
                            <span id="game-hud-errors">0</span>
                        </div>
                    </div>
                </div>
                
                <div class="game-canvas-wrapper" id="game-canvas-container" style="position: relative;">
                    <canvas id="game-canvas" width="800" height="500"></canvas>
                    <div id="game-instructions-overlay" style="position: absolute; inset: 0; background: rgba(15,23,42,0.95); backdrop-filter: blur(8px); z-index: 100; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 40px; border-radius: inherit;">
                        <div class="game-thumbnail anim-bg-${gameId}" style="width:120px; height:120px; border-radius:50%; margin:0 auto 20px auto; display:flex; justify-content:center; align-items:center; position:relative; overflow:hidden; box-shadow:0 0 30px rgba(56,189,248,0.2);">
                            <div class="premium-3d-orb" style="position:relative; width:90px; height:90px; margin:0;">
                                <i class="fa-solid fa-graduation-cap" style="font-size: 2.5rem; color: #38bdf8; position: relative; z-index: 2; text-shadow: 0 0 10px rgba(56,189,248,0.8);"></i>
                            </div>
                        </div>
                        <h2 style="font-size: 2rem; color: white; margin-bottom: 15px;">Misión Cognitiva</h2>
                        <p id="game-instructions-text" style="color: #cbd5e1; font-size: 1.15rem; max-width: 650px; margin-bottom: 30px; line-height: 1.6;"></p>
                        <button id="btn-start-mission" style="background: linear-gradient(135deg, #38bdf8, #818cf8); border: none; padding: 15px 40px; border-radius: 12px; font-size: 1.2rem; font-weight: bold; color: white; cursor: pointer; box-shadow: 0 10px 20px rgba(56, 189, 248, 0.3);">🚀 Iniciar Entrenamiento</button>
                    </div>
                </div>
            </div>
        `;

        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Populate instructions with cognitive benefits
        const instructionsDict = {
            'distraction_hunter': '<strong>🕹️ Instrucciones:</strong> Destruye solo los asteroides o amenazas válidas. Ignora y no toques los elementos de distracción.<br><br><strong style="color:#a78bfa;">🧠 ¿En qué te ayuda?</strong><br>Entrena tu <em>atención selectiva</em>, ayudándote a ignorar el ruido y las distracciones a tu alrededor para concentrarte en una sola tarea.',
            
            'emotional_stoplight': '<strong>🕹️ Instrucciones:</strong> Presiona la pantalla rápido cuando veas el indicador en VERDE. Si aparece en ROJO, frena tu impulso y no toques nada.<br><br><strong style="color:#a78bfa;">🧠 ¿En qué te ayuda?</strong><br>Mejora tu <em>control inhibitorio</em>, dándote la capacidad de pensar antes de actuar y evitar respuestas impulsivas.',
            
            'musical_memory': '<strong>🕹️ Instrucciones:</strong> Escucha y observa la secuencia de sonidos. Luego, repite el patrón en el mismo orden exacto.<br><br><strong style="color:#a78bfa;">🧠 ¿En qué te ayuda?</strong><br>Fortalece tu <em>memoria de trabajo visual y auditiva</em> a corto plazo, vital para seguir instrucciones de múltiples pasos.',
            
            'memory_cards': '<strong>🕹️ Instrucciones:</strong> Encuentra las parejas ocultas en el tablero en el menor tiempo posible.<br><br><strong style="color:#a78bfa;">🧠 ¿En qué te ayuda?</strong><br>Trabaja tu <em>retención de memoria visual espacial</em> y tu capacidad de recordar la ubicación de objetos.',
            
            'kids_spatial': '<strong>🕹️ Instrucciones:</strong> Observa el camino iluminado en el laberinto. Retén la secuencia de pasos y replícala exactamente.<br><br><strong style="color:#a78bfa;">🧠 ¿En qué te ayuda?</strong><br>Estimula tu <em>orientación espacial</em>, ayudándote a ubicarte en tu entorno y recordar rutas.',
            
            'kids_routine': '<strong>🕹️ Instrucciones:</strong> Organiza las tareas diarias en la agenda. ¡Cuidado con sobrecargar la energía del astronauta!<br><br><strong style="color:#a78bfa;">🧠 ¿En qué te ayuda?</strong><br>Desarrolla tu <em>función ejecutiva de planificación</em>, enseñándote a gestionar tu tiempo de forma equilibrada.',
            
            'kids_pattern': '<strong>🕹️ Instrucciones:</strong> Identifica rápidamente la figura intrusa que es diferente al resto.<br><br><strong style="color:#a78bfa;">🧠 ¿En qué te ayuda?</strong><br>Ejercita tu <em>flexibilidad cognitiva</em> y agilidad mental, permitiéndote cambiar de tarea y adaptarte con facilidad.',
            
            'kids_math': '<strong>🕹️ Instrucciones:</strong> Resuelve la operación matemática correcta antes de que el meteoro choque.<br><br><strong style="color:#a78bfa;">🧠 ¿En qué te ayuda?</strong><br>Mejora tu <em>velocidad de procesamiento</em> y fluidez numérica bajo ligera presión.',
            
            'spatial_focus': '<strong>🕹️ Instrucciones:</strong> Mantén tu vista en los objetivos. Un barrido visual constante es la clave.<br><br><strong style="color:#a78bfa;">🧠 ¿En qué te ayuda?</strong><br>Entrena tu <em>atención sostenida</em> y tu capacidad de rastrear información visual durante períodos prolongados.',
            
            'routine_builder': '<strong>🕹️ Instrucciones:</strong> Acomoda las tareas diarias priorizando responsabilidades y tiempo de descanso.<br><br><strong style="color:#a78bfa;">🧠 ¿En qué te ayuda?</strong><br>Fomenta la <em>planificación estratégica</em> y te ayuda a crear hábitos de estudio efectivos y saludables.',
            
            'pattern_matcher': '<strong>🕹️ Instrucciones:</strong> Encuentra la anomalía en el panel visual, alternando entre distintos tipos de patrones.<br><br><strong style="color:#a78bfa;">🧠 ¿En qué te ayuda?</strong><br>Aumenta tu capacidad de <em>adaptación y reconocimiento de patrones complejos</em>.',
            
            'speed_math': '<strong>🕹️ Instrucciones:</strong> Resuelve operaciones de cálculo mental rápido sin usar calculadora.<br><br><strong style="color:#a78bfa;">🧠 ¿En qué te ayuda?</strong><br>Fortalece la <em>automatización cognitiva</em>, haciendo que tu mente resuelva problemas estructurados casi sin esfuerzo.',
            
            'teens_distraction': '<strong>🕹️ Instrucciones:</strong> Ataca los objetivos clave filtrando la información irrelevante en un entorno lleno de ruido visual.<br><br><strong style="color:#a78bfa;">🧠 ¿En qué te ayuda?</strong><br>Potencia tu <em>atención selectiva extrema</em>, ideal para poder estudiar en ambientes con muchas distracciones.',
            
            'teens_stoplight': '<strong>🕹️ Instrucciones:</strong> Reacciona rapidísimo al inicio (verde), pero detén tu respuesta motora si cambia repentinamente a rojo.<br><br><strong style="color:#a78bfa;">🧠 ¿En qué te ayuda?</strong><br>Refina tu <em>frenado motor y control de impulsos avanzado</em> ante situaciones imprevistas o estresantes.',
            
            'teens_sound': '<strong>🕹️ Instrucciones:</strong> Identifica si la frecuencia de radar actual es igual a la anterior.<br><br><strong style="color:#a78bfa;">🧠 ¿En qué te ayuda?</strong><br>Entrena tu <em>memoria de trabajo (N-Back)</em>, crucial para retener, actualizar y manipular información en tiempo real.',
            
            'teens_cards': '<strong>🕹️ Instrucciones:</strong> Descifra la tabla encontrando los pares de datos ocultos.<br><br><strong style="color:#a78bfa;">🧠 ¿En qué te ayuda?</strong><br>Ejercita tu <em>memoria de trabajo visuoespacial</em>, fortaleciendo tu retentiva general.',
            
            'eco_recycle': '<strong>🕹️ Instrucciones:</strong> Clasifica rápidamente los residuos y colócalos en el contenedor correspondiente.<br><br><strong style="color:#a78bfa;">🧠 ¿En qué te ayuda?</strong><br>Fomenta la <em>categorización mental rápida</em> y la toma de decisiones ecológicas conscientes.',
            
            'eco_water': '<strong>🕹️ Instrucciones:</strong> Toca las tuberías rotas lo más rápido posible para reparar las fugas de agua.<br><br><strong style="color:#a78bfa;">🧠 ¿En qué te ayuda?</strong><br>Acelera tu <em>tiempo de reacción</em> y estimula tu coordinación viso-motora (ojo-mano).',
            
            'teens_eco_energy': '<strong>🕹️ Instrucciones:</strong> Apaga los dispositivos que derrochan energía (rojos) e ignora los eficientes (verdes).<br><br><strong style="color:#a78bfa;">🧠 ¿En qué te ayuda?</strong><br>Entrena la <em>discriminación visual rápida</em> y el control inhibitorio frente a múltiples estímulos.',
            
            'teens_eco_ocean': '<strong>🕹️ Instrucciones:</strong> Recoge el plástico (rojo) flotando en el agua sin tocar a la fauna marina (peces azules).<br><br><strong style="color:#a78bfa;">🧠 ¿En qué te ayuda?</strong><br>Fortalece tu <em>atención dividida</em> y tu precisión motora fina, permitiendo que tu cerebro maneje dos tareas a la vez.'
        };
        const instrText = instructionsDict[gameId] || '<strong>🕹️ Instrucciones:</strong> Sigue las instrucciones en pantalla.<br><br><strong style="color:#a78bfa;">🧠 ¿En qué te ayuda?</strong><br>Entrena tu capacidad cognitiva general y mejora tu enfoque.';
        document.getElementById('game-instructions-text').innerHTML = instrText;
        
        // Pausar juego hasta iniciar
        this.isPlaying = false;
        
        document.getElementById('btn-start-mission').addEventListener('click', () => {
            document.getElementById('game-instructions-overlay').style.display = 'none';
            this.isPlaying = true;
            this.gameTime = 0;

            // --- Aplicar efectos de la tienda al inicio de la partida ---
            const app = getApp();
            const skin = app ? app.state.activeSkin : null;
            this.activeEffects = { shieldActive: false, timeBonus: 0, multiplier: 1, slowMode: false, coinBonus: 1 };
            if (skin === 'green_shield')  { this.activeEffects.shieldActive = true; coach.speak('¡Escudo activo! Tu primer fallo será ignorado.'); }
            if (skin === 'golden_crown')  { this.activeEffects.timeBonus = 10; coach.speak('¡Corona equipada! +10 segundos de misión.'); }
            if (skin === 'jetpack')       { this.activeEffects.multiplier = 1.5; coach.speak('¡Mochila Cohete activa! Puntos x1.5 en esta misión.'); }
            if (skin === 'stellar_aura') { this.activeEffects.slowMode = true; coach.speak('¡Aura Estelar activa! Los estímulos irán más lentos.'); }
            if (skin === 'cyber_neon')   { this.activeEffects.coinBonus = 1.1; coach.speak('¡Skin Cyber Neon activo! +10% de NeuroCoins esta misión.'); }
            if (skin === 'holo_pet')     { this.activeEffects.coinBonus = 1.5; coach.speak('¡Mascota Holográfica activa! +50% de NeuroCoins y escudo extra.'); this.activeEffects.shieldActive = true; }
            this.shieldUsed = false;

            // Notificar en instrucciones si hay efecto activo
            if (skin && this.activeEffects.multiplier !== 1 || this.activeEffects.shieldActive || this.activeEffects.timeBonus || this.activeEffects.slowMode || this.activeEffects.coinBonus !== 1) {
                const skinName = skin || '';
                const el = document.getElementById('game-instructions-overlay');
                if (el) el.style.display = 'none';
            }

            // Import and start specific game instance after instructions
            this.startSpecificGame(gameId);
        });

        // Event Listeners
        document.getElementById('btn-exit-game').addEventListener('click', () => this.exit());

        // Adapt canvas to containers size
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // HUD timer loop
        const baseDuration = 60;
        this.gameInterval = setInterval(() => {
            if (!this.isPlaying) return;
            this.gameTime++;
            const bonus = (this.activeEffects && this.activeEffects.timeBonus) || 0;
            const timeDisplay = Math.max(0, baseDuration + bonus - this.gameTime);
            document.getElementById('game-hud-time').innerText = `${timeDisplay}s`;
            
            // Check fatigue
            if (this.gameTime === 30) {
                coach.speak(i18n.t('coachHalfTime'));
            }
            
            if (timeDisplay <= 0) {
                this.finish();
            }
        }, 1000);
    }

    resizeCanvas() {
        if (!this.canvas) return;
        const container = document.getElementById('game-canvas-container');
        if (container) {
            // Keep 8:5 aspect ratio but scale nicely
            const cssWidth = Math.min(800, container.clientWidth - 20);
            const cssHeight = (cssWidth * 5) / 8;
            
            const dpr = window.devicePixelRatio || 1;
            
            this.canvas.width = cssWidth * dpr;
            this.canvas.height = cssHeight * dpr;
            
            this.canvas.style.width = `${cssWidth}px`;
            this.canvas.style.height = `${cssHeight}px`;
            
            // Normalize coordinate system: The games assume an 800x500 virtual canvas.
            const scaleX = (cssWidth / 800) * dpr;
            const scaleY = (cssHeight / 500) * dpr;
            this.ctx.scale(scaleX, scaleY);
        }
    }

    async startSpecificGame(gameId) {
        try {
            // Dynamically import the module
            let module;
            if (gameId === 'distraction_hunter' || gameId === 'teens_distraction') {
                module = await import('./games/distraction_hunter.js');
            } else if (gameId === 'spatial_focus' || gameId === 'kids_spatial') {
                module = await import('./games/spatial_focus.js');
            } else if (gameId === 'routine_builder' || gameId === 'kids_routine') {
                module = await import('./games/routine_builder.js');
            } else if (gameId === 'emotional_stoplight' || gameId === 'teens_stoplight') {
                module = await import('./games/emotional_stoplight.js');
            } else if (gameId === 'musical_memory' || gameId === 'teens_sound') {
                module = await import('./games/musical_memory.js');
            } else if (gameId === 'memory_cards' || gameId === 'teens_cards') {
                module = await import('./games/memory_cards.js');
            } else if (gameId === 'pattern_matcher' || gameId === 'kids_pattern') {
                module = await import('./games/pattern_matcher.js');
            } else if (gameId === 'speed_math' || gameId === 'kids_math') {
                module = await import('./games/speed_math.js');
            } else if (gameId === 'eco_recycle') {
                module = await import('./games/eco_recycle.js');
            } else if (gameId === 'eco_water') {
                module = await import('./games/eco_water.js');
            } else if (gameId === 'teens_eco_energy') {
                module = await import('./games/teens_eco_energy.js');
            } else if (gameId === 'teens_eco_ocean') {
                module = await import('./games/teens_eco_ocean.js');
            }
            
            if (module && module.default) {
                this.activeGame = new module.default(this.canvas, this.ctx, this);
                this.activeGame.init();
            }
        } catch (error) {
            console.error("Error cargando el juego:", error);
            this.exit();
        }
    }

    adaptDifficulty(gameId) {
        const app = getApp();
        if (!app) { this.difficulty = 'medium'; return; }
        const history = app.state.history.filter(h => h.gameId === gameId);
        if (history.length === 0) {
            this.difficulty = 'medium';
            return;
        }
        
        // Read recent performance
        const lastSession = history[history.length - 1];
        const accuracy = lastSession.metrics.attention;
        const impulses = lastSession.metrics.impulseControl;

        if (accuracy > 85 && impulses > 80) {
            this.difficulty = 'hard';
        } else if (accuracy < 60 || impulses < 60) {
            this.difficulty = 'easy';
        } else {
            this.difficulty = 'medium';
        }
    }

    addScore(points) {
        // Apply multiplier from Jetpack skin, and coinBonus from Cyber/HoloPet
        const mult = (this.activeEffects && this.activeEffects.multiplier) || 1;
        const coinBonus = (this.activeEffects && this.activeEffects.coinBonus) || 1;
        this.gameScore += Math.round(points * mult * coinBonus);
        const scoreHUD = document.getElementById('game-hud-score');
        if (scoreHUD) scoreHUD.innerText = this.gameScore;
        sound.playPop();
    }

    registerError() {
        // Shield effect: absorb first error (green_shield or holo_pet)
        if (this.activeEffects && this.activeEffects.shieldActive && !this.shieldUsed) {
            this.shieldUsed = true;
            this.activeEffects.shieldActive = false;
            coach.speak('¡Escudo activado! Tu fallo fue absorbido. El escudo ya no está disponible.');
            sound.playPop();
            return; // skip error registration
        }
        this.gameErrors++;
        this.impulseClicks++;
        const errorsHUD = document.getElementById('game-hud-errors');
        if (errorsHUD) errorsHUD.innerText = this.gameErrors;
        sound.playError();
        
        // AI Dynamic help: If 3 quick errors, advise the user
        if (this.gameErrors % 3 === 0) {
            coach.speak(i18n.t('coachSlowDown'));
            // Dynamic correction: Temporarily slow stimulus speed in active game if easy mode is triggered
            if (this.activeGame && this.activeGame.adjustPacing) {
                this.activeGame.adjustPacing(true);
            }
        }
    }

    exit() {
        this.isPlaying = false;
        clearInterval(this.gameInterval);
        if (this.activeGame && this.activeGame.destroy) {
            this.activeGame.destroy();
        }
        const app = getApp();
        if (app) {
            if (this.currentGameId === 'eco_recycle' || this.currentGameId === 'eco_water' || this.currentGameId === 'teens_eco_energy' || this.currentGameId === 'teens_eco_ocean') {
                app.renderEcoSparkHome();
            } else {
                app.renderHome();
            }
        }
    }

    finish() {
        this.isPlaying = false;
        clearInterval(this.gameInterval);
        if (this.activeGame && this.activeGame.destroy) {
            this.activeGame.destroy();
        }

        // Calculate cognitive metrics
        const accuracy = this.totalStimuli > 0 ? Math.round((this.correctResponses / this.totalStimuli) * 100) : 100;
        
        // Impulse Control score based on errors and total stimuli
        const totalInputs = this.correctResponses + this.gameErrors;
        const impulseControlVal = totalInputs > 0 ? Math.round((this.correctResponses / totalInputs) * 100) : 100;
        
        // Base game variables
        const cognitiveMetrics = {
            attention: Math.max(20, Math.min(100, accuracy)),
            impulseControl: Math.max(20, Math.min(100, impulseControlVal)),
            workingMemory: this.currentGameId === 'musical_memory' ? Math.min(100, 40 + this.gameScore * 10) : 75,
            organization: this.currentGameId === 'routine_builder' ? Math.min(100, 50 + this.gameScore * 15) : 70
        };

        const sessionData = {
            gameId: this.currentGameId,
            gameName: this.getGameName(this.currentGameId),
            timestamp: Date.now(),
            score: this.gameScore,
            difficulty: this.difficulty,
            metrics: cognitiveMetrics,
            duration: this.gameTime
        };

        // Add to history and update coins in state
        const app = getApp();
        if (app) app.addGameSession(sessionData, this.gameScore);

        sound.playSuccess();
        coach.speak(i18n.t('coachWinMsg', { coins: this.gameScore }));

        // Render Summary Modal
        const container = document.getElementById('game-canvas-container');
        container.innerHTML = `
            <div class="game-summary-card">
                <div class="summary-icon glow-text">
                    <i class="fa-solid fa-trophy text-accent"></i>
                </div>
                <h2>${i18n.t('missionDone')}</h2>
                <p class="summary-subtitle">${i18n.t('missionSub')}</p>
                
                <div class="summary-metrics-grid">
                    <div class="metric-box">
                        <span class="metric-val text-blue">${cognitiveMetrics.attention}%</span>
                        <span class="metric-lbl">${i18n.t('metricAtt')}</span>
                    </div>
                    <div class="metric-box">
                        <span class="metric-val text-purple">${cognitiveMetrics.impulseControl}%</span>
                        <span class="metric-lbl">${i18n.t('metricImpulse')}</span>
                    </div>
                    <div class="metric-box">
                        <span class="metric-val text-accent">+${this.gameScore}</span>
                        <span class="metric-lbl">NeuroCoins</span>
                    </div>
                </div>

                <div class="summary-sparky-bubble">
                    <i class="fa-solid fa-robot"></i>
                    <p><strong>Sparky dice:</strong> ${i18n.t('sparkyResult')}</p>
                </div>

                <div class="summary-actions">
                    <button class="play-btn" id="btn-summary-home">
                        <i class="fa-solid fa-house"></i> ${i18n.t('btnHome')}
                    </button>
                    <button class="play-btn" id="btn-summary-replay" style="background: var(--primary-green);">
                        <i class="fa-solid fa-arrow-rotate-right"></i> ${i18n.t('btnReplay')}
                    </button>
                </div>
            </div>
        `;

        // CSS to support summary card styling
        const style = document.createElement('style');
        style.textContent = `
            .game-summary-card {
                background: var(--bg-card);
                border: 2px solid var(--border-color);
                border-radius: var(--radius-lg);
                padding: 40px;
                max-width: 500px;
                width: 90%;
                text-align: center;
                animation: zoomIn 0.4s ease;
                backdrop-filter: blur(24px);
            }
            .summary-icon {
                font-size: 4rem;
                margin-bottom: 16px;
            }
            .summary-subtitle {
                color: var(--text-muted);
                margin-bottom: 24px;
            }
            .summary-metrics-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 12px;
                margin-bottom: 24px;
            }
            .metric-box {
                background: var(--bg-app);
                border: 1px solid var(--border-color);
                padding: 16px 8px;
                border-radius: var(--radius-md);
                display: flex;
                flex-direction: column;
                align-items: center;
            }
            .metric-val {
                font-size: 1.6rem;
                font-weight: 800;
            }
            .metric-lbl {
                font-size: 0.72rem;
                color: var(--text-muted);
                margin-top: 4px;
            }
            .summary-sparky-bubble {
                background: hsla(270, 85%, 65%, 0.1);
                border-left: 4px solid var(--primary-purple);
                padding: 16px;
                border-radius: 0 var(--radius-md) var(--radius-md) 0;
                text-align: left;
                margin-bottom: 30px;
                display: flex;
                gap: 12px;
                font-size: 0.88rem;
                line-height: 1.4;
            }
            .summary-sparky-bubble i {
                font-size: 1.5rem;
                color: var(--primary-purple);
            }
            .summary-actions {
                display: flex;
                justify-content: center;
                gap: 16px;
            }
            @keyframes zoomIn {
                0% { transform: scale(0.9); opacity: 0; }
                100% { transform: scale(1); opacity: 1; }
            }
        `;
        document.head.appendChild(style);

        document.getElementById('btn-summary-home').addEventListener('click', () => {
            const app = getApp();
            if (app) {
                if (this.currentGameId === 'eco_recycle' || this.currentGameId === 'eco_water' || this.currentGameId === 'teens_eco_energy' || this.currentGameId === 'teens_eco_ocean') {
                    app.renderEcoSparkHome();
                } else {
                    app.renderHome();
                }
            }
        });
        
        document.getElementById('btn-summary-replay').addEventListener('click', () => {
            this.launch(this.currentGameId);
        });
    }

    getGameName(gameId) {
        const map = {
            distraction_hunter: 'gameName1',
            spatial_focus: 'gameName2',
            routine_builder: 'gameName3',
            emotional_stoplight: 'gameName4',
            musical_memory: 'gameName5',
            memory_cards: 'gameName6',
            pattern_matcher: 'gameName7',
            speed_math: 'gameName8',
            kids_spatial: 'gameName9',
            kids_routine: 'gameName10',
            kids_pattern: 'gameName11',
            kids_math: 'gameName12',
            teens_distraction: 'gameName13',
            teens_stoplight: 'gameName14',
            teens_sound: 'gameName15',
            teens_cards: 'gameName16',
            eco_recycle: 'Juego de Reciclaje',
            eco_water: 'Juego del Agua'
        };
        return i18n.t(map[gameId] || 'gameNameDefault');
    }
}

export const engine = new GameController();
