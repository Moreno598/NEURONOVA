/* -------------------------------------------------------------
   NEUROSPARK AI NEUROCOACH (Sparky Assistant Engine)
   ------------------------------------------------------------- */

import { sound } from './sound.js';
import { i18n } from './i18n.js';

class NeuroCoachAI {
    constructor() {
        this.voiceEnabled = false;
        this.synth = window.speechSynthesis;
        this.attentionTracker = {
            clicksOutside: 0,
            rapidClicks: 0,
            lastClickTime: 0,
            sessionStartTime: Date.now()
        };

        // ADHD-friendly tips bilingual (key = language, value = arrays)
        this.studyTips = {
            es: {
                kids: [
                    "¡Usa la técnica de la tortuga! Cuando sientas que vas muy rápido, para, respira y piensa en tu siguiente paso. 🐢",
                    "Divide tu tarea en partes tan pequeñas como un grano de arena. ¡Una a la vez! ⏳",
                    "¡Dale un respiro a tus ojos! Mira por la ventana y busca algo de color verde por 20 segundos. 🟢",
                    "Escribe o dibuja tus ideas en un papel. No tiene que ser perfecto, ¡solo saca la energía! 🎨",
                    "Sparky dice: ¡Inténtate estirar como una estrella de mar! Estira brazos y piernas lo más que puedas. ⭐"
                ],
                teens: [
                    "**Técnica Pomodoro Adaptada:** Trabaja por 20 minutos y descansa 5. Si te cuesta arrancar, compórmete solo con 5 minutos. ⏱️",
                    "**Bloqueo de Estímulos:** Pon tu celular en otra habitación antes de empezar. El esfuerzo de ir a buscarlo frena el impulso. 📱",
                    "**Descarga Mental (Brain Dump):** Si tienes la cabeza llena de pendientes, escríbelos todos antes de estudiar. 🧠",
                    "**Pausas Activas:** En tu descanso, levántate, haz 10 saltos o toma agua. El movimiento activa la dopamina. 🏃",
                    "**Metacognición:** Si te trabas en un problema, explícaselo en voz alta a Sparky. Explicarlo ayuda a reorganizar el pensamiento. 💬"
                ]
            },
            en: {
                kids: [
                    "Use the turtle technique! When you feel you're going too fast, stop, breathe and think about your next step. 🐢",
                    "Break your task into tiny pieces like grains of sand. One at a time! ⏳",
                    "Give your eyes a rest! Look out the window and find something green for 20 seconds. 🟢",
                    "Write or draw your ideas on paper. It doesn't have to be perfect, just get the energy out! 🎨",
                    "Sparky says: Try to stretch like a starfish! Stretch your arms and legs as far as you can. ⭐"
                ],
                teens: [
                    "**Adapted Pomodoro:** Work for 20 minutes, rest for 5. If it's hard to start, commit to just 5 minutes. ⏱️",
                    "**Stimulus Blocking:** Put your phone in another room before starting. The effort of going to get it stops the impulse. 📱",
                    "**Brain Dump:** If your head is full of pending things, write them all down before studying. 🧠",
                    "**Active Breaks:** In your break, stand up, do 10 jumps or drink water. Movement activates dopamine. 🏃",
                    "**Metacognition:** If you get stuck on a problem, explain it out loud to Sparky. Explaining reorganizes thinking. 💬"
                ]
            }
        };

        this.breakSuggestions = {
            es: [
                "**Pausa del Astronauta:** Cierra los ojos, respira contando hasta 4, mantén por 4, exhala en 4. ¡Listo para despegar! 🚀",
                "**Baile de Dedos:** Junta las yemas de tus dedos una a una con el pulgar lo más rápido que puedas. 👐",
                "**Estiramiento Sparky:** Párate, entrelaza las manos y estíralas hacia el cielo. Luego déjate caer hacia tus pies. 🧘",
                "**Recarga de Hidratación:** Camina a la cocina y toma un vaso de agua fresca lentamente. 💧"
            ],
            en: [
                "**Astronaut Break:** Close your eyes, breathe in counting to 4, hold for 4, exhale for 4. Ready for liftoff! 🚀",
                "**Finger Dance:** Touch each fingertip to your thumb as fast as you can. 👐",
                "**Sparky Stretch:** Stand up, interlace your hands and stretch them up to the sky. Then let yourself fall toward your feet. 🧘",
                "**Hydration Recharge:** Walk to the kitchen and slowly drink a glass of fresh water. 💧"
            ]
        };
    }

