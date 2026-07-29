import { createClient } from '@supabase/supabase-js';

const MAX_JSON_BYTES = 768 * 1024;
const PUBLIC_SUPABASE_VARIABLES = Object.freeze([
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY'
]);
let cachedAdminClient = null;
let cachedAdminSignature = null;

function inspectSupabaseKey(value) {
    if (!value) return { configured: false, format: 'missing' };
    if (!value.startsWith('eyJ')) return { configured: true, format: 'opaque' };

    try {
        const encodedPayload = value.split('.')[1]
            .replace(/-/g, '+')
            .replace(/_/g, '/');
        const payload = JSON.parse(atob(encodedPayload));
        return {
            configured: true,
            format: 'jwt',
            projectRef: payload.ref || null,
            role: payload.role || null
        };
    } catch {
        return { configured: true, format: 'invalid-jwt' };
    }
}

function auditSupabaseConfiguration(env) {
    const rawSupabaseUrl = String(env.SUPABASE_URL || '').trim();
    const restEndpointIndex = rawSupabaseUrl.toLowerCase().indexOf('/rest/v1');
    const supabaseUrl = restEndpointIndex >= 0
        ? rawSupabaseUrl.slice(0, restEndpointIndex)
        : rawSupabaseUrl;
    const supabaseAnonKey = String(
        env.SUPABASE_ANON_KEY || ''
    ).trim();
    const supabaseServiceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    const missing = [
        ['SUPABASE_URL', supabaseUrl],
        ['SUPABASE_ANON_KEY', supabaseAnonKey],
        ['SUPABASE_SERVICE_ROLE_KEY', supabaseServiceRoleKey]
    ].filter(([, value]) => !value).map(([name]) => name);

    let projectUrl = null;
    let projectRef = null;
    const invalidVariables = [];
    if (supabaseUrl) try {
        const parsedUrl = new URL(supabaseUrl);
        const validHost = /^[a-z0-9-]+\.supabase\.co$/i.test(parsedUrl.hostname);
        const validPath = parsedUrl.pathname === '/' || parsedUrl.pathname === '';
        const cleanUrl =
            parsedUrl.protocol === 'https:'
            && validHost
            && validPath
            && !parsedUrl.username
            && !parsedUrl.password
            && !parsedUrl.search
            && !parsedUrl.hash;

        if (!cleanUrl) {
            invalidVariables.push({
                name: 'SUPABASE_URL',
                reason:
                    'Debe ser la URL base HTTPS del proyecto '
                    + '(https://<project-ref>.supabase.co), sin /rest/v1, query ni fragmento.'
            });
        } else {
            projectUrl = parsedUrl.origin;
            projectRef = parsedUrl.hostname.split('.')[0];
        }
    } catch {
        invalidVariables.push({
            name: 'SUPABASE_URL',
            reason: 'No contiene una URL válida.'
        });
    }

    const anon = inspectSupabaseKey(supabaseAnonKey);
    const service = inspectSupabaseKey(supabaseServiceRoleKey);
    if (anon.format === 'invalid-jwt') {
        invalidVariables.push({
            name: 'SUPABASE_ANON_KEY',
            reason: 'La clave JWT no se puede decodificar.'
        });
    }
    if (service.format === 'invalid-jwt') {
        invalidVariables.push({
            name: 'SUPABASE_SERVICE_ROLE_KEY',
            reason: 'La clave JWT no se puede decodificar.'
        });
    }
    if (anon.projectRef && projectRef && anon.projectRef !== projectRef) {
        invalidVariables.push({
            name: 'SUPABASE_ANON_KEY',
            reason: 'Pertenece a otro proyecto Supabase.'
        });
    }
    if (service.projectRef && projectRef && service.projectRef !== projectRef) {
        invalidVariables.push({
            name: 'SUPABASE_SERVICE_ROLE_KEY',
            reason: 'Pertenece a otro proyecto Supabase.'
        });
    }
    if (anon.role && anon.role !== 'anon') {
        invalidVariables.push({
            name: 'SUPABASE_ANON_KEY',
            reason: `La clave JWT tiene el rol "${anon.role}" en vez de "anon".`
        });
    }
    if (service.role && service.role !== 'service_role') {
        invalidVariables.push({
            name: 'SUPABASE_SERVICE_ROLE_KEY',
            reason:
                `La clave JWT tiene el rol "${service.role}" `
                + 'en vez de "service_role".'
        });
    }
    if (supabaseAnonKey && supabaseServiceRoleKey
        && supabaseAnonKey === supabaseServiceRoleKey) {
        invalidVariables.push({
            name: 'SUPABASE_ANON_KEY',
            reason: 'No puede ser igual a SUPABASE_SERVICE_ROLE_KEY.'
        });
        invalidVariables.push({
            name: 'SUPABASE_SERVICE_ROLE_KEY',
            reason: 'No puede ser igual a SUPABASE_ANON_KEY.'
        });
    }

    const issues = invalidVariables.map(
        variable => `${variable.name}: ${variable.reason}`
    );
    return {
        missing,
        issues,
        invalidVariables,
        urlWasNormalized: Boolean(rawSupabaseUrl && rawSupabaseUrl !== supabaseUrl),
        projectUrl,
        projectRef,
        anon,
        service,
        supabaseUrl: projectUrl || supabaseUrl,
        supabaseAnonKey,
        supabaseServiceRoleKey
    };
}

