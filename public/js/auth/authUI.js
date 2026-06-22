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
        this.ageInput = document.getElementById('auth-age');
        this.parentEmailInput = document.getElementById('auth-parent-email');
        this.registerFieldsContainer = document.getElementById('auth-register-fields');

        this.subtitle = document.getElementById('auth-subtitle');

        this.init();
    }

    init() {
        if (!this.overlay) return;
        
        // Load saved credentials
        const savedEmail = localStorage.getItem('ns_saved_email');
        const savedPass = localStorage.getItem('ns_saved_password');
        if (savedEmail && this.emailInput) this.emailInput.value = savedEmail;
        if (savedPass && this.passwordInput) this.passwordInput.value = savedPass;

        let isAlreadyAuthenticated = false;

        // Listen to auth state changes
        authController.onAuthStateChange((event, session) => {
            if (session) {
                this.overlay.classList.remove('open');
                this.overlay.style.opacity = '0';
                this.overlay.style.visibility = 'hidden';
                document.body.style.overflow = ''; // Restore scroll
                
                if (isAlreadyAuthenticated) return;
                isAlreadyAuthenticated = true;

                // Adapt platform to user's age and name
                const userMeta = session.user?.user_metadata;
                const email = session.user?.email;

                // Mark admin without changing normal profile flow
                app.state.isAdmin = (email === 'sparkneuro64@gmail.com');

                // Load specific user state
                app.loadState(email);

                if (userMeta) {
                    const { firstName, lastName, age } = userMeta;
                    
                    // Set Profile Name
                    if (firstName) {
                        app.state.activeProfileName = `${firstName} ${lastName || ''}`.trim();
                    }
                    
                    // Set Game Mode by Age
                    if (age) {
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
            } else {
                this.title.innerText = 'Crear Cuenta';
                if(this.subtitle) this.subtitle.innerText = 'Únete a NeuroSpark y transforma tu aprendizaje.';
                this.submitBtn.innerText = 'Registrarse';
                this.toggleBtn.innerHTML = '¿Ya tienes cuenta? <span style="color: #38bdf8; font-weight: 800;">Inicia sesión aquí</span>';
                if(this.registerFieldsContainer) this.registerFieldsContainer.style.display = 'flex';
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
                    await authController.login(email, password);
                    localStorage.setItem('ns_saved_email', email);
                    localStorage.setItem('ns_saved_password', password);
                } else {
                    const firstName = this.firstNameInput ? this.firstNameInput.value.trim() : '';
                    const lastName = this.lastNameInput ? this.lastNameInput.value.trim() : '';
                    const age = this.ageInput ? this.ageInput.value.trim() : '';
                    const parentEmail = this.parentEmailInput ? this.parentEmailInput.value.trim() : '';

                    if (!firstName || !lastName || !age || !parentEmail) {
                        throw new Error("Por favor completa tus datos personales y el correo de tus padres.");
                    }

                    await authController.register(email, password, {
                        firstName,
                        lastName,
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
