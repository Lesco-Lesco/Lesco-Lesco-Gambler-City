import { EconomyManager } from '../Core/EconomyManager';
import type { IMinigame } from './BaseMinigame';

/**
 * Cara ou Coroa (Heads or Tails)
 * Simple street gambling game.
 */

export type HeadsTailsPhase = 'betting' | 'choosing' | 'flipping' | 'result';

export class HeadsTailsGame implements IMinigame {
    public phase: HeadsTailsPhase = 'betting';
    public betAmount: number = 10;
    public minBet: number = 10;
    public maxBet: number = 100;
    public humanChoice: 'heads' | 'tails' = 'heads';
    public winningSide: 'heads' | 'tails' | null = null;
    public flipTimer: number = 0;
    public rotationSpeed: number = 0;
    public currentRotation: number = 0;
    public resultMessage: string = '';

    // Betting UI
    public selectedBet: number = 10;

    constructor(_playerMoney: number) {
        this.updateLimits();
        this.selectedBet = this.minBet;
    }

    public updateLimits() {
        const limits = EconomyManager.getInstance().getBetLimits();
        this.minBet = limits.min;
        this.maxBet = limits.max;
        this.selectedBet = Math.max(this.minBet, Math.min(this.selectedBet, this.maxBet));
    }

    public confirmBet(amount: number) {
        this.betAmount = amount;
        this.phase = 'choosing';
    }

    public chooseSide(side: 'heads' | 'tails') {
        this.humanChoice = side;
        this.phase = 'flipping';
        this.flipTimer = 0;
        this.rotationSpeed = 20 + Math.random() * 10; // Initial rotation speed
        this.currentRotation = 0;
        this.winningSide = Math.random() < 0.5 ? 'heads' : 'tails';
    }

    public update(dt: number) {
        if (this.phase === 'flipping') {
            this.flipTimer += dt;
            this.currentRotation += this.rotationSpeed;
            this.rotationSpeed = Math.max(0.5, this.rotationSpeed * (1 - dt * 0.8)); // Decelerate

            if (this.rotationSpeed < 1.0 && this.flipTimer > 2.0) {
                // Determine final position based on winningSide
                // Heads is 0, Tails is PI
                const finalRot = this.winningSide === 'heads' ? 0 : Math.PI;
                // Force it to look right (very simplified rotation logic for 2D UI)
                this.currentRotation = finalRot;
                this.phase = 'result';
                this.calculateResult();
            }
        }
    }

    private calculateResult() {
        if (this.humanChoice === this.winningSide) {
            this.resultMessage = `🎉 VOCÊ GANHOU R$${this.betAmount * 2}!`;
        } else {
            this.resultMessage = `Você perdeu R$${this.betAmount}. Deu ${this.winningSide === 'heads' ? 'CARA' : 'COROA'}.`;
        }
    }

    public settle(): number {
        if (this.humanChoice === this.winningSide) {
            return this.betAmount; // Net profit
        } else {
            return -this.betAmount; // Net loss
        }
    }

    public reset(_playerMoney: number) {
        this.phase = 'betting';
        this.winningSide = null;
        this.flipTimer = 0;
        this.rotationSpeed = 0;
        this.currentRotation = 0;
        this.resultMessage = '';
        this.updateLimits();
    }
}
