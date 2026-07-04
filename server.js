const http = require('http');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const PORT = process.env.PORT || 3000;

const filesToMove = ['index.html', 'index.css', 'insignia.png', 'js', 'assets'];
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
    filesToMove.forEach(file => {
        const oldPath = path.join(__dirname, file);
        const newPath = path.join(publicDir, file);
        if (fs.existsSync(oldPath)) fs.renameSync(oldPath, newPath);
    });
}

const mimeTypes = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
    '.json': 'application/json', '.mp3': 'audio/mpeg', '.wav': 'audio/wav'
};

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

// ── Server ───────────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api/chat') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { query, mode, lang } = JSON.parse(body);
                // Small delay for typing effect
                await new Promise(resolve => setTimeout(resolve, 800));
                const response = getBotResponse(query, mode, lang);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ response }));
            } catch (err) {
                res.writeHead(400);
                res.end('Bad Request');
            }
        });
        return;
    }

    let filePath = path.join(publicDir, req.url === '/' ? 'index.html' : req.url);
    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                fs.readFile(path.join(publicDir, 'index.html'), (err2, content2) => {
                    if (err2) {
                        res.writeHead(404, { 'Content-Type': 'text/html' });
                        res.end('<h1>404 Not Found</h1>', 'utf-8');
                    } else {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(content2, 'utf-8');
                    }
                });
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`✅ NeuroSpark running on http://localhost:${PORT}`);
});
