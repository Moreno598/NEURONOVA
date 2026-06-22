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
        let response = '';

        // Mantenemos las keywords originales y añadimos nuevas capacidades NLP (Senior Pattern)
        const kw = {
            help: lang === 'en' ? ['help', 'how to play', 'how do i'] : ['ayuda', 'jugar', 'cómo juego', 'como juego'],
            tired: lang === 'en' ? ['tired', 'sleepy', 'bored', 'exhausted'] : ['cansado', 'sueño', 'fatiga', 'aburrido'],
            focus: lang === 'en' ? ['focus', 'distract', 'can\'t', 'concentrate'] : ['concentra', 'distra', 'no puedo'],
            coins: lang === 'en' ? ['neurocoin', 'coin', 'points'] : ['neurocoin', 'moneda', 'puntos'],
            sparky: lang === 'en' ? ['who are you', 'sparky', 'what are you'] : ['quien eres', 'quién eres', 'sparky'],
            report: lang === 'en' ? ['report', 'how am i', 'teacher', 'parent'] : ['reporte', 'docente', 'padre', 'cómo voy'],
            // --- NUEVAS INTENCIONES ---
            greeting: lang === 'en' ? ['hello', 'hi', 'hey', 'good morning'] : ['hola', 'buenos días', 'buenas tardes', 'buenas noches', 'saludos', 'que tal'],
            thanks: lang === 'en' ? ['thank', 'thanks', 'appreciate'] : ['gracias', 'te agradezco', 'muy amable', 'genial'],
            adhd: lang === 'en' ? ['what is adhd', 'adhd', 'hyperactive'] : ['qué es tdah', 'que es tdah', 'tdah', 'hiperactividad', 'déficit de atención'],
            emotion: lang === 'en' ? ['sad', 'angry', 'frustrated', 'happy', 'anxious'] : ['triste', 'enojado', 'frustrado', 'feliz', 'ansioso', 'estrés', 'estresado'],
            tips: lang === 'en' ? ['tip', 'advice', 'study'] : ['tip', 'consejo', 'estudiar', 'recomendación']
        };

        const has = (arr) => arr.some(k => text.includes(k));

        // Helper para respuestas dinámicas (evita que la IA suene repetitiva)
        const getRandomRes = (arr) => arr[Math.floor(Math.random() * arr.length)];

        // Evaluamos las nuevas intenciones primero
        if (has(kw.greeting)) {
            response = getRandomRes(
                lang === 'en' 
                ? ["Hello! 🌟 Sparky here. Ready to train?", "Hi! What's on your mind today?", "Hey there! Ready to boost your brain? 🧠"]
                : ["¡Hola! 🌟 Aquí Sparky. ¿Listo para entrenar?", "¡Hola! ¿Qué tienes en mente hoy?", "¡Qué tal! ¿Listo para potenciar tu cerebro? 🧠"]
            );
        } else if (has(kw.thanks)) {
            response = getRandomRes(
                lang === 'en'
                ? ["You're welcome! I'm here to support you. 💪", "Anytime! Remember to take your breaks. ✨"]
                : ["¡De nada! Estoy aquí para apoyarte. 💪", "¡Para eso estoy! Recuerda hacer tus pausas. ✨"]
            );
        } else if (has(kw.adhd)) {
            response = lang === 'en'
                ? "ADHD means your brain works a little differently, like a race car engine. With the right training, it becomes a superpower! 🚀"
                : "El TDAH significa que tu cerebro funciona un poco diferente, ¡como el motor de un auto de carreras! Con el entrenamiento adecuado, se convierte en un superpoder. 🚀";
        } else if (has(kw.emotion)) {
            response = lang === 'en'
                ? "I hear you. Emotions can be overwhelming sometimes. Try closing your eyes and taking 3 deep breaths. I'm here for you. 💙"
                : "Te entiendo. Las emociones pueden ser abrumadoras a veces. Intenta cerrar los ojos y respirar profundo 3 veces. Estoy aquí para ti. 💙";
        } else if (has(kw.tips)) {
            response = (lang === 'en' ? "Here is a great strategy for you:\n\n" : "Aquí tienes una excelente estrategia:\n\n") + this.getTip(mode);
        } 
        // LÍNEAS DE CÓDIGO ANTERIORES INTACTAS:
        else if (has(kw.help)) {
            response = mode === 'kids'
                ? (lang === 'en'
                    ? "It's super easy! Choose a game from the home screen. Each game trains a brain superpower like attention or memory. You earn NeuroCoins! 🏆"
                    : "¡Es súper fácil! Elige un juego de la pantalla principal. Cada juego entrena un superpoder de tu cerebro. ¡Y ganas NeuroCoins! 🏆")
                : (lang === 'en'
                    ? "You can train your executive functions with the 5 interactive simulators. Each one tracks inattention or impulsivity metrics. 📊"
                    : "Puedes entrenar tus funciones ejecutivas con los 5 simuladores. Cada uno rastrea métricas de inatención o impulsividad. 📊");
        } else if (has(kw.tired)) {
            response = (lang === 'en'
                ? "I totally understand. Mental fatigue happens to everyone. Take an active break right now:\n\n"
                : "Entiendo perfectamente. La fatiga mental nos pasa a todos. Aquí tienes una pausa activa:\n\n") + this.getBreak();
        } else if (has(kw.focus)) {
            response = (lang === 'en'
                ? "Don't worry, focus isn't about forcing your mind, it's about giving it space. Here's a tip:\n\n"
                : "No te preocupes, concentrarse no es forzar la mente, sino darle espacio. Mira este tip:\n\n") + this.getTip(mode);
        } else if (has(kw.coins)) {
            response = mode === 'kids'
                ? (lang === 'en'
                    ? "NeuroCoins are cognitive energy gems! Earn them by playing and completing missions. Use them in Sparky's shop! 💎"
                    : "¡Las NeuroCoins son gemas de energía cognitiva! Las ganas jugando y completando misiones. ¡Úsalas en la tienda de Sparky! 💎")
                : (lang === 'en'
                    ? "NeuroCoins represent your training consistency. They're based on your accuracy and impulse control. 🚀"
                    : "Las NeuroCoins representan tu constancia de entrenamiento. Se calculan basadas en tu precisión y control de impulsos. 🚀");
        } else if (has(kw.sparky)) {
            response = lang === 'en'
                ? "I'm Sparky! Your AI assistant and NeuroCoach. My mission is to help you train your brain and remind you that neurodiversity is a superpower! ⚡"
                : "¡Soy Sparky! Tu asistente IA y NeuroCoach. Mi misión es ayudarte a entrenar tu cerebro y recordarte que la neurodiversidad es un superpoder. ⚡";
        } else if (has(kw.report)) {
            response = this.generateQuickReport(appState);
        } else {
            // Advanced ChatGPT fallback via API
            try {
                const res = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: text, mode })
                });
                if (res.ok) {
                    const data = await res.json();
                    response = data.response;
                } else {
                    throw new Error("API fail");
                }
            } catch (err) {
                response = mode === 'kids'
                    ? (lang === 'en'
                        ? "Wow, great question! Training your brain is like building a rocket: it takes patience and consistency. Want to play Distraction Hunters? 🚀"
                        : "¡Wow, qué gran pregunta! Recuerda que entrenar tu cerebro requiere paciencia y constancia. ¿Quieres jugar a Cazadores de Distracciones? 🚀")
                    : (lang === 'en'
                        ? "Interesting. To optimize hyperfocus and regulate inattention, alternate structured work with kinesthetic breaks. Try a Pomodoro session?"
                        : "Interesante. Para optimizar el hiperfoco, alterna trabajo estructurado con pausas kinestésicas. ¿Probamos una sesión de Pomodoro?");
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
