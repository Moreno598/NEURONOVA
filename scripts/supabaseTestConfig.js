const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');

for (const envFile of ['.env.local', '.env']) {
    const envPath = path.join(projectRoot, envFile);
    if (!fs.existsSync(envPath)) continue;

    for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const separator = line.indexOf('=');
        if (separator < 1) continue;
        const key = line.slice(0, separator).trim();
        const value = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
        if (!(key in process.env)) process.env[key] = value;
    }
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY =
    process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_TEST_EMAIL = process.env.SUPABASE_TEST_EMAIL;
const SUPABASE_TEST_PASSWORD = process.env.SUPABASE_TEST_PASSWORD;
const SUPABASE_TEST_PARENT_EMAIL = process.env.SUPABASE_TEST_PARENT_EMAIL;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Faltan SUPABASE_URL y SUPABASE_ANON_KEY en el entorno.');
}

function requireTestCredentials() {
    if (!SUPABASE_TEST_EMAIL || !SUPABASE_TEST_PASSWORD) {
        throw new Error('Configura SUPABASE_TEST_EMAIL y SUPABASE_TEST_PASSWORD para esta prueba.');
    }
    return {
        email: SUPABASE_TEST_EMAIL,
        password: SUPABASE_TEST_PASSWORD,
        parentEmail: SUPABASE_TEST_PARENT_EMAIL
    };
}

module.exports = Object.freeze({
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    requireTestCredentials
});
