/* -------------------------------------------------------------
   NEUROSPARK GAME ENGINE (Game Runner & Difficulty Coordinator)
   ------------------------------------------------------------- */

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
                        <i class="fa-solid fa-graduation-cap" style="font-size: 4rem; color: #38bdf8; margin-bottom: 20px;"></i>
                        <h2 style="font-size: 2rem; color: white; margin-bottom: 15px;">Misión Cognitiva</h2>
                        <p id="game-instructions-text" style="color: #cbd5e1; font-size: 1.15rem; max-width: 650px; margin-bottom: 30px; line-height: 1.6;"></p>
                        <button id="btn-start-mission" style="background: linear-gradient(135deg, #38bdf8, #818cf8); border: none; padding: 15px 40px; border-radius: 12px; font-size: 1.2rem; font-weight: bold; color: white; cursor: pointer; box-shadow: 0 10px 20px rgba(56, 189, 248, 0.3);">🚀 Iniciar Entrenamiento</button>
                    </div>
                </div>
            </div>
        `;

        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Populate instructions
        const instructionsDict = {
            'distraction_hunter': 'Debes destruir (haciendo clic) solo los asteroides o amenazas válidas. Ignora y no toques los elementos de distracción para entrenar tu atención selectiva.',
            'emotional_stoplight': 'Paradigma Go/No-Go: Presiona la pantalla rápido cuando veas el semáforo o indicador en VERDE. Si aparece en ROJO, debes frenar el impulso y no tocar nada.',
            'musical_memory': 'Escucha y observa la secuencia de sonidos (similares al clásico Simón Dice). Cuando sea tu turno, repite el patrón en el mismo orden.',
            'memory_cards': 'Encuentra las parejas ocultas en el tablero en el menor tiempo posible para trabajar tu retención de memoria visual a corto plazo.',
            'kids_spatial': 'Observa el camino iluminado en el laberinto. Retén la secuencia de pasos y replícala exactamente para estimular tu orientación espacial.',
            'kids_routine': 'Arrastra y organiza las tareas diarias (estudio, juego, sueño) en la agenda. ¡Cuidado con sobrecargar la energía del astronauta!',
            'kids_pattern': 'Identifica rápidamente al alienígena o figura intrusa que es diferente al resto. ¡Tienes poco tiempo para ejercitar tu flexibilidad cognitiva!',
            'kids_math': 'Resuelve la ecuación matemática antes de que el meteoro choque. Mejora tu velocidad de procesamiento bajo ligera presión.',
            'spatial_focus': 'Mantén tu vista en los objetivos que aparecen. Un barrido visual constante es clave para el éxito.',
            'routine_builder': 'Acomoda las tareas diarias priorizando responsabilidades y tiempo de descanso para evitar la fatiga mental.',
            'pattern_matcher': 'Encuentra la anomalía en el panel visual. Trabaja tu flexibilidad alternando entre distintos tipos de patrones.',
            'speed_math': 'Operaciones de cálculo rápido mental sin uso de calculadora, diseñadas para fortalecer la automatización cognitiva.',
            'teens_distraction': 'Filtra la información irrelevante: ataca a los objetivos clave en un entorno lleno de ruidos visuales e interferencias.',
            'teens_stoplight': 'Debes reaccionar con un clic lo más rápido posible a la señal de inicio (verde), pero detener por completo tu respuesta motora si la señal cambia de imprevisto a rojo (Stop-Signal).',
            'teens_sound': 'Identifica qué frecuencias de radar son iguales a las anteriores para entrenar tu memoria de trabajo fonológica.',
            'teens_cards': 'Descifra la tabla encontrando los pares de datos para ejercitar tu actualización constante (N-Back espacial).'
        };
        const instrText = instructionsDict[gameId] || 'Sigue las instrucciones en pantalla y haz tu mejor esfuerzo para entrenar tu cerebro.';
        document.getElementById('game-instructions-text').innerText = instrText;
        
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
        if (app) app.renderHome();
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
            if (app) app.renderHome();
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
            teens_cards: 'gameName16'
        };
        return i18n.t(map[gameId] || 'gameNameDefault');
    }
}

export const engine = new GameController();
