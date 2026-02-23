import { EconomyManager } from '../Core/EconomyManager';
import type { IMinigame } from './BaseMinigame';

/**
 * Palitinho (Matchsticks)
 * 3 players. Dice roll for order. One broken matchstick = loser.
 */

export type PalitinhoPhase = 'betting' | 'dice_roll' | 'choosing' | 'reveal' | 'result';

interface PalitinhoPlayer {
    name: string;
    isHuman: boolean;
    diceValue: number;
    order: number;
    choice: number | null; // index of matchstick picked
    isLoser: boolean;
}

export class PalitinhoGame implements IMinigame {
    public phase: PalitinhoPhase = 'betting';
    public players: PalitinhoPlayer[] = [];
    public betAmount: number = 20;
    public pot: number = 0;
    public matchsticks: { isBroken: boolean, pickedBy: string | null }[] = [];
    public currentPlayerIdx: number = 0;
    public diceTimer: number = 0;
    public resultMessage: string = '';

    // UI
    public selectedBet: number = 20;
    public minBet: number = 10;
    public maxBet: number = 500;

    constructor() {
        this.updateLimits();
        this.setupPlayers();
    }

    private setupPlayers() {
        this.players = [
            { name: 'Você', isHuman: true, diceValue: 0, order: 0, choice: null, isLoser: false },
            { name: 'Soneca', isHuman: false, diceValue: 0, order: 0, choice: null, isLoser: false },
            { name: 'Gato', isHuman: false, diceValue: 0, order: 0, choice: null, isLoser: false }
        ];
    }

    public updateLimits() {
        const limits = EconomyManager.getInstance().getBetLimits();
        this.minBet = limits.min;
        this.maxBet = Math.min(limits.max, 500); // Caps for street game
        this.selectedBet = Math.max(this.minBet, Math.min(this.selectedBet, this.maxBet));
    }

    public confirmBet(amount: number) {
        this.betAmount = amount;
        this.pot = amount * this.players.length;
        this.phase = 'dice_roll';
        this.diceTimer = 0;

        // Roll dice
        for (const p of this.players) {
            p.diceValue = Math.floor(Math.random() * 6) + 1;
        }

        // Sort by dice (highest first)
        const sorted = [...this.players].sort((a, b) => b.diceValue - a.diceValue);
        sorted.forEach((p, i) => {
            const original = this.players.find(pl => pl.name === p.name);
            if (original) original.order = i;
        });

        // Setup matchsticks
        this.matchsticks = [
            { isBroken: false, pickedBy: null },
            { isBroken: false, pickedBy: null },
            { isBroken: false, pickedBy: null }
        ];
        this.matchsticks[Math.floor(Math.random() * 3)].isBroken = true;
    }

    public update(dt: number) {
        if (this.phase === 'dice_roll') {
            this.diceTimer += dt;
            if (this.diceTimer > 2.0) {
                this.phase = 'choosing';
                this.currentPlayerIdx = 0;
                this.processNPCTurns();
            }
        }
    }

    private processNPCTurns() {
        // Find who goes next in order
        while (this.currentPlayerIdx < this.players.length) {
            const activePlayer = this.players.find(p => p.order === this.currentPlayerIdx);
            if (!activePlayer) break;

            if (activePlayer.isHuman) {
                return; // Wait for human input
            } else {
                // NPC picks an available matchstick
                const available = this.matchsticks.map((m, i) => m.pickedBy === null ? i : -1).filter(i => i !== -1);
                const pick = available[Math.floor(Math.random() * available.length)];
                this.matchsticks[pick].pickedBy = activePlayer.name;
                activePlayer.choice = pick;
                this.currentPlayerIdx++;
            }
        }

        // All have picked
        this.phase = 'reveal';
    }

    public chooseMatchstick(idx: number) {
        if (this.phase !== 'choosing') return;
        const human = this.players.find(p => p.isHuman);
        if (!human || human.order !== this.currentPlayerIdx) return;

        if (this.matchsticks[idx].pickedBy !== null) return;

        this.matchsticks[idx].pickedBy = human.name;
        human.choice = idx;
        this.currentPlayerIdx++;
        this.processNPCTurns();
    }

    public calculateResult() {
        const loserIdx = this.matchsticks.findIndex(m => m.isBroken);
        const loserName = this.matchsticks[loserIdx].pickedBy;
        const loser = this.players.find(p => p.name === loserName);
        if (loser) loser.isLoser = true;

        if (loser?.isHuman) {
            this.resultMessage = `❌ Você quebrou o palito! Perdeu R$${this.betAmount}.`;
        } else {
            const winnersCount = this.players.length - 1;
            const payout = Math.floor(this.pot / (winnersCount * 10)) * 10;
            this.resultMessage = `🎉 ${loser?.name} perdeu! Você ganhou R$${payout}.`;
        }
        this.phase = 'result';
    }

    public settle(): number {
        const human = this.players.find(p => p.isHuman);
        if (!human) return 0;
        if (human.isLoser) return -this.betAmount;

        const winnersCount = this.players.length - 1;
        const payout = Math.floor(this.pot / (winnersCount * 10)) * 10;
        return payout - this.betAmount; // Net profit
    }

    public reset() {
        this.phase = 'betting';
        this.setupPlayers();
        this.matchsticks = [];
        this.currentPlayerIdx = 0;
        this.resultMessage = '';
        this.updateLimits();
    }
}
