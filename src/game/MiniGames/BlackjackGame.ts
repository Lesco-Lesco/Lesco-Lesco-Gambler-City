import { EconomyManager } from '../Core/EconomyManager';
import type { IMinigame } from './BaseMinigame';

/**
 * Blackjack Mini-Game Logic
 * Rules:
 * - 1 Player vs Dealer
 * - Standard 52 card deck
 * - Dealer hits until 17
 * - Blackjack pays 3:2 (simplified to 2x for consistency with other games if needed, but let's try 2.5x)
 */

export type BlackjackPhase = 'betting' | 'playing' | 'dealer_turn' | 'result';

export interface Card {
    suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
    value: string; // '2'-'10', 'J', 'Q', 'K', 'A'
    points: number;
}

export class BlackjackGame implements IMinigame {
    public phase: BlackjackPhase = 'betting';
    public betAmount: number = 10;
    public minBet: number = 10;
    public maxBet: number = 500;
    public playerHand: Card[] = [];
    public dealerHand: Card[] = [];
    public deck: Card[] = [];
    public resultMessage: string = '';
    public winner: 'player' | 'dealer' | 'push' | null = null;

    constructor(initialBet: number = 10) {
        this.betAmount = initialBet;
        this.updateLimits();
    }

    public updateLimits() {
        const limits = EconomyManager.getInstance().getBetLimits();
        this.minBet = limits.min;
        this.maxBet = limits.max;
    }

    private createDeck() {
        const suits: Card['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades'];
        const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        this.deck = [];
        for (const suit of suits) {
            for (const value of values) {
                let points = parseInt(value);
                if (isNaN(points)) {
                    if (value === 'A') points = 11;
                    else points = 10;
                }
                this.deck.push({ suit, value, points });
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

    public deal() {
        this.createDeck();
        this.playerHand = [this.deck.pop()!, this.deck.pop()!];
        this.dealerHand = [this.deck.pop()!, this.deck.pop()!];
        this.phase = 'playing';

        if (this.calculatePoints(this.playerHand) === 21) {
            this.stand(); // Natural Blackjack
        }
    }

    public hit() {
        if (this.phase !== 'playing') return;
        this.playerHand.push(this.deck.pop()!);
        if (this.calculatePoints(this.playerHand) > 21) {
            this.calculateResult();
        }
    }

    public stand() {
        if (this.phase !== 'playing') return;
        this.phase = 'dealer_turn';
        this.dealerPlay();
    }

    private dealerPlay() {
        while (this.calculatePoints(this.dealerHand) < 17) {
            this.dealerHand.push(this.deck.pop()!);
        }
        this.calculateResult();
    }

    public calculatePoints(hand: Card[]): number {
        let total = hand.reduce((sum, card) => sum + card.points, 0);
        let aces = hand.filter(c => c.value === 'A').length;
        while (total > 21 && aces > 0) {
            total -= 10;
            aces--;
        }
        return total;
    }

    private calculateResult() {
        const pPoints = this.calculatePoints(this.playerHand);
        const dPoints = this.calculatePoints(this.dealerHand);

        if (pPoints > 21) {
            this.winner = 'dealer';
            this.resultMessage = 'ESTOUROU! Você perdeu.';
        } else if (dPoints > 21) {
            this.winner = 'player';
            this.resultMessage = 'O DEALER ESTOUROU! Você ganhou!';
        } else if (pPoints > dPoints) {
            this.winner = 'player';
            this.resultMessage = 'VOCÊ GANHOU!';
        } else if (dPoints > pPoints) {
            this.winner = 'dealer';
            this.resultMessage = 'O DEALER GANHOU.';
        } else {
            this.winner = 'push';
            this.resultMessage = 'EMPATE (PUSH).';
        }
        this.phase = 'result';
    }

    public settle(): number {
        if (this.winner === 'player') {
            // Check for Blackjack (2 cards totaling 21)
            if (this.playerHand.length === 2 && this.calculatePoints(this.playerHand) === 21) {
                return Math.floor(this.betAmount * 1.5); // Bonus for Natural Blackjack
            }
            return this.betAmount;
        } else if (this.winner === 'push') {
            return 0;
        } else {
            return -this.betAmount;
        }
    }

    public reset() {
        this.phase = 'betting';
        this.playerHand = [];
        this.dealerHand = [];
        this.winner = null;
        this.resultMessage = '';
        this.updateLimits();
    }
}
