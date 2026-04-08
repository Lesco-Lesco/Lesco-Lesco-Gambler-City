import { EconomyManager } from '../Core/EconomyManager';

export type HorsePersonality = 'sprinter' | 'closer' | 'balanced' | 'erratic';

export interface Horse {
    id: number;
    name: string;
    color: string;
    odds: number;
    position: number;
    speed: number;
    personality: HorsePersonality;
    acceleration: number;
    stamina: number;
    baseSpeedMod: number; // Used to bias the speed calculation
    isFinished: boolean;
    finishTime?: number;
}

export class HorseRacingGame {
    public horses: Horse[] = [];
    public phase: 'betting' | 'racing' | 'result' = 'betting';
    public selectedHorse: number = 0;
    public betAmount: number = 10;   // Set automatically from EconomyManager on init/reset
    public isPeriphery: boolean = false;
    public winners: Horse[] = []; // Stores top finishers in order
    public raceTime: number = 0;
    public readonly RACE_DISTANCE = 1000;

    // Fixed prize table (relative to betAmount, resolved at payout time)
    // 1st: 6× bet received  → profit +5× bet
    // 2nd: 2× bet received  → profit +1× bet
    // 3rd: 1× bet received  → break even
    // 4th+: 0              → lost
    private static readonly PRIZE_MULT: Record<number, number> = { 1: 6, 2: 2, 3: 1 };

    constructor(isPeriphery: boolean = false) {
        this.isPeriphery = isPeriphery;
        this._refreshBet();
        this.initHorses();
    }

    private _refreshBet() {
        const limits = this.isPeriphery
            ? EconomyManager.getInstance().getPeripheryBetLimits()
            : EconomyManager.getInstance().getBetLimits();
        this.betAmount = limits.min;
    }

    private initHorses() {
        const pool = [
            "Alexandre", "Napoleão", "Aquiles", "Leonidas", "Espártaco",
            "César", "Heitor", "Ulisses", "Átila", "Gêngis",
            "Saladino", "Ricardo", "Artur", "Lancelot", "Percival",
            "Galahad", "Sigfrido", "Beowulf", "Rolando", "Aníbal",
            "Trajano", "Belisário", "Filipe", "Pirro", "Ciro"
        ];

        // Shuffle and pick 8
        const names = pool.sort(() => 0.5 - Math.random()).slice(0, 8);

        const horsePalettes = [
            { color: '#5C4033' }, // Marrom Escuro 1
            { color: '#FFFFFF' }, // Branco 1
            { color: '#D2B48C' }, // Marrom Claro (Tan)
            { color: '#3D2B1F' }, // Marrom Escuro 2 (Ex-Preto)
            { color: '#C19A6B' }, // Marrom Claro (Fawn)
            { color: '#FFFFFF' }, // Branco 2
            { color: '#4B3621' }, // Marrom Escuro 3
            { color: '#A0522D' }  // Marrom (Sienna)
        ];
        const personalities: HorsePersonality[] = ['sprinter', 'closer', 'balanced', 'erratic'];

        this.horses = names.map((name, i) => {
            const personality = personalities[Math.floor(Math.random() * personalities.length)];
            const palette = horsePalettes[i % horsePalettes.length];
            // Sprinters have lower odds, Closers higher
            let baseOdds = 3 + Math.random() * 5;
            if (personality === 'closer') baseOdds += 2;
            if (personality === 'sprinter') baseOdds -= 1;

            // Calculate intrinsic capability based on odds. Lower odds = better capability.
            const oddsFactor = 1.0 + (6.0 - baseOdds) * 0.04;

            return {
                id: i,
                name: name,
                color: palette.color,
                odds: parseFloat(baseOdds.toFixed(1)),
                position: 0,
                speed: 0,
                personality: personality,
                acceleration: (0.5 + Math.random() * 0.5) * oddsFactor,
                stamina: 1.0 * oddsFactor,
                baseSpeedMod: oddsFactor,
                isFinished: false
            } as Horse;
        });
    }

    public startRace(horseId: number) {
        this.selectedHorse = horseId;
        this._refreshBet();
        this.phase = 'racing';
        this.raceTime = 0;
        this.winners = [];
        this.horses.forEach(h => {
            h.position = 0;
            h.speed = 0;
            h.stamina = 1.0 * h.baseSpeedMod;
            h.isFinished = false;
        });
    }

    public update(dt: number) {
        if (this.phase !== 'racing') return;

        this.raceTime += dt;
        let allFinished = true;

        this.horses.forEach(horse => {
            if (horse.isFinished) return;

            allFinished = false;

            // Physics-based movement with personality
            let targetSpeed = (80 + Math.random() * 40) * horse.baseSpeedMod;
            const progress = horse.position / this.RACE_DISTANCE;

            switch (horse.personality) {
                case 'sprinter':
                    targetSpeed *= (1.3 - progress * 0.5);
                    break;
                case 'closer':
                    targetSpeed *= (0.8 + progress * 0.6);
                    break;
                case 'balanced':
                    targetSpeed *= 1.05;
                    break;
                case 'erratic':
                    // More extreme drift for erratic horses
                    const drift = Math.sin(this.raceTime * 2 + horse.id) * 0.15;
                    targetSpeed *= (0.9 + drift + Math.random() * 0.4);
                    break;
            }

            // Universal "Adrenaline" micro-boosts for all horses to create drama
            const adrenaline = Math.sin(this.raceTime * 4 + horse.id * 1.5) > 0.8 ? 1.08 : 1.0;
            targetSpeed *= adrenaline;

            // Smooth acceleration
            const accel = horse.personality === 'sprinter' ? 1.5 : 1.0;
            horse.speed += (targetSpeed - horse.speed) * dt * accel;
            horse.position += horse.speed * dt;

            if (horse.position >= this.RACE_DISTANCE) {
                horse.isFinished = true;
                horse.position = this.RACE_DISTANCE;
                horse.finishTime = this.raceTime;
                this.winners.push(horse);
            }
        });

        if (allFinished || (this.winners.length > 0 && this.raceTime > 20)) {
            // Safety timeout or all finished
            this.phase = 'result';
        }
    }

    /** Returns the finishing position (1-8) of the selected horse, or 9 if not yet finished. */
    public getPlacement(): number {
        const idx = this.winners.findIndex(h => h.id === this.selectedHorse);
        return idx === -1 ? 9 : idx + 1;
    }

    /** Fixed prize: 1st=6×bet, 2nd=2×bet, 3rd=1×bet (break even), 4th+=0 */
    public getPayout(): number {
        const mult = HorseRacingGame.PRIZE_MULT[this.getPlacement()] ?? 0;
        return this.betAmount * mult;
    }

    public reset() {
        this.phase = 'betting';
        this.winners = [];
        this.raceTime = 0;
        this._refreshBet();
        this.initHorses();
    }
}
