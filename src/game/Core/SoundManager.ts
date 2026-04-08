/**
 * SoundManager — Centralized audio manager using Howler.js.
 * Singleton pattern, lo-fi aesthetic for 90s Rio de Janeiro suburb.
 * 
 * Usage:
 *   SoundManager.getInstance().play('menu_select');
 *   SoundManager.getInstance().playLoop('ambient_night');
 */

import { Howl, Howler } from 'howler';
import { MINIGAME_MUSIC_PROFILES } from './MinigameMusicProfiles';

/** Sound categories for volume control */
type SoundCategory = 'sfx' | 'ambient' | 'music';

interface SoundEntry {
    howl: Howl;
    category: SoundCategory;
}

/** All available sound names */
export type SoundName =
    // UI
    | 'menu_select' | 'menu_confirm' | 'menu_back' | 'dialogue_bip'
    // Economy
    | 'coin_gain' | 'coin_loss'
    // Minigames
    | 'bet_place' | 'card_deal' | 'card_flip'
    | 'dice_roll' | 'dice_land' | 'coin_flip'
    | 'slot_spin' | 'slot_stop' | 'slot_jackpot'
    | 'win_small' | 'win_big' | 'lose' | 'draw'
    // Arcade
    | 'arcade_insert' | 'arcade_hit' | 'arcade_shoot'
    | 'arcade_bounce' | 'arcade_explosion'
    // Achievements
    | 'achievement_unlock'
    // Police
    | 'police_siren' | 'police_whistle'
    // Exploration
    | 'footstep' | 'door_enter' | 'door_exit'
    // Game State
    | 'game_over' | 'game_start'
    // Music
    | 'music_1' | 'music_2' | 'music_3' | 'music_4' | 'music_5' | 'music_6' | 'music_7' | 'music_8' | 'music_9'
    // Ambient
    | 'ambient_night' | 'ambient_casino';

/** Volume presets per sound */
const VOLUME_MAP: Partial<Record<SoundName, number>> = {
    // Ambient should be quieter
    ambient_night: 0.2,
    ambient_casino: 0.25,
    // Footsteps subtle
    footstep: 0.07,
    // UI blips soft
    menu_select: 0.35,
    menu_confirm: 0.4,
    menu_back: 0.3,
    dialogue_bip: 0.25,
    // Wins/losses moderate
    win_small: 0.5,
    win_big: 0.55,
    lose: 0.4,
    draw: 0.35,
    // Police louder
    police_siren: 0.5,
    police_whistle: 0.45,
    // Game events
    game_over: 0.55,
    game_start: 0.5,
    // Actions 
    bet_place: 0.4,
    coin_gain: 0.45,
    coin_loss: 0.4,
    slot_spin: 0.3,
    slot_stop: 0.4,
    slot_jackpot: 0.55,
    card_deal: 0.35,
    card_flip: 0.35,
    dice_roll: 0.4,
    dice_land: 0.4,
    coin_flip: 0.4,
    // Arcade
    arcade_insert: 0.4,
    arcade_hit: 0.35,
    arcade_shoot: 0.35,
    arcade_bounce: 0.3,
    arcade_explosion: 0.45,
    // Achievement
    achievement_unlock: 0.6,
    // Doors
    door_enter: 0.4,
    door_exit: 0.35,
    // Music (Ambiently low by default)
    music_1: 0.25, music_2: 0.25, music_3: 0.25,
    music_4: 0.25, music_5: 0.25, music_6: 0.25,
    music_7: 0.25, music_8: 0.25, music_9: 0.25,
};

/** Category assignment per sound */
const CATEGORY_MAP: Partial<Record<SoundName, SoundCategory>> = {
    ambient_night: 'ambient',
    ambient_casino: 'ambient',
    music_1: 'music', music_2: 'music', music_3: 'music',
    music_4: 'music', music_5: 'music', music_6: 'music',
    music_7: 'music', music_8: 'music', music_9: 'music',
};

interface PlayOptions {
    volume?: number;
    rate?: number;
}

export class SoundManager {
    private static instance: SoundManager;
    private sounds: Map<SoundName, SoundEntry> = new Map();
    private initialized: boolean = false;
    private muted: boolean = false;

    // Volume per category (0-1)
    private categoryVolumes: Record<SoundCategory, number> = {
        sfx: 0.8,
        ambient: 0.6,
        music: 0.7,
    };

    // Currently playing loop IDs
    private activeLoops: Map<SoundName, number> = new Map();

    // Step counters for procedural arpeggio (one counter per profile id)
    private arpStepCounters: Map<string, number> = new Map();

    private constructor() { }

    public static getInstance(): SoundManager {
        if (!SoundManager.instance) {
            SoundManager.instance = new SoundManager();
        }
        return SoundManager.instance;
    }

