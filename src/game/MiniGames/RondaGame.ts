import { BichoManager } from '../BichoManager';
/**
 * RondaGame (Ronda de Cartas) Logic
 * 
 * Simplified Rules for Gameplay Flow:
 * 1. Deck of 40 cards (1-10, 4 suits).
 * 2. House deals 2 "Objective" cards face up.
 * 3. Player bets on ONE of them.
 * 4. House starts revealing cards from the deck one by one.
 * 5. If a card matches the Player's choice (Rank), Player WINS.
 * 6. If a card matches the House's other card (Rank), House WINS.
 * 7. First match ends the round.
 */

export interface Card {
    rank: number; // 1-10 (1=Ace, 8=Jack, 9=Queen, 10=King)
    suit: 'ouros' | 'espadas' | 'copas' | 'paus';
}

export class RondaGame {
    public deck: Card[] = [];
    public objectiveCards: Card[] = [];
    public communityCards: Card[] = []; // Revealed cards
    public playerChoiceIndex: number = -1; // 0 or 1
    public phase: 'betting' | 'dealing' | 'result' = 'betting';
    public message: string = 'Escolha uma carta!';
    public winAmount: number = 0;
    public betAmount: number = 10;
    public minBet: number = 10;
    public maxBet: number = 100;

    constructor() {
        this.reset();
    }

    public reset() {
        this.createDeck();
        this.shuffleDeck();
        this.communityCards = [];
        this.playerChoiceIndex = -1;
        this.phase = 'betting';
        this.message = 'Escolha uma carta!';
        this.winAmount = 0;

        const limits = BichoManager.getInstance().getBetLimits();
        this.minBet = limits.min;
        this.maxBet = limits.max;
        this.betAmount = this.minBet;

        // Deal 2 objectives with DIFFERENT ranks
        this.objectiveCards = [];
        const first = this.drawCard()!;
        this.objectiveCards.push(first);

        // Find a second card with a different rank
        let secondIndex = this.deck.findIndex(c => c.rank !== first.rank);
        if (secondIndex === -1) {
            // Fallback (shouldn't happen with full deck)
            this.objectiveCards.push(this.drawCard()!);
        } else {
            const second = this.deck.splice(secondIndex, 1)[0];
            this.objectiveCards.push(second);
        }
    }

    private createDeck() {
        this.deck = [];
        const suits = ['ouros', 'espadas', 'copas', 'paus'] as const;
        for (const suit of suits) {
            for (let r = 1; r <= 10; r++) {
                this.deck.push({ rank: r, suit });
            }
        }
    }

    private shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    private drawCard(): Card | undefined {
        return this.deck.pop();
    }

    public chooseCard(index: number) { // 0 or 1
        if (this.phase !== 'betting') return;
        this.playerChoiceIndex = index;
        this.message = 'Embaralhando...';
        this.phase = 'dealing';

        // Start reveal loop
        this.revealNextCard();
    }

    private revealNextCard() {
        if (this.phase !== 'dealing') return;

        setTimeout(() => {
            const card = this.drawCard();
            if (!card) {
                this.phase = 'result';
                this.message = 'Baralho acabou! Empate.';
                return;
            }

            this.communityCards.push(card);

            // Check Match
            const playerTargetRank = this.objectiveCards[this.playerChoiceIndex].rank;
            const houseTargetRank = this.objectiveCards[this.playerChoiceIndex === 0 ? 1 : 0].rank;

            if (card.rank === playerTargetRank) {
                // Player Match!
                this.phase = 'result';
                this.winAmount = this.betAmount * 2;
                this.message = `Deu a sua! ${this.getCardName(card)}. GANHOU R$${this.winAmount}!`;
            } else if (card.rank === houseTargetRank) {
                // House Match!
                this.phase = 'result';
                this.winAmount = 0;
                this.message = `Deu a da banca! ${this.getCardName(card)}. PERDEU.`;
            } else {
                // Continue
                this.revealNextCard();
            }

        }, 800); // Delay between cards
    }

    public getCardName(card: Card): string {
        const ranks = ['As', '2', '3', '4', '5', '6', '7', 'Valete', 'Dama', 'Rei'];
        return `${ranks[card.rank - 1]} de ${card.suit}`;
    }
}
