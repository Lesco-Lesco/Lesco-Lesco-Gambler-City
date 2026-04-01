import { EconomyManager } from '../Core/EconomyManager';
import { GameConfig } from '../Core/GameConfig';
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

    public updateLimits(isPeriphery: boolean = false) {
        const limits = isPeriphery ? EconomyManager.getInstance().getPeripheryBetLimits() : EconomyManager.getInstance().getBetLimits();
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
            p.currentBet = this.betAmount; // Everyone pays the initial BB
            this.pot += this.betAmount;
            p.lastAction = 'Call';
        });

        this.phase = 'pre_flop';
        this.activePlayerIndex = 0; // Human starts
    }

    private static readonly FOLD_MESSAGES: string[] = [
        'Tô fora. Não vou bancar essa loucura.',
        'Fold. Tu tá blefando, mas não pago pra ver.',
        'Tá maluco? Essa aposta é absurda. Passo.',
        'Saí. Meu bolso não aguenta essa pressão.',
        'Nessa eu não entro. Boa sorte com o resto.',
        'Fold. Prefiro perder pouco do que perder tudo.',
        'Tu acha que eu sou trouxa? Fold.',
        'Essa mão não vale esse preço. Tô fora.',
    ];

    /** Allow player to increase the bet. NPCs decide independently whether to fold. */
    public raiseHand(extraAmount: number) {
        if (extraAmount <= 0) return;

        // Human always raises
        const human = this.players[0];
        const potCap = GameConfig.POKER_POT_CAP;

        // Cap the raise so pot doesn't exceed POKER_POT_CAP
        let effectiveRaise = extraAmount;
        if (this.pot + effectiveRaise * this.players.filter(p => !p.folded).length > potCap) {
            const activePlayers = this.players.filter(p => !p.folded).length;
            effectiveRaise = Math.max(0, Math.floor((potCap - this.pot) / (activePlayers * 10)) * 10);
        }
        if (effectiveRaise <= 0) return;

        human.currentBet += effectiveRaise;
        this.pot += effectiveRaise;
        human.lastAction = 'Raise';

        // Each NPC decides independently
        for (const npc of this.players.filter(p => !p.isHuman && !p.folded)) {
            const totalBetAfterCall = npc.currentBet + effectiveRaise;
            if (this.shouldNPCFold(npc, totalBetAfterCall)) {
                npc.folded = true;
                npc.lastAction = PokerGame.FOLD_MESSAGES[Math.floor(Math.random() * PokerGame.FOLD_MESSAGES.length)];
            } else {
                npc.currentBet += effectiveRaise;
                this.pot += effectiveRaise;
                npc.lastAction = 'Call';
            }
        }

        // Check if only human remains (all NPCs folded)
        const active = this.players.filter(p => !p.folded);
        if (active.length === 1 && active[0].isHuman) {
            this.winner = active[0];
            this.resultMessage = `Todos foldaram! ${active[0].name} ganhou R$${this.pot}!`;
            this.phase = 'result';
        }
    }

    /** Determine if an NPC should fold based on bet-to-bankroll ratio */
    private shouldNPCFold(npc: PokerPlayer, totalBet: number): boolean {
        const ratio = totalBet / npc.money;
        if (ratio > 0.7) return Math.random() < 0.85;
        if (ratio > 0.5) return Math.random() < 0.60;
        if (ratio > 0.3) return Math.random() < 0.30;
        if (ratio > 0.15) return Math.random() < 0.10;
        return false;
    }

    public nextPhase() {
        // Check if only one player remains
        const active = this.players.filter(p => !p.folded);
        if (active.length === 1) {
            this.winner = active[0];
            this.resultMessage = `Todos foldaram! ${active[0].name} ganhou R$${this.pot}!`;
            this.phase = 'result';
            return;
        }

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
            let score = this.evaluateHand(p.hand, this.communityCards);

            // House Edge: NPCs get a 5% base bonus and a 15% chance to "bluff/play aggressive" (extra 10% bonus)
            if (!p.isHuman) {
                score *= 1.05; // Base 5% bonus
                if (Math.random() < 0.15) {
                    score *= 1.10; // Aggressive/Bluff bonus
                    p.lastAction = 'Agressivo';
                }
            }

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
        // Simplified scoring: Sum of ranks + specific pattern bonuses
        let rankSum = allCards.reduce((sum, c) => sum + c.rank, 0);
        const counts: { [rank: number]: number } = {};
        allCards.forEach(c => counts[c.rank] = (counts[c.rank] || 0) + 1);

        let pairBonus = Object.values(counts).filter(v => v === 2).length * 100;
        let threeBonus = Object.values(counts).filter(v => v === 3).length * 500;
        let fourBonus = Object.values(counts).filter(v => v === 4).length * 2000;

        return rankSum + pairBonus + threeBonus + fourBonus;
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
