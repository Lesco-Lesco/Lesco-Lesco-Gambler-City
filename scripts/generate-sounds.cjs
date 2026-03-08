/**
 * generate-sounds.cjs — Procedural Lo-Fi Sound Generator
 * Generates all WAV audio files for Lesco Lesco Gambler City.
 * Theme: 90s Rio de Janeiro suburb, lo-fi gritty aesthetic.
 *
 * Usage: node scripts/generate-sounds.cjs
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'assets', 'audio');
const SAMPLE_RATE = 22050; // Lo-fi sample rate for gritty feel

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ─── WAV Writer ───────────────────────────────────────────────
function writeWav(filename, samples, sampleRate = SAMPLE_RATE) {
    const numSamples = samples.length;
    const bytesPerSample = 2; // 16-bit
    const dataSize = numSamples * bytesPerSample;
    const buffer = Buffer.alloc(44 + dataSize);

    // RIFF header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);

    // fmt chunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);        // chunk size
    buffer.writeUInt16LE(1, 20);         // PCM format
    buffer.writeUInt16LE(1, 22);         // mono
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * bytesPerSample, 28);
    buffer.writeUInt16LE(bytesPerSample, 32);
    buffer.writeUInt16LE(16, 34);        // bits per sample

    // data chunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);

    for (let i = 0; i < numSamples; i++) {
        const val = Math.max(-1, Math.min(1, samples[i]));
        buffer.writeInt16LE(Math.round(val * 32767), 44 + i * 2);
    }

    const filepath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filepath, buffer);
    console.log(`  ✔ ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`);
}

// ─── DSP Utilities ────────────────────────────────────────────

function noise() { return Math.random() * 2 - 1; }

function sine(freq, t) { return Math.sin(2 * Math.PI * freq * t); }

function square(freq, t) { return sine(freq, t) > 0 ? 1 : -1; }

function saw(freq, t) { return 2 * (freq * t % 1) - 1; }

function triangle(freq, t) { return 2 * Math.abs(2 * (freq * t % 1) - 1) - 1; }

/** Apply simple low-pass filter (1-pole) */
function lowPass(samples, cutoff) {
    const rc = 1.0 / (2 * Math.PI * cutoff);
    const dt = 1.0 / SAMPLE_RATE;
    const alpha = dt / (rc + dt);
    const out = new Float64Array(samples.length);
    out[0] = samples[0];
    for (let i = 1; i < samples.length; i++) {
        out[i] = out[i - 1] + alpha * (samples[i] - out[i - 1]);
    }
    return out;
}

/** Apply envelope (attack, decay, sustain level, release) in seconds */
function applyEnvelope(samples, attack, decay, sustainLevel, release) {
    const len = samples.length;
    const attackSamples = Math.floor(attack * SAMPLE_RATE);
    const decaySamples = Math.floor(decay * SAMPLE_RATE);
    const releaseSamples = Math.floor(release * SAMPLE_RATE);
    const sustainEnd = len - releaseSamples;

    for (let i = 0; i < len; i++) {
        let env = 1;
        if (i < attackSamples) {
            env = i / attackSamples;
        } else if (i < attackSamples + decaySamples) {
            const d = (i - attackSamples) / decaySamples;
            env = 1 - d * (1 - sustainLevel);
        } else if (i < sustainEnd) {
            env = sustainLevel;
        } else {
            const r = (i - sustainEnd) / releaseSamples;
            env = sustainLevel * (1 - r);
        }
        samples[i] *= env;
    }
    return samples;
}

/** Add lo-fi degradation (bit crush + noise) */
function loFi(samples, bits = 8, noiseAmount = 0.02) {
    const levels = Math.pow(2, bits);
    for (let i = 0; i < samples.length; i++) {
        // Bit crush
        samples[i] = Math.round(samples[i] * levels) / levels;
        // Add subtle noise
        samples[i] += noise() * noiseAmount;
    }
    return samples;
}

/** Simple reverb (comb filter) */
function addReverb(samples, delay = 0.08, decay = 0.3) {
    const delaySamples = Math.floor(delay * SAMPLE_RATE);
    const out = new Float64Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
        out[i] = samples[i];
        if (i >= delaySamples) {
            out[i] += out[i - delaySamples] * decay;
        }
    }
    return out;
}

/** Mix two sample arrays */
function mix(a, b, bVolume = 1) {
    const len = Math.max(a.length, b.length);
    const out = new Float64Array(len);
    for (let i = 0; i < len; i++) {
        out[i] = (i < a.length ? a[i] : 0) + (i < b.length ? b[i] * bVolume : 0);
    }
    return out;
}

