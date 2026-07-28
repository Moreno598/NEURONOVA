import { getApiUrl, getSupabaseClient } from './supabaseClient.js';

const TABLES = Object.freeze({
    parentLinks: 'correos',
    profiles: 'user_profiles'
});

const ADMIN_EMAIL = 'sparkneuro64@gmail.com';

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

async function requireSupabase(operation, phase) {
    try {
        return await getSupabaseClient();
    } catch (error) {
        throw reportError(`${operation}.client`, error, phase);
    }
}

async function requireVerifiedSession(supabase, operation) {
    const { data: sessionData, error: sessionReadError } =
        await supabase.auth.getSession();
    throwIfError(`${operation}.getSession`, sessionReadError, 'session');

    const session = sessionData?.session;
    if (!session?.access_token || !session.user?.id) {
        const error = sessionError(
            'Debes iniciar sesión antes de guardar información en Supabase.',
            'auth_session_required'
        );
        throw reportError(`${operation}.getSession`, error, 'session');
    }

    // getUser valida el JWT con Supabase Auth antes de cualquier INSERT/UPDATE.
    const { data: userData, error: userReadError } =
        await supabase.auth.getUser(session.access_token);
    throwIfError(`${operation}.getUser`, userReadError, 'session');

    if (!userData?.user?.id || userData.user.id !== session.user.id) {
        const error = sessionError(
            'La identidad del JWT no coincide con la sesión activa.',
            'auth_session_user_mismatch'
        );
        throw reportError(`${operation}.getUser`, error, 'session');
    }

    debugAuth('database-write:authorized', {
        operation,
        userId: userData.user.id,
        email: maskEmail(userData.user.email),
        hasAccessToken: true
    });
    return { session, user: userData.user };
}

function canManageEmail(user, targetEmail) {
    const actorEmail = normalizeEmail(user?.email);
    return actorEmail === normalizeEmail(targetEmail) || actorEmail === ADMIN_EMAIL;
}

