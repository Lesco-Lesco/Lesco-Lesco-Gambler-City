import { EconomyManager } from '../Core/EconomyManager';
import type { IMinigame } from './BaseMinigame';
/**
 * Purrinha Mini-Game
 * Rules:
 * - 2-5 players (1 human + NPCs)
 * - Each player secretly places 0-3 stones in their right hand
 * - All players guess the total sum
 * - Closest to the actual sum wins the pot
 *
 * Phases: BETTING → CHOOSING_STONES → GUESSING → REVEAL → RESULT
 */

export type PurrinhaPhase = 'betting' | 'choosing' | 'guessing' | 'reveal' | 'result';

export interface PurrinhaPlayer {
    name: string;
    isHuman: boolean;
    stones: number;       // 0-3
    guess: number;        // Their guess of the total
    money: number;
    hasGuessed: boolean;
}

export class PurrinhaGame implements IMinigame {
    public phase: PurrinhaPhase = 'betting';
    public players: PurrinhaPlayer[] = [];
    public betAmount: number = 10;
    public minBet: number = 10;
    public maxBet: number = 100;
    public pot: number = 0;
    public totalStones: number = 0;
    public winner: PurrinhaPlayer | null = null;
    public revealTimer: number = 0;
    public resultMessage: string = '';
    public isFinished: boolean = false;

    // Betting UI
    public selectedBet: number = 10;

    // Choosing UI
    public selectedStones: number = 0;

    // Guessing UI
    public selectedGuess: number = 0;
    public maxPossibleTotal: number = 0;

    // Animation
    public revealIndex: number = -1;

    constructor(humanMoney: number, npcCount: number = 3) {
        // Human player
        this.players.push({
            name: 'Você',
            isHuman: true,
            stones: 0,
            guess: 0,
            money: humanMoney,
            hasGuessed: false,
        });

        // NPC players
        const npcNames = ['Zé Mão', 'Bigode', 'Careca', 'Tião'];
        for (let i = 0; i < Math.min(npcCount, 4); i++) {
            this.players.push({
                name: npcNames[i],
                isHuman: false,
                stones: 0,
                guess: 0,
                money: 30 + Math.floor(Math.random() * 70),
                hasGuessed: false,
            });
        }

        this.maxPossibleTotal = this.players.length * 3;
        this.phase = 'betting';
        this.updateLimits();
    }

    public updateLimits() {
        const limits = EconomyManager.getInstance().getBetLimits();
        this.minBet = limits.min;
        this.maxBet = limits.max;
        // Ensure current bet is within valid range? 
        // Actually, better to reset bet to min when limits update
        if (this.phase === 'betting') {
            this.betAmount = Math.max(this.minBet, Math.min(this.betAmount, this.maxBet));
            this.selectedBet = this.betAmount;
        }
    }

    /** Confirm the bet and start */
    public confirmBet(amount: number) {
        this.betAmount = Math.max(this.minBet, Math.min(amount, this.maxBet));
        this.pot = this.betAmount * this.players.length;
        this.phase = 'choosing';
    }

    /** Player chooses their stones (0-3) */
    public chooseStones(count: number) {
        const human = this.players.find(p => p.isHuman);
        if (human) {
            human.stones = Math.max(0, Math.min(3, count));
        }

        // NPCs choose random stones
        for (const p of this.players) {
            if (!p.isHuman) {
                p.stones = Math.floor(Math.random() * 4); // 0-3
            }
        }

        this.totalStones = this.players.reduce((sum, p) => sum + p.stones, 0);
        this.phase = 'guessing';
    }

    /** Player makes their guess */
    public makeGuess(guess: number) {
        const human = this.players.find(p => p.isHuman);
        if (human) {
            human.guess = guess;
            human.hasGuessed = true;
        }

        // NPCs make guesses (semi-smart: they know their own stones)
        const usedGuesses = new Set<number>([guess]);
        for (const p of this.players) {
            if (!p.isHuman) {
                // NPCs guess based on their own stones + estimated average for others
                const othersEstimate = (this.players.length - 1) * 1.5;
                let npcGuess = Math.round(p.stones + othersEstimate + (Math.random() - 0.5) * 3);
                npcGuess = Math.max(0, Math.min(this.maxPossibleTotal, npcGuess));

                // Make sure no duplicate guesses
                while (usedGuesses.has(npcGuess) && npcGuess < this.maxPossibleTotal) {
                    npcGuess++;
                }
                if (usedGuesses.has(npcGuess)) {
                    npcGuess = Math.max(0, npcGuess - 2);
                }

                p.guess = npcGuess;
                p.hasGuessed = true;
                usedGuesses.add(npcGuess);
            }
        }

        this.phase = 'reveal';
        this.revealTimer = 0;
        this.revealIndex = -1;
    }

    /** Update during reveal phase */
    public update(dt: number): boolean {
        if (this.phase === 'reveal') {
            this.revealTimer += dt;

            // Reveal each player's stones one by one
            const revealInterval = 1.0;
            const newIdx = Math.floor(this.revealTimer / revealInterval);

            if (newIdx !== this.revealIndex && newIdx < this.players.length) {
                this.revealIndex = newIdx;
            }

            // After all revealed
            if (this.revealTimer > this.players.length * revealInterval + 1.5) {
                this.calculateWinner();
                this.phase = 'result';
                return true; // Phase changed
            }
        }
        return false;
    }

    private calculateWinner() {
        let bestPlayer: PurrinhaPlayer | null = null;
        let bestDiff = Infinity;

        for (const p of this.players) {
            const diff = Math.abs(p.guess - this.totalStones);
            if (diff < bestDiff) {
                bestDiff = diff;
                bestPlayer = p;
            }
        }

        this.winner = bestPlayer;

        if (bestPlayer) {
            if (bestPlayer.isHuman) {
                this.resultMessage = `🎉 VOCÊ GANHOU R$${this.pot}!`;
            } else {
                this.resultMessage = `${bestPlayer.name} ganhou. Você perdeu R$${this.betAmount}.`;
            }
        }
    }

    /** Apply money changes and return profit/loss for human */
    public settle(): number {
        const human = this.players.find(p => p.isHuman);
        if (!human || !this.winner) return 0;

        if (this.winner.isHuman) {
            return this.pot - this.betAmount; // Net profit
        } else {
            return -this.betAmount; // Lost the bet
        }
    }

    /** Reset for a new round */
    public reset(humanMoney: number) {
        this.phase = 'betting';
        this.pot = 0;
        this.totalStones = 0;
        this.winner = null;
        this.revealTimer = 0;
        this.resultMessage = '';
        this.isFinished = false;
        this.selectedStones = 0;
        this.selectedGuess = 0;
        this.revealIndex = -1;

        const human = this.players.find(p => p.isHuman);
        if (human) {
            human.money = humanMoney;
            human.stones = 0;
            human.guess = 0;
            human.hasGuessed = false;
        }

        for (const p of this.players) {
            if (!p.isHuman) {
                p.stones = 0;
                p.guess = 0;
                p.hasGuessed = false;
                // Give NPCs some more money if they are broke
                if (p.money < this.minBet) {
                    p.money = 50 + Math.floor(Math.random() * 50);
                }
            }
        }

        this.maxPossibleTotal = this.players.length * 3;
        this.updateLimits();
    }
}
