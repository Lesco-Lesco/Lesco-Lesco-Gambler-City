import { EconomyManager } from '../Core/EconomyManager';

export type DogPersonality = 'sprinter' | 'closer' | 'balanced' | 'erratic';

export interface Dog {
    id: number;
    name: string;
    breed: string;
    color: string;
    odds: number;
    position: number;
    speed: number;
    personality: DogPersonality;
    acceleration: number;
    stamina: number;
    baseSpeedMod: number; // Used to bias the speed calculation
    isFinished: boolean;
    finishTime?: number;
}

export class DogRacingGame {
    public dogs: Dog[] = [];
    public phase: 'betting' | 'racing' | 'result' = 'betting';
    public selectedDog: number = 0;
    public betAmount: number = 10;   // Set automatically from EconomyManager on init/reset
    public isPeriphery: boolean = false;
    public winners: Dog[] = [];
    public raceTime: number = 0;
    public readonly RACE_DISTANCE = 1000;

    // Fixed prize table (relative to betAmount)
    // 1st: 5× bet (50 if bet 10)
    // 2nd: 3× bet (30 if bet 10)
    // 3rd: 2× bet (20 if bet 10)
    // 4th: 1× bet (10 if bet 10 - consolation)
    private static readonly PRIZE_MULT: Record<number, number> = { 1: 5, 2: 3, 3: 2, 4: 1 };

    constructor(isPeriphery: boolean = false) {
        this.isPeriphery = isPeriphery;
        this._refreshBet();
        this.initDogs();
    }

    private _refreshBet() {
        const limits = this.isPeriphery
            ? EconomyManager.getInstance().getPeripheryBetLimits()
            : EconomyManager.getInstance().getBetLimits();
        this.betAmount = limits.min;
    }

    private initDogs() {
        const namePool = [
            "Augusto", "Nero", "Pompônio", "Constantino", "Marco Aurélio",
            "Cléber", "Horácio", "Virgílio", "Sêneca", "Tácito",
            "Bruto", "Cassandro", "Antônio", "Otelo", "Spartacus",
            "Mário", "Sila", "Graco", "Crasso", "Lépido"
        ];
        const breedPool = [
            "Greyhound", "Whippet", "Saluki", "Borzoi", "Afghan Hound",
            "Sloughi", "Azawakh", "Galgo", "Magyar Agár", "Pharaoh"
        ];

        // Shuffle and pick 8
        const names = namePool.sort(() => 0.5 - Math.random()).slice(0, 8);

        const dogPalettes = [
            { color: '#5C4033' }, // Marrom Escuro 1
            { color: '#FFFFFF' }, // Branco 1
            { color: '#D2B48C' }, // Marrom Claro (Tan)
            { color: '#3D2B1F' }, // Marrom Escuro 2
            { color: '#C19A6B' }, // Marrom Claro (Fawn)
            { color: '#FFFFFF' }, // Branco 2
            { color: '#4B3621' }, // Marrom Escuro 3
            { color: '#A0522D' }  // Marrom (Sienna)
        ];
        const personalities: DogPersonality[] = ['sprinter', 'closer', 'balanced', 'erratic'];

        this.dogs = names.map((name, i) => {
            const personality = personalities[Math.floor(Math.random() * personalities.length)];
            const breed = breedPool[Math.floor(Math.random() * breedPool.length)];
            const palette = dogPalettes[i % dogPalettes.length];
            let baseOdds = 4 + Math.random() * 6;
            if (personality === 'closer') baseOdds += 2;
            if (personality === 'sprinter') baseOdds -= 1;

            // Calculate intrinsic capability based on odds. Lower odds = better capability
            // Max odds is around 12, min odds is around 3.
            // Let's create a speed modifier where 3 odds gives 1.1x speed, 12 odds gives 0.9x speed.
            const oddsFactor = 1.0 + (7.5 - baseOdds) * 0.03;

            return {
                id: i,
                name: name,
                breed: breed,
                color: palette.color,
                odds: parseFloat(baseOdds.toFixed(1)),
                position: 0,
                speed: 0,
                personality: personality,
                acceleration: (0.6 + Math.random() * 0.4) * oddsFactor,
                stamina: 1.0 * oddsFactor,
                baseSpeedMod: oddsFactor,
                isFinished: false
            } as Dog;
        });
    }

    public startRace(dogId: number) {
        this.selectedDog = dogId;
        this._refreshBet();
        this.phase = 'racing';
        this.raceTime = 0;
        this.winners = [];
        this.dogs.forEach(d => {
            d.position = 0;
            d.speed = 0;
            d.isFinished = false;
            d.finishTime = undefined;
            d.stamina = (0.9 + Math.random() * 0.2) * d.baseSpeedMod;
        });
    }

    public update(dt: number) {
        if (this.phase !== 'racing') return;

        this.raceTime += dt;
        let allFinished = true;

        this.dogs.forEach(dog => {
            if (dog.isFinished) return;

            allFinished = false;

            // Logic based on personality and race progress
            const progress = dog.position / this.RACE_DISTANCE;
            let targetSpeed = (160 + Math.random() * 60) * dog.baseSpeedMod; // Base speed influenced by odds

            if (dog.personality === 'sprinter' && progress < 0.4) targetSpeed *= 1.25;
            if (dog.personality === 'sprinter' && progress > 0.7) targetSpeed *= 0.8;
            if (dog.personality === 'closer' && progress > 0.6) targetSpeed *= 1.3;
            if (dog.personality === 'erratic') targetSpeed *= (0.7 + Math.random() * 0.8);

            // "Adrenaline" micro-boosts for more position swapping drama
            const adrenaline = Math.sin(this.raceTime * 5 + dog.id * 2) > 0.7 ? 1.12 : 1.0;
            targetSpeed *= adrenaline;

            targetSpeed *= dog.stamina;

            // Simple physics
            dog.speed += (targetSpeed - dog.speed) * dog.acceleration * dt * 2;
            dog.position += dog.speed * dt;

            // Stamina drain
            dog.stamina -= 0.02 * dt;

            if (dog.position >= this.RACE_DISTANCE) {
                dog.isFinished = true;
                dog.finishTime = this.raceTime;
                this.winners.push(dog);
            }
        });

        if (allFinished || this.winners.length === this.dogs.length) {
            this.phase = 'result';
        }
    }

    /** Returns the finishing position (1-8) of the selected dog, or 9 if not yet finished. */
    public getPlacement(): number {
        const idx = this.winners.findIndex(d => d.id === this.selectedDog);
        return idx === -1 ? 9 : idx + 1;
    }

    /** Fixed prize: 1st=6×bet, 2nd=2×bet, 3rd=1×bet (break even), 4th+=0 */
    public getPayout(): number {
        const mult = DogRacingGame.PRIZE_MULT[this.getPlacement()] ?? 0;
        return this.betAmount * mult;
    }

    public reset() {
        this.phase = 'betting';
        this.selectedDog = 0;
        this.winners = [];
        this.raceTime = 0;
        this._refreshBet();
        this.initDogs();
    }
}
