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

    async getCurrentUser() {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        return user;
    },

    async checkUserExists(email) {
        try {
            const { data, error } = await supabase
                .from('correos')
                .select('user_email')
                .eq('user_email', email)
                .limit(1);
            if (data && data.length > 0) return true;
            return false;
        } catch (e) {
            return false;
        }
    },

    onAuthStateChange(callback) {
        supabase.auth.onAuthStateChange((event, session) => {
            callback(event, session);
        });
    }
};
