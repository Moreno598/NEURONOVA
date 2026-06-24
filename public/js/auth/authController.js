import { supabase } from './supabaseClient.js';

export const authController = {
    async register(email, password, metadata = {}) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: metadata
            }
        });
        if (error) throw error;
        return data;
    },

    async login(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        if (error) throw error;
        return data;
    },

    async logout() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    },

    async saveParentEmail(email, parentEmail) {
        const { error } = await supabase
            .from('correos')
            .insert([{ user_email: email, parent_email: parentEmail }]);
        if (error) throw error;
    },

    async getStudentEmailByParent(parentEmail) {
        try {
            // DEBUG: First check ALL rows in correos table
            const { data: allRows, error: allErr } = await supabase
                .from('correos')
                .select('*');
            console.log('[Parent Lookup] ALL rows in correos:', allRows, 'Error:', allErr);

            // Now do the specific lookup
            const { data, error } = await supabase
                .from('correos')
                .select('user_email')
                .eq('parent_email', parentEmail)
                .limit(1);
            
            console.log('[Parent Lookup] Specific query for:', parentEmail, '→ data:', data, 'error:', error);
            
            if (error) {
                console.warn('[Parent Lookup] Supabase error:', error.message);
                return null;
            }
            if (data && data.length > 0 && data[0].user_email) return data[0].user_email;
        } catch (e) {
            console.error("[Parent Lookup] Exception:", e);
        }
        return null;
    },

    async getCurrentUser() {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        return user;
    },

    async checkUserExists(email) {
        try {
            // Llama a una función RPC en Supabase para revisar la tabla auth.users directamente
            const { data, error } = await supabase.rpc('check_user_exists', { lookup_email: email });
            
            if (error) {
                console.error("RPC check_user_exists error:", error);
                return null; // Indica que la función no existe o falló
            }
            return data; // Devuelve true o false
        } catch (e) {
            console.error("Error validando usuario:", e);
            return null;
        }
    },

    async loadUserState(email) {
        try {
            const { data, error } = await supabase
                .from('user_profiles')
                .select('state_data')
                .eq('email', email)
                .single();
            if (data && data.state_data) return data.state_data;
        } catch (e) {}
        return null;
    },

    async saveUserState(email, stateData) {
        try {
            await supabase
                .from('user_profiles')
                .upsert({ email: email, state_data: stateData });
        } catch (e) {
            console.error("Error guardando en Supabase:", e);
        }
    },

    onAuthStateChange(callback) {
        supabase.auth.onAuthStateChange((event, session) => {
            callback(event, session);
        });
    },

    async getAllUsers() {
        try {
            const { data, error } = await supabase
                .from('user_profiles')
                .select('email, state_data')
                .order('email', { ascending: true });
            if (error) throw error;
            return data || [];
        } catch (e) {
            console.error('Error obteniendo usuarios:', e);
            return [];
        }
    },

    async deleteUserProfile(email) {
        try {
            const { error } = await supabase
                .from('user_profiles')
                .delete()
                .eq('email', email);
            if (error) throw error;
            return true;
        } catch (e) {
            console.error('Error eliminando perfil de usuario:', e);
            throw e;
        }
    }
};
