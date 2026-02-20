import { JogoDoBicho } from './MiniGames/JogoDoBicho';

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
 * BichoManager — Global singleton to handle player money, 
 * delayed Bicho results, and cross-scene notifications.
 */
export class BichoManager {
    private static instance: BichoManager;


    private _playerMoney: number = 200;
    private maxMoneyReached: number = 200;
    private internalTimer: number = 0; // Independent timer for Bicho events

    public get playerMoney(): number {
        return this._playerMoney;
    }

    public set playerMoney(value: number) {
        // Enforce 10-unit economy
        this._playerMoney = Math.floor(value / 10) * 10;
        if (this._playerMoney > this.maxMoneyReached) {
            this.maxMoneyReached = this._playerMoney;
        }
    }

    public getBetLimits(): { min: number, max: number } {
        // Dynamic limits based on max wealth
        // Min: 10 + 1% of max (capped 99k)
        // Max: 100 + 25% of max (capped 999k)
        const bonusMin = Math.floor(this.maxMoneyReached * 0.01);
        const bonusMax = Math.floor(this.maxMoneyReached * 0.25);

        const min = Math.min(99990, Math.max(10, Math.floor((10 + bonusMin) / 10) * 10));
        const max = Math.min(999990, Math.max(100, Math.floor((100 + bonusMax) / 10) * 10));

        return { min, max };
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
        if (this.playerMoney < amount) return;

        this.playerMoney -= amount;

        // RESULT DELAY: 10 in-game minutes
        // In our DayNightCycle, 10 minutes = 5 real seconds (at 300s total night)
        // However, we track resultTime in absolute seconds from dusk
        const delayInSeconds = (10 / 600) * 300; // 5 seconds

        this.pendingBets.push({
            animal,
            amount,
            resultTime: this.internalTimer + delayInSeconds,
            processed: false
        });
    }

    public update(dt: number) {
        this.internalTimer += dt;
        const currentInGameTime = this.internalTimer;
        // 1. Process Results
        for (const bet of this.pendingBets) {
            if (!bet.processed && currentInGameTime >= bet.resultTime) {
                bet.processed = true;

                // Generate a winner for THIS specific bet processing
                // Note: User wants "instant notification when they win"
                const result = this.bicho.getResult(); // Using existing logic, but maybe we want a fresh one per bet
                const animalName = JogoDoBicho.ANIMALS[bet.animal].name;
                const winnerName = JogoDoBicho.ANIMALS[result.winningAnimal].name;
                const winnerEmoji = JogoDoBicho.ANIMALS[result.winningAnimal].emoji;

                const betGroup = Math.floor(bet.animal / 5);
                const winningGroup = Math.floor(result.winningAnimal / 5);

                if (bet.animal === result.winningAnimal) {
                    const payout = bet.amount * 18;
                    this.playerMoney += payout;
                    this.addNotification(`+R$${payout}! DEU ${winnerEmoji} ${winnerName.toUpperCase()}!`, 5);
                } else if (betGroup === winningGroup) {
                    const payout = 50;
                    this.playerMoney += payout;
                    this.addNotification(`+R$${payout}! Quase! Acertou o GRUPO do ${winnerName}!`, 4);
                } else {
                    this.addNotification(`Deu ${winnerEmoji} ${winnerName}. Seu ${animalName} perdeu.`, 4);
                }

                // Clear the Bicho result so next bet gets a fresh chance or same day chance?
                // The user said "10 min from moment of bet". 
                // Let's force a new result for each bet processing to keep it dynamic.
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