function publicSupabaseConfiguration(env) {
    const configuration = auditSupabaseConfiguration(env);
    return {
        configuration,
        missingVariables: configuration.missing.filter(
            name => PUBLIC_SUPABASE_VARIABLES.includes(name)
        ),
        invalidVariables: configuration.invalidVariables.filter(
            variable => PUBLIC_SUPABASE_VARIABLES.includes(variable.name)
        )
    };
}

class ApiError extends Error {
    constructor(status, message, code = 'api_error', details = null) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

function jsonResponse(payload, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: {
        'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            ...extraHeaders
        }
    });
}

async function readJsonBody(request, maxBytes = MAX_JSON_BYTES) {
    const declaredLength = Number(request.headers.get('content-length') || 0);
    if (declaredLength > maxBytes) {
        throw new ApiError(
            413,
            'La solicitud supera el tamaño permitido.',
            'payload_too_large'
        );
    }

    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > maxBytes) {
        throw new ApiError(
            413,
            'La solicitud supera el tamaño permitido.',
            'payload_too_large'
        );
    }

    try {
        return body ? JSON.parse(body) : {};
    } catch {
        throw new ApiError(400, 'El cuerpo JSON no es válido.', 'invalid_json');
    }
}

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function normalizeAlias(value) {
    return String(value || '').trim();
}

function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function requireAdminConfiguration(env) {
    const configuration = auditSupabaseConfiguration(env);
    if (
        configuration.missing.length
        || configuration.issues.length
    ) {
        throw new ApiError(
            503,
            [
                'La conexión administrativa de Supabase no está configurada correctamente.',
                configuration.missing.length
                    ? `Variables ausentes: ${configuration.missing.join(', ')}.`
                    : '',
                configuration.issues.join(' ')
            ].filter(Boolean).join(' '),
            'supabase_admin_not_configured',
            {
                missingVariables: configuration.missing,
                invalidVariables: configuration.invalidVariables
            }
        );
    }

    const signature =
        `${configuration.supabaseUrl}\u0000${configuration.supabaseServiceRoleKey}`;
    if (cachedAdminClient && cachedAdminSignature === signature) {
        return cachedAdminClient;
    }

    // Una única instancia por isolate y conjunto de credenciales.
    cachedAdminClient = createClient(
        configuration.supabaseUrl,
        configuration.supabaseServiceRoleKey,
        {
            db: { schema: 'public' },
            auth: {
                autoRefreshToken: false,
                persistSession: false,
                detectSessionInUrl: false
            },
            global: {
                headers: { 'X-Client-Info': 'neurospark-cloudflare-worker' }
            }
        }
    );
    cachedAdminSignature = signature;
    return cachedAdminClient;
}

function createPublicAuthClient(env) {
    const {
        configuration,
        missingVariables,
        invalidVariables
    } = publicSupabaseConfiguration(env);

    if (missingVariables.length || invalidVariables.length) {
        throw new ApiError(
            503,
            missingVariables.length
                ? `Faltan variables del Worker: ${missingVariables.join(', ')}.`
                : 'La configuración pública de Supabase contiene valores inválidos.',
            missingVariables.length
                ? 'supabase_public_config_missing'
                : 'supabase_public_config_invalid',
            { missingVariables, invalidVariables }
        );
    }

    // Cliente efímero por petición: una sesión de login nunca puede contaminar
    // el cliente service_role persistente del isolate.
    return createClient(
        configuration.supabaseUrl,
        configuration.supabaseAnonKey,
        {
            db: { schema: 'public' },
            auth: {
                autoRefreshToken: false,
                persistSession: false,
                detectSessionInUrl: false
            },
            global: {
                headers: { 'X-Client-Info': 'neurospark-cloudflare-worker-auth' }
            }
        }
    );
}

function throwSupabaseError(error, fallbackStatus = 500) {
    if (!error) return;
    console.error('[Supabase Server] Error original:', error);
    throw new ApiError(
        Number(error.status) || fallbackStatus,
        error.message || 'Supabase devolvió un error sin mensaje.',
        error.code || 'supabase_error',
        {
            details: error.details || null,
            hint: error.hint || null
        }
    );
}

async function createAuthUser(client, { email, password, userMetadata, appMetadata }) {
    const { data, error } = await client.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: userMetadata,
        app_metadata: appMetadata
    });
    throwSupabaseError(error, 400);
    return data.user;
}

async function loginUser(payload, env) {
    const email = normalizeEmail(payload.email);
    const password = String(payload.password || '');
    if (!isValidEmail(email) || !password) {
        throw new ApiError(
            400,
            'El correo y la contraseña son obligatorios.',
            'invalid_login_payload'
        );
    }

    const client = createPublicAuthClient(env);
    const { data, error } = await client.auth.signInWithPassword({
        email,
        password
    });
    throwSupabaseError(error, 401);

    if (!data?.user || !data?.session?.access_token || !data.session.refresh_token) {
        throw new ApiError(
            502,
            'Supabase autenticó la solicitud sin devolver una sesión completa.',
            'supabase_session_incomplete'
        );
    }

    return {
        user: data.user,
        session: data.session
    };
}

function readBearerToken(request) {
    const authorization = request.headers.get('authorization') || '';
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match?.[1]) {
        throw new ApiError(
            401,
            'Falta el token Bearer de la sesión.',
            'authorization_token_missing'
        );
    }
    return match[1].trim();
}