/** Generate samples of given duration */
function makeSamples(duration) {
    return new Float64Array(Math.floor(duration * SAMPLE_RATE));
}

// ─── Sound Generators ─────────────────────────────────────────

function genMenuSelect() {
    const dur = 0.08;
    const samples = makeSamples(dur);
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        samples[i] = square(1200 + t * 2000, t) * 0.3;
    }
    applyEnvelope(samples, 0.005, 0.03, 0.2, 0.03);
    return loFi(lowPass(samples, 4000), 10, 0.01);
}

function genMenuConfirm() {
    const dur = 0.15;
    const samples = makeSamples(dur);
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        samples[i] = sine(800, t) * 0.3 + sine(1200, t) * 0.2;
    }
    applyEnvelope(samples, 0.01, 0.05, 0.3, 0.06);
    return loFi(lowPass(samples, 3500), 10, 0.01);
}

function genMenuBack() {
    const dur = 0.12;
    const samples = makeSamples(dur);
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        samples[i] = sine(600 - t * 1500, t) * 0.3;
    }
    applyEnvelope(samples, 0.005, 0.04, 0.2, 0.05);
    return loFi(lowPass(samples, 3000), 10, 0.01);
}

function genDialogueBip() {
    const dur = 0.05;
    const samples = makeSamples(dur);
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        samples[i] = sine(1200 + t * 400, t) * 0.25;
    }
    applyEnvelope(samples, 0.002, 0.01, 0.3, 0.02);
    return loFi(lowPass(samples, 3500), 9, 0.01);
}

function genCoinGain() {
    const dur = 0.35;
    const samples = makeSamples(dur);
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        // Rising arpeggio
        const note = Math.floor(t * 12) * 200 + 600;
        samples[i] = triangle(note, t) * 0.3 + sine(note * 1.5, t) * 0.1;
    }
    applyEnvelope(samples, 0.01, 0.08, 0.4, 0.1);
    return loFi(addReverb(lowPass(samples, 5000), 0.05, 0.2), 10, 0.015);
}

function genCoinLoss() {
    const dur = 0.4;
    const samples = makeSamples(dur);
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        // Descending tone
        samples[i] = saw(400 - t * 600, t) * 0.25;
    }
    applyEnvelope(samples, 0.01, 0.1, 0.3, 0.15);
    return loFi(lowPass(samples, 2500), 8, 0.02);
}

function genBetPlace() {
    const dur = 0.15;
    const samples = makeSamples(dur);
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        // Chip drop: noise burst filtered
        samples[i] = noise() * 0.4 * Math.exp(-t * 30);
        samples[i] += sine(2000, t) * 0.15 * Math.exp(-t * 20);
    }
    return loFi(lowPass(samples, 4000), 10, 0.01);
}

function genCardDeal() {
    const dur = 0.12;
    const samples = makeSamples(dur);
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        // Sliding friction
        samples[i] = noise() * 0.35 * Math.exp(-t * 25);
        samples[i] += sine(3000 + noise() * 500, t) * 0.05;
    }
    return loFi(lowPass(samples, 5000), 10, 0.01);
}

function genCardFlip() {
    const dur = 0.1;
    const samples = makeSamples(dur);
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        samples[i] = noise() * 0.3 * Math.exp(-t * 35);
        samples[i] += sine(1500, t) * 0.1 * Math.exp(-t * 20);
    }
    return loFi(lowPass(samples, 6000), 10, 0.01);
}

function genDiceRoll() {
    const dur = 0.5;
    const samples = makeSamples(dur);
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        // Rattling noise with rhythmic bumps
        const bump = Math.sin(t * 60) > 0.7 ? 1.5 : 1;
        samples[i] = noise() * 0.3 * bump * Math.exp(-t * 3);
        samples[i] += sine(200 + Math.random() * 100, t) * 0.1 * Math.exp(-t * 5);
    }
    return loFi(lowPass(samples, 3500), 9, 0.015);
}

function genDiceLand() {
    const dur = 0.2;
    const samples = makeSamples(dur);
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        samples[i] = noise() * 0.5 * Math.exp(-t * 20);
        samples[i] += sine(300, t) * 0.2 * Math.exp(-t * 15);
    }
    return loFi(lowPass(samples, 3000), 9, 0.02);
}

