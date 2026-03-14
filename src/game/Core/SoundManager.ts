/**
 * SoundManager — Centralized audio manager using Howler.js.
 * Singleton pattern, lo-fi aesthetic for 90s Rio de Janeiro suburb.
 * 
 * Usage:
 *   SoundManager.getInstance().play('menu_select');
 *   SoundManager.getInstance().playLoop('ambient_night');
 */

import { Howl, Howler } from 'howler';

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
}
