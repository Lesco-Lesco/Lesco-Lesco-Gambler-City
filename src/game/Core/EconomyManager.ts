/**
 * EconomyManager — Single source of truth for player money.
 * Handles balance, bet limits, and money rounding.
 * Emits MONEY_CHANGED events for UI and other systems.
 */

import { GameConfig } from './GameConfig';
import { GameEventEmitter } from './EventEmitter';
import { AchievementManager } from './AchievementManager';

export class EconomyManager {
    private static instance: EconomyManager;

    private _balance: number;
    private _maxMoneyReached: number;
    private _timesRecovered: number = 0;

    private constructor() {
        this._balance = GameConfig.STARTING_MONEY;
        this._maxMoneyReached = GameConfig.STARTING_MONEY;
    }

    public static getInstance(): EconomyManager {
        if (!EconomyManager.instance) {
            EconomyManager.instance = new EconomyManager();
        }
        return EconomyManager.instance;
    }

    /** Current player balance */
    public get balance(): number {
        return this._balance;
    }

    /** Set balance with rounding and event emission */
    public set balance(value: number) {
        const oldBalance = this._balance;
        this._balance = Math.floor(value / GameConfig.MONEY_UNIT) * GameConfig.MONEY_UNIT;
        if (this._balance > this._maxMoneyReached) {
            this._maxMoneyReached = this._balance;
            AchievementManager.getInstance().updateMaxMoney(this._maxMoneyReached);
        }
        if (this._balance !== oldBalance) {
            GameEventEmitter.getInstance().emit('MONEY_CHANGED', {
                amount: this._balance,
                delta: this._balance - oldBalance,
            });

            // Trigger All-In event if hits zero after a deduction (negative delta)
            if (this._balance === 0 && (this._balance - oldBalance) < 0) {
                AchievementManager.getInstance().recordAllIn();
            }
        }
    }

    /** Add money (positive or negative) */
    public addMoney(delta: number): void {
        this.balance = this._balance + delta;
    }

    /** Dynamic bet limits based on max wealth reached, capped by current balance (For Poker) */
    public getPokerBetLimits(): { min: number; max: number; step: number } {
        const bonusMin = Math.floor(this._maxMoneyReached * GameConfig.BET_MIN_BONUS_RATE);
        
        let min = Math.max(
            GameConfig.BET_MIN_BASE,
            Math.min(
                GameConfig.BET_MIN_CAP,
                Math.max(GameConfig.BET_MIN_BASE, Math.floor((GameConfig.BET_MIN_BASE + bonusMin) / GameConfig.MONEY_UNIT) * GameConfig.MONEY_UNIT)
            )
        );

        // Rule: Max is exactly 3x Min
        let max = min * 3;

        // Cap by current balance
        max = Math.min(max, this._balance);

        // Proportional bet step (scales with player wealth)
        const step = this.calculateStep(this._maxMoneyReached);

        return { min, max, step };
    }

    /** 
     * Dynamic bet limits for Periphery NPCs (High Risk / High Reward) for Poker.
     */
    public getPokerPeripheryBetLimits(): { min: number; max: number; step: number } {
        const base = this.getPokerBetLimits();
        let min = Math.min(this._balance, base.min * 2);
        if (min === 0 && this._balance >= base.min) min = base.min; 
        
        let max = Math.min(this._balance, min * 3);
        let step = base.step * 2;

        return { min, max, step };
    }

    /** Dynamic bet limits for all other minigames (1x to 3x range) */
    public getBetLimits(): { min: number; max: number; step: number } {
        let min = 10;
        const currentBalance = this._balance;
        
        if (currentBalance >= 10000) min = 1000;
        else if (currentBalance >= 5000) min = 500;
        else if (currentBalance >= 2000) min = 200;
        else if (currentBalance >= 1000) min = 100;
        else if (currentBalance >= 500) min = 50;
        else if (currentBalance >= 200) min = 20;

        // Rule: 3x limit
        let max = min * 3;
        
        // Cap by balance
        max = Math.min(max, currentBalance);
        
        const step = this.calculateStep(this._maxMoneyReached);

        return { min, max, step };
    }

    /** Dynamic bet limits for Periphery NPCs (1x to 3x range, 2x base) */
    public getPeripheryBetLimits(): { min: number; max: number; step: number } {
        const base = this.getBetLimits();
        let min = Math.min(this._balance, base.min * 2);
        let max = Math.min(this._balance, min * 3);
        let step = base.step * 2;
        
        return { min, max, step };
    }

    private calculateStep(wealth: number): number {
        if (wealth >= 50000) return 1000;
        if (wealth >= 20000) return 500;
        if (wealth >= 5000)  return 100;
        if (wealth >= 2000)  return 50;
        if (wealth >= 500)   return 20;
        return 10;
    }

    /** Reset to starting state */
    public reset(): void {
        this._balance = GameConfig.STARTING_MONEY;
        this._maxMoneyReached = GameConfig.STARTING_MONEY;
        this._timesRecovered = 0;
        GameEventEmitter.getInstance().emit('MONEY_CHANGED', {
            amount: this._balance,
            delta: 0,
        });
    }

    /**
     * Returns a difficulty multiplier between 1.1 and 1.3 based on player wealth.
     * Max difficulty (+30%) is reached at R$ 20,000.
     */
    public getDifficultyFactor(): number {
        const wealth = this._maxMoneyReached;
        const targetWealth = 20000;
        const maxExtraDifficulty = 0.20; // Extra 20% on top of 1.1 base

        const factor = Math.min(maxExtraDifficulty, (wealth / targetWealth) * maxExtraDifficulty);
        return 1.1 + factor;
    }

    /** Recovery from total bankruptcy (Vovó do Pão / Tia) */
    public recoverFromBroke(): { amount: number, message: string, character: string } | null {
        if (this._timesRecovered >= 1) {
            return null; // No more help after the first time
        }

        this._timesRecovered++;
        const amount = 50; 
        this.addMoney(amount);

        const characters = ['Tia Reclamona', 'Vovó do Pão', 'Primo Rico (Sarcástico)', 'Bicheiro de Bom Coração'];
        const char = characters[(this._timesRecovered - 1) % characters.length];

        const messages = [
            "Toma aí 50 conto, mas vê se não gasta tudo em bicho!",
            "Ficou liso de novo? Pega essa merreca e vai catar latinha.",
            "Tua vó mandou te dar isso. Ela disse que você não tem salvação.",
            "Sorte tua que eu tô de bom humor. Pega 50 e some daqui.",
        ];
        // Since we only allow 1 time now, we'll just pick the first one or a random one from the list
        const msg = messages[Math.floor(Math.random() * messages.length)];

        return { amount, message: msg, character: char };
    }

    public get timesRecovered(): number {
        return this._timesRecovered;
    }
}