async function logoutUser(request, payload, env) {
    const token = readBearerToken(request);
    const scope = String(payload.scope || 'local');
    if (!['local', 'global', 'others'].includes(scope)) {
        throw new ApiError(
            400,
            'El alcance de cierre de sesión no es válido.',
            'invalid_logout_scope'
        );
    }

    const client = requireAdminConfiguration(env);
    const { data: userData, error: userError } = await client.auth.getUser(token);
    if (userError || !userData?.user) {
        console.error('[Supabase Auth] Token de logout inválido.', userError);
        throw new ApiError(
            401,
            userError?.message || 'La sesión no es válida.',
            userError?.code || 'invalid_session'
        );
    }

    const { error } = await client.auth.admin.signOut(token, scope);
    throwSupabaseError(error, 401);
    return {
        loggedOut: true,
        scope
    };
}

async function deleteAuthUser(client, userId) {
    if (!userId) return;
    const { error } = await client.auth.admin.deleteUser(userId);
    if (error) {
        console.error('[Family Registration] No se pudo revertir el usuario Auth:', error);
    }
}

async function deleteFamilyRows(client, childUserId) {
    if (!childUserId) return;
    await Promise.all([
        client
            .from('correos')
            .delete()
            .eq('child_user_id', childUserId)
            .then(({ error }) => {
                if (error) console.error('[Family Registration] Limpieza correos:', error);
            }),
        client
            .from('user_profiles')
            .delete()
            .eq('user_id', childUserId)
            .then(({ error }) => {
                if (error) console.error('[Family Registration] Limpieza user_profiles:', error);
            })
    ]);
}

function validateFamilyRegistration(payload) {
    const alias = normalizeAlias(payload.alias);
    const fullName = String(payload.fullName || '').trim();
    const userEmail = normalizeEmail(payload.userEmail);
    const parentEmail = normalizeEmail(payload.parentEmail);
    const password = String(payload.password || '');
    const age = Number(payload.age);

    if (!/^[\p{L}\p{N}_-]{3,24}$/u.test(alias)) {
        throw new ApiError(
            400,
            'El alias debe tener entre 3 y 24 caracteres y solo usar letras, números, guion o guion bajo.',
            'invalid_alias'
        );
    }
    if (fullName.length < 3 || fullName.length > 100) {
        throw new ApiError(400, 'Ingresa el nombre completo.', 'invalid_full_name');
    }
    if (!Number.isInteger(age) || age < 6 || age > 17) {
        throw new ApiError(400, 'La edad debe estar entre 6 y 17 años.', 'invalid_age');
    }
    if (!isValidEmail(userEmail) || !isValidEmail(parentEmail)) {
        throw new ApiError(400, 'Los correos electrónicos no son válidos.', 'invalid_email');
    }
    if (userEmail === parentEmail) {
        throw new ApiError(
            400,
            'El correo del padre debe ser diferente al correo del estudiante.',
            'emails_must_differ'
        );
    }
    if (password.length < 8) {
        throw new ApiError(
            400,
            'La contraseña debe tener al menos 8 caracteres.',
            'weak_password'
        );
    }

    return {
        alias,
        fullName,
        userEmail,
        parentEmail,
        password,
        age,
        mode: age <= 11 ? 'child' : 'teen',
        avatar: payload.avatar && typeof payload.avatar === 'object'
            ? payload.avatar
            : null
    };
}

async function registerFamily(payload, env) {
    const client = requireAdminConfiguration(env);
    const registration = validateFamilyRegistration(payload);
    const { data: existingAlias, error: aliasError } = await client
        .from('user_profiles')
        .select('user_id')
        .ilike('alias', registration.alias)
        .eq('is_primary', true)
        .limit(1);
    throwSupabaseError(aliasError);
    if (existingAlias?.length) {
        throw new ApiError(409, 'Ese alias ya está en uso.', 'alias_already_exists');
    }

    let childUser = null;
    let parentUser = null;
    try {
        childUser = await createAuthUser(client, {
            email: registration.userEmail,
            password: registration.password,
            userMetadata: {
                alias: registration.alias,
                full_name: registration.fullName,
                age: registration.age,
                mode: registration.mode,
                parent_email: registration.parentEmail,
                avatar_config: registration.avatar?.config || null
            },
            appMetadata: {
                account_type: 'student',
                mode: registration.mode
            }
        });

        parentUser = await createAuthUser(client, {
            email: registration.parentEmail,
            password: registration.password,
            userMetadata: {
                linked_child_id: childUser.id,
                linked_child_alias: registration.alias
            },
            appMetadata: {
                account_type: 'parent',
                child_user_id: childUser.id
            }
        });

        const timestamp = new Date().toISOString();
        const profile = {
            user_id: childUser.id,
            parent_user_id: parentUser.id,
            email: registration.userEmail,
            user_email: registration.userEmail,
            parent_email: registration.parentEmail,
            alias: registration.alias,
            full_name: registration.fullName,
            age: registration.age,
            mode: registration.mode,
            updated_at: timestamp,
            state_data: {
                profile: {
                    userId: childUser.id,
                    username: registration.alias,
                    alias: registration.alias,
                    fullName: registration.fullName,
                    email: registration.userEmail,
                    parentEmail: registration.parentEmail,
                    age: registration.age,
                    mode: registration.mode,
                    avatar: registration.avatar,
                    updatedAt: timestamp
                }
            }
        };
        const link = {
            child_user_id: childUser.id,
            parent_user_id: parentUser.id,
            user_email: registration.userEmail,
            parent_email: registration.parentEmail,
            alias: registration.alias,
            full_name: registration.fullName,
            age: registration.age,
            mode: registration.mode
        };

        const { error: profileError } = await client
            .from('user_profiles')
            .insert(profile);
        throwSupabaseError(profileError, 400);

        const { error: linkError } = await client
            .from('correos')
            .insert(link);
        throwSupabaseError(linkError, 400);

        return {
            student: {
                id: childUser.id,
                email: registration.userEmail,
                alias: registration.alias,
                fullName: registration.fullName,
                age: registration.age,
                mode: registration.mode
            },
            parent: {
                id: parentUser.id,
                email: registration.parentEmail
            }
        };
    } catch (error) {
        console.error('[Family Registration] Error original:', error);
        await deleteFamilyRows(client, childUser?.id);
        await deleteAuthUser(client, parentUser?.id);
        await deleteAuthUser(client, childUser?.id);
        throw error;
    }
}

