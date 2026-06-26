/* -------------------------------------------------------------
   NEUROSPARK APPLICATION ORCHESTRATOR & ROUTER (i18n enabled)
   ------------------------------------------------------------- */

import { sound } from './sound.js';
import { coach } from './neurocoach.js';
import { engine } from './games.js';
import { dashboard } from './dashboard.js';
import { i18n } from './i18n.js';
import { AuthUI } from './auth/authUI.js';
import { authController } from './auth/authController.js';

class NeuroSparkApp {
    constructor() {
        this.state = {
            profile: 'kids',
            activeProfileName: 'Matias',
            coins: 120,
            level: 1,
            lang: 'es',
            unlockedItems: ['classic_skin'],
            activeSkin: 'classic_skin',
            history: [],
            tasks: [
                { id: 1, text: '📖 Leer 5 páginas de Ciencias', done: false },
                { id: 2, text: '🧮 Practicar tablas de multiplicar', done: false },
                { id: 3, text: '📝 Apuntar tareas en agenda', done: true }
            ],
            settings: {
                musicOn: false,
                voiceOn: false,
                lowStimulus: false,
                volume: 50
            }
        };

        this.storeItems = [
            { id: 'cyber_neon', nameKey: 'skinCyber', cost: 100, icon: 'fa-robot', color: '#38bdf8', image: 'assets/store_cyber_neon.png' },
            { id: 'green_shield', nameKey: 'skinShield', cost: 180, icon: 'fa-shield-halved', color: '#22c55e' },
            { id: 'golden_crown', nameKey: 'skinCrown', cost: 250, icon: 'fa-crown', color: '#fbbf24' },
            { id: 'jetpack', nameKey: 'skinJetpack', cost: 350, icon: 'fa-rocket', color: '#a855f7' },
            { id: 'stellar_aura', nameKey: 'skinAura', cost: 500, icon: 'fa-star', color: '#f472b6' },
            { id: 'holo_pet', nameKey: 'skinHolopet', cost: 800, icon: 'fa-dog', color: '#06b6d4' }
        ];
    }

    /* ---- BOOT ---- */
    init() {
        window.neuroApp = this;
        this.loadState();
        this.setupEventListeners();
        this.updateHeaderHUD();
        this.renderHome();

        document.body.addEventListener('click', e => coach.trackInteraction(e));

        setTimeout(() => {
            coach.speak(i18n.t('coachWelcome'));
        }, 1500);
    }

