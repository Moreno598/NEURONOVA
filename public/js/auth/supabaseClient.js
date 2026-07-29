const SUPABASE_CDN =
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
const CLIENT_SLOT = '__NEUROSPARK_SUPABASE_CLIENT__';

let clientPromise;
let libraryPromise;

function readApiBaseUrl() {
    return globalThis.location.origin;
}

export function getApiUrl(pathname) {
    return new URL(pathname, `${readApiBaseUrl()}/`).href;
}

async function readRuntimeConfig() {
    const configUrl = getApiUrl('/api/config/supabase');
    console.info(`[Supabase Config] Solicitando configuración desde ${configUrl}`);

    const response = await fetch(configUrl, {
        headers: { Accept: 'application/json' },
        cache: 'no-store'
    });

    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const serverMessage = payload.error || 'El Worker no devolvió un error descriptivo.';
        const missing = Array.isArray(payload.missingVariables)
            && payload.missingVariables.length
            ? ` Faltan: ${payload.missingVariables.join(', ')}.`
            : '';
        const invalid = Array.isArray(payload.invalidVariables)
            && payload.invalidVariables.length
            ? ` Inválidas: ${payload.invalidVariables
                .map(variable => `${variable.name} (${variable.reason})`)
                .join(', ')}.`
            : '';
        const code = payload.code ? ` [${payload.code}]` : '';
        throw new Error(
            `No se pudo cargar la configuración de Supabase desde `
            + `${configUrl} (${response.status}).${code} `
            + `${serverMessage}${missing}${invalid}`
        );
    }

    const config = await response.json();
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.url || '')) {
        throw new Error('SUPABASE_URL no tiene un formato válido.');
    }
    if (!config.anonKey || typeof config.anonKey !== 'string') {
        throw new Error('SUPABASE_ANON_KEY no está configurada.');
    }

    console.info(`[Supabase Config] Proyecto Supabase: ${new URL(config.url).origin}`);
    return config;
}

function loadSupabaseLibrary() {
    if (globalThis.supabase?.createClient) return Promise.resolve(globalThis.supabase);
    if (libraryPromise) return libraryPromise;

    libraryPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-neurospark-supabase]');
        if (existing) {
            existing.addEventListener('load', () => resolve(globalThis.supabase), { once: true });
            existing.addEventListener('error', () => reject(new Error('No se pudo cargar Supabase JS.')), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = SUPABASE_CDN;
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.dataset.neurosparkSupabase = 'true';
        script.addEventListener('load', () => {
            if (!globalThis.supabase?.createClient) {
                reject(new Error('La librería Supabase JS no expuso createClient.'));
                return;
            }
            resolve(globalThis.supabase);
        }, { once: true });
        script.addEventListener('error', () => {
            reject(new Error('No se pudo descargar @supabase/supabase-js.'));
        }, { once: true });
        document.head.append(script);
    });

    return libraryPromise;
}

export function getSupabaseClient() {
    if (globalThis[CLIENT_SLOT]) return Promise.resolve(globalThis[CLIENT_SLOT]);
    if (clientPromise) return clientPromise;

    clientPromise = Promise.all([readRuntimeConfig(), loadSupabaseLibrary()])
        .then(([config, library]) => {
            const client = library.createClient(config.url, config.anonKey, {
                db: { schema: 'public' },
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true,
                    storageKey: 'neurospark-supabase-auth'
                },
                global: {
                    headers: { 'X-Client-Info': 'neurospark-web' }
                }
            });

            globalThis[CLIENT_SLOT] = client;
            return client;
        })
        .catch(error => {
            clientPromise = undefined;
            console.error('[Supabase Client] Error de inicialización:', error);
            throw error;
        });

    return clientPromise;
}

// El cliente se obtiene de forma diferida. Así la navegación del formulario no
// depende de que el CDN o la configuración remota hayan terminado de cargar.
