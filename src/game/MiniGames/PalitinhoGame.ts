import { EconomyManager } from '../Core/EconomyManager';
import { BuffManager } from '../Core/BuffManager';
import type { IMinigame } from './BaseMinigame';

/**
 * Palitinho Mini-Game (Advanced 1v1 Duel)
 * Rules:
 * - 1v1 against a master gambler
 * - High stakes
 * - Each player secretly places 0-3 sticks in their hand
 * - Players guess the total
 * 
 * Phases: BETTING → CHOOSING → GUESSING → REVEAL → RESULT
 */

export type PalitinhoPhase = 'betting' | 'choosing' | 'guessing' | 'reveal' | 'result';

export interface PalitinhoPlayer {
    name: string;
    isHuman: boolean;
    sticks: number;       // 0-3
    guess: number;        // Their guess of the total
    money: number;
    hasGuessed: boolean;
}

export class PalitinhoGame implements IMinigame {
    public phase: PalitinhoPhase = 'betting';
    public players: PalitinhoPlayer[] = [];
    public betAmount: number = 50;
    public minBet: number = 50;
    public maxBet: number = 500;
    public pot: number = 0;
    public totalSticks: number = 0;
    public winner: PalitinhoPlayer | null = null;
    public revealTimer: number = 0;
    public resultMessage: string = '';
    public isFinished: boolean = false;

    // Betting UI
    public selectedBet: number = 50;

    // Choosing UI
    public selectedSticks: number = 0;

    // Guessing UI
    public selectedGuess: number = 0;
    public maxPossibleTotal: number = 0;

    // Animation
    public revealIndex: number = -1;

    constructor() {
        // Human player
        this.players.push({
            name: 'Você',
            isHuman: true,
            sticks: 0,
            guess: 0,
            money: 0, // Injected later or ignored for logic
            hasGuessed: false,
        });

        // The Master NPC
        this.players.push({
            name: 'Mestre Paliteiro',
            isHuman: false,
            sticks: 0,
            guess: 0,
            money: 1000,
            hasGuessed: false,
        });

        this.maxPossibleTotal = this.players.length * 3;
        this.phase = 'betting';
        this.updateLimits();
    }

    public updateLimits(isPeriphery: boolean = false) {
        const limits = isPeriphery ? EconomyManager.getInstance().getPeripheryBetLimits() : EconomyManager.getInstance().getBetLimits();
        // Palitinho is higher stakes than Purrinha
        this.minBet = limits.min * 2;
        this.maxBet = limits.max * 2;
        this.selectedBet = Math.max(this.minBet, this.selectedBet);
    }

    public confirmBet(amount: number) {
        this.betAmount = amount;
        this.pot = this.betAmount * this.players.length;
        this.phase = 'choosing';
    }

    public chooseSticks(count: number) {
        const human = this.players.find(p => p.isHuman);
        if (human) {
            human.sticks = Math.max(0, Math.min(3, count));
        }

        // NPC chooses random sticks
        for (const p of this.players) {
            if (!p.isHuman) {
                p.sticks = Math.floor(Math.random() * 4);
            }
        }

        this.totalSticks = this.players.reduce((sum, p) => sum + p.sticks, 0);
        this.phase = 'guessing';
    }

    public makeGuess(guess: number) {
        const human = this.players.find(p => p.isHuman);
        if (human) {
            human.guess = guess;
            human.hasGuessed = true;
        }

        // Master NPC makes a smart guess
        const usedGuesses = new Set<number>([guess]);
        for (const p of this.players) {
            if (!p.isHuman) {
                // Master knows his own sticks and makes a tighter range guess
                const npcGuess = Math.max(0, Math.min(this.maxPossibleTotal, p.sticks + Math.floor(Math.random() * 4)));
                
                let finalGuess = npcGuess;
                while (usedGuesses.has(finalGuess) && finalGuess < this.maxPossibleTotal) {
                    finalGuess++;
                }
                if (usedGuesses.has(finalGuess)) {
                    finalGuess = Math.max(0, finalGuess - 2);
                    while (usedGuesses.has(finalGuess) && finalGuess > 0) finalGuess--;
                }

                p.guess = finalGuess;
                p.hasGuessed = true;
                usedGuesses.add(p.guess);
            }
        }

        this.phase = 'reveal';
        this.revealTimer = 0;
        this.revealIndex = -1;
    }

    public update(dt: number): boolean {
        if (this.phase === 'reveal') {
            this.revealTimer += dt;
            const revealInterval = 0.8;
            const newIdx = Math.floor(this.revealTimer / revealInterval);

            if (newIdx !== this.revealIndex && newIdx < this.players.length) {
                this.revealIndex = newIdx;
            }

            if (this.revealTimer > this.players.length * revealInterval + 1.0) {
                this.calculateWinner();
                this.phase = 'result';
                return true;
            }
        }
        return false;
    }

    private calculateWinner() {
        let bestPlayer: PalitinhoPlayer | null = null;
        let bestDiff = Infinity;

        // Luck Bonus
        const human = this.players.find(p => p.isHuman);
        if (human) {
            const luck = BuffManager.getInstance().getLuckBonus();
            if (luck > 0 && Math.random() < luck * 1.5) { // Higher luck influence in duels
                this.totalSticks = human.guess;
            }
        }

        for (const p of this.players) {
            const diff = Math.abs(p.guess - this.totalSticks);
            if (diff < bestDiff) {
                bestDiff = diff;
                bestPlayer = p;
            }
        }

        this.winner = bestPlayer;
        if (bestPlayer) {
            if (bestPlayer.isHuman) {
                this.resultMessage = `DUELO VENCIDO! GANHOU R$${this.pot}!`;
            } else {
                this.resultMessage = `O MESTRE VENCEU. PERDEU R$${this.betAmount}.`;
            }
        }
    }

    public settle(): number {
        if (!this.winner) return 0;
        return this.winner.isHuman ? (this.pot - this.betAmount) : -this.betAmount;
    }

    public reset() {
        this.phase = 'betting';
        this.pot = 0;
        this.totalSticks = 0;
        this.winner = null;
        this.revealTimer = 0;
        this.resultMessage = '';
        this.isFinished = false;
        this.selectedSticks = 0;
        this.selectedGuess = 0;
        this.revealIndex = -1;

        for (const p of this.players) {
            p.sticks = 0;
            p.guess = 0;
            p.hasGuessed = false;
        }
        this.updateLimits();
    }
}
