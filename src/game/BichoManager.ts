import { JogoDoBicho } from './MiniGames/JogoDoBicho';
import { EconomyManager } from './Core/EconomyManager';
import { GameConfig } from './Core/GameConfig';

export interface BichoBet {
    animal: number;
    amount: number;
    resultTime: number; // in-game time when result is revealed
    processed: boolean;
}

export interface BichoNotification {
    message: string;
    timer: number;
}

/**
 * BichoManager — Handles Jogo do Bicho bets, delayed results, and notifications.
 * Money operations are delegated to EconomyManager.
 */
export class BichoManager {
    private static instance: BichoManager;

    private internalTimer: number = 0;

    /** @deprecated Use EconomyManager.getInstance().balance instead */
    public get playerMoney(): number {
        return EconomyManager.getInstance().balance;
    }

    /** @deprecated Use EconomyManager.getInstance().balance = value instead */
    public set playerMoney(value: number) {
        EconomyManager.getInstance().balance = value;
    }

    /** @deprecated Use EconomyManager.getInstance().getBetLimits() instead */
    public getBetLimits(): { min: number, max: number } {
        return EconomyManager.getInstance().getBetLimits();
    }

    private pendingBets: BichoBet[] = [];
    private notifications: BichoNotification[] = [];
    private bicho: JogoDoBicho;

    private constructor() {
        this.bicho = new JogoDoBicho();
    }

    public static getInstance(): BichoManager {
        if (!BichoManager.instance) {
            BichoManager.instance = new BichoManager();
        }
        return BichoManager.instance;
    }

    public placeBet(animal: number, amount: number) {
        const economy = EconomyManager.getInstance();
        if (economy.balance < amount) return;

        economy.addMoney(-amount);

        const delayInSeconds = (GameConfig.BICHO_RESULT_DELAY_MINUTES / 600) * 300; // 5 seconds

        this.pendingBets.push({
            animal,
            amount,
            resultTime: this.internalTimer + delayInSeconds,
            processed: false
        });
    }

    public update(dt: number) {
        const economy = EconomyManager.getInstance();
        this.internalTimer += dt;
        const currentInGameTime = this.internalTimer;

        // 1. Process Results
        for (const bet of this.pendingBets) {
            if (!bet.processed && currentInGameTime >= bet.resultTime) {
                bet.processed = true;

                const result = this.bicho.getResult();
                const animalName = JogoDoBicho.ANIMALS[bet.animal].name;
                const winnerName = JogoDoBicho.ANIMALS[result.winningAnimal].name;
                const winnerEmoji = JogoDoBicho.ANIMALS[result.winningAnimal].emoji;

                const betGroup = Math.floor(bet.animal / 5);
                const winningGroup = Math.floor(result.winningAnimal / 5);

                if (bet.animal === result.winningAnimal) {
                    const payout = bet.amount * GameConfig.BICHO_EXACT_MATCH_MULTIPLIER;
                    economy.addMoney(payout);
                    this.addNotification(`+R$${payout}! DEU ${winnerEmoji} ${winnerName.toUpperCase()}!`, 5);
                } else if (betGroup === winningGroup) {
                    const payout = GameConfig.BICHO_GROUP_MATCH_PAYOUT;
                    economy.addMoney(payout);
                    this.addNotification(`+R$${payout}! Quase! Acertou o GRUPO do ${winnerName}!`, 4);
                } else {
                    this.addNotification(`Deu ${winnerEmoji} ${winnerName}. Seu ${animalName} perdeu.`, 4);
                }

                this.bicho.newRound();
            }
        }

        // Clean up processed bets
        this.pendingBets = this.pendingBets.filter(b => !b.processed);

        // 2. Update Notifications
        for (let i = this.notifications.length - 1; i >= 0; i--) {
            this.notifications[i].timer -= dt;
            if (this.notifications[i].timer <= 0) {
                this.notifications.splice(i, 1);
            }
        }
    }

    public addNotification(message: string, duration: number = 3) {
        this.notifications.push({ message, timer: duration });
    }

    public getNotifications(): BichoNotification[] {
        return this.notifications;
    }

    public hasPendingBets(): boolean {
        return this.pendingBets.length > 0;
    }
}
