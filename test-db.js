const SUPABASE_URL = 'https://yfnjwnqutkjstvvxjjiy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlmbmp3bnF1dGtqc3R2dnhqaml5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5MTA4NzIsImV4cCI6MjA5NzQ4Njg3Mn0.wvD-kpJTFnuZfnXajyrCXeb7czkPhcVMlQzqMsAfJPE';

async function test() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/correos?select=*&limit=1`, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
    });
    const data = await res.json();
    console.log(data);
}
test();