export const authController = Object.freeze({
    async registerFamily(registration) {
        const endpoint = getApiUrl('/api/auth/register-family');
        console.info(`[NeuroSpark API] Registro familiar: ${endpoint}`);
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(registration)
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            const error = new Error(
                payload.error || `No se pudo crear la cuenta (${response.status}).`
            );
            error.code = payload.code || 'family_registration_failed';
            error.status = response.status;
            throw reportError('api.registerFamily', error, 'registration');
        }
        return payload;
    },

    async isAliasAvailable(alias) {
        const normalizedAlias = String(alias || '').trim();
        if (!normalizedAlias) return false;
        const supabase = await requireSupabase('rpc.is_alias_available', 'configuration');
        const { data, error } = await supabase.rpc('is_alias_available', {
            candidate_alias: normalizedAlias
        });
        throwIfError('rpc.is_alias_available', error, 'database');
        return Boolean(data);
    },

    async register(email, password, metadata = {}) {
        const normalizedEmail = normalizeEmail(email);
        const supabase = await requireSupabase('auth.signUp', 'configuration');
        debugAuth('register:start', { email: maskEmail(normalizedEmail) });

        const { data, error } = await supabase.auth.signUp({
            email: normalizedEmail,
            password,
            options: { data: metadata }
        });
        throwIfError('auth.signUp', error, 'authentication');

        if (!data?.user) {
            const missingUserError = new Error(
                'Supabase procesó el registro, pero no devolvió el usuario creado.'
            );
            missingUserError.code = 'auth_signup_user_missing';
            throw reportError('auth.signUp.user', missingUserError, 'authentication');
        }

        if (data.session) {
            const { data: sessionData, error: sessionReadError } =
                await supabase.auth.getSession();
            throwIfError('auth.getSession.afterSignUp', sessionReadError, 'session');

            if (!sessionData?.session?.user?.id) {
                const error = sessionError(
                    'La cuenta se creó, pero la sesión no quedó persistida.',
                    'auth_signup_session_not_persisted'
                );
                throw reportError('auth.getSession.afterSignUp', error, 'session');
            }

            data.session = sessionData.session;
        }

        debugAuth('register:success', {
            userId: data.user.id,
            email: maskEmail(data.user.email),
            hasSession: Boolean(data.session)
        });
        return data;
    },

    async login(email, password) {
        const normalizedEmail = normalizeEmail(email);
        const supabase = await requireSupabase('auth.signInWithPassword', 'configuration');
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
        const supabase = await requireSupabase('auth.signOut', 'configuration');
        const { error } = await supabase.auth.signOut({ scope });
        throwIfError('auth.signOut', error, 'authentication');
    },

    async getSession() {
        const supabase = await requireSupabase('auth.getSession', 'configuration');
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
        const supabase = await requireSupabase('auth.getUser', 'configuration');
        const { data, error } = await supabase.auth.getUser();
        throwIfError('auth.getUser', error, 'session');
        return data.user;
    },

    async getFamilyContext() {
        const supabase = await requireSupabase('rpc.get_my_family_context', 'configuration');
        const { data, error } = await supabase.rpc('get_my_family_context');
        throwIfError('rpc.get_my_family_context', error, 'database');
        return data || null;
    },

    async syncFamilyPassword(newPassword) {
        const supabase = await requireSupabase('api.syncFamilyPassword', 'configuration');
        const { data: sessionData, error: sessionError } =
            await supabase.auth.getSession();
        throwIfError('auth.getSession.beforePasswordSync', sessionError, 'session');
        const accessToken = sessionData?.session?.access_token;
        if (!accessToken) throw new Error('No existe una sesión activa para cambiar la contraseña.');

        const endpoint = getApiUrl('/api/auth/sync-family-password');
        console.info(`[NeuroSpark API] Sincronización de contraseña: ${endpoint}`);
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ newPassword })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            const error = new Error(
                payload.error || `No se pudo actualizar la contraseña (${response.status}).`
            );
            error.code = payload.code || 'password_sync_failed';
            error.status = response.status;
            throw reportError('api.syncFamilyPassword', error, 'authentication');
        }
        return payload;
    },

    async updateUserMetadata(metadata) {
        const supabase = await requireSupabase('auth.updateUser', 'configuration');
        const { data, error } = await supabase.auth.updateUser({ data: metadata });
        throwIfError('auth.updateUser', error, 'authentication');
        return data;
    },

    async resetPassword(email) {
        const supabase = await requireSupabase('auth.resetPasswordForEmail', 'configuration');
        const redirectTo = new URL('app.html#login', window.location.href).href;
        const { data, error } = await supabase.auth.resetPasswordForEmail(
            normalizeEmail(email),
            { redirectTo }
        );
        throwIfError('auth.resetPasswordForEmail', error, 'authentication');
        return data;
    },

    async saveParentEmail(email, parentEmail) {
        const supabase = await requireSupabase('correos.save', 'configuration');
        const { user } = await requireVerifiedSession(supabase, 'correos.save');
        const normalizedUserEmail = normalizeEmail(email);
        if (normalizeEmail(user.email) !== normalizedUserEmail) {
            throw reportError(
                'correos.save.identity',
                sessionError(
                    'Una cuenta solo puede crear su propio vínculo familiar.',
                    'family_link_identity_mismatch'
                ),
                'authorization'
            );
        }

        const row = {
            user_email: normalizedUserEmail,
            parent_email: normalizeEmail(parentEmail),
            child_user_id: user.id,
            is_primary: true
        };
        const { data: current, error: lookupError } = await supabase
            .from(TABLES.parentLinks)
            .select('user_email,parent_email,child_user_id')
            .eq('child_user_id', user.id)
            .eq('is_primary', true)
            .limit(1)
            .maybeSingle();
        throwIfError('correos.lookupBeforeSave', lookupError);

        if (current) {
            if (normalizeEmail(current.parent_email) !== row.parent_email) {
                throw reportError(
                    'correos.save.immutableParent',
                    new Error(
                        'El correo del padre/tutor ya está vinculado y no puede cambiarse desde el navegador.'
                    ),
                    'authorization'
                );
            }
            return current;
        }

        const { data, error } = await supabase
            .from(TABLES.parentLinks)
            .insert(row)
            .select('user_email,parent_email,child_user_id')
            .single();
        throwIfError('correos.insert', error);
        return data;
    },

    async getStudentEmailByParent(parentEmail) {
        const normalizedEmail = normalizeEmail(parentEmail);
        if (!normalizedEmail) return null;

        // La función anónima anterior exponía relaciones familiares antes del
        // login. El flujo actual autentica primero la cuenta parental y obtiene
        // después su vínculo mediante la RPC protegida por RLS.
        const supabase = await requireSupabase('correos.getByParent', 'configuration');
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || normalizeEmail(userData?.user?.email) !== normalizedEmail) {
            return null;
        }

        const context = await this.getFamilyContext();
        return context?.viewer_role === 'parent'
            ? context.user_email || null
            : null;
    },

    async checkUserExists(email) {
        const supabase = await requireSupabase('rpc.check_user_exists', 'configuration');
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
        const supabase = await requireSupabase('user_profiles.select', 'configuration');
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
        const supabase = await requireSupabase('user_profiles.save', 'configuration');
        const normalizedEmail = normalizeEmail(email);
        if (!normalizedEmail) throw new Error('Se requiere un correo para guardar el perfil.');
        const { user } = await requireVerifiedSession(supabase, 'user_profiles.save');
        if (!canManageEmail(user, normalizedEmail)) {
            throw reportError(
                'user_profiles.save.identity',
                sessionError(
                    'La sesión activa no puede modificar este perfil.',
                    'profile_identity_mismatch'
                ),
                'authorization'
            );
        }

        const isOwnProfile = normalizeEmail(user.email) === normalizedEmail;
        const identityColumn = isOwnProfile ? 'user_id' : 'email';
        const identityValue = isOwnProfile ? user.id : normalizedEmail;

        const { data: current, error: lookupError } = await supabase
            .from(TABLES.profiles)
            .select('email,user_id')
            .eq(identityColumn, identityValue)
            .eq('is_primary', true)
            .limit(1)
            .maybeSingle();
        throwIfError('user_profiles.lookupBeforeSave', lookupError);

        if (!current && !isOwnProfile) {
            throw reportError(
                'user_profiles.insert.admin',
                new Error(
                    'El perfil objetivo no existe. Debe crearse mediante el flujo de registro del Worker.'
                ),
                'authorization'
            );
        }

        const query = current
            ? supabase
                .from(TABLES.profiles)
                .update({ state_data: stateData })
                .eq(identityColumn, identityValue)
                .eq('is_primary', true)
            : supabase
                .from(TABLES.profiles)
                .insert({
                    email: normalizedEmail,
                    user_email: normalizedEmail,
                    user_id: user.id,
                    state_data: stateData,
                    is_primary: true
                });
        const { data, error } = await query
            .select('email,user_id,state_data')
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
        let subscription = null;
        let cancelled = false;

        requireSupabase('auth.onAuthStateChange', 'configuration')
            .then(supabase => {
                if (cancelled) return;
                const { data } = supabase.auth.onAuthStateChange((event, session) => {
                    callback(event, session);
                });
                subscription = data.subscription;
            })
            .catch(error => {
                console.error('[Supabase:auth.onAuthStateChange]', error);
            });

        return {
            unsubscribe() {
                cancelled = true;
                subscription?.unsubscribe();
            }
        };
    },

    async getAllUsers() {
        const supabase = await requireSupabase('user_profiles.selectAll', 'configuration');
        const { data, error } = await supabase
            .from(TABLES.profiles)
            .select('email,state_data')
            .order('email', { ascending: true });
        throwIfError('user_profiles.selectAll', error);
        return data || [];
    },

    async deleteUserProfile(email) {
        const supabase = await requireSupabase('user_profiles.delete', 'configuration');
        const { user } = await requireVerifiedSession(supabase, 'user_profiles.delete');
        if (normalizeEmail(user.email) !== ADMIN_EMAIL) {
            throw reportError(
                'user_profiles.delete.authorization',
                sessionError(
                    'Solo el administrador puede eliminar perfiles.',
                    'admin_session_required'
                ),
                'authorization'
            );
        }
        const { error } = await supabase
            .from(TABLES.profiles)
            .delete()
            .eq('email', normalizeEmail(email));
        throwIfError('user_profiles.delete', error);
        return true;
    }
});