async function verifyAccessToken(request, client) {
    const authorization = request.headers.get('authorization') || '';
    const token = authorization.startsWith('Bearer ')
        ? authorization.slice(7)
        : '';
    if (!token) throw new ApiError(401, 'Falta la sesión del estudiante.', 'missing_session');

    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user?.id) {
        if (error) console.error('[Supabase Server] Token inválido:', error);
        throw new ApiError(401, 'La sesión del estudiante no es válida.', 'invalid_session');
    }
    return data.user;
}

async function syncFamilyPassword(request, payload, env) {
    const client = requireAdminConfiguration(env);
    const user = await verifyAccessToken(request, client);
    if (user.app_metadata?.account_type !== 'student') {
        throw new ApiError(
            403,
            'Solo la cuenta del estudiante puede cambiar la contraseña familiar.',
            'student_session_required'
        );
    }

    const newPassword = String(payload.newPassword || '');
    if (newPassword.length < 8) {
        throw new ApiError(400, 'La contraseña debe tener al menos 8 caracteres.', 'weak_password');
    }

    const { data: profile, error: profileError } = await client
        .from('user_profiles')
        .select('user_id,parent_user_id')
        .eq('user_id', user.id)
        .eq('is_primary', true)
        .limit(1)
        .maybeSingle();
    throwSupabaseError(profileError);
    if (!profile?.parent_user_id) {
        throw new ApiError(404, 'No se encontró la cuenta parental vinculada.', 'parent_not_found');
    }

    // Supabase Admin no ofrece una transacción entre dos identidades Auth.
    const { error: parentError } = await client.auth.admin.updateUserById(
        profile.parent_user_id,
        { password: newPassword }
    );
    throwSupabaseError(parentError, 400);

    const { error: studentError } = await client.auth.admin.updateUserById(
        profile.user_id,
        { password: newPassword }
    );
    throwSupabaseError(studentError, 400);
    return { updated: true };
}

async function verifySupabaseServerConnection(env) {
    const supabaseConfiguration = auditSupabaseConfiguration(env);
    console.log(
        `[Supabase Config] SUPABASE_URL=${supabaseConfiguration.projectUrl || '(inválida o vacía)'}`
    );
    console.log(
        '[Supabase Config] SUPABASE_ANON_KEY='
        + (supabaseConfiguration.anon.configured
            ? `configurada (formato=${supabaseConfiguration.anon.format})`
            : 'vacía o undefined')
    );
    console.log(
        '[Supabase Config] SUPABASE_SERVICE_ROLE_KEY='
        + (supabaseConfiguration.service.configured
            ? `configurada (formato=${supabaseConfiguration.service.format}, solo servidor)`
            : 'vacía o undefined')
    );

    if (supabaseConfiguration.missing.length) {
        console.error(
            `[Supabase Config] Variables vacías/undefined: ${supabaseConfiguration.missing.join(', ')}`
        );
    }
    for (const issue of supabaseConfiguration.issues) {
        console.error(`[Supabase Config] ${issue}`);
    }

    if (
        supabaseConfiguration.missing.length
        || supabaseConfiguration.issues.length
    ) {
        return {
            ok: false,
            projectUrl: supabaseConfiguration.projectUrl,
            missingVariables: supabaseConfiguration.missing,
            issues: supabaseConfiguration.issues,
            checks: []
        };
    }

    const supabaseAdmin = requireAdminConfiguration(env);
    console.log(
        `[Supabase Server] Comprobando ${supabaseConfiguration.supabaseUrl}/auth/v1/admin/users`
    );
    console.log(
        `[Supabase Server] Comprobando ${supabaseConfiguration.supabaseUrl}/rest/v1/user_profiles`
    );
    console.log(
        `[Supabase Server] Comprobando ${supabaseConfiguration.supabaseUrl}/rest/v1/correos`
    );

    const checks = await Promise.all([
        supabaseAdmin.auth.admin
            .listUsers({ page: 1, perPage: 1 })
            .then(({ error }) => ({ name: 'Auth Admin', error })),
        supabaseAdmin
            .from('user_profiles')
            .select('id', { head: true, count: 'exact' })
            .then(({ error }) => ({ name: 'user_profiles', error })),
        supabaseAdmin
            .from('correos')
            .select('id', { head: true, count: 'exact' })
            .then(({ error }) => ({ name: 'correos', error }))
    ]);

    const failures = checks.filter(check => check.error);
    if (failures.length) {
        for (const check of failures) {
            console.error(`[Supabase Server] Falló ${check.name}:`, {
                message: check.error.message,
                code: check.error.code,
                details: check.error.details,
                hint: check.error.hint
            });
        }
        return {
            ok: false,
            projectUrl: supabaseConfiguration.projectUrl,
            missingVariables: [],
            issues: [],
            checks: checks.map(check => ({
                name: check.name,
                ok: !check.error,
                code: check.error?.code || null
            }))
        };
    }

    console.log('[Supabase Server] Auth, user_profiles y correos disponibles.');
    return {
        ok: true,
        projectUrl: supabaseConfiguration.projectUrl,
        missingVariables: [],
        issues: [],
        checks: checks.map(check => ({ name: check.name, ok: true, code: null }))
    };
}