    setVoiceEnabled(enabled, voiceMsg) {
        this.voiceEnabled = enabled;
        if (enabled) {
            this.speak(voiceMsg || i18n.t('coachVoiceOn'));
        } else {
            if (this.synth) this.synth.cancel();
        }
    }

    speak(text) {
        if (!this.voiceEnabled || !this.synth) return;
        this.synth.cancel();
        const cleanText = text.replace(/[*#_~`\[\]()]/g, '');
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = i18n.currentLang === 'en' ? 'en-US' : 'es-ES';
        utterance.rate = 1.0;
        utterance.pitch = 1.1;
        this.synth.speak(utterance);
    }

    getTip(mode) {
        const lang = i18n.currentLang;
        const tips = (this.studyTips[lang] || this.studyTips['es']);
        const list = tips[mode === 'kids' ? 'kids' : 'teens'];
        return list[Math.floor(Math.random() * list.length)];
    }

    getBreak() {
        const lang = i18n.currentLang;
        const breaks = (this.breakSuggestions[lang] || this.breakSuggestions['es']);
        return breaks[Math.floor(Math.random() * breaks.length)];
    }

    async processChatQuery(query, appState) {
        const text = query.toLowerCase().trim();
        const mode = appState.profile;
        const lang = i18n.currentLang;
        const isEs = lang !== 'en';
        let response = '';

        const has = (arr) => arr.some(k => text.includes(k));
        const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

        // ── Intent map (bilingual) ─────────────────────────────────────────
        const intents = [
            {
                keys: isEs ? ['hola','buenos','buenas','saludos','que tal','hey'] : ['hello','hi','hey','good morning','sup'],
                res: () => rand(isEs
                    ? ['¡Hola! 🌟 Aquí Sparky. ¿En qué te ayudo hoy?', '¡Hola! ¿Qué tienes en mente?', '¡Qué tal! ¿Listo para potenciar tu cerebro? 🧠']
                    : ['Hello! 🌟 Sparky here. How can I help you today?', 'Hi! What is on your mind?', 'Hey there! Ready to boost your brain? 🧠'])
            },
            {
                keys: isEs ? ['gracias','te agradezco','muy amable'] : ['thank','thanks','appreciate','cheers'],
                res: () => rand(isEs
                    ? ['¡De nada! Estoy aquí para apoyarte. 💪', '¡Para eso estoy! Recuerda hacer tus pausas. ✨']
                    : ['You are welcome! I am here to support you. 💪', 'Anytime! Remember to take your breaks. ✨'])
            },
            {
                keys: isEs ? ['tdah','hiperactividad','déficit de atención','deficit de atencion','tda '] : ['adhd','hyperactive','attention deficit','add '],
                res: () => isEs
                    ? '🧠 **¿Qué es el TDAH?**\n\nEl Trastorno por Déficit de Atención e Hiperactividad es una condición neurológica donde el cerebro regula la atención y los impulsos de manera diferente.\n\n**No es pereza ni falta de voluntad.** Es química cerebral.\n\nCon entrenamiento y estrategias correctas, el cerebro TDAH puede convertirse en un superpoder. ⚡\n\nNeuroSpark fue diseñado exactamente para esto.'
                    : '🧠 **What is ADHD?**\n\nAttention Deficit Hyperactivity Disorder is a neurological condition where the brain regulates attention and impulses differently.\n\n**It is not laziness or lack of willpower.** It is brain chemistry.\n\nWith the right training and strategies, the ADHD brain can become a superpower. ⚡\n\nNeuroSpark was designed exactly for this.'
            },
            {
                keys: isEs ? ['triste','enojado','frustrado','ansioso','estrés','estresado','agobiad','nervioso'] : ['sad','angry','frustrated','anxious','stressed','overwhelmed','nervous','worried'],
                res: () => isEs
                    ? '💙 Te entiendo. Las emociones intensas son señales de que algo necesita atención.\n\n**Técnica 5-4-3-2-1** (ancla al presente):\n- 5 cosas que *ves*\n- 4 que *tocas*\n- 3 que *escuchas*\n- 2 que *hueles*\n- 1 que *saboreas*\n\nRespiración: inhala 4 seg → aguanta 4 → exhala 6. Repite 3 veces. \n\n¡Estoy aquí para ti! 🌟'
                    : '💙 I hear you. Intense emotions are signals that something needs attention.\n\n**5-4-3-2-1 Technique** (anchors to the present):\n- 5 things you *see*\n- 4 you *touch*\n- 3 you *hear*\n- 2 you *smell*\n- 1 you *taste*\n\nBreathing: inhale 4s → hold 4s → exhale 6s. Repeat 3 times.\n\nI am here for you! 🌟'
            },
            {
                keys: isEs ? ['consejo','tip ','estrategia','estudiar','recomendación','recomendacion'] : ['tip ','advice','strategy','study','recommendation'],
                res: () => (isEs ? '💡 Aquí tienes una estrategia cognitiva:\n\n' : '💡 Here is a cognitive strategy:\n\n') + this.getTip(mode)
            },
            {
                keys: isEs ? ['cansado','fatiga','aburrido','no tengo ganas','agotado','sin energía'] : ['tired','exhausted','bored','no energy','sleepy','drained'],
                res: () => (isEs ? '😴 La fatiga mental nos pasa a todos. Pausa activa ahora:\n\n' : '😴 Mental fatigue happens to all of us. Active break right now:\n\n') + this.getBreak()
            },
            {
                keys: isEs ? ['concentra','distra','no puedo','me cuesta','perder el foco','focus'] : ['focus','distract','can not','concentrate','lose focus','hard to'],
                res: () => (isEs ? '🎯 Concentrarse no es forzar la mente, es darle espacio. Tip:\n\n' : '🎯 Focusing is not about forcing your mind, it is about giving it space. Tip:\n\n') + this.getTip(mode)
            },
            {
                keys: isEs ? ['neurocoin','moneda','puntos','tienda','shop','comprar'] : ['neurocoin','coin','points','shop','buy','store'],
                res: () => isEs
                    ? '💎 **NeuroCoins** son tu moneda de progreso.\n\n- Ganas NeuroCoins al **completar juegos** con buen desempeño.\n- Más precisión y control de impulsos = más monedas.\n- Canjéalas en la **Tienda de Sparky** por skins y personalizaciones.\n- 500 NeuroCoins = subir de nivel. ¡Sigue entrenando!'
                    : '💎 **NeuroCoins** are your progress currency.\n\n- Earn NeuroCoins by **completing games** with good performance.\n- More accuracy and impulse control = more coins.\n- Redeem them at **Sparky\'s Shop** for skins and customizations.\n- 500 NeuroCoins = level up. Keep training!'
            },
            {
                keys: isEs ? ['quien eres','qué eres','que eres','sparky','quién eres'] : ['who are you','what are you','sparky','your name','your purpose'],
                res: () => isEs
                    ? '⚡ **¡Soy Sparky!** Tu asistente IA y NeuroCoach personal.\n\n**Lo que puedo hacer por ti:**\n- 🎯 Darte estrategias de concentración y estudio\n- 😴 Sugerirte pausas activas personalizadas\n- 🧠 Explicarte qué es el TDAH y la neurodiversidad\n- 📊 Generarte un reporte cognitivo rápido\n- 💬 Escucharte cuando lo necesitas\n\nMi misión: recordarte que tu cerebro es único y poderoso. 🌟'
                    : '⚡ **I am Sparky!** Your AI assistant and personal NeuroCoach.\n\n**What I can do for you:**\n- 🎯 Give you focus and study strategies\n- 😴 Suggest personalized active breaks\n- 🧠 Explain ADHD and neurodiversity\n- 📊 Generate a quick cognitive report\n- 💬 Listen when you need it\n\nMy mission: remind you that your brain is unique and powerful. 🌟'
            },
            {
                keys: isEs ? ['reporte','cómo voy','como voy','mi progreso','estadísticas','mi avance'] : ['report','how am i','my progress','statistics','my stats'],
                res: () => this.generateQuickReport(appState)
            },
            {
                keys: isEs ? ['ayuda','cómo juego','como juego','cómo funciona','como funciona','qué hago'] : ['help','how to play','how do i','how does','what do i do'],
                res: () => mode === 'kids'
                    ? (isEs ? '🏆 ¡Es súper fácil! Elige un juego, completa la misión y gana NeuroCoins. Cada juego entrena un superpoder de tu cerebro. ¿Empezamos?' : '🏆 Super easy! Choose a game, complete the mission and earn NeuroCoins. Each game trains a brain superpower. Shall we start?')
                    : (isEs ? '📊 Tienes 8 simuladores neurocognitivos. Cada uno mide atención, control de impulsos, memoria o planificación. Juega, gana NeuroCoins y revisa tu reporte.' : '📊 You have 8 neurocognitive simulators. Each measures attention, impulse control, memory or planning. Play, earn NeuroCoins and check your report.')
            }
        ];

        // ── Match intent ───────────────────────────────────────────────────
        for (const intent of intents) {
            if (has(intent.keys)) {
                response = intent.res();
                break;
            }
        }

        // ── Fallback: call server API (with lang context) ──────────────────
        if (!response) {
            try {
                const res = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: text, mode, lang })
                });
                if (res.ok) {
                    const data = await res.json();
                    response = data.response;
                } else { throw new Error('API fail'); }
            } catch {
                response = isEs
                    ? (mode === 'kids'
                        ? '🤔 ¡Buena pregunta! No tengo una respuesta exacta para eso ahora, pero puedes preguntarme sobre: concentración, memoria, estrés, TDAH, juegos, rutinas o tu reporte. ¡Estoy aquí! 🚀'
                        : '💡 Pregunta interesante. Puedo ayudarte con: estrategias de estudio, control de impulsos, memoria, estrés, motivación, organización o tu reporte cognitivo. ¿Sobre qué profundizamos?')
                    : (mode === 'kids'
                        ? '🤔 Great question! I can help with: focus, memory, stress, ADHD, games, routines or your report. I am here! 🚀'
                        : '💡 Interesting question. I can help with: study strategies, impulse control, memory, stress, motivation, organization or your cognitive report. What shall we explore?');
            }
        }

        return response;
    }

    generateQuickReport(state) {
        const history = state.history || [];
        const lang = i18n.currentLang;
        if (history.length === 0) return i18n.t('noData');

        let totalGames = history.length;
        let avgAttention = 0, avgControl = 0;
        const totalCoins = state.coins;

        history.forEach(game => {
            avgAttention += game.metrics.attention;
            avgControl += game.metrics.impulseControl;
        });

        avgAttention = Math.round(avgAttention / totalGames);
        avgControl = Math.round(avgControl / totalGames);

        const lowAtt = avgAttention < 70
            ? (lang === 'en' ? "Rapid attentional fatigue detected. Recommend 15-minute study blocks." : "Se observa fatiga atencional rápida. Recomiendo sesiones cortas de 15 min.")
            : (lang === 'en' ? "Excellent attentional stability! Keep it up." : "¡Excelente estabilidad atencional! Sigue así.");

        return lang === 'en'
            ? `### 📊 Neuro-Report for ${state.activeProfileName}\n*   **Sessions:** ${totalGames}\n*   **Avg Sustained Attention:** ${avgAttention}%\n*   **Avg Self-Regulation:** ${avgControl}%\n*   **NeuroCoins:** ${totalCoins} 💎\n\n**NeuroCoach Suggestion:** ${lowAtt}`
            : `### 📊 Neuro-Reporte de ${state.activeProfileName}\n*   **Sesiones realizadas:** ${totalGames} misiones.\n*   **Atención Sostenida Promedio:** ${avgAttention}%\n*   **Autorregulación (Impulsividad):** ${avgControl}%\n*   **NeuroCoins Acumulados:** ${totalCoins} 💎\n\n**Sugerencia NeuroCoach:** ${lowAtt}`;
    }

    // Clinical detailed report for Parents / Teachers
    generateFullClinicalReport(state) {
        const history = state.history || [];
        const timeSpent = history.reduce((sum, item) => sum + (item.duration || 0), 0);

        let avgAttention = 0;
        let avgControl = 0;
        let avgWorkingMemory = 0;
        let avgOrganization = 0;

        let gamesCount = { distraction_hunter: 0, spatial_focus: 0, routine_builder: 0, emotional_stoplight: 0, musical_memory: 0 };

        history.forEach(item => {
            avgAttention += item.metrics.attention;
            avgControl += item.metrics.impulseControl;
            avgWorkingMemory += item.metrics.workingMemory || 0;
            avgOrganization += item.metrics.organization || 0;

            if (gamesCount[item.gameId] !== undefined) {
                gamesCount[item.gameId]++;
            }
        });

        const count = history.length || 1;
        avgAttention = Math.round(avgAttention / count);
        avgControl = Math.round(avgControl / count);
        avgWorkingMemory = Math.round(avgWorkingMemory / (gamesCount.musical_memory || 1));
        avgOrganization = Math.round(avgOrganization / (gamesCount.routine_builder || 1));

        if (!gamesCount.musical_memory) avgWorkingMemory = 70;
        if (!gamesCount.routine_builder) avgOrganization = 75;

        let subtypeSuspect = i18n.t('noData');
        let recommendation = '';

        if (avgAttention < 65 && avgControl >= 75) {
            subtypeSuspect = i18n.t('subtypeInattentive');
            recommendation = i18n.t('recInattentive');
        } else if (avgControl < 65 && avgAttention >= 70) {
            subtypeSuspect = i18n.t('subtypeHyperactive');
            recommendation = i18n.t('recHyperactive');
        } else if (avgAttention < 65 && avgControl < 65) {
            subtypeSuspect = i18n.t('subtypeCombined');
            recommendation = i18n.t('recCombined');
        } else {
            subtypeSuspect = i18n.t('subtypeBalanced');
            recommendation = i18n.t('recBalanced');
        }

        const locale = i18n.currentLang === 'en' ? 'en-US' : 'es-ES';

        return {
            date: new Date().toLocaleDateString(locale),
            profileName: state.activeProfileName,
            ageMode: state.profile === 'kids' ? i18n.t('modeKidsLabel') : i18n.t('modeTeensLabel'),
            totalSessions: history.length,
            totalMinutes: Math.round(timeSpent / 60),
            metrics: {
                attention: avgAttention,
                impulseControl: avgControl,
                workingMemory: avgWorkingMemory,
                organization: avgOrganization
            },
            subtypeSuspect,
            recommendation
        };
    }

    trackInteraction(e) {
        const now = Date.now();
        if (now - this.attentionTracker.lastClickTime < 250) {
            this.attentionTracker.rapidClicks++;
            if (this.attentionTracker.rapidClicks > 5) {
                this.triggerAlert("impulsive");
                this.attentionTracker.rapidClicks = 0;
            }
        } else {
            this.attentionTracker.rapidClicks = 0;
        }

        this.attentionTracker.lastClickTime = now;

        const isInteractive = e.target.closest('button, a, input, canvas, .task-checkbox, .store-item');
        if (!isInteractive && e.target.id !== 'dynamic-bg') {
            this.attentionTracker.clicksOutside++;
            if (this.attentionTracker.clicksOutside > 8) {
                this.triggerAlert("distracted");
                this.attentionTracker.clicksOutside = 0;
            }
        }
    }

    triggerAlert(type) {
        const widget = document.getElementById('neurocoach-widget');
        const badge = document.getElementById('coach-badge');

        if (widget) {
            widget.classList.add('pulse-alert');
            setTimeout(() => widget.classList.remove('pulse-alert'), 1000);
        }

        if (badge) {
            badge.innerText = "!";
            badge.style.display = 'flex';
        }

        sound.playPop();

        if (type === "impulsive") {
            this.speak(i18n.t('coachImpulsive'));
        } else if (type === "distracted") {
            this.speak(i18n.t('coachDistracted'));
        }
    }
}

export const coach = new NeuroCoachAI();
