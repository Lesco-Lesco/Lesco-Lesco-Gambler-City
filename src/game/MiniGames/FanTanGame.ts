import { BichoManager } from '../BichoManager';

/**
 * Fan-Tan (Chinatown Street Version)
 * Players bet on the remainder (1, 2, 3, 0/4) of a pile of grains divided by 4.
 */

export type FanTanPhase = 'betting' | 'choosing' | 'reveal' | 'counting' | 'result';

export class FanTanGame {
    public phase: FanTanPhase = 'betting';
    public betAmount: number = 20;
    public pot: number = 0;
    public totalGrains: number = 0;
    public remainder: number = 0;
    public currentPlayerChoices: number[] = [];
    public resultMessage: string = '';

    // Counting animation
    public displayedGrains: number = 0;
    public countTimer: number = 0;

    // UI
    public selectedBet: number = 20;
    public minBet: number = 10;
    public maxBet: number = 1000;

    constructor() {
        this.updateLimits();
    }

    public updateLimits() {
        const limits = BichoManager.getInstance().getBetLimits();
        this.minBet = limits.min;
        this.maxBet = limits.max;
        this.selectedBet = Math.max(this.minBet, Math.min(this.selectedBet, this.maxBet));
    }

    public confirmBet(amount: number) {
        this.betAmount = amount;
        this.pot = amount * 2; // Against the house, double the bet
        this.phase = 'choosing';
    }

    public choosePosition(pos: number) {
        if (this.currentPlayerChoices.includes(pos)) return;

        this.currentPlayerChoices.push(pos);

        if (this.currentPlayerChoices.length === 2) {
            this.phase = 'reveal';
            this.totalGrains = 10 + Math.floor(Math.random() * 91); // 10 to 100
            this.remainder = this.totalGrains % 4;
            if (this.remainder === 0) this.remainder = 4;

            this.displayedGrains = this.totalGrains;
            this.countTimer = 0;
        }
    }

    public update(dt: number) {
        if (this.phase === 'counting') {
            this.countTimer += dt;
            if (this.countTimer > 0.3) {
                this.countTimer = 0;
                if (this.displayedGrains > this.remainder) {
                    this.displayedGrains = Math.max(this.remainder, this.displayedGrains - 4);
                } else {
                    this.phase = 'result';
                    this.calculateResult();
                }
            }
        }
    }

    private calculateResult() {
        if (this.currentPlayerChoices.includes(this.remainder)) {
            this.resultMessage = `🎉 VOCÊ GANHOU R$${this.pot}! O resto foi ${this.remainder}.`;
        } else {
            this.resultMessage = `A banca ganhou. O resto foi ${this.remainder}.`;
        }
    }

    public settle(): number {
        if (this.currentPlayerChoices.includes(this.remainder)) {
            return this.pot - this.betAmount; // Net profit
        } else {
            return -this.betAmount; // Lost bet
        }
    }

    public reset() {
        this.phase = 'betting';
        this.currentPlayerChoices = [];
        this.resultMessage = '';
        this.updateLimits();
    }
}