function genCoinFlip() {
    const dur = 0.4;
    const samples = makeSamples(dur);
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        // Metallic ring
        const ring = sine(3000, t) * 0.2 + sine(4500, t) * 0.1 + sine(6000, t) * 0.05;
        const impact = noise() * 0.3 * Math.exp(-t * 15);
        samples[i] = (ring * Math.exp(-t * 8) + impact);
    }
    return loFi(lowPass(samples, 5000), 10, 0.01);
}

function genSlotSpin() {
    const dur = 1.2;
    const samples = makeSamples(dur);
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        // Mechanical reel ticking
        const tick = Math.sin(t * 220) > 0.9 ? 0.4 : 0;
        samples[i] = tick + noise() * 0.08;
        samples[i] += saw(80 + t * 20, t) * 0.06;
    }
    applyEnvelope(samples, 0.05, 0.1, 0.7, 0.3);
    return loFi(lowPass(samples, 3000), 9, 0.02);
}

function genSlotStop() {
    const dur = 0.2;
    const samples = makeSamples(dur);
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        samples[i] = noise() * 0.3 * Math.exp(-t * 20);
        samples[i] += sine(500, t) * 0.3 * Math.exp(-t * 15);
    }
    return loFi(lowPass(samples, 4000), 10, 0.01);
}

function genSlotJackpot() {
    const dur = 1.5;
    const samples = makeSamples(dur);
    const notes = [523, 659, 784, 1047, 784, 1047, 1319];
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        const noteIdx = Math.min(Math.floor(t * 5), notes.length - 1);
        const freq = notes[noteIdx];
        samples[i] = square(freq, t) * 0.15 + sine(freq, t) * 0.2 + triangle(freq * 2, t) * 0.08;
    }
    applyEnvelope(samples, 0.02, 0.1, 0.5, 0.3);
    return loFi(addReverb(lowPass(samples, 4000), 0.06, 0.25), 10, 0.015);
}

function genWinSmall() {
    const dur = 0.5;
    const samples = makeSamples(dur);
    const notes = [660, 880, 1100];
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        const noteIdx = Math.min(Math.floor(t * 6), notes.length - 1);
        samples[i] = triangle(notes[noteIdx], t) * 0.3;
    }
    applyEnvelope(samples, 0.01, 0.05, 0.4, 0.15);
    return loFi(addReverb(lowPass(samples, 4500), 0.04, 0.2), 10, 0.01);
}

function genWinBig() {
    const dur = 1.0;
    const samples = makeSamples(dur);
    const notes = [523, 659, 784, 1047, 1319, 1568];
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        const noteIdx = Math.min(Math.floor(t * 6), notes.length - 1);
        const freq = notes[noteIdx];
        samples[i] = square(freq, t) * 0.12 + sine(freq, t) * 0.2 + sine(freq * 2, t) * 0.08;
    }
    applyEnvelope(samples, 0.02, 0.08, 0.45, 0.25);
    return loFi(addReverb(lowPass(samples, 5000), 0.07, 0.3), 10, 0.015);
}

function genLose() {
    const dur = 0.6;
    const samples = makeSamples(dur);
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        // Descending minor tone
        const freq = 400 - t * 300;
        samples[i] = saw(freq, t) * 0.2 + sine(freq * 0.5, t) * 0.15;
    }
    applyEnvelope(samples, 0.02, 0.1, 0.35, 0.2);
    return loFi(lowPass(samples, 2000), 8, 0.025);
}

function genDraw() {
    const dur = 0.3;
    const samples = makeSamples(dur);
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        samples[i] = sine(440, t) * 0.25 + sine(550, t) * 0.15;
    }
    applyEnvelope(samples, 0.02, 0.05, 0.3, 0.1);
    return loFi(lowPass(samples, 3000), 10, 0.01);
}

function genArcadeInsert() {
    const dur = 0.35;
    const samples = makeSamples(dur);
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        // Coin sliding then ding
        if (t < 0.15) {
            samples[i] = noise() * 0.2 * Math.exp(-t * 8);
        } else {
            const tt = t - 0.15;
            samples[i] = sine(2000, tt) * 0.3 * Math.exp(-tt * 12);
            samples[i] += sine(3000, tt) * 0.15 * Math.exp(-tt * 15);
        }
    }
    return loFi(lowPass(samples, 5000), 10, 0.01);
}