    /** Initialize all sounds. Call once at game start. */
    public init(): void {
        if (this.initialized) return;
        this.initialized = true;

        const allSounds: SoundName[] = [
            'menu_select', 'menu_confirm', 'menu_back', 'dialogue_bip',
            'coin_gain', 'coin_loss',
            'bet_place', 'card_deal', 'card_flip',
            'dice_roll', 'dice_land', 'coin_flip',
            'slot_spin', 'slot_stop', 'slot_jackpot',
            'win_small', 'win_big', 'lose', 'draw',
            'arcade_insert', 'arcade_hit', 'arcade_shoot',
            'arcade_bounce', 'arcade_explosion',
            'achievement_unlock',
            'police_siren', 'police_whistle',
            'footstep', 'door_enter', 'door_exit',
            'game_over', 'game_start',
            'music_1', 'music_2', 'music_3', 'music_4', 'music_5',
            'music_6', 'music_7', 'music_8', 'music_9',
            'ambient_night', 'ambient_casino',
        ];

        for (const name of allSounds) {
            const category: SoundCategory = CATEGORY_MAP[name] || 'sfx';
            const baseVolume = VOLUME_MAP[name] ?? 0.5;
            const isLoop = name.startsWith('ambient_');
            const isMusic = name.startsWith('music_');
            const extension = isMusic ? 'mp3' : 'wav';

            const howl = new Howl({
                src: [`/assets/audio/${name}.${extension}`],
                volume: baseVolume * this.categoryVolumes[category],
                loop: isLoop,
                preload: true,
                // Lo-fi rate variation for non-ambient/non-music sounds
                rate: (isLoop || isMusic) ? 1.0 : 0.95 + Math.random() * 0.1,
            });

            this.sounds.set(name, { howl, category });
        }

        console.log(`🔊 SoundManager: ${allSounds.length} sounds loaded`);
    }

    /** Play a one-shot sound */
    public play(name: SoundName, options?: PlayOptions): void {
        if (this.muted) return;
        const entry = this.sounds.get(name);
        if (!entry) return;

        const category = CATEGORY_MAP[name] || 'sfx';
        const baseVolume = VOLUME_MAP[name] ?? 0.5;
        
        // Calculate volume
        const vol = options?.volume !== undefined 
            ? options.volume 
            : (baseVolume * this.categoryVolumes[category]);

        // Start playing to get ID
        const id = entry.howl.play();
        
        // Apply per-instance volume
        entry.howl.volume(vol, id);

        // Apply rate variation or override
        if (options?.rate !== undefined) {
            entry.howl.rate(options.rate, id);
        } else if (category !== 'ambient') {
            entry.howl.rate(0.93 + Math.random() * 0.14, id);
        }
    }

    /** Start a looping sound (ambient) */
    public playLoop(name: SoundName): void {
        if (this.activeLoops.has(name)) return; // Already playing
        const entry = this.sounds.get(name);
        if (!entry) return;

        entry.howl.loop(true);
        const id = entry.howl.play();
        this.activeLoops.set(name, id);
    }

    /** Stop a looping sound */
    public stopLoop(name: SoundName): void {
        const entry = this.sounds.get(name);
        const id = this.activeLoops.get(name);
        if (!entry || id === undefined) return;

        entry.howl.stop(id);
        this.activeLoops.delete(name);
    }

    /** Fade out a loop over duration (ms) then stop it */
    public fadeOutLoop(name: SoundName, duration: number = 1000): void {
        const entry = this.sounds.get(name);
        const id = this.activeLoops.get(name);
        if (!entry || id === undefined) return;

        entry.howl.fade(entry.howl.volume(), 0, duration, id);
        setTimeout(() => {
            entry.howl.stop(id);
            // Reset volume for next play
            const baseVolume = VOLUME_MAP[name] ?? 0.5;
            const category: SoundCategory = CATEGORY_MAP[name] || 'sfx';
            entry.howl.volume(baseVolume * this.categoryVolumes[category]);
            this.activeLoops.delete(name);
        }, duration);
    }

    /** Stop a specific sound (all instances) */
    public stop(name: SoundName): void {
        const entry = this.sounds.get(name);
        if (!entry) return;
        entry.howl.stop();
        this.activeLoops.delete(name);
    }

    /** Stop all sounds */
    public stopAll(): void {
        Howler.stop();
        this.activeLoops.clear();
    }

    /** Toggle mute */
    public toggleMute(): boolean {
        this.muted = !this.muted;
        Howler.mute(this.muted);
        return this.muted;
    }

    /** Set mute state */
    public setMute(muted: boolean): void {
        this.muted = muted;
        Howler.mute(muted);
    }

    /** Get mute state */
    public isMuted(): boolean {
        return this.muted;
    }

    /** Set master volume (0-1) */
    public setMasterVolume(vol: number): void {
        Howler.volume(Math.max(0, Math.min(1, vol)));
    }