    async loadState(email = null) {
        if (email) this.state.currentUserEmail = email.toLowerCase();
        const key = this.state.currentUserEmail ? 'neurospark_state_' + this.state.currentUserEmail : 'neurospark_state';

        // 1. Cargar estado local inmediato
        const saved = localStorage.getItem(key);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                this.state = { ...this.state, ...parsed, settings: { ...this.state.settings, ...(parsed.settings || {}) } };
            } catch (e) { }
        }

        // 2. Cargar estado remoto de Supabase (Sincronización)
        if (this.state.currentUserEmail) {
            const dbState = await authController.loadUserState(this.state.currentUserEmail);
            if (dbState) {
                this.state = { ...this.state, ...dbState, settings: { ...this.state.settings, ...(dbState.settings || {}) } };
                localStorage.setItem(key, JSON.stringify(this.state));
            }
        }

        i18n.setLang(this.state.lang || 'es');
        sound.setVolume(this.state.settings.volume / 100);
        coach.voiceEnabled = this.state.settings.voiceOn;
        if (this.state.settings.lowStimulus) document.body.classList.add('low-stimulus');

        this.updateHeaderHUD();
    }

    async saveState() {
        const key = this.state.currentUserEmail ? 'neurospark_state_' + this.state.currentUserEmail : 'neurospark_state';
        localStorage.setItem(key, JSON.stringify(this.state));

        if (this.state.currentUserEmail) {
            await authController.saveUserState(this.state.currentUserEmail, this.state);
        }
    }

    /* ---- HEADER HUD ---- */
    updateHeaderHUD() {
        document.getElementById('player-coins').innerText = this.state.coins.toLocaleString();
        document.getElementById('player-level').innerText = this.state.level;
        document.getElementById('current-profile-name').innerText = this.state.activeProfileName;

        // Render custom avatar in header
        const avatarIcon = document.querySelector('.profile-select-btn i.fa-user-astronaut');
        if (this.state.avatar && document.querySelector('.profile-select-btn')) {
            const profileBtn = document.querySelector('.profile-select-btn');
            let imgEl = document.getElementById('header-avatar-img');
            if (!imgEl) {
                imgEl = document.createElement('img');
                imgEl.id = 'header-avatar-img';
                imgEl.style.width = '24px';
                imgEl.style.height = '24px';
                imgEl.style.borderRadius = '50%';
                imgEl.style.background = 'rgba(255,255,255,0.1)';
                if (avatarIcon) avatarIcon.style.display = 'none';
                profileBtn.insertBefore(imgEl, document.getElementById('current-profile-name'));
            }
            const avState = this.state.avatar;
            imgEl.src = (avState.startsWith('http') || avState.startsWith('data:')) ? avState : `https://api.dicebear.com/7.x/bottts/svg?seed=${avState.charAt(0).toUpperCase() + avState.slice(1)}`;
            imgEl.style.display = 'block';
        }
        document.getElementById('logo-sub-text').innerText = i18n.t('logoSub');

        // XP progress bar: every 500 coins = 1 level
        const coinsPerLevel = 500;
        const coinsIntoLevel = this.state.coins % coinsPerLevel;
        const pct = Math.min(100, Math.round((coinsIntoLevel / coinsPerLevel) * 100));
        const xpBar = document.getElementById('xp-bar-fill');
        const xpLabel = document.getElementById('xp-bar-label');
        if (xpBar) {
            xpBar.style.width = pct + '%';
        }
        if (xpLabel) {
            xpLabel.innerText = coinsIntoLevel + ' / ' + coinsPerLevel;
        }

        // Check level up
        const newLevel = Math.floor(this.state.coins / coinsPerLevel) + 1;
        if (newLevel > this.state.level) {
            this.state.level = newLevel;
            this.showToast(i18n.t('toastLevelUp', { level: newLevel }), 'success');
        }

        const btnMusic = document.getElementById('btn-music');
        const btnVoice = document.getElementById('btn-voice');
        if (this.state.settings.musicOn) btnMusic.classList.add('active');
        else btnMusic.classList.remove('active');
        if (this.state.settings.voiceOn) btnVoice.classList.add('active');
        else btnVoice.classList.remove('active');

        // Update Sparky chat welcome placeholder & chips
        const chatInput = document.getElementById('chat-user-input');
        if (chatInput) chatInput.placeholder = i18n.t('chatPlaceholder');
        const chipBreak = document.getElementById('chip-break');
        const chipTip = document.getElementById('chip-tip');
        const chipReport = document.getElementById('chip-report');
        if (chipBreak) chipBreak.innerHTML = `<i class="fa-solid fa-hourglass-half"></i> ${i18n.t('chatBreakChip')}`;
        if (chipTip) chipTip.innerHTML = `<i class="fa-solid fa-lightbulb"></i> ${i18n.t('chatTipChip')}`;
        if (chipReport) chipReport.innerHTML = `<i class="fa-solid fa-chart-line"></i> ${i18n.t('chatReportChip')}`;
    }

    /* ---- EVENT LISTENERS ---- */
    setupEventListeners() {
        document.getElementById('btn-logo').addEventListener('click', () => {
            if (engine.isPlaying) {
                engine.exit();
            } else {
                this.renderHome();
            }
        });

        // Music
        const btnMusic = document.getElementById('btn-music');
        btnMusic.title = i18n.t('hdrMusic');
        btnMusic.addEventListener('click', () => {
            const playing = sound.toggleFocusMusic();
            this.state.settings.musicOn = playing;
            this.saveState();
            btnMusic.classList.toggle('active', playing);
            this.showToast(playing ? i18n.t('toastMusicOn') : i18n.t('toastMusicOff'), 'info');
        });

        // Voice
        const btnVoice = document.getElementById('btn-voice');
        btnVoice.title = i18n.t('hdrVoice');
        btnVoice.addEventListener('click', () => {
            const enabled = !this.state.settings.voiceOn;
            this.state.settings.voiceOn = enabled;
            coach.setVoiceEnabled(enabled, i18n.t('coachVoiceOn'));
            this.saveState();
            btnVoice.classList.toggle('active', enabled);
            this.showToast(enabled ? i18n.t('toastVoiceOn') : i18n.t('toastVoiceOff'), 'info');
        });



        // Settings
        document.getElementById('btn-settings').addEventListener('click', () => this.openSettingsModal());

        // Sparky widget
        const trigger = document.getElementById('coach-trigger');
        const chatPanel = document.getElementById('coach-chat-panel');
        trigger.addEventListener('click', () => {
            chatPanel.classList.toggle('hidden');
            document.getElementById('coach-badge').style.display = 'none';
            sound.playPop();
        });
        document.getElementById('btn-close-chat').addEventListener('click', () => {
            chatPanel.classList.add('hidden');
            sound.playPop();
        });

        // Chat chips
        document.getElementById('chip-break').addEventListener('click', async () => {
            this.addChatMessage('user', i18n.t('chatSendUser1'));
            const msgId = this.addChatMessage('system', '', true);
            const res = await coach.processChatQuery('estoy cansado', this.state);
            this.updateChatMessage(msgId, res);
        });
        document.getElementById('chip-tip').addEventListener('click', async () => {
            this.addChatMessage('user', i18n.t('chatSendUser2'));
            const msgId = this.addChatMessage('system', '', true);
            const res = await coach.processChatQuery('tip', this.state);
            this.updateChatMessage(msgId, res);
        });
        document.getElementById('chip-report').addEventListener('click', async () => {
            this.addChatMessage('user', i18n.t('chatSendUser3'));
            const msgId = this.addChatMessage('system', '', true);
            const res = await coach.processChatQuery('reporte', this.state);
            this.updateChatMessage(msgId, res);
        });

        // Chat input
        const chatInput = document.getElementById('chat-user-input');
        const btnSend = document.getElementById('chat-send-btn');
        const sendMsg = async () => {
            const val = chatInput.value.trim();
            if (!val) return;
            chatInput.value = '';
            this.addChatMessage('user', val);

            const msgId = this.addChatMessage('system', '', true);
            try {
                const response = await coach.processChatQuery(val, this.state);
                this.updateChatMessage(msgId, response);
            } catch (err) {
                this.updateChatMessage(msgId, "Lo siento, mi conexión cerebral falló. ¿Puedes repetirlo?");
            }
        };
        btnSend.addEventListener('click', sendMsg);
        chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendMsg(); });

        // Update static texts that don't re-render
        this.updateHeaderHUD();
    }

    /* ---- PROFILE SWITCH ---- */
    changeProfileMode(mode) {
        this.state.profile = mode;
        this.updateHeaderHUD();
        this.saveState();
        this.renderHome();
        coach.speak(i18n.t('toastModeSwitched', { name: this.state.activeProfileName }));
        this.showToast(i18n.t('toastModeSwitched', { name: this.state.activeProfileName }), 'success');
    }

    /* ---- LANGUAGE SWITCH ---- */
    setLanguage(lang) {
        this.state.lang = lang;
        i18n.setLang(lang);
        this.saveState();
        this.updateHeaderHUD();
        this.renderHome();
        this.showToast(i18n.t('toastLangChanged'), 'success');
    }

    /* ---- ROUTER ---- */
    renderHome() {
        const mount = document.getElementById('app-view-mount');
        mount.innerHTML = '';
        const lowStim = this.state.settings.lowStimulus ? ' low-stimulus' : '';
        const themeClass = document.body.classList.contains('light-theme') ? ' light-theme' : ' dark-theme';

        if (this.state.profile === 'admin') {
            document.body.className = 'teens-mode admin-games-mode' + themeClass + lowStim;
            this.renderAdminGamesHome(mount);
        } else if (this.state.profile === 'parent') {
            document.body.className = 'teens-mode parent-panel-mode' + themeClass + lowStim;
            this.renderParentHome(mount);
        } else if (this.state.profile === 'kids') {
            document.body.className = 'kids-mode' + themeClass + lowStim;
            this.renderKidsHome(mount);
        } else if (this.state.profile === 'teens') {
            document.body.className = 'teens-mode' + themeClass + lowStim;
            this.renderTeensHome(mount);
        } else {
            document.body.className = 'adults-mode' + themeClass + lowStim;
            dashboard.render(mount, this.state);
        }

        // Apply slide animation when returning to home
        if (mount.firstElementChild) {
            mount.firstElementChild.style.animation = 'page-slide-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both';
        }

        // Inject admin card if user is admin
        if (this.state.isAdmin) {
            this._injectAdminCard(mount);
        }
    }

    /* ---- ADMIN CARD INJECTION ---- */
    _injectAdminCard(mount) {
        // Remove any old floating button from previous renders
        const old = document.getElementById('admin-access-card');
        if (old) old.remove();

        // Show the pre-existing header button
        const btn = document.getElementById('btn-admin-header');
        if (btn) {
            btn.style.display = '';
            const fresh = btn.cloneNode(true);
            btn.parentNode.replaceChild(fresh, btn);
            fresh.addEventListener('click', () => this.openAdminPanel());
        }

        // Show games toggle button
        const btnGames = document.getElementById('btn-admin-games');
        if (btnGames) {
            btnGames.style.display = '';
            const freshGames = btnGames.cloneNode(true);
            btnGames.parentNode.replaceChild(freshGames, btnGames);

            // Set initial state based on current profile
            if (this.state.isAdmin) {
                freshGames.innerHTML = '<i class="fa-solid fa-shield-halved"></i>';
                freshGames.title = "Abrir Panel Admin";
            } else if (this.state.profile === 'parent') {
                freshGames.style.display = 'none';
            } else if (this.state.profile === 'adults') {
                freshGames.innerHTML = '<i class="fa-solid fa-gamepad"></i>';
                freshGames.title = "Modo Juegos";
            } else {
                freshGames.innerHTML = '<i class="fa-solid fa-chart-line"></i>';
                freshGames.title = "Modo Panel Principal";
            }

            freshGames.addEventListener('click', () => {
                if (this.state.isAdmin) {
                    // Admin toggles between admin-games view and admin panel modal
                    if (this.state.profile === 'admin') {
                        this.openAdminPanel();
                    } else {
                        this.state.profile = 'admin';
                        this.renderHome();
                    }
                } else if (this.state.profile === 'adults') {
                    this.changeProfileMode('kids');
                } else {
                    this.changeProfileMode('adults');
                }
            });
        }
    }

    /* ---- ADMIN PANEL (MODAL) ---- */
    openAdminPanel() {
        let overlay = document.getElementById('admin-panel-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'admin-panel-overlay';
            overlay.className = 'settings-overlay';
            document.body.appendChild(overlay);
        }

        overlay.innerHTML = `
            <div id="admin-panel-modal-inner" class="settings-modal" style="padding: 0; overflow: hidden; position: relative; max-height: 90vh; display: flex; flex-direction: column;">
                <div class="admin-shimmer-bar"></div>

                <!-- Header -->
                <div style="background: linear-gradient(135deg, #1e293b, #0f172a); padding: 24px 36px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); flex-shrink: 0;">
                    <h2 style="font-size: 1.6rem; color: white; display: flex; align-items: center; gap: 12px; margin: 0;">
                        <i class="fa-solid fa-shield-halved" style="color: #a78bfa;"></i> Panel de Administración
                    </h2>
                    <button id="btn-close-admin" style="background: rgba(255,255,255,0.08); border: none; color: white; width: 36px; height: 36px; border-radius: 50%; font-size: 1rem; cursor: pointer; transition: background 0.2s, transform 0.2s;">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <!-- Scrollable body -->
                <div style="padding: 28px 36px; display: flex; flex-direction: column; gap: 24px; overflow-y: auto;">

                    <!-- Usuarios Registrados -->
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                            <h4 style="margin: 0; color: var(--text-main); font-size: 1.15rem; display: flex; align-items: center; gap: 10px;">
                                <i class="fa-solid fa-users" style="color: var(--primary-blue);"></i> Usuarios Registrados
                                <span id="admin-user-count" style="background: rgba(56,189,248,0.15); border: 1px solid rgba(56,189,248,0.3); color: var(--primary-blue); padding: 2px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 700;">…</span>
                            </h4>
                            <button id="btn-refresh-users" style="background: rgba(56,189,248,0.1); border: 1px solid rgba(56,189,248,0.25); color: #38bdf8; padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: 0.85rem; font-weight: 600; transition: all 0.2s;">
                                <i class="fa-solid fa-rotate-right"></i> Actualizar
                            </button>
                        </div>

                        <!-- Search bar -->
                        <input type="text" id="admin-user-search" placeholder="🔍  Buscar por nombre o correo..." style="width: 100%; padding: 12px 16px; border-radius: 10px; border: 1.5px solid var(--border-color); background: var(--bg-app); color: var(--text-main); font-size: 0.95rem; outline: none; margin-bottom: 14px; transition: border-color 0.3s; font-family: inherit;">

                        <!-- Table -->
                        <div style="overflow-x: auto; border-radius: 12px; border: 1px solid var(--border-color);">
                            <table id="admin-users-table" style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                                <thead>
                                    <tr style="background: var(--bg-app); border-bottom: 1px solid var(--border-color);">
                                        <th style="padding: 12px 16px; text-align: left; color: var(--text-muted); font-weight: 600; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.5px;">Estudiante</th>
                                        <th style="padding: 12px 16px; text-align: left; color: var(--text-muted); font-weight: 600; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.5px;">Correo</th>
                                        <th style="padding: 12px 16px; text-align: center; color: var(--text-muted); font-weight: 600; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.5px;">Edad</th>
                                        <th style="padding: 12px 16px; text-align: center; color: var(--text-muted); font-weight: 600; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.5px;">Perfil</th>
                                        <th style="padding: 12px 16px; text-align: center; color: var(--text-muted); font-weight: 600; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.5px;">NeuroCoins</th>
                                        <th style="padding: 12px 16px; text-align: center; color: var(--text-muted); font-weight: 600; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.5px;">Nivel</th>
                                        <th style="padding: 12px 16px; text-align: center; color: var(--text-muted); font-weight: 600; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.5px;">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody id="admin-users-tbody">
                                    <tr><td colspan="7" style="text-align:center; padding: 30px; color: var(--text-muted);">
                                        <i class="fa-solid fa-spinner fa-spin" style="margin-right:8px;"></i>Cargando usuarios...
                                    </td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Separator -->
                    <div style="border-top: 1px solid var(--border-color);"></div>

                    <!-- Dar Coins -->
                    <div>
                        <p style="color: var(--text-muted); margin: 0 0 14px; font-size: 0.95rem;"><i class="fa-solid fa-coins" style="color:#f59e0b; margin-right:6px;"></i>Otorga NeuroCoins a un estudiante.</p>
                        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                            <input type="email" id="admin-coins-email" placeholder="correo_estudiante@ejemplo.com" style="flex: 1; min-width: 200px; padding: 14px; border-radius: 10px; border: 2px solid var(--border-color); background: var(--bg-app); color: var(--text-main); font-size: 0.95rem; outline: none; transition: border-color 0.3s;">
                            <input type="number" id="admin-coins-amount" placeholder="Cantidad" style="width: 130px; padding: 14px; border-radius: 10px; border: 2px solid var(--border-color); background: var(--bg-app); color: var(--text-main); font-size: 0.95rem; outline: none;">
                            <button id="btn-add-coins" class="play-btn" style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 0 28px; font-size: 0.95rem; border-radius: 10px; height: 50px; white-space: nowrap;">
                                <i class="fa-solid fa-coins"></i> Dar Coins
                            </button>
                        </div>
                    </div>

                    <!-- Asignar Rol -->
                    <div>
                        <p style="color: var(--text-muted); margin: 0 0 14px; font-size: 0.95rem;"><i class="fa-solid fa-user-shield" style="color:#a78bfa; margin-right:6px;"></i>Asigna un rol especial a un usuario.</p>
                        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                            <input type="email" id="admin-search-email" placeholder="correo@ejemplo.com" style="flex: 1; min-width: 200px; padding: 14px; border-radius: 10px; border: 2px solid var(--border-color); background: var(--bg-app); color: var(--text-main); font-size: 0.95rem; outline: none; transition: border-color 0.3s;">
                            <select id="admin-role-select" style="padding: 14px; border-radius: 10px; border: 2px solid var(--border-color); background: var(--bg-app); color: var(--text-main); font-size: 0.95rem; outline: none; cursor: pointer; min-width: 190px;">
                                <option value="padre">Padre / Apoderado</option>
                                <option value="docente">Docente / Especialista</option>
                            </select>
                            <button id="btn-assign-role" class="play-btn" style="background: linear-gradient(135deg, #7c3aed, #1d4ed8); color: white; padding: 0 28px; font-size: 0.95rem; border-radius: 10px; height: 50px; white-space: nowrap;">
                                <i class="fa-solid fa-check"></i> Asignar Rol
                            </button>
                        </div>
                    </div>

                    <!-- Log -->
                    <div id="admin-log-list" style="display: flex; flex-direction: column; gap: 10px; max-height: 180px; overflow-y: auto;">
                        <div style="padding: 14px 18px; background: var(--bg-app); border-radius: 10px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 0.9rem; color: var(--text-muted);"><i class="fa-solid fa-circle-info" style="margin-right: 8px;"></i>Aún no hay asignaciones en esta sesión.</span>
                        </div>
                    </div>
                </div>
            </div>
        `;


        overlay.classList.add('open');

        document.getElementById('btn-close-admin').addEventListener('click', () => overlay.classList.remove('open'));
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });

        // ── Load & render users table ──────────────────────────────
        let allUsers = [];

        const profileLabel = { kids: '🧒 Niños', teens: '🧑 Adolescentes', adults: '👨 Adultos', admin: '🛡️ Admin' };
        const profileColor = { kids: '#38bdf8', teens: '#a78bfa', adults: '#22c55e', admin: '#f59e0b' };

        const renderUsersTable = (users) => {
            const tbody = document.getElementById('admin-users-tbody');
            if (!tbody) return;
            if (!users.length) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 30px; color: var(--text-muted);">
                    <i class="fa-solid fa-user-slash" style="margin-right:8px;"></i>No se encontraron usuarios.
                </td></tr>`;
                return;
            }
            tbody.innerHTML = users.map((u, idx) => {
                const s = u.state_data || {};
                const name = s.activeProfileName || '—';
                const age = s.age || '—';
                const prof = s.profile || 'kids';
                const coins = (s.coins ?? 0).toLocaleString();
                const level = s.level || 1;
                const color = profileColor[prof] || '#38bdf8';
                const label = profileLabel[prof] || prof;
                const initials = name !== '—' ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';
                return `<tr style="border-bottom: 1px solid var(--border-color); transition: background 0.2s;" 
                    onmouseover="this.style.background='var(--bg-hover)'" 
                    onmouseout="this.style.background='transparent'">
                    <td style="padding: 13px 16px;">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <div style="width:36px;height:36px;border-radius:10px;background:${color}22;border:1px solid ${color}44;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.8rem;color:${color};flex-shrink:0;">${initials}</div>
                            <span style="color:var(--text-main);font-weight:600;">${name}</span>
                        </div>
                    </td>
                    <td style="padding: 13px 16px; color: var(--text-muted); font-size:0.85rem;">${u.email}</td>
                    <td style="padding: 13px 16px; text-align:center; color: var(--text-main); font-weight:600;">${age}</td>
                    <td style="padding: 13px 16px; text-align:center;">
                        <span style="background:${color}22;border:1px solid ${color}44;color:${color};padding:3px 10px;border-radius:20px;font-size:0.78rem;font-weight:700;white-space:nowrap;">${label}</span>
                    </td>
                    <td style="padding: 13px 16px; text-align:center;">
                        <span style="color:#fbbf24;font-weight:700;"><i class="fa-solid fa-coins" style="margin-right:4px;font-size:0.8rem;"></i>${coins}</span>
                    </td>
                    <td style="padding: 13px 16px; text-align:center;">
                        <span style="background:rgba(167,139,250,0.15);border:1px solid rgba(167,139,250,0.3);color:#a78bfa;padding:3px 10px;border-radius:20px;font-size:0.8rem;font-weight:700;white-space:nowrap;display:inline-block;">Lv. ${level}</span>
                    </td>
                    <td style="padding: 13px 16px; text-align:center;">
                        <button class="btn-delete-user" data-email="${u.email}" style="background:rgba(239, 68, 68, 0.1); border:1px solid rgba(239, 68, 68, 0.3); color:#ef4444; width:30px; height:30px; border-radius:6px; cursor:pointer; transition:all 0.2s;" title="Eliminar Perfil" onmouseover="this.style.background='rgba(239, 68, 68, 0.2)'" onmouseout="this.style.background='rgba(239, 68, 68, 0.1)'">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </td>
                </tr>`;
            }).join('');
        };

        const loadUsers = async () => {
            const tbody = document.getElementById('admin-users-tbody');
            const countBadge = document.getElementById('admin-user-count');
            if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin" style="margin-right:8px;"></i>Cargando...</td></tr>`;
            allUsers = await authController.getAllUsers();
            if (countBadge) countBadge.textContent = allUsers.length;
            renderUsersTable(allUsers);
        };

        loadUsers();

        // Eliminar usuario
        document.getElementById('admin-users-tbody')?.addEventListener('click', async (e) => {
            const btn = e.target.closest('.btn-delete-user');
            if (!btn) return;
            const email = btn.getAttribute('data-email');
            if (confirm(`¿Estás seguro de que deseas eliminar permanentemente el perfil de ${email}?`)) {
                try {
                    await authController.deleteUserProfile(email);
                    this.showToast('Usuario eliminado correctamente.', 'success');
                    loadUsers();
                } catch (err) {
                    this.showToast('Error al eliminar usuario.', 'warning');
                }
            }
        });

        document.getElementById('btn-refresh-users')?.addEventListener('click', loadUsers);

        document.getElementById('admin-user-search')?.addEventListener('input', function () {
            const q = this.value.trim().toLowerCase();
            if (!q) { renderUsersTable(allUsers); return; }
            const filtered = allUsers.filter(u => {
                const name = ((u.state_data || {}).activeProfileName || '').toLowerCase();
                return u.email.toLowerCase().includes(q) || name.includes(q);
            });
            renderUsersTable(filtered);
        });

        // Focus styles for search
        const userSearch = document.getElementById('admin-user-search');
        if (userSearch) {
            userSearch.addEventListener('focus', function () { this.style.borderColor = '#38bdf8'; });
            userSearch.addEventListener('blur', function () { this.style.borderColor = 'var(--border-color)'; });
        }

        const emailInput = document.getElementById('admin-search-email');
        emailInput.addEventListener('focus', function () { this.style.borderColor = '#7c3aed'; });
        emailInput.addEventListener('blur', function () { this.style.borderColor = 'var(--border-color)'; });

        document.getElementById('btn-assign-role').addEventListener('click', async () => {
            const email = emailInput.value.trim().toLowerCase();
            const roleSelect = document.getElementById('admin-role-select');
            const roleText = roleSelect.options[roleSelect.selectedIndex].text;
            if (!email || !email.includes('@')) {
                this.showToast('Ingresa un correo electrónico válido.', 'warning');
                return;
            }

            const btn = document.getElementById('btn-assign-role');
            const originalContent = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verificando...';
            btn.disabled = true;

            const userExistsLocally = localStorage.getItem('neurospark_state_' + email) !== null || email === 'sparkneuro64@gmail.com';
            const userExistsInDB = await authController.checkUserExists(email);

            btn.innerHTML = originalContent;
            btn.disabled = false;

            if (userExistsInDB === false && !userExistsLocally) {
                this.showToast('El usuario no está registrado en Supabase.', 'warning');
                return;
            } else if (userExistsInDB === null && !userExistsLocally) {
                this.showToast('Aviso: Verificación RPC no instalada. Se creará un perfil local.', 'info');
            }

            const logList = document.getElementById('admin-log-list');
            // Clear placeholder if present
            if (logList.children.length === 1 && logList.querySelector('[style*="circle-info"]')) {
                logList.innerHTML = '';
            }
            const item = document.createElement('div');
            item.style.cssText = 'padding: 16px 20px; background: rgba(124,58,237,0.08); border-radius: 10px; border: 1px solid rgba(124,58,237,0.25); display: flex; justify-content: space-between; align-items: center; opacity: 0; transform: translateY(-8px); transition: all 0.35s ease;';
            item.innerHTML = '<span style="font-size: 0.95rem;"><i class="fa-solid fa-user-check" style="color:#7c3aed; margin-right: 8px;"></i>' + email + '</span>' +
                '<span style="background: rgba(124,58,237,0.2); color: #a78bfa; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600;">' + roleText + '</span>';
            logList.prepend(item);
            setTimeout(() => { item.style.opacity = '1'; item.style.transform = 'translateY(0)'; }, 10);
            this.showToast('Rol "' + roleText + '" asignado a ' + email, 'success');
            emailInput.value = '';
        });

        document.getElementById('btn-add-coins').addEventListener('click', async () => {
            const emailInput = document.getElementById('admin-coins-email');
            const email = emailInput.value.trim().toLowerCase();
            const amount = parseInt(document.getElementById('admin-coins-amount').value, 10);
            if (!email || !email.includes('@')) {
                this.showToast('Ingresa un correo electrónico válido.', 'warning');
                return;
            }
            if (isNaN(amount) || amount <= 0) {
                this.showToast('Ingresa una cantidad válida de NeuroCoins.', 'warning');
                return;
            }

            const btn = document.getElementById('btn-add-coins');
            const originalContent = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verificando...';
            btn.disabled = true;

            const userExistsLocally = localStorage.getItem('neurospark_state_' + email) !== null || email === 'sparkneuro64@gmail.com';
            const userExistsInDB = await authController.checkUserExists(email);

            btn.innerHTML = originalContent;
            btn.disabled = false;

            if (userExistsInDB === false && !userExistsLocally) {
                this.showToast('El usuario no está registrado en Supabase.', 'warning');
                return;
            } else if (userExistsInDB === null && !userExistsLocally) {
                this.showToast('Aviso: Verificación RPC no instalada. Se creará una billetera local.', 'info');
            }

            const logList = document.getElementById('admin-log-list');
            if (logList.children.length === 1 && logList.querySelector('[style*="circle-info"]')) {
                logList.innerHTML = '';
            }
            const item = document.createElement('div');
            item.style.cssText = 'padding: 16px 20px; background: rgba(245,158,11,0.08); border-radius: 10px; border: 1px solid rgba(245,158,11,0.25); display: flex; justify-content: space-between; align-items: center; opacity: 0; transform: translateY(-8px); transition: all 0.35s ease;';
            item.innerHTML = '<span style="font-size: 0.95rem;"><i class="fa-solid fa-user-plus" style="color:#f59e0b; margin-right: 8px;"></i>' + email + '</span>' +
                '<span style="background: rgba(245,158,11,0.2); color: #fbbf24; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600;">+' + amount + ' Coins</span>';
            logList.prepend(item);
            setTimeout(() => { item.style.opacity = '1'; item.style.transform = 'translateY(0)'; }, 10);
            this.showToast('Se otorgaron ' + amount + ' NeuroCoins a ' + email, 'success');

            // Add coins to target user's state
            const targetEmail = email;
            const targetKey = 'neurospark_state_' + targetEmail;

            // Try to load from Supabase first
            let targetState = await authController.loadUserState(targetEmail);

            if (!targetState) {
                let targetStateStr = localStorage.getItem(targetKey);
                targetState = targetStateStr ? JSON.parse(targetStateStr) : {
                    profile: 'kids',
                    activeProfileName: 'Estudiante',
                    coins: 120,
                    level: 1,
                    lang: 'es',
                    unlockedItems: ['classic_skin'],
                    activeSkin: 'classic_skin',
                    history: [],
                    tasks: [],
                    settings: { musicOn: false, voiceOn: false, lowStimulus: false, volume: 50 }
                };
            }

            targetState.coins = (targetState.coins || 0) + amount;
            // Prevent injecting the admin's email into the target's state
            targetState.currentUserEmail = targetEmail;

            // Save to Local and Supabase DB
            localStorage.setItem(targetKey, JSON.stringify(targetState));
            await authController.saveUserState(targetEmail, targetState);

            // If the admin is gifting themselves
            if (targetEmail === (this.state.currentUserEmail || '').toLowerCase()) {
                this.state.coins += amount;
                this.updateHeaderHUD();
                this.saveState();
            }

            document.getElementById('admin-coins-email').value = '';
            document.getElementById('admin-coins-amount').value = '';
        });
    }

    /* ---- ADMIN HOME (standalone page - kept for reference) ---- */
    renderAdminHome(mount) {
        mount.innerHTML = `
            <div style="padding: 30px; display: flex; flex-direction: column; gap: 30px; max-width: 1000px; margin: 0 auto; width: 100%;">
                <div style="background: linear-gradient(135deg, #1e293b, #0f172a); padding: 40px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
                    <h2 style="font-size: 2.2rem; margin-bottom: 15px; color: white; display: flex; align-items: center; gap: 15px;">
                        <i class="fa-solid fa-shield-halved text-purple"></i> Panel de Administración General
                    </h2>
                    <p style="font-size: 1.1rem; color: var(--text-muted);">Control total sobre los accesos y roles de la plataforma NeuroSpark.</p>
                </div>
                
                <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 20px; padding: 40px;">
                    <h3 style="font-size: 1.6rem; margin-bottom: 15px; color: white;"><i class="fa-solid fa-users-gear text-blue"></i> Asignación de Roles de Especialistas</h3>
                    <p style="color: var(--text-muted); margin-bottom: 30px; font-size: 1.05rem;">Busca a un usuario registrado por su correo electrónico para otorgarle los permisos especiales de Docente o Padre.</p>
                    
                    <div style="display: flex; gap: 20px; margin-bottom: 40px; flex-wrap: wrap;">
                        <input type="email" id="admin-search-email" placeholder="correo_del_usuario@ejemplo.com" style="flex: 1; min-width: 250px; padding: 18px; border-radius: 12px; border: 2px solid var(--border-color); background: rgba(0,0,0,0.2); color: var(--text-main); font-size: 1.1rem; outline: none; transition: border-color 0.3s;">
                        <select id="admin-role-select" style="padding: 18px; border-radius: 12px; border: 2px solid var(--border-color); background: var(--bg-card); color: white; font-size: 1.1rem; outline: none; cursor: pointer; min-width: 250px;">
                            <option value="padre">Otorgar Rol: Padre / Apoderado</option>
                            <option value="docente">Otorgar Rol: Docente / Especialista</option>
                        </select>
                        <button id="btn-assign-role" class="play-btn" style="background: linear-gradient(135deg, var(--primary-blue), var(--primary-purple)); padding: 0 40px; font-size: 1.1rem; border-radius: 12px; height: 60px;"><i class="fa-solid fa-check"></i> Asignar</button>
                    </div>

                    <div style="border-top: 1px solid var(--border-color); padding-top: 30px;">
                        <h4 style="margin-bottom: 20px; color: white; font-size: 1.2rem;"><i class="fa-solid fa-clock-rotate-left"></i> Registro de Asignaciones Recientes</h4>
                        <div id="admin-log-list" style="display: flex; flex-direction: column; gap: 15px;">
                            <div style="padding: 20px; background: rgba(255,255,255,0.03); border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-size: 1.05rem;"><i class="fa-solid fa-user-tie text-purple" style="margin-right: 10px;"></i> director@neurospark.edu</span>
                                <span class="difficulty-badge diff-easy" style="border-color: #a78bfa; color: #a78bfa; padding: 6px 12px; font-size: 0.85rem;">Docente Especialista</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('admin-search-email').addEventListener('focus', function () {
            this.style.borderColor = '#38bdf8';
        });
        document.getElementById('admin-search-email').addEventListener('blur', function () {
            this.style.borderColor = 'var(--border-color)';
        });

        document.getElementById('btn-assign-role').addEventListener('click', () => {
            const email = document.getElementById('admin-search-email').value;
            const roleSelect = document.getElementById('admin-role-select');
            const roleText = roleSelect.options[roleSelect.selectedIndex].text;

            if (!email || !email.includes('@')) {
                this.showToast('Por favor, ingresa un correo electrónico válido.', 'warning');
                return;
            }

            const logList = document.getElementById('admin-log-list');
            const div = document.createElement('div');
            div.style.cssText = "padding: 20px; background: rgba(56, 189, 248, 0.05); border-radius: 12px; border: 1px solid rgba(56, 189, 248, 0.2); display: flex; justify-content: space-between; align-items: center; opacity: 0; transform: translateY(-10px); transition: all 0.4s ease;";
            div.innerHTML = '<span style="font-size: 1.05rem;"><i class="fa-solid fa-user-check text-blue" style="margin-right: 10px;"></i> ' + email + '</span>' +
                '<span class="difficulty-badge diff-medium" style="padding: 6px 12px; font-size: 0.85rem;">' + roleText.split(':')[1].trim() + '</span>';
            logList.prepend(div);

            setTimeout(() => {
                div.style.opacity = '1';
                div.style.transform = 'translateY(0)';
            }, 10);

            this.showToast('Rol asignado exitosamente a ' + email, 'success');
            document.getElementById('admin-search-email').value = '';
        });
    }

    /* ---- KIDS HOME ---- */
    renderKidsHome(mount) {
        const name = this.state.activeProfileName;
        const avatar = this.state.avatar || 'sparky';
        const avatarUrl = (avatar.startsWith('http') || avatar.startsWith('data:')) ? avatar : `https://api.dicebear.com/7.x/bottts/svg?seed=${avatar.charAt(0).toUpperCase() + avatar.slice(1)}`;
        mount.innerHTML = `
            <div class="kids-home-view">
                <div class="kids-welcome-banner">
                    <div class="kids-welcome-info">
                        <h2>${i18n.t('kidsWelcome', { name })}</h2>
                        <p>${i18n.t('kidsWelcomeSub')}</p>
                    </div>
                    <div class="sparky-mascot-img">
                        <img src="${avatarUrl}"
                             alt="${name}"
                             style="width:110px;height:110px;border-radius:50%;background:rgba(255,255,255,0.15);border:3px solid rgba(255,255,255,0.5);object-fit:cover;box-shadow:0 0 20px rgba(167,139,250,0.4);"
                             onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
                        <svg viewBox="0 0 100 100" style="width:110px;height:110px;display:none;">
                            <rect x="20" y="20" width="60" height="55" rx="15" fill="#a78bfa" stroke="#ffffff" stroke-width="4"/>
                            <circle cx="50" cy="5" r="5" fill="#facc15"/>
                            <line x1="50" y1="20" x2="50" y2="8" stroke="#ffffff" stroke-width="3"/>
                            <rect x="30" y="30" width="40" height="18" rx="4" fill="#0f172a"/>
                            <circle cx="42" cy="39" r="4" fill="#38bdf8"/>
                            <circle cx="58" cy="39" r="4" fill="#38bdf8"/>
                            <path d="M 44 58 Q 50 63 56 58" stroke="#ffffff" stroke-width="3" fill="none"/>
                        </svg>
                    </div>
                </div>

                <div class="kids-game-section">
                    <h3 class="section-title"><i class="fa-solid fa-gamepad text-accent"></i> ${i18n.t('kidsGamesTitle')}</h3>
                    <div class="games-grid">
                        ${this._gameCard('distraction_hunter', 'g1Name', 'g1Desc', 'diff-easy', 'g1Tag', 'fa-meteor', 'distraction.png')}
                        ${this._gameCard('emotional_stoplight', 'g4Name', 'g4Desc', 'diff-easy', 'g4Tag', 'fa-traffic-light', 'stoplight.png')}
                        ${this._gameCard('musical_memory', 'g5Name', 'g5Desc', 'diff-medium', 'g5Tag', 'fa-music', 'memory.png')}
                        ${this._gameCard('memory_cards', 'g6Name', 'g6Desc', 'diff-easy', 'g6Tag', 'fa-layer-group', 'spatial.png')}
                        ${this._gameCard('kids_spatial', 'k_spatialName', 'k_spatialDesc', 'diff-medium', 'g2Tag', 'fa-star', 'spatial.png')}
                        ${this._gameCard('kids_routine', 'k_routineName', 'k_routineDesc', 'diff-medium', 'g3Tag', 'fa-rocket', 'routine.png')}
                        ${this._gameCard('kids_pattern', 'k_patternName', 'k_patternDesc', 'diff-medium', 'g7Tag', 'fa-shapes', 'distraction.png')}
                        ${this._gameCard('kids_math', 'k_mathName', 'k_mathDesc', 'diff-hard', 'g8Tag', 'fa-calculator', 'memory.png')}
                    </div>
                </div>

                <div class="store-container">
                    <h3 class="section-title"><i class="fa-solid fa-shop text-purple"></i> ${i18n.t('storeTitle')}</h3>
                    <p style="color:var(--text-muted);font-size:0.9rem;">${i18n.t('storeSub')}</p>
                    <div class="store-grid">
                        ${this.storeItems.map(item => {
            const bought = this.state.unlockedItems.includes(item.id);
            const active = this.state.activeSkin === item.id;
            const btnHTML = active
                ? `<span class="difficulty-badge diff-easy">${i18n.t('equipped')}</span>`
                : bought
                    ? `<button class="equip-btn" style="background:#7c3aed;color:white;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;">${i18n.t('equip')}</button>`
                    : `<span style="color:#fbbf24;font-weight:700;"><i class="fa-solid fa-coins"></i> ${item.cost}</span>`;
            const imgOrIcon = item.image
                ? `<img src="${item.image}" alt="${i18n.t(item.nameKey)}" style="height: 60px; width: 60px; object-fit: contain; margin-bottom: 12px; filter: drop-shadow(0 0 10px ${item.color});" />`
                : `<i class="fa-solid ${item.icon}" style="font-size:2.5rem;color:${item.color};display:block;margin:10px 0;text-shadow: 0 0 10px ${item.color};"></i>`;
            return `
                                <div class="store-item ${bought ? 'purchased' : ''} ${active ? 'active-skin' : ''}" data-id="${item.id}">
                                    ${imgOrIcon}
                                    <strong>${i18n.t(item.nameKey)}</strong>
                                    <div style="margin-top:10px;">${btnHTML}</div>
                                </div>`;
        }).join('')}
                    </div>
                </div>
            </div>`;

        mount.querySelectorAll('.play-btn').forEach(btn => {
            btn.addEventListener('click', () => engine.launch(btn.getAttribute('data-game')));
        });

        mount.querySelectorAll('.store-item').forEach(item => {
            item.addEventListener('click', e => {
                const itemId = item.getAttribute('data-id');
                const itemData = this.storeItems.find(i => i.id === itemId);

                if (e.target.closest('.equip-btn')) {
                    this.state.activeSkin = itemId;
                    this.saveState(); this.renderHome();
                    this.showToast(i18n.t('customized'), 'success');
                    return;
                }
                if (this.state.unlockedItems.includes(itemId)) return;

                if (this.state.coins >= itemData.cost) {
                    this.state.coins -= itemData.cost;
                    this.state.unlockedItems.push(itemId);
                    this.state.activeSkin = itemId;
                    this.saveState(); this.updateHeaderHUD(); this.renderHome();
                    sound.playSuccess();
                    this.showToast(i18n.t('bought', { name: i18n.t(itemData.nameKey) }), 'success');
                } else {
                    sound.playError();
                    this.showToast(i18n.t('notEnoughCoins'), 'warning');
                }
            });
        });
    }

    _gameCard(id, nameKey, descKey, diffClass, tagKey, icon, imgName) {
        const isEn = typeof i18n !== 'undefined' && i18n.currentLang === 'en';
        const isQu = typeof i18n !== 'undefined' && i18n.currentLang === 'qu';
        const diffMapEs = { 'diff-easy': 'FÁCIL', 'diff-medium': 'MEDIO', 'diff-hard': 'DIFÍCIL' };
        const diffMapEn = { 'diff-easy': 'EASY', 'diff-medium': 'MEDIUM', 'diff-hard': 'HARD' };
        const diffMapQu = { 'diff-easy': 'ALLILLAN', 'diff-medium': 'CHAWPI', 'diff-hard': 'SASA' };
        const map = isQu ? diffMapQu : (isEn ? diffMapEn : diffMapEs);
        const diffLabel = map[diffClass] || diffClass.replace('diff-', '').toUpperCase();

        return `
            <div class="game-card">
                <div class="game-thumbnail" style="background-image: url('assets/games/${imgName}');">
                    <i class="fa-solid ${icon}" style="display:none;"></i>
                </div>
                <div class="game-info">
                    <span class="game-tag">${i18n.t(tagKey)}</span>
                    <h4 class="game-title">${i18n.t(nameKey)}</h4>
                    <p class="game-desc">${i18n.t(descKey)}</p>
                    <div class="game-footer">
                        <span class="difficulty-badge ${diffClass}">${diffLabel}</span>
                        <button class="play-btn" data-game="${id}">${i18n.t('playBtn')} <i class="fa-solid fa-play"></i></button>
                    </div>
                </div>
            </div>`;
    }

    /* ---- TEENS HOME ---- */
    renderTeensHome(mount) {
        const name = this.state.activeProfileName;
        const avatar = this.state.avatar || 'sparky';
        const avatarUrl = (avatar.startsWith('http') || avatar.startsWith('data:')) ? avatar : `https://api.dicebear.com/7.x/bottts/svg?seed=${avatar.charAt(0).toUpperCase() + avatar.slice(1)}`;
        mount.innerHTML = `
            <div class="teens-home-view">
                <div class="teens-main-panel" style="display:flex;flex-direction:column;gap:24px;">
                    <div class="kids-welcome-banner" style="background:linear-gradient(135deg,hsla(270,85%,20%,0.8),hsla(210,100%,25%,0.8));">
                        <div class="kids-welcome-info">
                            <h2>${i18n.t('teensWelcome', { name })}</h2>
                            <p>${i18n.t('teensWelcomeSub')}</p>
                        </div>
                        <div style="flex-shrink:0;">
                            <img src="${avatarUrl}"
                                 alt="${name}"
                                 style="width:90px;height:90px;border-radius:50%;background:rgba(255,255,255,0.1);border:3px solid rgba(167,139,250,0.6);object-fit:cover;box-shadow:0 0 20px rgba(167,139,250,0.35);"
                                 onerror="this.style.display='none'">
                        </div>
                    </div>
                    <h3 class="section-title"><i class="fa-solid fa-brain text-blue"></i> ${i18n.t('teensGamesTitle')}</h3>
                    <div class="games-grid" style="grid-template-columns:1fr 1fr;">
                        ${this._gameCard('spatial_focus', 'g2Name', 'g2Desc', 'diff-medium', 'g2Tag', 'fa-star-half-stroke', 'spatial.png')}
                        ${this._gameCard('routine_builder', 'g3Name', 'g3Desc', 'diff-hard', 'g3Tag', 'fa-puzzle-piece', 'routine.png')}
                        ${this._gameCard('pattern_matcher', 'g7Name', 'g7Desc', 'diff-medium', 'g7Tag', 'fa-shapes', 'distraction.png')}
                        ${this._gameCard('speed_math', 'g8Name', 'g8Desc', 'diff-hard', 'g8Tag', 'fa-calculator', 'memory.png')}
                        ${this._gameCard('teens_distraction', 't_distName', 't_distDesc', 'diff-medium', 'g1Tag', 'fa-shield-halved', 'distraction.png')}
                        ${this._gameCard('teens_stoplight', 't_stopName', 't_stopDesc', 'diff-hard', 'g4Tag', 'fa-bolt', 'stoplight.png')}
                        ${this._gameCard('teens_sound', 't_soundName', 't_soundDesc', 'diff-hard', 'g5Tag', 'fa-wave-square', 'memory.png')}
                        ${this._gameCard('teens_cards', 't_cardsName', 't_cardsDesc', 'diff-medium', 'g6Tag', 'fa-unlock-keyhole', 'spatial.png')}
                    </div>
                </div>

                <div style="display:flex;flex-direction:column;gap:24px;">
                    <div class="pomodoro-container">
                        <h3>${i18n.t('pomodoroTitle')}</h3>
                        <p style="color:var(--text-muted);font-size:0.8rem;margin-top:4px;">${i18n.t('pomodoroSub')}</p>
                        <div class="timer-circle" id="timer-display">20:00</div>
                        <div class="timer-controls">
                            <button class="timer-btn" id="btn-timer-start">${i18n.t('pomodoroStart')}</button>
                            <button class="timer-btn" id="btn-timer-reset">${i18n.t('pomodoroReset')}</button>
                        </div>
                    </div>

                    <div class="teens-planner">
                        <div class="planner-header">
                            <h3>${i18n.t('plannerTitle')}</h3>
                            <button class="control-btn" id="btn-add-task" style="width:30px;height:30px;border-radius:6px;font-size:0.85rem;">
                                <i class="fa-solid fa-plus"></i>
                            </button>
                        </div>
                        <div class="task-list" id="teen-task-list">
                            ${this.state.tasks.map(task => `
                                <div class="task-item ${task.done ? 'completed' : ''}" data-id="${task.id}">
                                    <div class="task-left">
                                        <div class="task-checkbox">${task.done ? '✓' : ''}</div>
                                        <span class="task-text">${task.text}</span>
                                    </div>
                                    <button class="delete-task-btn" style="background:none;border:none;color:#ef4444;cursor:pointer;">
                                        <i class="fa-solid fa-trash-can"></i>
                                    </button>
                                </div>`).join('')}
                        </div>
                    </div>
                </div>
            </div>`;

        mount.querySelectorAll('.play-btn[data-game]').forEach(btn =>
            btn.addEventListener('click', () => engine.launch(btn.getAttribute('data-game')))
        );

        const taskList = document.getElementById('teen-task-list');
        taskList.addEventListener('click', e => {
            const item = e.target.closest('.task-item');
            if (!item) return;
            const taskId = parseInt(item.getAttribute('data-id'));
            if (e.target.closest('.delete-task-btn')) {
                this.state.tasks = this.state.tasks.filter(t => t.id !== taskId);
                this.saveState(); this.renderHome(); return;
            }
            const task = this.state.tasks.find(t => t.id === taskId);
            task.done = !task.done;
            this.saveState();
            if (task.done) { sound.playSuccess(); this.state.coins += 5; this.updateHeaderHUD(); }
            else sound.playPop();
            this.renderHome();
        });

        document.getElementById('btn-add-task').addEventListener('click', () => {
            let overlay = document.getElementById('task-prompt-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'task-prompt-overlay';
                overlay.className = 'settings-overlay';
                document.body.appendChild(overlay);
            }

            overlay.innerHTML = `
                <div class="settings-modal" style="max-width: 400px; text-align: center; padding: 30px;">
                    <h3 style="margin-bottom: 20px; font-size: 1.4rem;">${i18n.t('plannerAdd')}</h3>
                    <input type="text" id="custom-task-input" style="width: 100%; padding: 14px; border-radius: 12px; border: 2px solid var(--border-color); background: rgba(0,0,0,0.2); color: var(--text-main); margin-bottom: 24px; outline: none; font-size: 1rem; transition: border-color 0.3s;" placeholder="Ej: Estudiar para el examen...">
                    <div style="display: flex; gap: 12px; justify-content: center;">
                        <button id="btn-task-cancel" class="play-btn" style="background: rgba(255,255,255,0.05); color: var(--text-main); border: 1px solid var(--border-color);">Cancelar</button>
                        <button id="btn-task-add" class="play-btn" style="background: linear-gradient(135deg, var(--primary-blue), var(--primary-purple));">Agregar Tarea</button>
                    </div>
                </div>
            `;

            overlay.classList.add('open');
            const input = document.getElementById('custom-task-input');
            setTimeout(() => input.focus(), 100);

            const closeTaskPrompt = () => {
                overlay.classList.remove('open');
            };

            const addTask = () => {
                const text = input.value;
                if (text && text.trim()) {
                    this.state.tasks.push({ id: Date.now(), text: text.trim(), done: false });
                    this.saveState(); this.renderHome();
                }
                closeTaskPrompt();
            };

            document.getElementById('btn-task-cancel').addEventListener('click', closeTaskPrompt);
            document.getElementById('btn-task-add').addEventListener('click', addTask);
            input.addEventListener('keydown', e => {
                if (e.key === 'Enter') addTask();
                if (e.key === 'Escape') closeTaskPrompt();
            });
        });

        this.setupPomodoro();
    }

    /* ---- PARENT DASHBOARD VIEW ---- */
    renderParentHome(mount) {
        // Ensure studentName is stored clean (no prefix) and persisted in state
        if (!this.state.studentName) {
            // Strip any known prefix from activeProfileName as fallback
            this.state.studentName = this.state.activeProfileName
                .replace(/^Apoderado de\s*/i, '')
                .replace(/^Qhawaq\s*/i, '')
                .replace(/^Guardian of\s*/i, '')
                .trim();
        }
        const studentName = this.state.studentName;

        // Always rebuild activeProfileName in current language (never store prefix)
        this.state.activeProfileName = i18n.t('parentPrefix') + ' ' + studentName;
        document.getElementById('current-profile-name').innerText = this.state.activeProfileName;

        const coins = this.state.coins || 0;
        const level = this.state.level || 1;
        const coinsPerLevel = 500;
        const coinsIntoLevel = coins % coinsPerLevel;
        const pct = Math.min(100, Math.round((coinsIntoLevel / coinsPerLevel) * 100));
        const avatar = this.state.avatar || 'sparky';
        const avatarUrl = (avatar.startsWith('http') || avatar.startsWith('data:')) ? avatar : `https://api.dicebear.com/7.x/bottts/svg?seed=${avatar.charAt(0).toUpperCase() + avatar.slice(1)}`;

        // Determine age group
        const userAge = this.state.userAge || '—';
        const profileType = (parseInt(userAge) <= 11) ? i18n.t('parentProfileKids') : i18n.t('parentProfileTeens');
        const profileColor = (parseInt(userAge) <= 11) ? '#86efac' : '#c4b5fd';

        mount.innerHTML = `
            <div class="teens-home-view parent-panel-view" style="gap:28px;">
                <!-- Parent Welcome Banner -->
                <div class="kids-welcome-banner" style="background: linear-gradient(135deg, var(--primary-green), var(--primary-blue)); border: 1px solid var(--border-color); box-shadow: 0 8px 30px var(--glow-color); display:flex; justify-content:space-between; align-items:center;">
                    <div class="kids-welcome-info" style="display:flex;align-items:center;gap:20px;">
                        <img src="${avatarUrl}" style="width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,0.3);border:3px solid rgba(255,255,255,0.5);flex-shrink:0;">
                        <div>
                            <h2 style="display:flex;align-items:center;gap:10px;color:#1e293b;margin:0 0 6px;font-size:1.4rem;"><i class="fa-solid fa-user-shield"></i> ${i18n.t('parentPortalTitle')}</h2>
                            <p style="color:#1e293b;margin:0;font-size:0.95rem;">${i18n.t('parentPortalDesc', { name: studentName })}</p>
                        </div>
                    </div>
                    <button id="btn-download-pdf" class="play-btn" style="background: #1e293b; color: white; padding: 10px 16px; border-radius: 8px; font-size: 0.9rem; border: none; cursor: pointer; flex-shrink: 0; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                        <i class="fa-solid fa-file-pdf" style="color: #ef4444; margin-right: 6px;"></i> ${i18n.t('parentDownloadPdf')}
                    </button>
                </div>

                <!-- STATS CARDS -->
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                    <div class="game-card" style="padding: 24px; text-align: center;">
                        <i class="fa-solid fa-coins" style="font-size: 2.2rem; color: #f59e0b; margin-bottom: 10px;"></i>
                        <h3 style="color: var(--text-main); margin: 0; font-size: 1.05rem;">${i18n.t('parentCoins')}</h3>
                        <p style="color: var(--text-muted); font-size: 2rem; font-weight: 900; margin: 6px 0 0;">${coins}</p>
                    </div>
                    <div class="game-card" style="padding: 24px; text-align: center;">
                        <i class="fa-solid fa-star" style="font-size: 2.2rem; color: var(--primary-blue); margin-bottom: 10px;"></i>
                        <h3 style="color: var(--text-main); margin: 0; font-size: 1.05rem;">${i18n.t('parentLevel')}</h3>
                        <p style="color: var(--text-muted); font-size: 2rem; font-weight: 900; margin: 6px 0 0;">${level}</p>
                    </div>
                    <div class="game-card" style="padding: 24px; text-align: center;">
                        <i class="fa-solid fa-child" style="font-size: 2.2rem; color: ${profileColor}; margin-bottom: 10px;"></i>
                        <h3 style="color: var(--text-main); margin: 0; font-size: 1.05rem;">${i18n.t('parentAge')}</h3>
                        <p style="color: var(--text-muted); font-size: 2rem; font-weight: 900; margin: 6px 0 0;">${userAge}</p>
                    </div>
                    <div class="game-card" style="padding: 24px; text-align: center;">
                        <i class="fa-solid fa-brain" style="font-size: 2.2rem; color: var(--primary-purple); margin-bottom: 10px;"></i>
                        <h3 style="color: var(--text-main); margin: 0; font-size: 1.05rem;">${i18n.t('parentProfile')}</h3>
                        <p style="color: ${profileColor}; font-size: 1.1rem; font-weight: 800; margin: 6px 0 0;">${profileType}</p>
                    </div>
                </div>

                <!-- LEVEL PROGRESS -->
                <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:14px;padding:24px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                        <h3 style="color:var(--text-main);margin:0;font-size:1.1rem;font-weight:800;"><i class="fa-solid fa-chart-line" style="color:var(--primary-blue);margin-right:8px;"></i> ${i18n.t('parentProgress', { level: level + 1 })}</h3>
                        <span style="color:var(--text-muted);font-size:0.85rem;font-weight:700;">${coinsIntoLevel} / ${coinsPerLevel} coins</span>
                    </div>
                    <div style="width:100%;height:14px;background:rgba(255,255,255,0.06);border-radius:10px;overflow:hidden;border:1px solid var(--border-color);">
                        <div style="width:${pct}%;height:100%;background:linear-gradient(90deg, var(--primary-blue), var(--primary-purple));border-radius:10px;transition:width 0.6s ease;"></div>
                    </div>
                </div>

                <!-- ACTIVITY SUMMARY -->
                <div style="display:flex;flex-direction:column;gap:16px;">
                    <div style="display:flex;align-items:center;gap:12px;padding:14px 20px;background:var(--bg-card);border:1px solid var(--border-color);border-radius:14px;">
                        <i class="fa-solid fa-gamepad" style="color:var(--primary-green);font-size:1.3rem;"></i>
                        <div>
                            <h3 style="color:var(--text-main);margin:0;font-size:1.15rem;font-weight:800;">${i18n.t('parentModulesTitle')}</h3>
                            <p style="color:var(--text-muted);margin:0;font-size:0.8rem;">${i18n.t('parentModulesDesc', { name: studentName })}</p>
                        </div>
                    </div>
                    <div style="background:var(--bg-card);border-radius:14px;border:1px solid var(--border-color);padding:24px;">
                        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;">
                            ${this._getParentGamesList()}
                        </div>
                    </div>
                </div>
                
                <!-- PARENT TIPS -->
                <div style="background:rgba(56,189,248,0.05);border:1px solid rgba(56,189,248,0.12);border-radius:14px;padding:24px;">
                    <h3 style="color:var(--text-main);margin:0 0 12px;font-size:1.05rem;font-weight:800;"><i class="fa-solid fa-lightbulb" style="color:#f59e0b;margin-right:8px;"></i> ${i18n.t('parentTipsTitle')}</h3>
                    <ul style="color:var(--text-muted);margin:0;padding-left:20px;line-height:1.8;font-size:0.9rem;">
                        <li>${i18n.t('parentTip1')}</li>
                        <li>${i18n.t('parentTip2')}</li>
                        <li>${i18n.t('parentTip3')}</li>
                        <li>${i18n.t('parentTip4')}</li>
                    </ul>
                </div>
            </div>`;

        // Wire up PDF download button
        const btnPdf = mount.querySelector('#btn-download-pdf');
        if (btnPdf) {
            btnPdf.addEventListener('click', () => {
                this._downloadParentPdf(studentName, coins, level, userAge, profileType);
            });
        }
    }

    _downloadParentPdf(studentName, coins, level, userAge, profileType) {
        if (!window.jspdf) {
            this.showToast('El generador de PDF aún está cargando.', 'warning');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const lang = i18n.currentLang;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        
        // --- 1. HEADER (Dark Slate) ---
        doc.setFillColor(15, 23, 42); // #0f172a
        doc.rect(0, 0, pageWidth, 40, 'F');
        
        // Brand/Logo Text
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(56, 189, 248); // #38bdf8
        doc.text("NEUROSPARK", 20, 26);
        
        // Title
        doc.setFontSize(14);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(255, 255, 255);
        doc.text(i18n.t('pdfTitle'), pageWidth - 20, 26, { align: 'right' });
        
        let y = 60;
        
        // --- 2. STUDENT INFO SECTION ---
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(studentName.toUpperCase(), 20, y);
        
        // Colored Line under name
        doc.setDrawColor(56, 189, 248);
        doc.setLineWidth(1.5);
        doc.line(20, y + 4, 80, y + 4);
        
        y += 20;

        // --- 3. STATS CARDS ---
        const cardWidth = (pageWidth - 50) / 3;
        
        // Box 1: Coins (Gold/Orange)
        doc.setFillColor(254, 243, 199);
        doc.roundedRect(20, y, cardWidth, 30, 3, 3, 'F');
        doc.setFontSize(10);
        doc.setTextColor(217, 119, 6);
        doc.text(i18n.t('pdfCoins').replace(':', ''), 20 + (cardWidth/2), y + 12, { align: 'center' });
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(String(coins), 20 + (cardWidth/2), y + 23, { align: 'center' });
        
        // Box 2: Level (Blue)
        doc.setFillColor(224, 242, 254);
        doc.roundedRect(20 + cardWidth + 5, y, cardWidth, 30, 3, 3, 'F');
        doc.setFontSize(10);
        doc.setTextColor(2, 132, 199); 
        doc.setFont('helvetica', 'normal');
        doc.text(i18n.t('pdfLevel').replace(':', ''), 20 + cardWidth + 5 + (cardWidth/2), y + 12, { align: 'center' });
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(String(level), 20 + cardWidth + 5 + (cardWidth/2), y + 23, { align: 'center' });
        
        // Box 3: Age/Profile (Purple)
        doc.setFillColor(243, 232, 255);
        doc.roundedRect(20 + (cardWidth*2) + 10, y, cardWidth, 30, 3, 3, 'F');
        doc.setFontSize(10);
        doc.setTextColor(147, 51, 234); 
        doc.setFont('helvetica', 'normal');
        doc.text(i18n.t('pdfAge').replace(':', ''), 20 + (cardWidth*2) + 10 + (cardWidth/2), y + 12, { align: 'center' });
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        
        // Extract basic age from string to display nicely
        const cleanProf = profileType.split('(')[0].replace('Perfil', '').trim();
        doc.text(`${userAge} - ${cleanProf}`, 20 + (cardWidth*2) + 10 + (cardWidth/2), y + 23, { align: 'center' });
        
        y += 45;

        // --- 4. ANALYSIS SECTION (Attention & Hyperactivity) ---
        doc.setFillColor(240, 253, 244); // light green bg
        doc.setDrawColor(187, 247, 208);
        doc.setLineWidth(0.5);
        doc.roundedRect(20, y, pageWidth - 40, 60, 4, 4, 'FD');

        y += 12;
        doc.setFontSize(14);
        doc.setTextColor(22, 101, 52); // dark green
        doc.setFont('helvetica', 'bold');
        doc.text("✦ " + i18n.t('pdfAttentionTitle').replace(':', ''), 28, y);
        
        y += 12;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(21, 128, 61);
        
        // Simulating attention based on level, capping at 95%
        const attnPct = Math.min(95, 55 + (level * 3)); 
        const hypPct = Math.max(15, 85 - (level * 2)); // Decreases as they level up
        
        doc.text(i18n.t('pdfAttentionLevel') + ` ${attnPct}%`, 35, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50, 50, 50);
        doc.text(`- ${i18n.t('pdfAchievements')} Precisión en juegos de enfoque en progreso continuo.`, 35, y);
        
        y += 10;
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(21, 128, 61);
        doc.text(i18n.t('pdfHyperactivity') + ` ${hypPct}%`, 35, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50, 50, 50);
        doc.text(`- ${i18n.t('pdfErrors')} Aún hay impulsividad en decisiones rápidas.`, 35, y);

        y += 20;
        
        // --- 5. ADVICE SECTION ---
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.5);
        doc.roundedRect(20, y, pageWidth - 40, 65, 4, 4, 'FD');
        
        y += 12;
        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.text("✦ " + i18n.t('pdfAdviceTitle').replace(':', ''), 28, y);
        
        y += 10;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        
        const adviceLines = [
            i18n.t('pdfAdvice1'),
            i18n.t('pdfAdvice2'),
            i18n.t('pdfAdvice3')
        ];
        
        adviceLines.forEach(line => {
            const splitLine = doc.splitTextToSize(line, pageWidth - 60);
            doc.text(splitLine, 35, y);
            y += splitLine.length * 6 + 2;
        });
        
        // --- 5. FOOTER ---
        doc.setFontSize(10);
        doc.setTextColor(148, 163, 184);
        doc.text(`NeuroSpark Platform © ${new Date().getFullYear()} - Generado el ${new Date().toLocaleDateString()}`, pageWidth / 2, pageHeight - 15, { align: 'center' });

        // Save
        const fileName = `NeuroSpark_Reporte_${studentName.replace(/\s+/g, '_')}_${lang}.pdf`;
        doc.save(fileName);
        this.showToast('PDF descargado con éxito', 'success');
    }

    _getParentGamesList() {
        const age = parseInt(this.state.userAge) || 10;
        let games = [];
        if (age <= 11) {
            games = [
                { icon: 'fa-puzzle-piece', name: 'Memory Cards', color: '#38bdf8' },
                { icon: 'fa-eye', name: 'Buscador Visual', color: '#22c55e' },
                { icon: 'fa-calculator', name: 'Mathcraft', color: '#f59e0b' },
                { icon: 'fa-shapes', name: 'Patrón Mágico', color: '#a78bfa' },
                { icon: 'fa-book-open', name: 'Lecturas Activas', color: '#f43f5e' },
                { icon: 'fa-calendar-check', name: 'Rutina Builder', color: '#14b8a6' },
                { icon: 'fa-music', name: 'Ritmo Cognitivo', color: '#e879f9' },
                { icon: 'fa-lightbulb', name: 'Inventos Locos', color: '#fb923c' }
            ];
        } else {
            games = [
                { icon: 'fa-code', name: 'NeuroCode', color: '#38bdf8' },
                { icon: 'fa-flask', name: 'Laboratorio IA', color: '#22c55e' },
                { icon: 'fa-chess', name: 'Estrategia Pro', color: '#a78bfa' },
                { icon: 'fa-file-lines', name: 'Comprensión+', color: '#f59e0b' },
                { icon: 'fa-brain', name: 'Memoria Avanzada', color: '#f43f5e' },
                { icon: 'fa-clock', name: 'Gestión Tiempo', color: '#14b8a6' },
                { icon: 'fa-pen-fancy', name: 'Escritura Creativa', color: '#e879f9' },
                { icon: 'fa-chart-bar', name: 'Finanzas Básicas', color: '#fb923c' }
            ];
        }
        return games.map(g => `
            <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(255,255,255,0.03);border:1px solid var(--border-color);border-radius:10px;">
                <i class="fa-solid ${g.icon}" style="color:${g.color};font-size:1.1rem;width:22px;text-align:center;"></i>
                <span style="color:var(--text-main);font-size:0.85rem;font-weight:600;">${g.name}</span>
            </div>
        `).join('');
    }

    /* ---- ADMIN GAMES VIEW (all 16 games) ---- */
    renderAdminGamesHome(mount) {
        const name = this.state.activeProfileName;
        mount.innerHTML = `
            <div class="teens-home-view admin-games-view" style="gap:32px;">

                <!-- Admin Welcome Banner -->
                <div class="kids-welcome-banner" style="background: linear-gradient(135deg, rgba(124,58,237,0.7), rgba(29,78,216,0.7)); border: 1px solid rgba(167,139,250,0.3); box-shadow: 0 4px 30px rgba(124,58,237,0.2);">
                    <div class="kids-welcome-info">
                        <h2 style="display:flex;align-items:center;gap:12px;"><i class="fa-solid fa-shield-halved" style="color:#a78bfa;"></i> Panel de Acceso Total</h2>
                        <p>Bienvenido, <strong>${name}</strong>. Vista exclusiva del administrador — acceso completo a los 16 módulos de juego.</p>
                    </div>
                    <button class="play-btn" id="btn-admin-open-panel" style="background:rgba(167,139,250,0.2);border:1px solid rgba(167,139,250,0.5);color:#a78bfa;white-space:nowrap;flex-shrink:0;">
                        <i class="fa-solid fa-users-gear"></i> Abrir Panel Admin
                    </button>
                </div>

                <!-- KIDS SECTION -->
                <div style="display:flex;flex-direction:column;gap:16px;">
                    <div style="display:flex;align-items:center;gap:12px;padding:14px 20px;background:rgba(186,230,253,0.07);border:1px solid rgba(186,230,253,0.15);border-radius:14px;">
                        <i class="fa-solid fa-child" style="color:#bae6fd;font-size:1.3rem;"></i>
                        <div>
                            <h3 style="color:#bae6fd;margin:0;font-size:1.15rem;font-weight:800;">Módulos — Niños (6–11 años)</h3>
                            <p style="color:rgba(255,255,255,0.5);margin:0;font-size:0.8rem;">8 juegos adaptativos de concentración, memoria y emociones</p>
                        </div>
                        <span style="margin-left:auto;background:rgba(186,230,253,0.15);border:1px solid rgba(186,230,253,0.3);color:#bae6fd;padding:4px 14px;border-radius:20px;font-size:0.8rem;font-weight:700;">8 JUEGOS</span>
                    </div>
                    <div class="games-grid">
                        ${this._gameCard('distraction_hunter', 'g1Name', 'g1Desc', 'diff-easy', 'g1Tag', 'fa-meteor', 'distraction.png')}
                        ${this._gameCard('emotional_stoplight', 'g4Name', 'g4Desc', 'diff-easy', 'g4Tag', 'fa-traffic-light', 'stoplight.png')}
                        ${this._gameCard('musical_memory', 'g5Name', 'g5Desc', 'diff-medium', 'g5Tag', 'fa-music', 'memory.png')}
                        ${this._gameCard('memory_cards', 'g6Name', 'g6Desc', 'diff-easy', 'g6Tag', 'fa-layer-group', 'spatial.png')}
                        ${this._gameCard('kids_spatial', 'k_spatialName', 'k_spatialDesc', 'diff-medium', 'g2Tag', 'fa-star', 'spatial.png')}
                        ${this._gameCard('kids_routine', 'k_routineName', 'k_routineDesc', 'diff-medium', 'g3Tag', 'fa-rocket', 'routine.png')}
                        ${this._gameCard('kids_pattern', 'k_patternName', 'k_patternDesc', 'diff-medium', 'g7Tag', 'fa-shapes', 'distraction.png')}
                        ${this._gameCard('kids_math', 'k_mathName', 'k_mathDesc', 'diff-hard', 'g8Tag', 'fa-calculator', 'memory.png')}
                    </div>
                </div>

                <!-- DIVIDER -->
                <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(167,139,250,0.3),transparent);"></div>

                <!-- TEENS SECTION -->
                <div style="display:flex;flex-direction:column;gap:16px;">
                    <div style="display:flex;align-items:center;gap:12px;padding:14px 20px;background:rgba(167,139,250,0.07);border:1px solid rgba(167,139,250,0.15);border-radius:14px;">
                        <i class="fa-solid fa-user-graduate" style="color:#a78bfa;font-size:1.3rem;"></i>
                        <div>
                            <h3 style="color:#a78bfa;margin:0;font-size:1.15rem;font-weight:800;">Módulos — Adolescentes (12–17 años)</h3>
                            <p style="color:rgba(255,255,255,0.5);margin:0;font-size:0.8rem;">8 juegos de lógica avanzada, velocidad y control ejecutivo</p>
                        </div>
                        <span style="margin-left:auto;background:rgba(167,139,250,0.15);border:1px solid rgba(167,139,250,0.3);color:#a78bfa;padding:4px 14px;border-radius:20px;font-size:0.8rem;font-weight:700;">8 JUEGOS</span>
                    </div>
                    <div class="games-grid" style="grid-template-columns:1fr 1fr;">
                        ${this._gameCard('spatial_focus', 'g2Name', 'g2Desc', 'diff-medium', 'g2Tag', 'fa-star-half-stroke', 'spatial.png')}
                        ${this._gameCard('routine_builder', 'g3Name', 'g3Desc', 'diff-hard', 'g3Tag', 'fa-puzzle-piece', 'routine.png')}
                        ${this._gameCard('pattern_matcher', 'g7Name', 'g7Desc', 'diff-medium', 'g7Tag', 'fa-shapes', 'distraction.png')}
                        ${this._gameCard('speed_math', 'g8Name', 'g8Desc', 'diff-hard', 'g8Tag', 'fa-calculator', 'memory.png')}
                        ${this._gameCard('teens_distraction', 't_distName', 't_distDesc', 'diff-medium', 'g1Tag', 'fa-shield-halved', 'distraction.png')}
                        ${this._gameCard('teens_stoplight', 't_stopName', 't_stopDesc', 'diff-hard', 'g4Tag', 'fa-bolt', 'stoplight.png')}
                        ${this._gameCard('teens_sound', 't_soundName', 't_soundDesc', 'diff-hard', 'g5Tag', 'fa-wave-square', 'memory.png')}
                        ${this._gameCard('teens_cards', 't_cardsName', 't_cardsDesc', 'diff-medium', 'g6Tag', 'fa-unlock-keyhole', 'spatial.png')}
                    </div>
                </div>
            </div>`;

        // Wire up all game launch buttons
        mount.querySelectorAll('.play-btn[data-game]').forEach(btn =>
            btn.addEventListener('click', () => engine.launch(btn.getAttribute('data-game')))
        );

        // Open Admin Panel button
        const openPanelBtn = document.getElementById('btn-admin-open-panel');
        if (openPanelBtn) {
            openPanelBtn.addEventListener('click', () => this.openAdminPanel());
        }
    }



    setupPomodoro() {

        let timer = null, timeRemaining = 20 * 60, running = false;
        const display = document.getElementById('timer-display');
        const startBtn = document.getElementById('btn-timer-start');
        const resetBtn = document.getElementById('btn-timer-reset');
        const fmt = () => {
            const m = Math.floor(timeRemaining / 60).toString().padStart(2, '0');
            const s = (timeRemaining % 60).toString().padStart(2, '0');
            display.innerText = `${m}:${s}`;
        };
        startBtn.addEventListener('click', () => {
            if (running) {
                clearInterval(timer); running = false;
                startBtn.innerText = i18n.t('pomodoroStart');
                display.classList.remove('timer-running');
            } else {
                running = true; startBtn.innerText = i18n.t('pomodoroPause');
                display.classList.add('timer-running');
                timer = setInterval(() => {
                    timeRemaining--;
                    fmt();
                    if (timeRemaining <= 0) {
                        clearInterval(timer); running = false;
                        startBtn.innerText = i18n.t('pomodoroStart');
                        display.classList.remove('timer-running');
                        sound.playSuccess();
                        coach.speak(i18n.t('coachPomodoro'));
                        timeRemaining = 20 * 60; fmt();
                    }
                }, 1000);
            }
        });
        resetBtn.addEventListener('click', () => {
            clearInterval(timer); running = false;
            startBtn.innerText = i18n.t('pomodoroStart');
            display.classList.remove('timer-running');
            timeRemaining = 20 * 60; fmt();
        });
    }

    /* ---- SETTINGS MODAL ---- */
    openSettingsModal() {
        let overlay = document.getElementById('settings-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'settings-overlay';
            overlay.className = 'settings-overlay';
            document.body.appendChild(overlay);
        }

        const lang = i18n.currentLang;

        overlay.innerHTML = `
            <div class="settings-modal">
                <div class="settings-header" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <h3 style="margin: 0; color: #1e293b;">${i18n.t('settingsTitle')}</h3>
                    <button id="btn-close-settings" style="background: transparent; border: none; font-size: 2rem; color: #1e293b; cursor: pointer; line-height: 1; padding: 0 10px;">&times;</button>
                </div>

                <!-- Low Stimulus -->
                <div class="settings-row">
                    <div class="settings-row-label">
                        <span>${i18n.t('settingStimLabel')}</span>
                        <small>${i18n.t('settingStimDesc')}</small>
                    </div>
                    <label class="switch">
                        <input type="checkbox" id="check-stimulus" ${this.state.settings.lowStimulus ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>

                <!-- Voice -->
                <div class="settings-row">
                    <div class="settings-row-label">
                        <span>${i18n.t('settingVoiceLabel')}</span>
                        <small>${i18n.t('settingVoiceDesc')}</small>
                    </div>
                    <label class="switch">
                        <input type="checkbox" id="check-voice" ${this.state.settings.voiceOn ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>

                <!-- Volume -->
                <div class="settings-row">
                    <div class="settings-row-label">
                        <span>${i18n.t('settingVolLabel')}</span>
                        <small>${i18n.t('settingVolDesc')}</small>
                    </div>
                    <input type="range" id="slider-volume" min="0" max="100"
                           value="${this.state.settings.volume}" style="width:120px;">
                </div>

                <!-- Language -->
                <div class="settings-row">
                    <div class="settings-row-label">
                        <span>${i18n.t('settingLangLabel')}</span>
                        <small>${i18n.t('settingLangDesc')}</small>
                    </div>
                    <div class="lang-toggle">
                        <button class="lang-btn ${lang === 'es' ? 'active' : ''}" data-lang="es" id="btn-lang-es">
                            🇪🇸 Español
                        </button>
                        <button class="lang-btn ${lang === 'en' ? 'active' : ''}" data-lang="en" id="btn-lang-en">
                            🇺🇸 English
                        </button>
                        <button class="lang-btn ${lang === 'qu' ? 'active' : ''}" data-lang="qu" id="btn-lang-qu">
                            🇵🇪 Quechua - Perú
                        </button>
                    </div>
                </div>

                <!-- Reset -->
                <button class="play-btn" id="btn-reset-app"
                        style="background:#ef4444;width:100%;justify-content:center;margin-top:20px;">
                    <i class="fa-solid fa-trash-arrow-up"></i> ${i18n.t('settingReset')}
                </button>

                <!-- Logout -->
                <button class="play-btn" id="btn-logout-app"
                        style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: var(--text-main); width:100%;justify-content:center;margin-top:10px;">
                    <i class="fa-solid fa-right-from-bracket"></i> Cerrar Sesión
                </button>
            </div>`;

        // Add lang-toggle CSS if not present
        if (!document.getElementById('lang-toggle-style')) {
            const s = document.createElement('style');
            s.id = 'lang-toggle-style';
            s.textContent = `
                .lang-toggle { display:flex; gap:8px; }
                .lang-btn {
                    background: var(--bg-app);
                    border: 2px solid var(--border-color);
                    color: var(--text-main);
                    padding: 8px 16px;
                    border-radius: var(--radius-md);
                    cursor: pointer;
                    font-size: 0.9rem;
                    font-weight: 600;
                    transition: var(--transition-smooth);
                    font-family: var(--font-main);
                }
                .lang-btn:hover { border-color: var(--primary-purple); background: var(--bg-card-hover); }
                .lang-btn.active {
                    background: linear-gradient(135deg, var(--primary-blue), var(--primary-purple));
                    color: white;
                    border-color: transparent;
                    box-shadow: 0 4px 12px var(--glow-color);
                }`;
            document.head.appendChild(s);
        }

        overlay.classList.add('open');

        // Bind events
        document.getElementById('btn-close-settings').addEventListener('click', () => overlay.classList.remove('open'));

        document.getElementById('check-stimulus').addEventListener('change', e => {
            this.state.settings.lowStimulus = e.target.checked;
            document.body.classList.toggle('low-stimulus', e.target.checked);
            this.saveState();
        });

        document.getElementById('check-voice').addEventListener('change', e => {
            this.state.settings.voiceOn = e.target.checked;
            coach.voiceEnabled = e.target.checked;
            this.saveState(); this.updateHeaderHUD();
        });

        document.getElementById('slider-volume').addEventListener('input', e => {
            this.state.settings.volume = parseInt(e.target.value);
            sound.setVolume(this.state.settings.volume / 100);
            this.saveState();
        });

        // Language buttons
        overlay.querySelectorAll('.lang-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const newLang = btn.getAttribute('data-lang');
                if (newLang === i18n.currentLang) return;
                overlay.classList.remove('open');
                this.setLanguage(newLang);
            });
        });

        document.getElementById('btn-reset-app').addEventListener('click', () => {
            if (confirm(i18n.t('settingResetConfirm'))) {
                localStorage.clear(); window.location.reload();
            }
        });

        document.getElementById('btn-logout-app').addEventListener('click', async () => {
            try {
                const { authController } = await import('./auth/authController.js');
                await authController.logout();
                localStorage.removeItem('neurospark_state');
                localStorage.removeItem('ns_is_parent');
                window.location.reload();
            } catch (err) {
                console.error('Logout error:', err);
                this.showToast('Error al cerrar sesión.', 'warning');
            }
        });
    }

    /* ---- LANGUAGE SWITCH ---- */
    setLanguage(lang) {
        this.state.lang = lang;
        i18n.setLang(lang);
        // renderHome first (may set state.studentName for parent profiles)
        this.updateHeaderHUD();
        this.renderHome();
        // Save AFTER render so studentName is persisted cleanly
        this.saveState();
        // Re-open settings in new language
        setTimeout(() => this.openSettingsModal(), 350);
        this.showToast(i18n.t('toastLangChanged'), 'success');
    }

    /* ---- GAME SESSION ---- */
    addGameSession(sessionData, scoreReward) {
        this.state.history.push(sessionData);
        this.state.coins += scoreReward;
        const threshold = this.state.level * 100;
        if (this.state.coins >= threshold) {
            this.state.level++;
            this.showToast(i18n.t('toastLevelUp', { level: this.state.level }), 'success');
            coach.speak(i18n.t('coachLevelUp', { level: this.state.level }));
        }
        this.saveState(); this.updateHeaderHUD();
    }

    /* ---- CHAT ---- */
    addChatMessage(sender, text, isTyping = false) {
        const container = document.getElementById('chat-messages-container');
        if (!container) return;
        const msgId = 'msg-' + Date.now() + Math.floor(Math.random() * 1000);
        const div = document.createElement('div');
        div.id = msgId;
        div.className = `message ${sender} ${isTyping ? 'typing' : ''}`;

        let contentHtml = '';
        if (isTyping) {
            contentHtml = `<div class="typing-indicator"><span></span><span></span><span></span></div>`;
        } else {
            const fmt = text
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/\n/g, '<br>');
            contentHtml = `<p>${fmt}</p>`;
        }

        div.innerHTML = contentHtml;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
        if (sender === 'system' && !isTyping) coach.speak(text);
        return msgId;
    }

    updateChatMessage(msgId, newText) {
        const div = document.getElementById(msgId);
        if (!div) return;
        div.classList.remove('typing');
        const fmt = newText
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');
        div.innerHTML = `<p>${fmt}</p>`;
        const container = document.getElementById('chat-messages-container');
        if (container) container.scrollTop = container.scrollHeight;
        coach.speak(newText);
    }

    /* ---- TOAST ---- */
    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icons = { success: 'fa-circle-check', warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };
        toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.success}"></i><span>${message}</span>`;
        container.appendChild(toast);
        sound.playPop();
        setTimeout(() => {
            toast.style.animation = 'slide-in 0.3s reverse forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

export const app = new NeuroSparkApp();

window.addEventListener('DOMContentLoaded', () => {
    // roundRect polyfill
    if (!CanvasRenderingContext2D.prototype.roundRect) {
        CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
            const R = Math.min(r, w / 2, h / 2);
            this.beginPath();
            this.moveTo(x + R, y);
            this.lineTo(x + w - R, y);
            this.quadraticCurveTo(x + w, y, x + w, y + R);
            this.lineTo(x + w, y + h - R);
            this.quadraticCurveTo(x + w, y + h, x + w - R, y + h);
            this.lineTo(x + R, y + h);
            this.quadraticCurveTo(x, y + h, x, y + h - R);
            this.lineTo(x, y + R);
            this.quadraticCurveTo(x, y, x + R, y);
            this.closePath();
        };
    }
    app.init();
    new AuthUI();
});
