/**
 * EconomyManager — Single source of truth for player money.
 * Handles balance, bet limits, and money rounding.
 * Emits MONEY_CHANGED events for UI and other systems.
 */

import { GameConfig } from './GameConfig';
import { GameEventEmitter } from './EventEmitter';

export class EconomyManager {
    private static instance: EconomyManager;

    private _balance: number;
    private _maxMoneyReached: number;

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
        }
        if (this._balance !== oldBalance) {
            GameEventEmitter.getInstance().emit('MONEY_CHANGED', {
                amount: this._balance,
                delta: this._balance - oldBalance,
            });
        }
    }

    /** Add money (positive or negative) */
    public addMoney(delta: number): void {
        this.balance = this._balance + delta;
    }

    /** Dynamic bet limits based on max wealth reached */
    public getBetLimits(): { min: number; max: number } {
        const bonusMin = Math.floor(this._maxMoneyReached * GameConfig.BET_MIN_BONUS_RATE);
        const bonusMax = Math.floor(this._maxMoneyReached * GameConfig.BET_MAX_BONUS_RATE);

        const min = Math.min(
            GameConfig.BET_MIN_CAP,
            Math.max(GameConfig.BET_MIN_BASE, Math.floor((GameConfig.BET_MIN_BASE + bonusMin) / GameConfig.MONEY_UNIT) * GameConfig.MONEY_UNIT)
        );
        const max = Math.min(
            GameConfig.BET_MAX_CAP,
            Math.max(GameConfig.BET_MAX_BASE, Math.floor((GameConfig.BET_MAX_BASE + bonusMax) / GameConfig.MONEY_UNIT) * GameConfig.MONEY_UNIT)
        );

        return { min, max };
    }

    /** Reset to starting state */
    public reset(): void {
        this._balance = GameConfig.STARTING_MONEY;
        this._maxMoneyReached = GameConfig.STARTING_MONEY;
        GameEventEmitter.getInstance().emit('MONEY_CHANGED', {
            amount: this._balance,
            delta: 0,
        });
    }
}