    /** Set category volume (0-1) */
    public setCategoryVolume(category: SoundCategory, vol: number): void {
        this.categoryVolumes[category] = Math.max(0, Math.min(1, vol));

        // Update all sounds in this category
        for (const [name, entry] of this.sounds) {
            if (entry.category === category) {
                const baseVolume = VOLUME_MAP[name] ?? 0.5;
                entry.howl.volume(baseVolume * vol);
            }
        }
    }

    /** Resume AudioContext (required for browsers after user interaction) */
    public resumeContext(): void {
        if (Howler.ctx && Howler.ctx.state === 'suspended') {
            Howler.ctx.resume();
        }
    }

    // ─────────────────────────────────────────────────────────────────
    //  🎵 PROCEDURAL CHIPTUNE ENGINE
    //  Sintetiza notas musicais via Web Audio API sem nenhum arquivo.
    //  Respeita mute global e usa o AudioContext do Howler.
    // ─────────────────────────────────────────────────────────────────

    /**
     * Toca a próxima nota procedural do perfil musical do minigame.
     * Avança o step counter ciclicamente (ou aleatoriamente, conforme o perfil).
     *
     * @param profileId  ID do minigame (ex: 'videobingo', 'blackjack')
     * @param volumeOverride  Volume opcional (sobrescreve o padrão do perfil)
     */
    public playArpeggio(profileId: string, volumeOverride?: number): void {
        if (this.muted) return;
        const ctx = Howler.ctx as AudioContext | undefined;
        if (!ctx || ctx.state === 'suspended') return;

        const profile = MINIGAME_MUSIC_PROFILES[profileId];
        if (!profile) return;

        const scale = profile.scale;
        let step = this.arpStepCounters.get(profileId) ?? 0;

        let freq: number;
        if (profile.stepMode === 'cycle') {
            freq = scale[step % scale.length];
            this.arpStepCounters.set(profileId, step + 1);
        } else {
            // 'random' — escolhe aleatoriamente dentro da escala
            freq = scale[Math.floor(Math.random() * scale.length)];
            // Guarda mesmo assim para poder resetar
            this.arpStepCounters.set(profileId, step + 1);
        }

        this._synthesizeNote(ctx, freq, profile.waveform, volumeOverride ?? profile.volume, profile.noteDuration);
    }

    /**
     * Toca a fanfara de vitória ou derrota do minigame.
     * Sequência de notas com delay de 90ms entre cada uma.
     *
     * @param profileId  ID do minigame
     * @param type       'win' | 'lose'
     */
    public playFanfare(profileId: string, type: 'win' | 'lose'): void {
        if (this.muted) return;
        const ctx = Howler.ctx as AudioContext | undefined;
        if (!ctx || ctx.state === 'suspended') return;

        const profile = MINIGAME_MUSIC_PROFILES[profileId];
        if (!profile) return;

        const notes = type === 'win' ? profile.winFanfare : profile.loseFanfare;
        const fanfareVolume = type === 'win' ? 0.20 : 0.15;
        const noteDuration = type === 'win' ? 200 : 170;
        const noteGap = 95; // ms entre notas

        notes.forEach((freq, i) => {
            setTimeout(() => {
                const c = Howler.ctx as AudioContext | undefined;
                if (!c || c.state === 'suspended') return;
                // Última nota da vitória dura mais
                const dur = (type === 'win' && i === notes.length - 1) ? noteDuration * 2 : noteDuration;
                this._synthesizeNote(c, freq, profile.waveform, fanfareVolume, dur);
            }, i * noteGap);
        });
    }

    /**
     * Reseta o step counter de um perfil (chamar ao reiniciar o minigame).
     */
    public resetArpeggioStep(profileId: string): void {
        this.arpStepCounters.set(profileId, 0);
    }

    /**
     * Motor interno de síntese — cria oscilador + envelope ADSR simplificado.
     * @private
     */
    private _synthesizeNote(
        ctx: AudioContext,
        frequency: number,
        waveform: OscillatorType,
        volume: number,
        durationMs: number
    ): void {
        try {
            const t = ctx.currentTime;
            const durSec = durationMs / 1000;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = waveform;
            osc.frequency.setValueAtTime(frequency, t);

            // Envelope ADSR suave:
            //   Attack  10ms  — entrada gradual
            //   Decay   40ms  — queda para sustain
            //   Sustain 60%   — nível de sustain
            //   Release       — fade até o fim da nota
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(volume, t + 0.010);             // Attack
            gain.gain.linearRampToValueAtTime(volume * 0.6, t + 0.050);       // Decay
            gain.gain.setValueAtTime(volume * 0.6, t + durSec - 0.040);       // Sustain hold
            gain.gain.linearRampToValueAtTime(0, t + durSec);                 // Release

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(t);
            osc.stop(t + durSec + 0.01);

            // Limpeza automática após término
            osc.onended = () => {
                try { osc.disconnect(); gain.disconnect(); } catch (_) { /* ignore */ }
            };
        } catch (_) {
            // Silencia qualquer erro de AudioContext
        }
    }
}
