import { EconomyManager } from '../Core/EconomyManager';
import type { IMinigame } from './BaseMinigame';
/**
 * DiceGame (Dados) Logic — Overhauled to 5-player "Stones Style"
 * 
 * Rules:
 * 1. 5 Players (1 Human, 4 NPCs).
 * 2. Each player chooses TWO numbers (1-6).
 * 3. Two dice are rolled.
 * 4. Winner is the one whose pair is "statistically closest" to the roll.
 *    Proximity formula: abs(D1 - P1) + abs(D2 - P2).
 */

export interface DicePlayer {
    name: string;
    choices: [number, number];
    isHuman: boolean;
    score: number;
}

export class DiceGame implements IMinigame {
    public players: DicePlayer[] = [];
    public dice1: number = 1;
    public dice2: number = 1;
    public isRolling: boolean = false;
    public phase: 'betting' | 'rolling' | 'result' = 'betting';
    public winner: DicePlayer | null = null;
    public message: string = 'Faça sua aposta!';
    public betAmount: number = 10;
    public minBet: number = 10;
    public maxBet: number = 100;

    constructor() {
        this.initializePlayers();
        this.updateLimits();
    }

    public updateLimits() {
        const limits = EconomyManager.getInstance().getBetLimits();
        this.minBet = limits.min;
        this.maxBet = limits.max;
    }

    private initializePlayers() {
        this.players = [
            { name: 'Você', choices: [1, 1], isHuman: true, score: 0 },
            { name: 'Zeca', choices: [1, 1], isHuman: false, score: 0 },
            { name: 'Nando', choices: [1, 1], isHuman: false, score: 0 },
            { name: 'Beto', choices: [1, 1], isHuman: false, score: 0 },
            { name: 'Dudu', choices: [1, 1], isHuman: false, score: 0 },
        ];
    }

    public startRound(humanChoices: [number, number], bet: number) {
        this.betAmount = bet;
        this.phase = 'rolling';
        this.isRolling = true;
        this.message = 'Rolando os dados...';

        // Set human choices
        this.players[0].choices = humanChoices;

        // Randomize NPC choices (avoiding human choices for variety)
        for (let i = 1; i < this.players.length; i++) {
            this.players[i].choices = [
                Math.floor(Math.random() * 6) + 1,
                Math.floor(Math.random() * 6) + 1
            ];
        }
    }

    public resolve() {
        this.dice1 = Math.floor(Math.random() * 6) + 1;
        this.dice2 = Math.floor(Math.random() * 6) + 1;
        this.isRolling = false;
        this.phase = 'result';

        // Calculate scores (lower is better)
        let bestScore = 999;
        let winners: DicePlayer[] = [];

        for (const p of this.players) {
            // Check both combinations (D1-P1, D2-P2) and (D1-P2, D2-P1) for fairness
            const scoreA = Math.abs(this.dice1 - p.choices[0]) + Math.abs(this.dice2 - p.choices[1]);
            const scoreB = Math.abs(this.dice1 - p.choices[1]) + Math.abs(this.dice2 - p.choices[0]);
            p.score = Math.min(scoreA, scoreB);

            if (p.score < bestScore) {
                bestScore = p.score;
                winners = [p];
            } else if (p.score === bestScore) {
                winners.push(p);
            }
        }

        // Randomly pick one winner if tie
        this.winner = winners[Math.floor(Math.random() * winners.length)];

        if (this.winner.isHuman) {
            const detail = bestScore === 0 ? "em cheio" : `(margem ${bestScore})`;
            this.message = `GANHOU! Você acertou ${detail}!`;
        } else {
            this.message = `${this.winner.name} venceu (margem ${bestScore}).`;
        }
    }

    public settle(): number {
        if (!this.winner) return 0;
        if (this.winner.isHuman) {
            return this.betAmount * (this.players.length - 1); // Net profit
        } else {
            return -this.betAmount; // Lost the bet
        }
    }

    public reset() {
        this.phase = 'betting';
        this.message = 'Faça sua aposta!';
        this.isRolling = false;
        this.winner = null;
        this.updateLimits();
    }
}
