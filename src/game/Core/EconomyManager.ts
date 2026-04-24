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
        const bonusMax = Math.floor(this._maxMoneyReached * GameConfig.BET_MAX_BONUS_RATE);

        let min = Math.max(
            GameConfig.BET_MIN_BASE,
            Math.min(
                GameConfig.BET_MIN_CAP,
                Math.max(GameConfig.BET_MIN_BASE, Math.floor((GameConfig.BET_MIN_BASE + bonusMin) / GameConfig.MONEY_UNIT) * GameConfig.MONEY_UNIT)
            )
        );
        let max = Math.min(
            GameConfig.BET_MAX_CAP,
            Math.max(GameConfig.BET_MAX_BASE, Math.floor((GameConfig.BET_MAX_BASE + bonusMax) / GameConfig.MONEY_UNIT) * GameConfig.MONEY_UNIT)
        );

        // Cap by current balance
        max = Math.min(max, this._balance);

        // Proportional bet step (scales with player wealth)
        let step = 10;
        if (this._maxMoneyReached >= 50000) step = 1000;
        else if (this._maxMoneyReached >= 20000) step = 500;
        else if (this._maxMoneyReached >= 5000) step = 100;
        else if (this._maxMoneyReached >= 2000) step = 50;
        else if (this._maxMoneyReached >= 500) step = 20;

        return { min, max, step };
    }

    /** 
     * Dynamic bet limits for Periphery NPCs (High Risk / High Reward) for Poker.
     */
    public getPokerPeripheryBetLimits(): { min: number; max: number; step: number } {
        const baseLimits = this.getPokerBetLimits();
        
        let min = Math.min(this._balance, baseLimits.min * 2);
        if (min === 0 && this._balance >= baseLimits.min) min = baseLimits.min; 
        
        let max = Math.min(this._balance, baseLimits.max * 2);
        let step = baseLimits.step * 2;

        return { min, max, step };
    }

    /** Single bet quotes for all other minigames */
    public getBetLimits(): { min: number; max: number; step: number } {
        let bet = 10;
        const currentBalance = this._balance;
        
        if (currentBalance >= 10000) bet = 1000;
        else if (currentBalance >= 5000) bet = 500;
        else if (currentBalance >= 2000) bet = 200;
        else if (currentBalance >= 1000) bet = 100;
        else if (currentBalance >= 500) bet = 50;
        else if (currentBalance >= 200) bet = 20;

        return { min: bet, max: bet, step: 0 };
    }

    /** Single bet quotes for Periphery NPCs (all other minigames) */
    public getPeripheryBetLimits(): { min: number; max: number; step: number } {
        const baseLimits = this.getBetLimits();
        let bet = baseLimits.min * 2;
        return { min: bet, max: bet, step: 0 };
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