// ── Comprehensive Intent Engine ──────────────────────────────────────────────
const intents = [
    {
        id: 'pomodoro',
        keys: ['pomodoro', 'temporizador', 'timer', 'tiempo de estudio', 'study time'],
        es: '⏱️ **La Técnica Pomodoro** es ideal para el TDAH:\n\n1. Trabaja **25 minutos** en una sola tarea.\n2. Descansa **5 minutos** — ¡muévete, estira, toma agua!\n3. Cada 4 ciclos, toma un descanso largo de **20 minutos**.\n\nTu panel tiene un temporizador Pomodoro integrado. ¡Úsalo!',
        en: '⏱️ **The Pomodoro Technique** is perfect for ADHD:\n\n1. Work **25 minutes** on one single task.\n2. Rest **5 minutes** — move, stretch, drink water!\n3. Every 4 cycles, take a long **20-minute** break.\n\nYour panel has a built-in Pomodoro timer. Use it!'
    },
    {
        id: 'memory',
        keys: ['memoria', 'memory', 'recordar', 'remember', 'olvidar', 'forget', 'memori'],
        es: '🧠 **Cómo mejorar tu memoria:**\n\n- **Repetición espaciada**: repasa el tema a las 24h, 3 días y 1 semana.\n- **Asociación visual**: convierte conceptos en imágenes o historias.\n- **Enseña lo que aprendes**: explicar fija el conocimiento.\n\nEl juego *Memoria Musical* y *Cartas de Memoria* entrenan esto directamente. ¡Inténtalos!',
        en: '🧠 **How to improve your memory:**\n\n- **Spaced repetition**: review at 24h, 3 days, and 1 week.\n- **Visual association**: turn concepts into images or stories.\n- **Teach what you learn**: explaining fixes knowledge.\n\nThe *Musical Memory* and *Memory Cards* games train this directly. Try them!'
    },
    {
        id: 'anxiety',
        keys: ['ansioso', 'ansiedad', 'nervioso', 'nervous', 'anxiety', 'anxious', 'preocupado', 'worried', 'miedo', 'fear'],
        es: '💙 Entiendo que te sientes ansioso. Eso es completamente válido.\n\n**Técnica 5-4-3-2-1** (para este momento):\n- Nombra **5 cosas** que puedes *ver*\n- **4** que puedes *tocar*\n- **3** que puedes *escuchar*\n- **2** que puedes *oler*\n- **1** que puedes *saborear*\n\nEsto ancla tu mente al presente. ¡Estoy aquí contigo! 🌟',
        en: '💙 I understand you feel anxious. That is completely valid.\n\n**5-4-3-2-1 Technique** (for right now):\n- Name **5 things** you can *see*\n- **4** you can *touch*\n- **3** you can *hear*\n- **2** you can *smell*\n- **1** you can *taste*\n\nThis anchors your mind to the present. I am here with you! 🌟'
    },
    {
        id: 'attention',
        keys: ['atención', 'attention', 'concentrar', 'concentrate', 'focus', 'distraer', 'distract', 'inatento', 'inattentive'],
        es: '🎯 **Estrategias para mejorar la atención:**\n\n- **Elimina distracciones**: silencia el celular, pon música instrumental.\n- **Trabaja en bloques cortos**: 15-20 min es ideal para cerebros TDAH.\n- **Check de intención**: antes de empezar, escribe *qué* harás y *por qué*.\n- **Activa tu modo "piloto"**: el juego *Cazadores de Distracciones* entrena esto.\n\n¿Quieres un tip específico para tu situación?',
        en: '🎯 **Strategies to improve attention:**\n\n- **Eliminate distractions**: silence your phone, play instrumental music.\n- **Work in short blocks**: 15-20 min is ideal for ADHD brains.\n- **Intention check**: before starting, write *what* you will do and *why*.\n- **Activate pilot mode**: the *Distraction Hunters* game trains this.\n\nWant a specific tip for your situation?'
    },
    {
        id: 'sleep',
        keys: ['dormir', 'sleep', 'sueño', 'sleepy', 'cansado', 'tired', 'descansar', 'rest', 'insomnio', 'insomnia'],
        es: '😴 **El sueño es fundamental** para el cerebro con TDAH:\n\n- Evita pantallas **1 hora antes** de dormir.\n- Establece un horario fijo de sueño (incluso fines de semana).\n- La temperatura ideal para dormir es **18-20°C**.\n- Prueba la técnica **4-7-8**: inhala 4 seg, aguanta 7, exhala 8.\n\nDormir bien mejora la atención, memoria y control emocional al día siguiente. 🌙',
        en: '😴 **Sleep is fundamental** for the ADHD brain:\n\n- Avoid screens **1 hour before** sleeping.\n- Keep a fixed sleep schedule (even on weekends).\n- The ideal sleep temperature is **65-68°F**.\n- Try the **4-7-8 technique**: inhale 4s, hold 7s, exhale 8s.\n\nGood sleep improves attention, memory and emotional control. 🌙'
    },
    {
        id: 'motivation',
        keys: ['motivación', 'motivation', 'motivado', 'motivated', 'ganas', 'quiero', 'want to', 'no quiero', 'do not want', 'flojo', 'lazy', 'procrastin'],
        es: '🔥 **¿Cómo recuperar la motivación?**\n\n1. **Empieza con 2 minutos**: comprométete a solo 2 minutos de la tarea. El inicio es lo más difícil.\n2. **Recompénsate**: define qué ganarás al terminar (no solo NeuroCoins 😄).\n3. **Conecta con el propósito**: ¿para qué sirve esto en tu vida real?\n4. **Cambio de ambiente**: un lugar diferente activa el cerebro.\n\n¡Tú puedes! Un pequeño paso hoy vale más que un gran plan mañana. 💪',
        en: '🔥 **How to recover motivation?**\n\n1. **Start with 2 minutes**: commit to just 2 minutes of the task. The start is the hardest part.\n2. **Reward yourself**: define what you will gain when done.\n3. **Connect with purpose**: how does this help your real life?\n4. **Change environment**: a different place activates the brain.\n\nYou can do it! One small step today is worth more than a big plan tomorrow. 💪'
    },
    {
        id: 'stress',
        keys: ['estrés', 'stress', 'estresado', 'stressed', 'agobiad', 'overwhelmed', 'presión', 'pressure', 'mucho trabajo', 'too much work'],
        es: '🧘 Cuando el estrés llega, tu cerebro entra en modo supervivencia. **Salimos de ahí así:**\n\n1. **Para todo** por 3 minutos.\n2. **Respira**: 4 seg inhala, 4 aguanta, 6 exhala. Repite 5 veces.\n3. **Escribe** todas las tareas pendientes en papel — sácalas de la cabeza.\n4. **Elige UNA** tarea para ahora. Solo una.\n\nEl cerebro con TDAH se bloquea ante múltiples demandas. La clave es simplificar. 💙',
        en: '🧘 When stress arrives, your brain enters survival mode. **We exit like this:**\n\n1. **Stop everything** for 3 minutes.\n2. **Breathe**: 4s inhale, 4 hold, 6 exhale. Repeat 5 times.\n3. **Write** all pending tasks on paper — get them out of your head.\n4. **Pick ONE** task for now. Just one.\n\nThe ADHD brain blocks with multiple demands. Simplifying is the key. 💙'
    },
    {
        id: 'games',
        keys: ['juego', 'game', 'jugar', 'play', 'simulador', 'simulator', 'misión', 'mission', 'qué juego', 'which game', 'recomienda', 'recommend'],
        es: '🎮 **Los 8 simuladores de NeuroSpark** y qué entrenan:\n\n- 🛸 **Cazadores de Distracciones** → Atención selectiva\n- 🌌 **Viaje Espacial** → Atención sostenida\n- 🧩 **Constructor de Rutinas** → Planificación\n- 🚦 **Semáforo Emocional** → Control de impulsos\n- 🎵 **Memoria Musical** → Memoria de trabajo\n- 🃏 **Cartas de Memoria** → Memoria visual\n- 🧩 **Buscador de Patrones** → Flexibilidad cognitiva\n- 🧮 **Astro Matemáticas** → Velocidad de procesamiento\n\n¿Cuál quieres intentar primero?',
        en: '🎮 **NeuroSpark\'s 8 simulators** and what they train:\n\n- 🛸 **Distraction Hunters** → Selective attention\n- 🌌 **Spatial Journey** → Sustained attention\n- 🧩 **Routine Builder** → Planning\n- 🚦 **Emotional Stoplight** → Impulse control\n- 🎵 **Musical Memory** → Working memory\n- 🃏 **Memory Cards** → Visual memory\n- 🧩 **Pattern Matcher** → Cognitive flexibility\n- 🧮 **Astro Math** → Processing speed\n\nWhich one do you want to try first?'
    },
    {
        id: 'impulse',
        keys: ['impulsiv', 'impulso', 'impulse', 'control', 'reaccion', 'reaction', 'paro', 'stop myself', 'antes de actuar', 'before acting'],
        es: '⚡ **Control de impulsos — técnicas rápidas:**\n\n- **Pausa de 5 segundos**: antes de actuar, cuenta mentalmente 5-4-3-2-1.\n- **"¿Lo lamentaré?"**: pregúntate si en 10 minutos te arrepentirás.\n- **Frío físico**: agua fría en la cara o muñecas activa el nervio vago.\n- **Juego recomendado**: 🚦 *Semáforo Emocional* es perfecto para entrenar esto.\n\n¡El autocontrol es un músculo que se entrena! 💪',
        en: '⚡ **Impulse control — quick techniques:**\n\n- **5-second pause**: before acting, mentally count 5-4-3-2-1.\n- **"Will I regret it?"**: ask yourself if in 10 minutes you will be sorry.\n- **Physical cold**: cold water on face or wrists activates the vagus nerve.\n- **Recommended game**: 🚦 *Emotional Stoplight* is perfect for training this.\n\nSelf-control is a muscle you can train! 💪'
    },
    {
        id: 'nutrition',
        keys: ['comida', 'food', 'nutrición', 'nutrition', 'comer', 'eat', 'dieta', 'diet', 'cerebro y comida', 'brain food'],
        es: '🥦 **Alimentación para el cerebro con TDAH:**\n\n- **Omega-3** (pescado, nueces, chía): mejoran la comunicación neuronal.\n- **Proteínas en el desayuno**: estabilizan la dopamina todo el día.\n- **Evita azúcar en picos**: los picos glucémicos generan bajones de atención.\n- **Hidratación**: un cerebro deshidratado al 2% pierde el 20% del rendimiento.\n\n¡Comer bien no es opcional, es neuroeducación! 🍳',
        en: '🥦 **Nutrition for the ADHD brain:**\n\n- **Omega-3** (fish, walnuts, chia): improve neural communication.\n- **Protein at breakfast**: stabilizes dopamine all day.\n- **Avoid sugar spikes**: glycemic spikes cause attention crashes.\n- **Hydration**: a 2% dehydrated brain loses 20% of performance.\n\nEating well is not optional, it is neuroeducation! 🍳'
    },
    {
        id: 'exercise',
        keys: ['ejercicio', 'exercise', 'deporte', 'sport', 'actividad física', 'physical activity', 'moverme', 'move', 'correr', 'run'],
        es: '🏃 **El ejercicio es el mejor medicamento natural** para el TDAH:\n\n- **20-30 min** de ejercicio aeróbico aumentan dopamina y norepinefrina hasta 4 horas.\n- Lo mejor: **antes de estudiar**, no después.\n- No necesita ser intenso: caminar, bailar, saltar la cuerda.\n- En NeuroSpark, las *Pausas Activas* de Sparky tienen este mismo efecto.\n\n¡Muévete y tu cerebro te lo agradecerá! 🧠⚡',
        en: '🏃 **Exercise is the best natural medicine** for ADHD:\n\n- **20-30 min** of aerobic exercise boosts dopamine and norepinephrine for up to 4 hours.\n- Best timing: **before studying**, not after.\n- Does not need to be intense: walking, dancing, jumping rope.\n- In NeuroSpark, Sparky\'s *Active Breaks* have the same effect.\n\nMove your body and your brain will thank you! 🧠⚡'
    },
    {
        id: 'organization',
        keys: ['organizar', 'organize', 'orden', 'order', 'planificar', 'plan', 'agenda', 'horario', 'schedule', 'rutina', 'routine'],
        es: '📅 **Sistema de organización para TDAH:**\n\n1. **Una sola lista**: no muchas listas, solo una. Todo ahí.\n2. **Prioridad ABC**: A = urgente/importante, B = importante, C = algún día.\n3. **Bloques de tiempo**: asigna tareas a horas específicas, no solo a días.\n4. **Revisión nocturna**: 5 min antes de dormir planea el día siguiente.\n\nEl juego *Constructor de Rutinas* te entrena en planificación real. 🧩',
        en: '📅 **Organization system for ADHD:**\n\n1. **One single list**: not many lists, just one. Everything there.\n2. **ABC priority**: A = urgent/important, B = important, C = someday.\n3. **Time blocks**: assign tasks to specific hours, not just days.\n4. **Night review**: 5 min before sleep plan the next day.\n\nThe *Routine Builder* game trains you in real planning. 🧩'
    },
    {
        id: 'neurodiversity',
        keys: ['neurodiversidad', 'neurodiversity', 'diferente', 'different', 'especial', 'special', 'superpoder', 'superpower', 'discapacidad', 'disability'],
        es: '🌈 **La neurodiversidad es una fortaleza, no un defecto.**\n\nCelebres con TDAH y/o neurodiversidad:\n- **Albert Einstein** — física teórica\n- **Simone Biles** — gimnasta más condecorada de la historia\n- **Justin Timberlake** — música y entretenimiento\n- **Emma Watson** — actriz y activista\n\nTu cerebro procesa el mundo de manera única. NeuroSpark existe para ayudarte a canalizar eso. ⚡',
        en: '🌈 **Neurodiversity is a strength, not a flaw.**\n\nFamous people with ADHD and/or neurodiversity:\n- **Albert Einstein** — theoretical physics\n- **Simone Biles** — most decorated gymnast in history\n- **Justin Timberlake** — music and entertainment\n- **Emma Watson** — actress and activist\n\nYour brain processes the world uniquely. NeuroSpark exists to help you channel that. ⚡'
    }
];

