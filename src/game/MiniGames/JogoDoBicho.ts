/**
 * Jogo do Bicho — traditional Brazilian animal betting game.
 * 25 animals, each with 4 associated numbers (01-00).
 * Results generated pseudo-randomly.
 * Bets close at 18:00, results at 09:00.
 */

export interface BichoAnimal {
    name: string;
    emoji: string;
    numbers: number[]; // 4 numbers per animal
}

export interface BichoResult {
    winningAnimal: number; // index 0-24
    numbers: number[];     // the 4 winning numbers
    timestamp: number;     // when the result was generated
}

export class JogoDoBicho {
    /** The 25 official Jogo do Bicho animals */
    static readonly ANIMALS: BichoAnimal[] = [
        { name: 'Avestruz', emoji: '🐦', numbers: [1, 2, 3, 4] },
        { name: 'Águia', emoji: '🦅', numbers: [5, 6, 7, 8] },
        { name: 'Burro', emoji: '🐴', numbers: [9, 10, 11, 12] },
        { name: 'Borboleta', emoji: '🦋', numbers: [13, 14, 15, 16] },
        { name: 'Cachorro', emoji: '🐕', numbers: [17, 18, 19, 20] },
        { name: 'Cabra', emoji: '🐐', numbers: [21, 22, 23, 24] },
        { name: 'Carneiro', emoji: '🐑', numbers: [25, 26, 27, 28] },
        { name: 'Camelo', emoji: '🐪', numbers: [29, 30, 31, 32] },
        { name: 'Cobra', emoji: '🐍', numbers: [33, 34, 35, 36] },
        { name: 'Coelho', emoji: '🐇', numbers: [37, 38, 39, 40] },
        { name: 'Cavalo', emoji: '🐎', numbers: [41, 42, 43, 44] },
        { name: 'Elefante', emoji: '🐘', numbers: [45, 46, 47, 48] },
        { name: 'Galo', emoji: '🐓', numbers: [49, 50, 51, 52] },
        { name: 'Gato', emoji: '🐱', numbers: [53, 54, 55, 56] },
        { name: 'Jacaré', emoji: '🐊', numbers: [57, 58, 59, 60] },
        { name: 'Leão', emoji: '🦁', numbers: [61, 62, 63, 64] },
        { name: 'Macaco', emoji: '🐒', numbers: [65, 66, 67, 68] },
        { name: 'Porco', emoji: '🐷', numbers: [69, 70, 71, 72] },
        { name: 'Pavão', emoji: '🦚', numbers: [73, 74, 75, 76] },
        { name: 'Peru', emoji: '🦃', numbers: [77, 78, 79, 80] },
        { name: 'Touro', emoji: '🐂', numbers: [81, 82, 83, 84] },
        { name: 'Tigre', emoji: '🐅', numbers: [85, 86, 87, 88] },
        { name: 'Urso', emoji: '🐻', numbers: [89, 90, 91, 92] },
        { name: 'Veado', emoji: '🦌', numbers: [93, 94, 95, 96] },
        { name: 'Vaca', emoji: '🐄', numbers: [97, 98, 99, 0] },
    ];

    private lastResult: BichoResult | null = null;
    private seed: number;

    constructor() {
        // Use current timestamp as seed for this session
        this.seed = Date.now();
    }

    /** Generate a deterministic result based on the seed */
    public getResult(): BichoResult {
        if (this.lastResult) return this.lastResult;

        // Pseudo-random based on seed
        const hash = Math.sin(this.seed * 12.9898 + 78.233) * 43758.5453;
        const winningAnimal = Math.floor((hash - Math.floor(hash)) * 25);
        const animal = JogoDoBicho.ANIMALS[winningAnimal];

        this.lastResult = {
            winningAnimal,
            numbers: animal.numbers,
            timestamp: Date.now(),
        };

        return this.lastResult;
    }

    /** Reset for a new day/round */
    public newRound() {
        this.seed = Date.now() + Math.random() * 10000;
        this.lastResult = null;
    }

    /** Check if betting is currently allowed */
    public canBet(): boolean {
        return true; // Always open in Endless Night
    }
}
