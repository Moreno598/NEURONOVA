// Reemplaza estas constantes con las credenciales de tu proyecto en Supabase
const SUPABASE_URL = 'https://yfnjwnqutkjstvvxjjiy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlmbmp3bnF1dGtqc3R2dnhqaml5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5MTA4NzIsImV4cCI6MjA5NzQ4Njg3Mn0.wvD-kpJTFnuZfnXajyrCXeb7czkPhcVMlQzqMsAfJPE';

// Inicializa el cliente usando la librería de Supabase inyectada globalmente vía CDN
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});
