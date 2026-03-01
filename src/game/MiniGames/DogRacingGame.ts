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
    isFinished: boolean;
    finishTime?: number;
}

export class DogRacingGame {
    public dogs: Dog[] = [];
    public phase: 'betting' | 'racing' | 'result' = 'betting';
    public selectedDog: number = 0;
    public betAmount: number = 10;
    public winners: Dog[] = [];
    public raceTime: number = 0;
    public readonly RACE_DISTANCE = 1000;

    constructor() {
        this.initDogs();
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

            return {
                id: i,
                name: name,
                breed: breed,
                color: palette.color,
                odds: parseFloat(baseOdds.toFixed(1)),
                position: 0,
                speed: 0,
                personality: personality,
                acceleration: 0.6 + Math.random() * 0.4,
                stamina: 1.0,
                isFinished: false
            };
        });
    }

    public startRace(dogId: number, amount: number) {
        this.selectedDog = dogId;
        this.betAmount = amount;
        this.phase = 'racing';
        this.raceTime = 0;
        this.winners = [];
        this.dogs.forEach(d => {
            d.position = 0;
            d.speed = 0;
            d.isFinished = false;
            d.finishTime = undefined;
            d.stamina = 0.9 + Math.random() * 0.2;
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
            let targetSpeed = 160 + Math.random() * 60; // Base speed for dogs (slightly faster than horses in units)

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

    public getPayout(): number {
        if (this.winners.length > 0 && this.winners[0].id === this.selectedDog) {
            const rawPayout = this.betAmount * this.winners[0].odds;
            return Math.floor(rawPayout / 10) * 10;
        }
        return 0;
    }

    public reset() {
        this.phase = 'betting';
        this.selectedDog = 0;
        this.betAmount = 10;
        this.winners = [];
        this.raceTime = 0;
        this.initDogs();
    }
}
