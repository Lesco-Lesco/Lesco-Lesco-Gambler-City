import { EconomyManager } from '../Core/EconomyManager';
import type { IMinigame } from './BaseMinigame';

/**
 * Jo Ken Po (Rock Paper Scissors)
 * Street minigame.
 */

export type JokenpoChoice = 'rock' | 'paper' | 'scissors' | null;
export type JokenpoPhase = 'betting' | 'choosing' | 'showdown' | 'result';

export class JokenpoGame implements IMinigame {
    public phase: JokenpoPhase = 'betting';
    public betAmount: number = 10;
    public minBet: number = 10;
    public maxBet: number = 200; // A bit higher for Jo Ken Po
    public playerChoice: JokenpoChoice = null;
    public npcChoice: JokenpoChoice = null;
    public resultMessage: string = '';
    public winner: 'player' | 'npc' | 'draw' | null = null;

    // Betting UI
    public selectedBet: number = 10;
    private playerMoney: number = 0;

    constructor(playerMoney: number) {
        this.playerMoney = playerMoney;
        this.updateLimits();
        this.selectedBet = this.minBet;
    }

    public updateLimits() {
        const limits = EconomyManager.getInstance().getBetLimits();
        this.minBet = limits.min;
        // Cap max bet by both economy limits and player money
        this.maxBet = Math.min(this.playerMoney, limits.max * 2);

        // Ensure selected bet is within new limits
        if (this.selectedBet > this.maxBet) this.selectedBet = this.maxBet;

        // If money is very low, allow betting what's left
        if (this.selectedBet < this.minBet) {
            this.selectedBet = Math.max(0, this.maxBet);
        }
    }

    public confirmBet(amount: number) {
        if (amount > this.playerMoney) {
            amount = this.playerMoney;
        }
        if (amount < this.minBet && this.playerMoney >= this.minBet) {
            amount = this.minBet;
        }

        this.betAmount = amount;
        this.phase = 'choosing';
    }

    public play(choice: JokenpoChoice) {
        if (!choice) return;
        this.playerChoice = choice;
        this.npcChoice = this.getNpcChoice(choice);
        this.phase = 'showdown';

        // Showdown delay is handled in UI or update
    }

    private getNpcChoice(pChoice: JokenpoChoice): JokenpoChoice {
        const r = Math.random();

        // Rebalanceamento:
        // 35% de chance do NPC escolher o que PERDE para o jogador (Vitória do Jogador)
        // 33% de chance de EMPATE
        // 32% de chance do NPC escolher o que GANHA do jogador (Vitória do NPC)

        let winningMove: JokenpoChoice = 'rock';
        let losingMove: JokenpoChoice = 'rock';

        if (pChoice === 'rock') { winningMove = 'paper'; losingMove = 'scissors'; }
        else if (pChoice === 'paper') { winningMove = 'scissors'; losingMove = 'rock'; }
        else if (pChoice === 'scissors') { winningMove = 'rock'; losingMove = 'paper'; }

        if (r < 0.35) return losingMove;   // Jogador ganha
        if (r < 0.68) return pChoice;      // Empate (0.68 - 0.35 = 0.33)
        return winningMove;                // NPC ganha (1.0 - 0.68 = 0.32)
    }

    public determineWinner() {
        if (this.playerChoice === this.npcChoice) {
            this.winner = 'draw';
            this.resultMessage = 'EMPATE! Tente novamente.';
        } else if (
            (this.playerChoice === 'rock' && this.npcChoice === 'scissors') ||
            (this.playerChoice === 'paper' && this.npcChoice === 'rock') ||
            (this.playerChoice === 'scissors' && this.npcChoice === 'paper')
        ) {
            this.winner = 'player';
            this.resultMessage = `🎉 VOCÊ GANHOU R$ ${this.betAmount * 2}!`;
        } else {
            this.winner = 'npc';
            this.resultMessage = `Você perdeu R$ ${this.betAmount}.`;
        }
        this.phase = 'result';
    }

    public update(_dt: number) {
        // Showdown animation/timer logic could go here
    }

    public settle(): number {
        if (this.winner === 'player') {
            return this.betAmount; // Return net profit
        } else if (this.winner === 'draw') {
            return 0; // Return original bet (net 0)
        } else {
            return -this.betAmount; // Net loss
        }
    }

    public reset(playerMoney: number) {
        this.playerMoney = playerMoney;
        this.phase = 'betting';
        this.playerChoice = null;
        this.npcChoice = null;
        this.winner = null;
        this.resultMessage = '';
        this.updateLimits();
    }
}
