import { supabase } from './supabaseClient.js';

const TABLES = Object.freeze({
    parentLinks: 'correos',
    profiles: 'user_profiles'
});

const AUTH_DEBUG = (() => {
    try {
        return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
            || window.localStorage.getItem('neurospark_auth_debug') === 'true';
    } catch {
        return false;
    }
})();

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function maskEmail(value) {
    const [name = '', domain = ''] = normalizeEmail(value).split('@');
    if (!domain) return '(correo inválido)';
    return `${name.slice(0, 2)}***@${domain}`;
}

function tagError(operation, phase, error) {
    const taggedError = error instanceof Error
        ? error
        : new Error(error?.message || 'Error desconocido de Supabase.');

    try {
        taggedError.neurosparkOperation = operation;
        taggedError.neurosparkPhase = phase;
    } catch {
        // Algunos errores de terceros pueden ser objetos no extensibles.
    }
    return taggedError;
}

function reportError(operation, error, phase = 'database') {
    const taggedError = tagError(operation, phase, error);

    // Se conserva el objeto original para ver stack, status y causa en DevTools.
    console.error(`[Supabase:${operation}]`, taggedError);
    console.error(`[Supabase:${operation}:details]`, {
        phase,
        message: error?.message || 'Error desconocido',
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        status: error?.status
    });
    return taggedError;
}

function throwIfError(operation, error, phase = 'database') {
    if (!error) return;
    throw reportError(operation, error, phase);
}

function debugAuth(event, details = {}) {
    if (!AUTH_DEBUG) return;
    console.info(`[Supabase Auth:${event}]`, details);
}

function sessionError(message, code) {
    const error = new Error(message);
    error.code = code;
    return tagError('auth.sessionVerification', 'session', error);
}

