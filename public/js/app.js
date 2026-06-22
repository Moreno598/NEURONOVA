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
            { id: 'cyber_neon',   nameKey: 'skinCyber',  cost: 100, icon: 'fa-robot',        color: '#38bdf8' },
            { id: 'green_shield', nameKey: 'skinShield', cost: 180, icon: 'fa-shield-halved', color: '#22c55e' },
            { id: 'golden_crown', nameKey: 'skinCrown',  cost: 250, icon: 'fa-crown',         color: '#fbbf24' }
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
            } catch (e) {}
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
        document.getElementById('player-coins').innerText       = this.state.coins;
        document.getElementById('player-level').innerText       = this.state.level;
        document.getElementById('current-profile-name').innerText = this.state.activeProfileName;
        document.getElementById('logo-sub-text').innerText      = i18n.t('logoSub');

        const btnMusic = document.getElementById('btn-music');
        const btnVoice = document.getElementById('btn-voice');
        if (this.state.settings.musicOn) btnMusic.classList.add('active');
        else btnMusic.classList.remove('active');
        if (this.state.settings.voiceOn) btnVoice.classList.add('active');
        else btnVoice.classList.remove('active');



        // Update Sparky chat welcome placeholder & chips
        const chatInput = document.getElementById('chat-user-input');
        if (chatInput) chatInput.placeholder = i18n.t('chatPlaceholder');
        const chipBreak  = document.getElementById('chip-break');
        const chipTip    = document.getElementById('chip-tip');
        const chipReport = document.getElementById('chip-report');
        if (chipBreak)  chipBreak.innerHTML  = `<i class="fa-solid fa-hourglass-half"></i> ${i18n.t('chatBreakChip')}`;
        if (chipTip)    chipTip.innerHTML    = `<i class="fa-solid fa-lightbulb"></i> ${i18n.t('chatTipChip')}`;
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
        const trigger   = document.getElementById('coach-trigger');
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
        const btnSend   = document.getElementById('chat-send-btn');
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
        const lowStim   = this.state.settings.lowStimulus ? ' low-stimulus' : '';
        const themeClass = document.body.classList.contains('light-theme') ? ' light-theme' : ' dark-theme';

        if (this.state.profile === 'admin') {
            document.body.className = 'admin-mode' + themeClass + lowStim;
            this.renderAdminHome(mount);
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
            if (this.state.profile === 'adults') {
                freshGames.innerHTML = '<i class="fa-solid fa-gamepad"></i>';
                freshGames.title = "Modo Juegos";
            } else {
                freshGames.innerHTML = '<i class="fa-solid fa-chart-line"></i>';
                freshGames.title = "Modo Panel Principal";
            }

            freshGames.addEventListener('click', () => {
                if (this.state.profile === 'adults') {
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
            <div class="settings-modal" style="max-width: 800px; width: 95%; padding: 0; overflow: hidden;">
                <div style="background: linear-gradient(135deg, #1e293b, #0f172a); padding: 30px 40px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08);">
                    <h2 style="font-size: 1.8rem; color: white; display: flex; align-items: center; gap: 14px; margin: 0;">
                        <i class="fa-solid fa-shield-halved" style="color: #a78bfa;"></i> Panel de Administración
                    </h2>
                    <button id="btn-close-admin" style="background: rgba(255,255,255,0.08); border: none; color: white; width: 38px; height: 38px; border-radius: 50%; font-size: 1.1rem; cursor: pointer;">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <div style="padding: 35px 40px; display: flex; flex-direction: column; gap: 28px;">
                    <p style="color: var(--text-muted); margin: 0; font-size: 1rem;">Asigna roles de acceso especial a usuarios registrados en la plataforma.</p>
                    <div style="display: flex; gap: 16px; flex-wrap: wrap;">
                        <input type="email" id="admin-search-email" placeholder="correo@ejemplo.com" style="flex: 1; min-width: 220px; padding: 16px; border-radius: 12px; border: 2px solid var(--border-color); background: rgba(0,0,0,0.25); color: var(--text-main); font-size: 1rem; outline: none; transition: border-color 0.3s;">
                        <select id="admin-role-select" style="padding: 16px; border-radius: 12px; border: 2px solid var(--border-color); background: #1e293b; color: white; font-size: 1rem; outline: none; cursor: pointer; min-width: 220px;">
                            <option value="padre">Padre / Apoderado</option>
                            <option value="docente">Docente / Especialista</option>
                        </select>
                        <button id="btn-assign-role" class="play-btn" style="background: linear-gradient(135deg, #7c3aed, #1d4ed8); padding: 0 32px; font-size: 1rem; border-radius: 12px; height: 54px; white-space: nowrap;">
                            <i class="fa-solid fa-check"></i> Asignar Rol
                        </button>
                    </div>

                    <p style="color: var(--text-muted); margin: 10px 0 0; font-size: 1rem;">Otorga NeuroCoins a los estudiantes para recompensar su esfuerzo.</p>
                    <div style="display: flex; gap: 16px; flex-wrap: wrap;">
                        <input type="email" id="admin-coins-email" placeholder="correo_estudiante@ejemplo.com" style="flex: 1; min-width: 220px; padding: 16px; border-radius: 12px; border: 2px solid var(--border-color); background: rgba(0,0,0,0.25); color: var(--text-main); font-size: 1rem; outline: none; transition: border-color 0.3s;">
                        <input type="number" id="admin-coins-amount" placeholder="Cantidad (ej. 500)" style="width: 150px; padding: 16px; border-radius: 12px; border: 2px solid var(--border-color); background: #1e293b; color: white; font-size: 1rem; outline: none;">
                        <button id="btn-add-coins" class="play-btn" style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 0 32px; font-size: 1rem; border-radius: 12px; height: 54px; white-space: nowrap;">
                            <i class="fa-solid fa-coins"></i> Dar Coins
                        </button>
                    </div>
                    <div style="border-top: 1px solid var(--border-color); padding-top: 24px;">
                        <h4 style="margin: 0 0 18px 0; color: white; font-size: 1.1rem;"><i class="fa-solid fa-clock-rotate-left" style="margin-right: 8px;"></i>Asignaciones Recientes</h4>
                        <div id="admin-log-list" style="display: flex; flex-direction: column; gap: 12px; max-height: 240px; overflow-y: auto;">
                            <div style="padding: 16px 20px; background: rgba(255,255,255,0.03); border-radius: 10px; border: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-size: 0.95rem; color: var(--text-muted);"><i class="fa-solid fa-circle-info" style="margin-right: 8px;"></i>Aún no hay asignaciones en esta sesión.</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        overlay.classList.add('open');

        document.getElementById('btn-close-admin').addEventListener('click', () => overlay.classList.remove('open'));
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });

        const emailInput = document.getElementById('admin-search-email');
        emailInput.addEventListener('focus', function() { this.style.borderColor = '#7c3aed'; });
        emailInput.addEventListener('blur', function() { this.style.borderColor = 'var(--border-color)'; });

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

        document.getElementById('admin-search-email').addEventListener('focus', function() {
            this.style.borderColor = '#38bdf8';
        });
        document.getElementById('admin-search-email').addEventListener('blur', function() {
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
        mount.innerHTML = `
            <div class="kids-home-view">
                <div class="kids-welcome-banner">
                    <div class="kids-welcome-info">
                        <h2>${i18n.t('kidsWelcome', { name })}</h2>
                        <p>${i18n.t('kidsWelcomeSub')}</p>
                    </div>
                    <div class="sparky-mascot-img">
                        <svg viewBox="0 0 100 100" style="width:110px;height:110px;">
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
                        ${this._gameCard('distraction_hunter', 'g1Name', 'g1Desc', 'diff-easy',   'g1Tag', 'fa-meteor', 'distraction.png')}
                        ${this._gameCard('spatial_focus',      'g2Name', 'g2Desc', 'diff-medium', 'g2Tag', 'fa-star-half-stroke', 'spatial.png')}
                        ${this._gameCard('routine_builder',    'g3Name', 'g3Desc', 'diff-medium', 'g3Tag', 'fa-puzzle-piece', 'routine.png')}
                        ${this._gameCard('emotional_stoplight','g4Name', 'g4Desc', 'diff-easy',   'g4Tag', 'fa-traffic-light', 'stoplight.png')}
                        ${this._gameCard('musical_memory',     'g5Name', 'g5Desc', 'diff-hard',   'g5Tag', 'fa-music', 'memory.png')}
                    </div>
                </div>

                <div class="store-container">
                    <h3 class="section-title"><i class="fa-solid fa-shop text-purple"></i> ${i18n.t('storeTitle')}</h3>
                    <p style="color:var(--text-muted);font-size:0.9rem;">${i18n.t('storeSub')}</p>
                    <div class="store-grid">
                        ${this.storeItems.map(item => {
                            const bought  = this.state.unlockedItems.includes(item.id);
                            const active  = this.state.activeSkin === item.id;
                            const btnHTML = active
                                ? `<span class="difficulty-badge diff-easy">${i18n.t('equipped')}</span>`
                                : bought
                                    ? `<button class="equip-btn" style="background:#7c3aed;color:white;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;">${i18n.t('equip')}</button>`
                                    : `<span style="color:#fbbf24;font-weight:700;"><i class="fa-solid fa-coins"></i> ${item.cost}</span>`;
                            return `
                                <div class="store-item ${bought ? 'purchased' : ''} ${active ? 'active-skin' : ''}" data-id="${item.id}">
                                    <i class="fa-solid ${item.icon}" style="font-size:2rem;color:${item.color};display:block;margin:10px 0;"></i>
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
                const itemId   = item.getAttribute('data-id');
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
                        <span class="difficulty-badge ${diffClass}">${diffClass.replace('diff-','').toUpperCase()}</span>
                        <button class="play-btn" data-game="${id}">${i18n.t('playBtn')} <i class="fa-solid fa-play"></i></button>
                    </div>
                </div>
            </div>`;
    }

    /* ---- TEENS HOME ---- */
    renderTeensHome(mount) {
        const name = this.state.activeProfileName;
        mount.innerHTML = `
            <div class="teens-home-view">
                <div class="teens-main-panel" style="display:flex;flex-direction:column;gap:24px;">
                    <div class="kids-welcome-banner" style="background:linear-gradient(135deg,hsla(270,85%,20%,0.8),hsla(210,100%,25%,0.8));">
                        <div class="kids-welcome-info">
                            <h2>${i18n.t('teensWelcome', { name })}</h2>
                            <p>${i18n.t('teensWelcomeSub')}</p>
                        </div>
                    </div>
                    <h3 class="section-title"><i class="fa-solid fa-brain text-blue"></i> ${i18n.t('teensGamesTitle')}</h3>
                    <div class="games-grid" style="grid-template-columns:1fr 1fr;">
                        ${this._gameCard('distraction_hunter', 'g1Name', 'g1Desc', 'diff-easy',   'g1Tag', 'fa-meteor', 'distraction.png')}
                        ${this._gameCard('spatial_focus',      'g2Name', 'g2Desc', 'diff-medium', 'g2Tag', 'fa-star-half-stroke', 'spatial.png')}
                        ${this._gameCard('routine_builder',    'g3Name', 'g3Desc', 'diff-medium', 'g3Tag', 'fa-puzzle-piece', 'routine.png')}
                        ${this._gameCard('emotional_stoplight','g4Name', 'g4Desc', 'diff-easy',   'g4Tag', 'fa-traffic-light', 'stoplight.png')}
                        ${this._gameCard('musical_memory',     'g5Name', 'g5Desc', 'diff-hard',   'g5Tag', 'fa-music', 'memory.png')}
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



    setupPomodoro() {
        let timer = null, timeRemaining = 20 * 60, running = false;
        const display   = document.getElementById('timer-display');
        const startBtn  = document.getElementById('btn-timer-start');
        const resetBtn  = document.getElementById('btn-timer-reset');
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
                <div class="settings-header">
                    <h3>${i18n.t('settingsTitle')}</h3>
                    <button class="close-chat-btn" id="btn-close-settings">&times;</button>
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
                overlay.classList.remove('open');
                this.showToast('Sesión cerrada correctamente.', 'info');
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
        // Re-seed default profile names in the new language
        if (this.state.profile !== 'admin') {
            // Keep user name
        }
        this.saveState();
        this.updateHeaderHUD();
        this.renderHome();
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
        const msgId = 'msg-' + Date.now() + Math.floor(Math.random()*1000);
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
        if(container) container.scrollTop = container.scrollHeight;
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
        CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
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
