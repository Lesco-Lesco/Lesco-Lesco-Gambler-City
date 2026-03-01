

export interface WinPattern {
    type: 'row' | 'col' | 'diag' | 'corner';
    index?: number;
}

export interface BingoCard {
    playerName: string;
    numbers: number[][]; // 5x5 (central is free/0)
    marked: boolean[][];
    winningPatterns: WinPattern[];
}

const NPC_NAMES = [
    "Tiquinho", "Zé do Bar", "Manoel", "Chico", "Beto", "Cida",
    "Sargento Gomes", "Toninho", "Lúcia", "Raimundo", "Bia",
    "Geraldo", "Baiano", "Vovô", "Xuxa", "Paulinho", "Sueli"
];

export class VideoBingoGame {
    public cards: BingoCard[] = [];
    public drawnNumbers: Set<number> = new Set();
    public phase: 'betting' | 'picking' | 'playing' | 'result' = 'betting';
    public betAmount: number = 0;
    public totalPayout: number = 0;
    public selectedCardIndex: number = -1;
    public winners: number[] = []; // Indices of winning cards
    public winnerNames: string[] = [];
    public lastDrawnNumber: number | null = null;
    public drawnHistory: number[] = [];

    constructor() {
        this.initCards();
    }

    private initCards() {
        this.cards = [];
        for (let c = 0; c < 4; c++) {
            const card: BingoCard = {
                playerName: "???",
                numbers: [],
                marked: [],
                winningPatterns: []
            };
            const pool = Array.from({ length: 90 }, (_, i) => i + 1);
            for (let r = 0; r < 5; r++) {
                card.numbers[r] = [];
                card.marked[r] = [];
                for (let col = 0; col < 5; col++) {
                    const idx = Math.floor(Math.random() * pool.length);
                    card.numbers[r][col] = pool.splice(idx, 1)[0];
                    card.marked[r][col] = false;
                }
            }
            // Free space center
            card.numbers[2][2] = 0;
            card.marked[2][2] = true;
            this.cards.push(card);
        }
    }

    public start() {
        this.phase = 'picking';
        this.drawnNumbers.clear();
        this.drawnHistory = [];
        this.lastDrawnNumber = null;
        this.totalPayout = 0;
        this.selectedCardIndex = -1;
        this.winners = [];
        this.winnerNames = [];
        this.cards.forEach(c => {
            c.playerName = "???"; // Reset names for new round
            c.winningPatterns = [];
            for (let r = 0; r < 5; r++) {
                for (let col = 0; col < 5; col++) {
                    c.marked[r][col] = (r === 2 && col === 2);
                }
            }
        });
    }

    public selectCard(index: number, bet: number) {
        this.selectedCardIndex = index;
        this.betAmount = bet;
        this.phase = 'playing';

        // Assign names now
        const namesPool = [...NPC_NAMES];
        this.cards.forEach((card, i) => {
            if (i === index) {
                card.playerName = "VOCÊ";
            } else {
                const nameIdx = Math.floor(Math.random() * namesPool.length);
                card.playerName = namesPool.splice(nameIdx, 1)[0];
            }
        });
    }

    public drawNext() {
        if (this.phase === 'result' || this.drawnNumbers.size >= 90) {
            return null;
        }

        let num;
        do {
            num = Math.floor(Math.random() * 90) + 1;
        } while (this.drawnNumbers.has(num));

        this.drawnNumbers.add(num);
        this.drawnHistory.push(num);
        this.lastDrawnNumber = num;
        this.markCards(num);

        // Check for winner after each draw
        this.calculatePayout();
        if (this.winners.length > 0) {
            this.phase = 'result';
            return num;
        }

        return num;
    }

    private markCards(num: number) {
        this.cards.forEach(card => {
            for (let r = 0; r < 5; r++) {
                for (let c = 0; c < 5; c++) {
                    if (card.numbers[r][c] === num) {
                        card.marked[r][c] = true;
                    }
                }
            }
        });
    }

    private calculatePayout() {
        this.winners = [];
        this.winnerNames = [];
        this.cards.forEach((card, cardIdx) => {
            card.winningPatterns = [];
            // Rows
            for (let r = 0; r < 5; r++) {
                if (card.marked[r].every(m => m)) {
                    card.winningPatterns.push({ type: 'row', index: r });
                }
            }
            // Cols
            for (let c = 0; c < 5; c++) {
                let colWin = true;
                for (let r = 0; r < 5; r++) {
                    if (!card.marked[r][c]) colWin = false;
                }
                if (colWin) {
                    card.winningPatterns.push({ type: 'col', index: c });
                }
            }
            // Diagonals
            let d1 = true, d2 = true;
            for (let i = 0; i < 5; i++) {
                if (!card.marked[i][i]) d1 = false;
                if (!card.marked[i][4 - i]) d2 = false;
            }
            if (d1) card.winningPatterns.push({ type: 'diag', index: 1 });
            if (d2) card.winningPatterns.push({ type: 'diag', index: 2 });

            // Corners
            if (card.marked[0][0] && card.marked[0][4] && card.marked[4][0] && card.marked[4][4]) {
                card.winningPatterns.push({ type: 'corner' });
            }

            if (card.winningPatterns.length > 0) {
                this.winners.push(cardIdx);
                this.winnerNames.push(card.playerName);
            }
        });

        // Player only gets paid if their card is in the winners list
        if (this.winners.includes(this.selectedCardIndex)) {
            // Maximum payout is the total pot (4 cards * 10 bet = 40)
            this.totalPayout = 40;
        } else {
            this.totalPayout = 0;
        }
    }

    public reset() {
        this.phase = 'betting';
        this.drawnNumbers.clear();
        this.initCards();
    }
}