function genArcadeHit() {
    const dur = 0.15;
    const samples = makeSamples(dur);
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        samples[i] = noise() * 0.5 * Math.exp(-t * 25);
        samples[i] += square(150, t) * 0.2 * Math.exp(-t * 20);
    }
    return loFi(lowPass(samples, 3000), 8, 0.02);
}

function genArcadeShoot() {
    const dur = 0.2;
    const samples = makeSamples(dur);
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        // Pew pew — descending square wave
        samples[i] = square(1500 - t * 5000, t) * 0.25 * Math.exp(-t * 10);
        samples[i] += noise() * 0.1 * Math.exp(-t * 15);
    }
    return loFi(lowPass(samples, 4000), 9, 0.015);
}

function genArcadeBounce() {
    const dur = 0.1;
    const samples = makeSamples(dur);
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        samples[i] = sine(800 + t * 3000, t) * 0.3 * Math.exp(-t * 20);
    }
    return loFi(lowPass(samples, 5000), 10, 0.01);
}

function genArcadeExplosion() {
    const dur = 0.6;
    const samples = makeSamples(dur);
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        samples[i] = noise() * 0.6 * Math.exp(-t * 5);
        samples[i] += sine(60 + noise() * 30, t) * 0.3 * Math.exp(-t * 4);
    }
    return loFi(lowPass(samples, 2000), 7, 0.03);
}

function genPoliceSiren() {
    const dur = 2.0;
    const samples = makeSamples(dur);
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        // Classic two-tone siren
        const freq = 600 + Math.sin(t * 4) * 200;
        samples[i] = square(freq, t) * 0.15 + sine(freq, t) * 0.15;
    }
    applyEnvelope(samples, 0.1, 0.2, 0.5, 0.4);
    return loFi(lowPass(samples, 3000), 9, 0.02);
}

function genPoliceWhistle() {
    const dur = 0.8;
    const samples = makeSamples(dur);
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        const freq = 2500 + Math.sin(t * 8) * 300;
        samples[i] = sine(freq, t) * 0.25 + noise() * 0.05;
    }
    applyEnvelope(samples, 0.02, 0.05, 0.6, 0.15);
    return loFi(lowPass(samples, 6000), 10, 0.01);
}

function genFootstep() {
    const dur = 0.12;
    const samples = makeSamples(dur);
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        samples[i] = noise() * 0.35 * Math.exp(-t * 30);
        samples[i] += sine(100 + Math.random() * 50, t) * 0.15 * Math.exp(-t * 25);
    }
    return loFi(lowPass(samples, 2000), 8, 0.02);
}

function genDoorEnter() {
    const dur = 0.4;
    const samples = makeSamples(dur);
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        // Creaky door + thud
        if (t < 0.25) {
            samples[i] = sine(300 + t * 800, t) * 0.2 + noise() * 0.08;
        } else {
            const tt = t - 0.25;
            samples[i] = noise() * 0.4 * Math.exp(-tt * 20);
            samples[i] += sine(80, tt) * 0.2 * Math.exp(-tt * 15);
        }
    }
    return loFi(lowPass(samples, 2500), 9, 0.02);
}

function genDoorExit() {
    const dur = 0.3;
    const samples = makeSamples(dur);
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        samples[i] = noise() * 0.3 * Math.exp(-t * 15);
        samples[i] += sine(200 - t * 300, t) * 0.15;
    }
    applyEnvelope(samples, 0.01, 0.05, 0.3, 0.1);
    return loFi(lowPass(samples, 2500), 9, 0.02);
}

function genGameOver() {
    const dur = 2.0;
    const samples = makeSamples(dur);
    // Dramatic descending minor chord
    const notes = [392, 349, 330, 262, 196];
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        const noteIdx = Math.min(Math.floor(t * 2.5), notes.length - 1);
        const freq = notes[noteIdx];
        samples[i] = saw(freq, t) * 0.15 + sine(freq * 0.5, t) * 0.15 + square(freq, t) * 0.05;
    }
    applyEnvelope(samples, 0.05, 0.2, 0.4, 0.6);
    return loFi(addReverb(lowPass(samples, 2500), 0.1, 0.35), 8, 0.025);
}

function genGameStart() {
    const dur = 0.8;
    const samples = makeSamples(dur);
    const notes = [262, 330, 392, 523];
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        const noteIdx = Math.min(Math.floor(t * 5), notes.length - 1);
        const freq = notes[noteIdx];
        samples[i] = triangle(freq, t) * 0.25 + sine(freq * 2, t) * 0.1;
    }
    applyEnvelope(samples, 0.02, 0.05, 0.5, 0.2);
    return loFi(addReverb(lowPass(samples, 4500), 0.05, 0.2), 10, 0.01);
}