function getBotResponse(query, mode, lang) {
    const q = query.toLowerCase();
    const isEs = lang === 'es' || !lang;

    // Try to match an intent
    for (const intent of intents) {
        if (intent.keys.some(k => q.includes(k))) {
            return isEs ? intent.es : intent.en;
        }
    }

    // Contextual fallback based on mode
    if (mode === 'kids') {
        return isEs
            ? '🤔 ¡Buena pregunta! No tengo una respuesta exacta para eso ahora mismo, pero sé que eres súper inteligente. ¿Qué tal si jugamos un poco y luego lo pensamos juntos? 🚀'
            : '🤔 Great question! I do not have an exact answer for that right now, but I know you are super smart. How about we play a game and think about it together? 🚀';
    }

    return isEs
        ? `💡 Interesante pregunta. Como NeuroCoach, te sugiero abordarla con el método **"Divide y Vencerás"**:\n\n1. Define el problema en una oración.\n2. Identifica qué necesitas saber.\n3. Busca en bloques de 15 min.\n4. Sintetiza lo aprendido.\n\n¿Quieres que profundice en algo específico?`
        : `💡 Interesting question. As your NeuroCoach, I suggest tackling it with the **"Divide and Conquer"** method:\n\n1. Define the problem in one sentence.\n2. Identify what you need to know.\n3. Research in 15-min blocks.\n4. Synthesize what you learned.\n\nWant me to go deeper on something specific?`;
}

