/**
 * BuffManager — Manages temporary player power-ups.
 * Singleton.
 */

export type BuffType = 'comungado';

export class BuffManager {
    private static instance: BuffManager;
    private activeBuffs: Map<BuffType, number> = new Map(); // BuffType -> remaining time in seconds
    private postBuffCooldowns: Map<string, number> = new Map(); // Key -> remaining time in seconds

    private constructor() {}

    public static getInstance(): BuffManager {
        if (!BuffManager.instance) {
            BuffManager.instance = new BuffManager();
        }
        return BuffManager.instance;
    }

    /** Reset state (clear active buffs and cooldowns) */
    public reset(): void {
        this.activeBuffs.clear();
        this.postBuffCooldowns.clear();
    }

    public update(dt: number) {
        // Update active buffs
        for (const [type, time] of this.activeBuffs.entries()) {
            const newTime = time - dt;
            if (newTime <= 0) {
                this.activeBuffs.delete(type);
                console.log(`✨ Buff expired: ${type}`);
            } else {
                this.activeBuffs.set(type, newTime);
            }
        }

        // Update cooldowns
        for (const [key, time] of this.postBuffCooldowns.entries()) {
            const newTime = time - dt;
            if (newTime <= 0) {
                this.postBuffCooldowns.delete(key);
            } else {
                this.postBuffCooldowns.set(key, newTime);
            }
        }
    }

    public addBuff(type: BuffType, duration: number) {
        // Non-cumulative as per user request
        if (this.hasBuff(type)) return;
        
        this.activeBuffs.set(type, duration);
        console.log(`🌟 Buff added: ${type} for ${duration}s`);
    }

    public hasBuff(type: BuffType): boolean {
        return this.activeBuffs.has(type);
    }

    public getBuffTime(type: BuffType): number {
        return this.activeBuffs.get(type) || 0;
    }

    public getLuckBonus(): number {
        // 10% bonus for Comungado
        return this.hasBuff('comungado') ? 0.1 : 0;
    }

    public setCooldown(key: string, duration: number) {
        this.postBuffCooldowns.set(key, duration);
    }

    public getCooldown(key: string): number {
        return this.postBuffCooldowns.get(key) || 0;
    }

    public isOnCooldown(key: string): boolean {
        return this.getCooldown(key) > 0;
    }
}
