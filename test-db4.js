const SUPABASE_URL = 'https://yfnjwnqutkjstvvxjjiy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlmbmp3bnF1dGtqc3R2dnhqaml5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5MTA4NzIsImV4cCI6MjA5NzQ4Njg3Mn0.wvD-kpJTFnuZfnXajyrCXeb7czkPhcVMlQzqMsAfJPE';

async function test() {
    // 1. Valid user (we know patrickmorales964@gmail.com is in the screenshot)
    let res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: 'patrickmorales964@gmail.com', password: 'WrongPassword123!' })
    });
    console.log("Valid user, wrong pass:", await res.json());

    // 2. Invalid user
    res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: 'nonexistent123456789@gmail.com', password: 'WrongPassword123!' })
    });
    console.log("Invalid user, wrong pass:", await res.json());
}
test();
