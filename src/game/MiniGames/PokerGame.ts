import { EconomyManager } from '../Core/EconomyManager';
import type { IMinigame } from './BaseMinigame';

/**
 * 3-Player Texas Hold'em Poker Logic
 * Players: 1 Human, 2 NPCs
 * simplified rounds: Pre-flop, Flop, Turn, River.
 */

export type PokerPhase = 'betting' | 'pre_flop' | 'flop' | 'turn' | 'river' | 'result';

export interface PokerCard {
    suit: 'H' | 'D' | 'C' | 'S';
    value: string; // '2'-'9', 'T', 'J', 'Q', 'K', 'A'
    rank: number;
}

export interface PokerPlayer {
    name: string;
    isHuman: boolean;
    hand: PokerCard[];
    money: number;
    currentBet: number;
    folded: boolean;
    lastAction: string;
}

export class PokerGame implements IMinigame {
    public phase: PokerPhase = 'betting';
    public betAmount: number = 10; // Big Blind
    public minBet: number = 10;
    public maxBet: number = 1000;
    public pot: number = 0;
    public players: PokerPlayer[] = [];
    public communityCards: PokerCard[] = [];
    public deck: PokerCard[] = [];
    public resultMessage: string = '';
    public winner: PokerPlayer | null = null;
    public activePlayerIndex: number = 0;

    constructor(initialBB: number = 10) {
        this.betAmount = initialBB;
        this.players = [
            { name: 'Você', isHuman: true, hand: [], money: 0, currentBet: 0, folded: false, lastAction: '' },
            { name: 'Geraldo', isHuman: false, hand: [], money: 500, currentBet: 0, folded: false, lastAction: '' },
            { name: 'Tião', isHuman: false, hand: [], money: 500, currentBet: 0, folded: false, lastAction: '' }
        ];
        this.updateLimits();
    }

    public updateLimits() {
        const limits = EconomyManager.getInstance().getBetLimits();
        this.minBet = limits.min;
        this.maxBet = limits.max;
    }

    private createDeck() {
        const suits: PokerCard['suit'][] = ['H', 'D', 'C', 'S'];
        const values = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
        this.deck = [];
        for (const suit of suits) {
            for (const [rank, value] of values.entries()) {
                this.deck.push({ suit, value, rank: rank + 2 });
            }
        }
        this.shuffle();
    }

    private shuffle() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    public startMatch() {
        this.createDeck();
        this.communityCards = [];
        this.pot = 0;
        this.players.forEach(p => {
            p.hand = [this.deck.pop()!, this.deck.pop()!];
            p.folded = false;
            p.currentBet = 0;
            p.lastAction = '';
        });

        // Blind posts (simplified)
        this.players[0].currentBet = this.betAmount; // Human as BB
        this.pot = this.betAmount;

        this.phase = 'pre_flop';
        this.activePlayerIndex = 1; // NPC starts
    }

    public nextPhase() {
        if (this.phase === 'pre_flop') {
            this.phase = 'flop';
            this.communityCards = [this.deck.pop()!, this.deck.pop()!, this.deck.pop()!];
        } else if (this.phase === 'flop') {
            this.phase = 'turn';
            this.communityCards.push(this.deck.pop()!);
        } else if (this.phase === 'turn') {
            this.phase = 'river';
            this.communityCards.push(this.deck.pop()!);
        } else if (this.phase === 'river') {
            this.calculateWinner();
        }
    }

    private calculateWinner() {
        let bestScore = -1;
        let bestPlayer: PokerPlayer | null = null;

        const activePlayers = this.players.filter(p => !p.folded);
        for (const p of activePlayers) {
            const score = this.evaluateHand(p.hand, this.communityCards);
            if (score > bestScore) {
                bestScore = score;
                bestPlayer = p;
            }
        }

        this.winner = bestPlayer;
        if (bestPlayer) {
            this.resultMessage = `${bestPlayer.name} ganhou R$${this.pot}!`;
        }
        this.phase = 'result';
    }

    private evaluateHand(hand: PokerCard[], community: PokerCard[]): number {
        const allCards = [...hand, ...community];
        // Placeholder: Sum of ranks + count of pairs
        let rankSum = allCards.reduce((sum, c) => sum + c.rank, 0);
        const counts: { [rank: number]: number } = {};
        allCards.forEach(c => counts[c.rank] = (counts[c.rank] || 0) + 1);
        let pairBonus = Object.values(counts).filter(v => v === 2).length * 100;
        let threeBonus = Object.values(counts).filter(v => v === 3).length * 500;
        return rankSum + pairBonus + threeBonus;
    }

    public settle(): number {
        if (!this.winner) return 0;
        const human = this.players[0];
        if (this.winner === human) {
            return this.pot - human.currentBet;
        } else {
            return -human.currentBet;
        }
    }

    public reset() {
        this.phase = 'betting';
        this.winner = null;
        this.resultMessage = '';
        this.communityCards = [];
        this.pot = 0;
        this.updateLimits();
    }
}
