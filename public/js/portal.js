import { authController } from './auth/authController.js';

const expectedRole = document.body.dataset.portalRole;
const loadingScreen = document.getElementById('loading-screen');

function normalizeState(value) {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch {
        return {};
    }
}

function setText(selector, value) {
    document.querySelectorAll(selector).forEach(element => {
        element.textContent = value ?? '—';
    });
}

function renderList(id, values, emptyMessage) {
    const list = document.getElementById(id);
    if (!list) return;
    list.replaceChildren();

    const items = Array.isArray(values) ? values.slice(0, 8) : [];
    if (!items.length) {
        const item = document.createElement('li');
        const label = document.createElement('span');
        label.textContent = emptyMessage;
        item.append(label);
        list.append(item);
        return;
    }

    items.forEach((value, index) => {
        const item = document.createElement('li');
        const label = document.createElement('span');
        const result = document.createElement('strong');
        const text =
            value?.text
            || value?.title
            || value?.game
            || value?.name
            || `Registro ${index + 1}`;
        const detail =
            value?.score
            ?? value?.result
            ?? value?.status
            ?? value?.done
            ?? 'Registrado';
        label.textContent = String(text);
        result.textContent = typeof detail === 'boolean'
            ? (detail ? 'Completado' : 'Pendiente')
            : String(detail);
        item.append(label, result);
        list.append(item);
    });
}

function metricsFromState(state) {
    const tasks = Array.isArray(state.tasks) ? state.tasks : [];
    const completedTasks = tasks.filter(task => task?.done).length;
    const history = Array.isArray(state.history) ? state.history : [];
    const results = Array.isArray(state.results)
        ? state.results
        : Array.isArray(state.gameResults)
            ? state.gameResults
            : history.filter(entry => entry?.score !== undefined);
    const progress = tasks.length
        ? Math.round(completedTasks / tasks.length * 100)
        : Number(state.progress || 0);

    return {
        level: Number(state.level || 1),
        coins: Number(state.coins || 0),
        eco: Number(state.ecoPoints || 0),
        activities: history.length,
        results: results.length,
        tasks: tasks.length,
        history: history.length,
        progress: Math.max(0, Math.min(100, progress || 0)),
        tasksList: tasks,
        historyList: history,
        resultsList: results,
        reports: Array.isArray(state.reports) ? state.reports : []
    };
}

function applyMetrics(metrics) {
    const values = {
        level: metrics.level,
        coins: metrics.coins.toLocaleString('es-PE'),
        eco: metrics.eco.toLocaleString('es-PE'),
        activities: metrics.activities,
        results: metrics.results,
        tasks: metrics.tasks,
        history: metrics.history,
        progress: `${metrics.progress}%`
    };
    Object.entries(values).forEach(([name, value]) => {
        setText(`[data-metric="${name}"]`, value);
    });
    document.getElementById('student-progress-bar')
        ?.style.setProperty('--progress', `${metrics.progress}%`);
    document.getElementById('parent-progress-bar')
        ?.style.setProperty('--progress', `${metrics.progress}%`);

    renderList('student-results', metrics.resultsList, 'Aún no hay resultados.');
    renderList('student-activity', metrics.historyList, 'Aún no hay actividad registrada.');
    renderList('parent-activity', metrics.historyList, 'Aún no hay actividad registrada.');
    renderList('parent-results', metrics.resultsList, 'Aún no hay resultados registrados.');
    renderList('parent-history', metrics.historyList, 'Aún no hay elementos en el historial.');
    renderList('parent-reports', metrics.reports, 'Aún no hay reportes generados.');
}

function setupNavigation() {
    const buttons = [...document.querySelectorAll('[data-view-target]')];
    const views = [...document.querySelectorAll('[data-view]')];
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            const target = button.dataset.viewTarget;
            buttons.forEach(candidate => {
                candidate.classList.toggle('is-active', candidate === button);
            });
            views.forEach(view => {
                view.classList.toggle('is-active', view.dataset.view === target);
            });
        });
    });
}

function persistProjection(user, context, role) {
    const state = normalizeState(context.state_data);
    const profile = state.profile || {};
    const projection = {
        version: 3,
        userId: user.id,
        studentId: context.user_id,
        email: user.email,
        studentEmail: context.user_email,
        parentEmail: context.parent_email,
        name: context.alias,
        fullName: context.full_name,
        age: context.age,
        mode: context.mode,
        role,
        avatar: profile.avatar || null,
        provider: 'supabase',
        createdAt: new Date().toISOString()
    };
    localStorage.setItem('neurospark_session', JSON.stringify(projection));
    return projection;
}

