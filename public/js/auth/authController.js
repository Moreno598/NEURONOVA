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

    onAuthStateChange(callback) {
        supabase.auth.onAuthStateChange((event, session) => {
            callback(event, session);
        });
    }
};