export const authController = Object.freeze({
    async register(email, password, metadata = {}) {
        const { data, error } = await supabase.auth.signUp({
            email: normalizeEmail(email),
            password,
            options: { data: metadata }
        });
        throwIfError('auth.signUp', error, 'authentication');
        return data;
    },

    async login(email, password) {
        const normalizedEmail = normalizeEmail(email);
        debugAuth('login:start', { email: maskEmail(normalizedEmail) });

        const { data, error } = await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password
        });
        throwIfError('auth.signInWithPassword', error, 'authentication');

        if (!data?.user || !data?.session?.access_token) {
            const error = sessionError(
                'Supabase aceptó el acceso, pero no devolvió una sesión completa.',
                'auth_session_missing'
            );
            reportError('auth.signInWithPassword.session', error, 'session');
            throw error;
        }

        const { data: sessionData, error: getSessionError } =
            await supabase.auth.getSession();
        throwIfError('auth.getSession.afterLogin', getSessionError, 'session');

        if (!sessionData?.session?.user?.id) {
            const error = sessionError(
                'La sesión no quedó persistida después del inicio de sesión.',
                'auth_session_not_persisted'
            );
            reportError('auth.getSession.afterLogin', error, 'session');
            throw error;
        }

        // getUser valida el token contra el servidor de Auth.
        const { data: userData, error: getUserError } =
            await supabase.auth.getUser();
        throwIfError('auth.getUser.afterLogin', getUserError, 'session');

        if (!userData?.user || userData.user.id !== data.user.id) {
            const error = sessionError(
                'El usuario de la sesión no coincide con el usuario autenticado.',
                'auth_user_mismatch'
            );
            reportError('auth.getUser.afterLogin', error, 'session');
            throw error;
        }

        debugAuth('login:success', {
            userId: userData.user.id,
            email: maskEmail(userData.user.email),
            expiresAt: sessionData.session.expires_at
        });

        return {
            ...data,
            user: userData.user,
            session: sessionData.session
        };
    },

    async logout(scope = 'local') {
        const { error } = await supabase.auth.signOut({ scope });
        throwIfError('auth.signOut', error, 'authentication');
    },

    async getSession() {
        const { data, error } = await supabase.auth.getSession();
        throwIfError('auth.getSession', error, 'session');
        debugAuth('session:read', {
            active: Boolean(data.session),
            userId: data.session?.user?.id || null,
            expiresAt: data.session?.expires_at || null
        });
        return data.session;
    },

    async getCurrentUser() {
        const { data, error } = await supabase.auth.getUser();
        throwIfError('auth.getUser', error, 'session');
        return data.user;
    },

    async updateUserMetadata(metadata) {
        const { data, error } = await supabase.auth.updateUser({ data: metadata });
        throwIfError('auth.updateUser', error, 'authentication');
        return data;
    },

    async resetPassword(email) {
        const redirectTo = new URL('app.html#login', window.location.href).href;
        const { data, error } = await supabase.auth.resetPasswordForEmail(
            normalizeEmail(email),
            { redirectTo }
        );
        throwIfError('auth.resetPasswordForEmail', error, 'authentication');
        return data;
    },

    async saveParentEmail(email, parentEmail) {
        const row = {
            user_email: normalizeEmail(email),
            parent_email: normalizeEmail(parentEmail)
        };
        const { data: current, error: lookupError } = await supabase
            .from(TABLES.parentLinks)
            .select('user_email')
            .eq('user_email', row.user_email)
            .limit(1)
            .maybeSingle();
        throwIfError('correos.lookupBeforeSave', lookupError);

        const query = current
            ? supabase
                .from(TABLES.parentLinks)
                .update({ parent_email: row.parent_email })
                .eq('user_email', row.user_email)
            : supabase.from(TABLES.parentLinks).insert(row);
        const { data, error } = await query
            .select('user_email,parent_email')
            .single();
        throwIfError(current ? 'correos.update' : 'correos.insert', error);
        return data;
    },

    async getStudentEmailByParent(parentEmail) {
        const normalizedEmail = normalizeEmail(parentEmail);
        if (!normalizedEmail) return null;

        const { data: rpcData, error: rpcError } = await supabase.rpc(
            'get_student_email_by_parent',
            { lookup_parent_email: normalizedEmail }
        );
        if (!rpcError) return rpcData || null;
        if (rpcError.code !== 'PGRST202') {
            reportError('rpc.get_student_email_by_parent', rpcError);
        }

        // Compatibilidad temporal hasta aplicar la migración RLS incluida.
        const { data, error } = await supabase
            .from(TABLES.parentLinks)
            .select('user_email')
            .eq('parent_email', normalizedEmail)
            .limit(1)
            .maybeSingle();

        if (error) {
            reportError('correos.selectByParent', error);
            return null;
        }
        return data?.user_email || null;
    },

    async checkUserExists(email) {
        const { data, error } = await supabase.rpc('check_user_exists', {
            lookup_email: normalizeEmail(email)
        });
        if (error) {
            reportError('rpc.check_user_exists', error);
            return null;
        }
        return Boolean(data);
    },

    async loadUserState(email) {
        const normalizedEmail = normalizeEmail(email);
        if (!normalizedEmail) return null;

        const { data, error } = await supabase
            .from(TABLES.profiles)
            .select('state_data')
            .eq('email', normalizedEmail)
            .maybeSingle();

        if (error) {
            throw reportError('user_profiles.select', error, 'database');
        }
        return data?.state_data || null;
    },

    async saveUserState(email, stateData) {
        const normalizedEmail = normalizeEmail(email);
        if (!normalizedEmail) throw new Error('Se requiere un correo para guardar el perfil.');

        const { data: current, error: lookupError } = await supabase
            .from(TABLES.profiles)
            .select('email')
            .eq('email', normalizedEmail)
            .limit(1)
            .maybeSingle();
        throwIfError('user_profiles.lookupBeforeSave', lookupError);

        const query = current
            ? supabase
                .from(TABLES.profiles)
                .update({ state_data: stateData })
                .eq('email', normalizedEmail)
            : supabase
                .from(TABLES.profiles)
                .insert({ email: normalizedEmail, state_data: stateData });
        const { data, error } = await query
            .select('email,state_data')
            .single();
        throwIfError(current ? 'user_profiles.update' : 'user_profiles.insert', error);
        return data?.state_data || stateData;
    },

    async saveUserProfile(email, profile) {
        const currentState = await this.loadUserState(email);
        const nextState = {
            ...(currentState || {}),
            profile: {
                ...(currentState?.profile || {}),
                ...profile,
                updatedAt: new Date().toISOString()
            }
        };
        await this.saveUserState(email, nextState);
        return nextState.profile;
    },

    async ensureUserProfile(email, profile) {
        const currentState = await this.loadUserState(email);
        if (currentState?.profile) return currentState.profile;
        return this.saveUserProfile(email, profile);
    },

    onAuthStateChange(callback) {
        const { data } = supabase.auth.onAuthStateChange((event, session) => {
            callback(event, session);
        });
        return data.subscription;
    },

    async getAllUsers() {
        const { data, error } = await supabase
            .from(TABLES.profiles)
            .select('email,state_data')
            .order('email', { ascending: true });
        throwIfError('user_profiles.selectAll', error);
        return data || [];
    },

    async deleteUserProfile(email) {
        const { error } = await supabase
            .from(TABLES.profiles)
            .delete()
            .eq('email', normalizeEmail(email));
        throwIfError('user_profiles.delete', error);
        return true;
    }
});