function renderProfile(user, context, role) {
    const state = normalizeState(context.state_data);
    const avatar = state.profile?.avatar;
    const modeLabel = context.mode === 'child' ? 'Niño' : 'Adolescente';
    document.body.dataset.studentMode = context.mode || 'teen';

    setText('[data-alias]', context.alias || 'Estudiante');
    setText('[data-full-name]', context.full_name || '—');
    setText('[data-age]', context.age ? `${context.age} años` : '—');
    setText('[data-mode-label]', modeLabel);
    setText('[data-student-email]', context.user_email);
    setText('[data-parent-email]', context.parent_email);

    const profileMode = document.getElementById('profile-mode');
    if (profileMode) profileMode.textContent = `Modo ${modeLabel}`;
    const sidebarMode = document.getElementById('sidebar-mode');
    if (sidebarMode) sidebarMode.textContent = `Modo ${modeLabel}`;
    const modeBadge = document.getElementById('mode-badge');
    if (modeBadge) modeBadge.textContent = `Modo ${modeLabel}`;
    const description = document.getElementById('mode-description');
    const heroTitle = document.getElementById('student-hero-title');
    if (heroTitle) {
        heroTitle.textContent = context.mode === 'child'
            ? 'Aprende, juega y descubre.'
            : 'Organiza tus metas y supera nuevos retos.';
    }
    if (description) {
        description.textContent = context.mode === 'child'
            ? 'Retos claros, motivadores y adaptados a estudiantes de 6 a 11 años.'
            : 'Herramientas, progreso y desafíos adaptados a estudiantes de 12 a 17 años.';
    }

    const fallback = document.getElementById('profile-avatar-fallback');
    if (fallback) fallback.textContent = (context.alias || 'N').slice(0, 1).toUpperCase();
    const image = document.getElementById('profile-avatar');
    if (image && avatar?.image) {
        image.src = avatar.image;
        image.alt = `Avatar de ${context.alias}`;
        image.hidden = false;
        fallback.hidden = true;
    }

    applyMetrics(metricsFromState(state));
    persistProjection(user, context, role);
}

async function logout() {
    try {
        await authController.logout('local');
    } catch (error) {
        console.error('[Portal] Error original al cerrar sesión:', error);
    } finally {
        localStorage.removeItem('neurospark_session');
        window.location.replace('app.html#login');
    }
}

function setupPasswordForm() {
    const form = document.getElementById('family-password-form');
    if (!form) return;
    form.addEventListener('submit', async event => {
        event.preventDefault();
        const password = document.getElementById('new-family-password');
        const confirmation = document.getElementById('confirm-family-password');
        const status = document.getElementById('password-status');
        status.className = 'form-status';

        if (password.value.length < 8) {
            status.textContent = 'La contraseña debe tener al menos 8 caracteres.';
            status.classList.add('is-error');
            return;
        }
        if (password.value !== confirmation.value) {
            status.textContent = 'Las contraseñas no coinciden.';
            status.classList.add('is-error');
            return;
        }

        const submit = form.querySelector('button[type="submit"]');
        submit.disabled = true;
        status.textContent = 'Actualizando ambas cuentas…';
        try {
            await authController.syncFamilyPassword(password.value);
            status.textContent = 'Contraseña actualizada para el estudiante y el padre.';
            status.classList.add('is-success');
            form.reset();
        } catch (error) {
            console.error('[Portal] Error original al sincronizar contraseña:', error);
            status.textContent = error.message;
            status.classList.add('is-error');
        } finally {
            submit.disabled = false;
        }
    });
}

async function boot() {
    setupNavigation();
    setupPasswordForm();
    document.getElementById('logout-button')?.addEventListener('click', logout);

    try {
        const session = await authController.getSession();
        if (!session?.user) {
            window.location.replace('app.html#login');
            return;
        }
        const user = await authController.getCurrentUser();
        const context = await authController.getFamilyContext();
        if (!context?.user_id) {
            throw new Error('No se encontró el perfil familiar de esta cuenta.');
        }

        const role =
            context.viewer_role
            || (user.app_metadata?.account_type === 'parent' ? 'parent' : 'student');
        if (role !== expectedRole) {
            window.location.replace(role === 'parent' ? 'parent.html' : 'student.html');
            return;
        }

        renderProfile(user, context, role);
        loadingScreen.classList.add('is-hidden');
    } catch (error) {
        console.error('[Portal] No se pudo iniciar el panel:', error);
        localStorage.removeItem('neurospark_session');
        window.location.replace('app.html#login');
    }
}

boot();
