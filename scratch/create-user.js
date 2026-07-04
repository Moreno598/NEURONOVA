const SUPABASE_URL = 'https://yfnjwnqutkjstvvxjjiy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlmbmp3bnF1dGtqc3R2dnhqaml5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5MTA4NzIsImV4cCI6MjA5NzQ4Njg3Mn0.wvD-kpJTFnuZfnXajyrCXeb7czkPhcVMlQzqMsAfJPE';

async function createUser() {
    const email = 'premium@neurospark.com';
    const password = 'premium123';
    
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            email,
            password,
            data: {
                first_name: 'Cuenta',
                last_name: 'Premium',
                alias: 'premiumUser',
                age: 15,
                parent_email: 'padre@neurospark.com',
                avatar_config: {
                    skin: 0,
                    shirt: 0,
                    pants: 0,
                    hairStyle: 1,
                    hairColor: 0,
                    gender: 'Block'
                }
            }
        })
    });
    
    const data = await res.json();
    console.log(data);
}
createUser();
