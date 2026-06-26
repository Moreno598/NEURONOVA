import { authController } from './authController.js';
import { app } from '../app.js';

export class AuthUI {
    constructor() {
        this.isLoginMode = true;
        this.overlay = document.getElementById('auth-overlay');
        this.title = document.getElementById('auth-title');
        this.emailInput = document.getElementById('auth-email');
        this.passwordInput = document.getElementById('auth-password');
        this.submitBtn = document.getElementById('btn-auth-submit');
        this.toggleBtn = document.getElementById('btn-auth-toggle');

        this.firstNameInput = document.getElementById('auth-firstname');
        this.lastNameInput = document.getElementById('auth-lastname');
        this.aliasInput = document.getElementById('auth-alias');
        this.ageInput = document.getElementById('auth-age');
        this.parentEmailInput = document.getElementById('auth-parent-email');
        this.registerFieldsContainer = document.getElementById('auth-register-fields');

        this.subtitle = document.getElementById('auth-subtitle');
        this.parentToggleContainer = document.getElementById('auth-parent-toggle-container');

        this.init();
    }

    init() {
        if (!this.overlay) return;
        
        // Load saved credentials
        const savedEmail = localStorage.getItem('ns_saved_email');
        const savedPass = localStorage.getItem('ns_saved_password');
        if (savedEmail && this.emailInput) this.emailInput.value = savedEmail;
        if (savedPass && this.passwordInput) this.passwordInput.value = savedPass;

        // Setup Avatar Selection
        const avatarOptions = document.querySelectorAll('.avatar-option');
        avatarOptions.forEach(opt => {
            opt.addEventListener('click', () => {
                avatarOptions.forEach(o => o.classList.remove('selected', 'active-avatar'));
                avatarOptions.forEach(o => { o.style.borderColor = 'transparent'; o.style.boxShadow = 'none'; o.style.transform = 'scale(1)'; });
                opt.classList.add('selected');
                opt.style.borderColor = '#38bdf8';
                opt.style.boxShadow = '0 0 10px #38bdf8';
                opt.style.transform = 'scale(1.1)';
            });
        });

        // Setup Age visual feedback
        if (this.ageInput) {
            this.ageInput.addEventListener('input', (e) => {
                const val = parseInt(e.target.value, 10);
                if (val >= 6 && val <= 11) {
                    // Kids color feedback (Pastel Blue/Green)
                    e.target.style.borderColor = '#86efac';
                    e.target.style.boxShadow = '0 0 12px rgba(134, 239, 172, 0.4)';
                } else if (val >= 12 && val <= 17) {
                    // Teens color feedback (Purple)
                    e.target.style.borderColor = '#a78bfa';
                    e.target.style.boxShadow = '0 0 12px rgba(167, 139, 250, 0.4)';
                } else {
                    e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                    e.target.style.boxShadow = 'none';
                }
            });
        }

        let isAlreadyAuthenticated = false;

        // Listen to auth state changes
        authController.onAuthStateChange(async (event, session) => {
            window.isUserLoggedIn = !!session;

            if (session) {
                if (window.hasManuallyLoggedIn) {
                    if (window.dismissAuthOverlay) {
                        window.dismissAuthOverlay();
                    } else {
                        this.overlay.classList.remove('open');
                        this.overlay.style.opacity = '0';
                        this.overlay.style.visibility = 'hidden';
                        document.body.style.overflow = '';
                    }
                } else {
                    // Update buttons for logged in users (INITIAL_SESSION / Page Reload)
                    const btnNav = document.getElementById('btn-nav-register');
                    if (btnNav) {
                        btnNav.innerHTML = '<i class="fa-solid fa-gamepad" style="color: #38bdf8; font-size: 0.9rem;"></i><span style="color: white; font-weight: 800; font-size: 0.9rem; letter-spacing: 0.5px;">Ir a Juegos</span>';
                        btnNav.removeAttribute('onclick');
                        btnNav.addEventListener('click', (e) => {
                            e.preventDefault();
                            if (window.dismissAuthOverlay) window.dismissAuthOverlay();
                        });
                    }
                    
                    const btnLogout = document.getElementById('btn-nav-logout');
                    if (btnLogout) btnLogout.style.display = 'flex';

                    const btnComenzar = document.querySelector('.premium-btn');
                    if (btnComenzar && (btnComenzar.innerText.includes('COMENZAR') || btnComenzar.innerText.includes('IR A LOS JUEGOS'))) {
                        btnComenzar.innerHTML = 'IR A LOS JUEGOS <i class="fa-solid fa-gamepad"></i>';
                        btnComenzar.removeAttribute('onclick');
                        btnComenzar.addEventListener('click', (e) => {
                            e.preventDefault();
                            if (window.dismissAuthOverlay) window.dismissAuthOverlay();
                        });
                    }
                }

                
                if (isAlreadyAuthenticated) return;
                isAlreadyAuthenticated = true;

                // Adapt platform to user's age and name
                const userMeta = session.user?.user_metadata;
                const email = session.user?.email;

                // Load specific user state
                await app.loadState(email);

                // Mark admin and redirect directly to games view
                app.state.isAdmin = (email === 'sparkneuro64@gmail.com');

                if (app.state.isAdmin) {
                    // Admin goes to full games view
                    app.state.profile = 'admin';
                    app.state.activeProfileName = 'Matias M.';
                } else if (userMeta) {
                    const { firstName, lastName, age, alias, avatar } = userMeta;
                    
                    if (avatar) app.state.avatar = avatar;

                    // Set Profile Name
                    if (alias) {
                        app.state.activeProfileName = alias;
                    } else if (firstName) {
                        app.state.activeProfileName = `${firstName} ${lastName || ''}`.trim();
                    }
                    
                    const isParent = localStorage.getItem('ns_is_parent') === 'true';

                    // Save age for parent dashboard
                    if (age) app.state.userAge = parseInt(age, 10);

                    // Set Game Mode by Age or Role
                    if (isParent) {
                        app.state.profile = 'parent';
                        app.state.activeProfileName = 'Apoderado de ' + app.state.activeProfileName;
                    } else if (age) {
                        const userAge = parseInt(age, 10);
                        if (userAge <= 11) {
                            app.state.profile = 'kids';
                        } else if (userAge <= 17) {
                            app.state.profile = 'teens';
                        } else {
                            app.state.profile = 'adults';
                        }
                    }
                }
                
                // Refresh app logic
                app.saveState();
                app.updateHeaderHUD();
                app.renderHome();
            } else {
                isAlreadyAuthenticated = false;
                this.overlay.classList.add('open');
                this.overlay.style.opacity = '1';
                this.overlay.style.visibility = 'visible';
                document.body.style.overflow = 'hidden'; // Prevent double scrollbars
            }
        });

        // Toggle Register / Login
        this.toggleBtn.addEventListener('click', () => {
            this.isLoginMode = !this.isLoginMode;
            if (this.isLoginMode) {
                this.title.innerText = 'Bienvenido de nuevo';
                if(this.subtitle) this.subtitle.innerText = 'Ingresa tus credenciales para acceder a tu entorno.';
                this.submitBtn.innerText = 'Ingresar al Portal';
                this.toggleBtn.innerHTML = '¿No tienes una cuenta? <span style="color: #38bdf8; font-weight: 800;">Crear una ahora</span>';
                if(this.registerFieldsContainer) this.registerFieldsContainer.style.display = 'none';
                if(this.parentToggleContainer) this.parentToggleContainer.style.display = 'flex';
            } else {
                this.title.innerText = 'Crear Cuenta';
                if(this.subtitle) this.subtitle.innerText = 'Únete a NeuroSpark y transforma tu aprendizaje.';
                this.submitBtn.innerText = 'Registrarse';
                this.toggleBtn.innerHTML = '¿Ya tienes cuenta? <span style="color: #38bdf8; font-weight: 800;">Inicia sesión aquí</span>';
                if(this.registerFieldsContainer) this.registerFieldsContainer.style.display = 'flex';
                if(this.parentToggleContainer) this.parentToggleContainer.style.display = 'none';
            }
        });

        // Submit Action
        this.submitBtn.addEventListener('click', async () => {
            const email = this.emailInput.value.trim();
            const password = this.passwordInput.value.trim();

            if (!email || !password) {
                app.showToast('Por favor completa todos los campos', 'warning');
                return;
            }

            try {
                this.submitBtn.disabled = true;
                this.submitBtn.innerText = 'Cargando...';

                if (this.isLoginMode) {
                    window.hasManuallyLoggedIn = true;
                    let loginEmail = email;
                    let isParent = false;

                    // Auto-detect: check if this email is registered as a parent
                    const studentEmail = await authController.getStudentEmailByParent(email);
                    if (studentEmail) {
                        loginEmail = studentEmail;
                        isParent = true;
                    }

                    if (isParent) {
                        localStorage.setItem('ns_is_parent', 'true');
                    } else {
                        localStorage.removeItem('ns_is_parent');
                    }

                    try {
                        console.log('[LOGIN DEBUG] Attempting login with:', { loginEmail, isParent, originalEmail: email, passwordLength: password.length });
                        await authController.login(loginEmail, password);
                    } catch (loginErr) {
                        if (isParent) {
                            throw new Error('Contraseña incorrecta. Recuerda que debes usar la misma contraseña que tu hijo(a) creó al registrarse en NeuroSpark.');
                        }
                        throw loginErr;
                    }
                    localStorage.setItem('ns_saved_email', email);
                    localStorage.setItem('ns_saved_password', password);
                } else {
                    const firstName = this.firstNameInput ? this.firstNameInput.value.trim() : '';
                    const lastName = this.lastNameInput ? this.lastNameInput.value.trim() : '';
                    const alias = this.aliasInput ? this.aliasInput.value.trim() : '';
                    const age = this.ageInput ? this.ageInput.value.trim() : '';
                    const parentEmail = this.parentEmailInput ? this.parentEmailInput.value.trim() : '';

                    if (!firstName || !lastName || !alias || !age || !parentEmail) {
                        throw new Error("Por favor completa tus datos personales (incluyendo el alias) y el correo de tus padres.");
                    }
                    
                    const ageNum = parseInt(age, 10);
                    if (isNaN(ageNum) || ageNum < 6 || ageNum > 17) {
                        throw new Error("NeuroSpark está diseñado exclusivamente para edades entre 6 y 17 años.");
                    }
                    
                    const avatarImgEl = document.getElementById('avatar-preview-img');
                    const avatar = avatarImgEl ? avatarImgEl.getAttribute('data-avatar') : 'sparky';

                    window.hasManuallyLoggedIn = true;
                    await authController.register(email, password, {
                        firstName,
                        lastName,
                        alias,
                        avatar,
                        age: parseInt(age, 10)
                    });
                    
                    // Save the parent email to the 'correos' table
                    try {
                        await authController.saveParentEmail(email, parentEmail);
                    } catch(e) {
                        console.error("Error guardando correo del padre", e);
                    }

                    localStorage.setItem('ns_saved_email', email);
                    localStorage.setItem('ns_saved_password', password);
                    app.showToast('¡Cuenta creada! Hemos enviado un enlace de verificación. Por favor revisa tu correo (y la carpeta de spam).', 'success');
                    this.isLoginMode = true;
                    this.title.innerText = 'Iniciar Sesión';
                    this.submitBtn.innerText = 'Ingresar';
                    this.toggleBtn.innerHTML = '¿No tienes una cuenta? <span style="color: #38bdf8; font-weight: 800;">Crear una ahora</span>';
                    if(this.registerFieldsContainer) this.registerFieldsContainer.style.display = 'none';
                }
            } catch (error) {
                console.error("Auth Error:", error);
                const errorMsg = error.message || (Object.keys(error).length ? JSON.stringify(error) : 'Error de conexión o credenciales (revisa la consola)');
                app.showToast(errorMsg, 'warning');
            } finally {
                this.submitBtn.disabled = false;
                this.submitBtn.innerText = this.isLoginMode ? 'Ingresar' : 'Crear Cuenta';
            }
        });

        // Initial Check
        this.checkInitialSession();
    }

    async checkInitialSession() {
        try {
            const user = await authController.getCurrentUser();
            if (!user) {
                this.overlay.classList.add('open');
                this.overlay.style.opacity = '1';
                this.overlay.style.visibility = 'visible';
                document.body.style.overflow = 'hidden';
            }
        } catch (error) {
            this.overlay.classList.add('open');
            this.overlay.style.opacity = '1';
            this.overlay.style.visibility = 'visible';
            document.body.style.overflow = 'hidden';
        }
    }
}
