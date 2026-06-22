/* -------------------------------------------------------------
   NEUROSPARK AUDIO ENGINE (Web Audio API Synthesizer)
   ------------------------------------------------------------- */

class AudioEngine {
    constructor() {
        this.ctx = null;
        this.ambientOscs = [];
        this.ambientGain = null;
        this.isMusicPlaying = false;
        this.volume = 0.5;
        this.musicVolume = 0.15;
    }

    init() {
        if (this.ctx) return;
        // Create audio context
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        
        // Master Gain
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
    }

    setVolume(value) {
        this.volume = value;
        if (this.masterGain) {
            this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
        }
    }

    playSuccess() {
        this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'triangle';
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        const now = this.ctx.currentTime;
        
        // Arpeggio
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
        osc.frequency.setValueAtTime(1046.50, now + 0.3); // C6
        
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        
        osc.start(now);
        osc.stop(now + 0.6);
    }

    playError() {
        this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        const now = this.ctx.currentTime;
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.3);
        
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        
        osc.start(now);
        osc.stop(now + 0.3);
    }

    playTone(frequency, duration, type = 'sine') {
        this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = type;
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        const now = this.ctx.currentTime;
        osc.frequency.setValueAtTime(frequency, now);
        
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        
        osc.start(now);
        osc.stop(now + duration);
    }

    playPop() {
        this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        const now = this.ctx.currentTime;
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.08);
        
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        
        osc.start(now);
        osc.stop(now + 0.08);
    }

    toggleFocusMusic() {
        this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();

        if (this.isMusicPlaying) {
            this.stopFocusMusic();
        } else {
            this.startFocusMusic();
        }
        return this.isMusicPlaying;
    }

    startFocusMusic() {
        this.isMusicPlaying = true;
        
        // Ambient Sound: Binaural Beats (100Hz and 110Hz to make a 10Hz alpha wave focus beat)
        this.ambientGain = this.ctx.createGain();
        this.ambientGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
        this.ambientGain.connect(this.masterGain);

        // Left ear oscillator
        const osc1 = this.ctx.createOscillator();
        osc1.frequency.value = 100;
        const panner1 = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
        if (panner1) {
            panner1.pan.value = -1;
            osc1.connect(panner1);
            panner1.connect(this.ambientGain);
        } else {
            osc1.connect(this.ambientGain);
        }
        
        // Right ear oscillator
        const osc2 = this.ctx.createOscillator();
        osc2.frequency.value = 110; // Binaural 10Hz diff
        const panner2 = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
        if (panner2) {
            panner2.pan.value = 1;
            osc2.connect(panner2);
            panner2.connect(this.ambientGain);
        } else {
            osc2.connect(this.ambientGain);
        }

        // Add soft musical background chord (C Maj7, F Maj7)
        const chordGain = this.ctx.createGain();
        chordGain.gain.setValueAtTime(0.04, this.ctx.currentTime);
        chordGain.connect(this.masterGain);

        const chordOscs = [];
        const frequencies = [130.81, 164.81, 196.00, 246.94]; // C major 7 notes

        frequencies.forEach(freq => {
            const osc = this.ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            
            // Soft filter
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(400, this.ctx.currentTime);
            
            osc.connect(filter);
            filter.connect(chordGain);
            osc.start();
            chordOscs.push(osc);
        });

        osc1.start();
        osc2.start();

        this.ambientOscs = [osc1, osc2, ...chordOscs];
    }

    stopFocusMusic() {
        this.isMusicPlaying = false;
        if (this.ambientOscs.length > 0) {
            this.ambientOscs.forEach(osc => {
                try { osc.stop(); } catch(e) {}
            });
            this.ambientOscs = [];
        }
    }
}

export const sound = new AudioEngine();