function genAmbientNight() {
    const dur = 8.0; // 8 second loop
    const samples = makeSamples(dur);

    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;

        // Base: low rumble (distant traffic / city hum)
        let s = sine(45, t) * 0.04 + sine(60, t) * 0.03;

        // Crickets: high-freq intermittent chirps
        const cricketPhase = Math.sin(t * 2.3) * 0.5 + 0.5;
        if (cricketPhase > 0.7) {
            s += sine(4200 + Math.sin(t * 180) * 200, t) * 0.03;
        }

        // Distant dog barks (periodic bursts)
        const dogPhase = Math.sin(t * 0.8 + 1.5);
        if (dogPhase > 0.92) {
            s += noise() * 0.04 * Math.sin(t * 50);
        }

        // Muffled bass (distant funk/samba)
        s += sine(80, t) * 0.025 * (Math.sin(t * 0.5) * 0.5 + 0.5);
        s += sine(120, t) * 0.015 * (Math.sin(t * 1.3) * 0.5 + 0.5);

        // General atmospheric noise floor
        s += noise() * 0.015;

        samples[i] = s;
    }

    return loFi(lowPass(samples, 3000), 10, 0.008);
}

function genAmbientCasino() {
    const dur = 6.0; // 6 second loop
    const samples = makeSamples(dur);

    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;

        // Electric buzz (fluorescent lights)
        let s = sine(120, t) * 0.03 + sine(240, t) * 0.015;

        // Muffled chatter
        s += noise() * 0.02 * (Math.sin(t * 3) * 0.3 + 0.7);

        // Occasional clinking
        const clink = Math.sin(t * 7.1 + 2);
        if (clink > 0.95) {
            s += sine(3500, t) * 0.04 * Math.exp(-(t % 1) * 15);
        }

        // Subtle machine hum
        s += saw(55, t) * 0.01;

        // Noise floor
        s += noise() * 0.01;

        samples[i] = s;
    }

    return loFi(lowPass(samples, 2500), 10, 0.008);
}

// ─── Generate All Sounds ──────────────────────────────────────

console.log('\n🎵 Generating Lo-Fi Sound Effects...\n');

// UI / Navigation
writeWav('menu_select.wav', genMenuSelect());
writeWav('menu_confirm.wav', genMenuConfirm());
writeWav('menu_back.wav', genMenuBack());
writeWav('dialogue_bip.wav', genDialogueBip());
writeWav('dialogue_bip.wav', genDialogueBip());

// Economy
writeWav('coin_gain.wav', genCoinGain());
writeWav('coin_loss.wav', genCoinLoss());

// Minigames
writeWav('bet_place.wav', genBetPlace());
writeWav('card_deal.wav', genCardDeal());
writeWav('card_flip.wav', genCardFlip());
writeWav('dice_roll.wav', genDiceRoll());
writeWav('dice_land.wav', genDiceLand());
writeWav('coin_flip.wav', genCoinFlip());
writeWav('slot_spin.wav', genSlotSpin());
writeWav('slot_stop.wav', genSlotStop());
writeWav('slot_jackpot.wav', genSlotJackpot());
writeWav('win_small.wav', genWinSmall());
writeWav('win_big.wav', genWinBig());
writeWav('lose.wav', genLose());
writeWav('draw.wav', genDraw());

// Arcade
writeWav('arcade_insert.wav', genArcadeInsert());
writeWav('arcade_hit.wav', genArcadeHit());
writeWav('arcade_shoot.wav', genArcadeShoot());
writeWav('arcade_bounce.wav', genArcadeBounce());
writeWav('arcade_explosion.wav', genArcadeExplosion());

// Police
writeWav('police_siren.wav', genPoliceSiren());
writeWav('police_whistle.wav', genPoliceWhistle());

// Exploration
writeWav('footstep.wav', genFootstep());
writeWav('door_enter.wav', genDoorEnter());
writeWav('door_exit.wav', genDoorExit());

// Game State
writeWav('game_over.wav', genGameOver());
writeWav('game_start.wav', genGameStart());

// Ambient Loops
writeWav('ambient_night.wav', genAmbientNight());
writeWav('ambient_casino.wav', genAmbientCasino());

console.log('\n✅ All sounds generated successfully!\n');
