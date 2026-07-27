import { supabase } from './supabaseClient.js';

const TABLES = Object.freeze({
    parentLinks: 'correos',
    profiles: 'user_profiles'
});

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function reportError(operation, error) {
    console.error(`[Supabase:${operation}]`, {
        message: error?.message || 'Error desconocido',
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        status: error?.status
    });
}

function throwIfError(operation, error) {
    if (!error) return;
    reportError(operation, error);
    throw error;
}

export const authController = Object.freeze({
    async register(email, password, metadata = {}) {
        const { data, error } = await supabase.auth.signUp({
            email: normalizeEmail(email),
            password,
            options: { data: metadata }
        });
        throwIfError('auth.signUp', error);
        return data;
    },

    async login(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: normalizeEmail(email),
            password
        });
        throwIfError('auth.signInWithPassword', error);
        return data;
    },

    async logout(scope = 'local') {
        const { error } = await supabase.auth.signOut({ scope });
        throwIfError('auth.signOut', error);
    },

    async getSession() {
        const { data, error } = await supabase.auth.getSession();
        throwIfError('auth.getSession', error);
        return data.session;
    },

    async getCurrentUser() {
        const { data, error } = await supabase.auth.getUser();
        throwIfError('auth.getUser', error);
        return data.user;
    },

    async updateUserMetadata(metadata) {
        const { data, error } = await supabase.auth.updateUser({ data: metadata });
        throwIfError('auth.updateUser', error);
        return data;
    },

    async resetPassword(email) {
        const redirectTo = new URL('app.html#login', window.location.href).href;
        const { data, error } = await supabase.auth.resetPasswordForEmail(
            normalizeEmail(email),
            { redirectTo }
        );
        throwIfError('auth.resetPasswordForEmail', error);
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
            reportError('user_profiles.select', error);
            throw error;
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
        const currentState = await this.loadUserState(email).catch(() => null);
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
