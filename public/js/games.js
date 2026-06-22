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
                
                <div class="game-canvas-wrapper" id="game-canvas-container">
                    <canvas id="game-canvas" width="800" height="500"></canvas>
                </div>
            </div>
        `;

        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Event Listeners
        document.getElementById('btn-exit-game').addEventListener('click', () => this.exit());

        // Adapt canvas to containers size
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // Import and start specific game instance
        this.startSpecificGame(gameId);

        // HUD timer loop
        this.gameInterval = setInterval(() => {
            if (!this.isPlaying) return;
            this.gameTime++;
            const timeDisplay = Math.max(0, 60 - this.gameTime);
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
            if (gameId === 'distraction_hunter') {
                module = await import('./games/distraction_hunter.js');
            } else if (gameId === 'spatial_focus') {
                module = await import('./games/spatial_focus.js');
            } else if (gameId === 'routine_builder') {
                module = await import('./games/routine_builder.js');
            } else if (gameId === 'emotional_stoplight') {
                module = await import('./games/emotional_stoplight.js');
            } else if (gameId === 'musical_memory') {
                module = await import('./games/musical_memory.js');
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
        this.gameScore += points;
        const scoreHUD = document.getElementById('game-hud-score');
        if (scoreHUD) scoreHUD.innerText = this.gameScore;
        sound.playPop();
    }

    registerError() {
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
            musical_memory: 'gameName5'
        };
        return i18n.t(map[gameId] || 'gameNameDefault');
    }
}

export const engine = new GameController();