// ── Cloudflare Worker router ─────────────────────────────────────────────────
function corsHeaders(request) {
    const requestOrigin = request.headers.get('origin');
    if (!requestOrigin) return {};

    const workerOrigin = new URL(request.url).origin;
    if (requestOrigin !== workerOrigin) {
        return {};
    }

    return {
        'Access-Control-Allow-Origin': requestOrigin,
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Vary': 'Origin'
    };
}

function apiResponse(request, payload, status = 200) {
    return jsonResponse(payload, status, corsHeaders(request));
}

async function handleApiRequest(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders(request)
        });
    }

    if (request.method === 'GET' && pathname === '/api/health') {
        return apiResponse(request, {
            status: 'ok',
            worker: 'running'
        });
    }

    if (request.method === 'GET' && pathname === '/api/config/supabase') {
        const {
            configuration,
            missingVariables,
            invalidVariables
        } = publicSupabaseConfiguration(env);

        console.log(
            `[Supabase Config] GET ${url.origin}/api/config/supabase`
            + ` -> proyecto ${configuration.projectUrl || '(no disponible)'}`,
            {
                supabaseUrlConfigured: Boolean(configuration.supabaseUrl),
                supabaseUrlNormalized: configuration.urlWasNormalized,
                anonKeyConfigured: configuration.anon.configured,
                serviceRoleConfigured: configuration.service.configured
            }
        );

        if (missingVariables.length || invalidVariables.length) {
            const code = missingVariables.length
                ? 'supabase_public_config_missing'
                : 'supabase_public_config_invalid';
            const errorMessage = missingVariables.length
                ? `Faltan variables del Worker: ${missingVariables.join(', ')}.`
                : 'La configuración pública de Supabase contiene valores inválidos.';

            console.error('[Worker Configuration Error]', {
                endpoint: pathname,
                status: 503,
                message: errorMessage,
                stack: null,
                missingVariables,
                invalidVariables
            });
            return apiResponse(request, {
                error: errorMessage,
                code,
                missingVariables,
                invalidVariables
            }, 503);
        }

        // La clave administrativa nunca forma parte de esta respuesta.
        return apiResponse(request, {
            url: configuration.supabaseUrl,
            anonKey: configuration.supabaseAnonKey
        });
    }

    if (request.method === 'GET' && pathname === '/api/health/supabase') {
        const result = await verifySupabaseServerConnection(env);
        return apiResponse(request, result, result.ok ? 200 : 503);
    }

    if (request.method === 'POST' && pathname === '/api/auth/register-family') {
        const payload = await readJsonBody(request);
        const data = await registerFamily(payload, env);
        return apiResponse(request, data, 201);
    }

    if (request.method === 'POST' && pathname === '/api/auth/login') {
        const payload = await readJsonBody(request);
        const data = await loginUser(payload, env);
        return apiResponse(request, data);
    }

    if (request.method === 'POST' && pathname === '/api/auth/logout') {
        const payload = await readJsonBody(request);
        const data = await logoutUser(request, payload, env);
        return apiResponse(request, data);
    }

    if (
        request.method === 'POST'
        && pathname === '/api/auth/sync-family-password'
    ) {
        const payload = await readJsonBody(request);
        const data = await syncFamilyPassword(request, payload, env);
        return apiResponse(request, data);
    }

    if (request.method === 'POST' && pathname === '/api/chat') {
        const { query, mode, lang } = await readJsonBody(request);
        if (typeof query !== 'string' || !query.trim()) {
            throw new ApiError(400, 'La consulta no es válida.', 'invalid_chat_query');
        }
        return apiResponse(request, {
            response: getBotResponse(query, mode, lang)
        });
    }

    return apiResponse(request, {
        error: 'Ruta de API no encontrada.',
        code: 'api_route_not_found',
        path: pathname
    }, 404);
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        try {
            if (url.pathname.startsWith('/api/')) {
                return await handleApiRequest(request, env);
            }

            if (!env.ASSETS || typeof env.ASSETS.fetch !== 'function') {
                throw new ApiError(
                    500,
                    'El binding ASSETS no está configurado.',
                    'assets_binding_missing'
                );
            }

            return env.ASSETS.fetch(request);
        } catch (error) {
            const status = Number(error.status) || 500;
            const code = error.code || 'worker_error';
            console.error('[Worker Error]', {
                endpoint: url.pathname,
                method: request.method,
                status,
                code,
                message: error.message || 'Error interno del Worker.',
                stack: error.stack || null,
                missingVariables: error.details?.missingVariables || [],
                invalidVariables: error.details?.invalidVariables || [],
                details: error.details || null
            });
            const payload = {
                error: error.message || 'Error interno del Worker.',
                code
            };
            if (error.details) payload.details = error.details;
            return apiResponse(request, payload, status);
        }
    }
};
