/**
 * SlotMachine — 3-reel caça-níquel logic.
 * Supports multiple themes (Fruits, Animals, Shapes, Food).
 */

export type SlotTheme = 'fruits' | 'animals' | 'shapes' | 'food' | 'ocean' | 'space';

export interface SlotResult {
    reels: number[];
    symbols: string[];
    payout: number;
    isJackpot: boolean;
}

export class SlotMachine {
    static readonly THEMES: Record<SlotTheme, { symbols: string[], payouts: Record<string, number> }> = {
        fruits: {
            symbols: ['🍒', '🍋', '🔔', '💎', '7️⃣', '⭐'],
            payouts: { '🍒': 2, '🍋': 3, '🔔': 4, '💎': 6, '7️⃣': 10, '⭐': 15 }
        },
        animals: {
            symbols: ['🐶', '🐱', '🦊', '🐯', '🦁', '🐉'],
            payouts: { '🐶': 2, '🐱': 3, '🦊': 4, '🐯': 6, '🦁': 10, '🐉': 15 }
        },
        shapes: {
            symbols: ['🔴', '🟦', '🔺', '⭐', '💎', '☀️'],
            payouts: { '🔴': 2, '🟦': 3, '🔺': 4, '⭐': 6, '💎': 10, '☀️': 15 }
        },
        food: {
            symbols: ['🍕', '🍔', '🍟', '🍦', '🍩', '🍰'],
            payouts: { '🍕': 2, '🍔': 3, '🍟': 4, '🍦': 6, '🍩': 10, '🍰': 15 }
        },
        ocean: {
            symbols: ['🐟', '🐙', '🐚', '🦀', '🦈', '🧜'],
            payouts: { '🐟': 2, '🐙': 3, '🐚': 4, '🦀': 6, '🦈': 10, '🧜': 15 }
        },
        space: {
            symbols: ['🚀', '🛸', '🪐', '👽', '☄️', '🌌'],
            payouts: { '🚀': 2, '🛸': 3, '🪐': 4, '👽': 6, '☄️': 10, '🌌': 15 }
        }
    };

    /**
     * Spin the slot machine.
     * @param bet - Amount wagered
     * @param themeName - The theme to use
     * @returns SlotResult with reel positions, symbols and payout
     */
    public spin(bet: number, themeName: SlotTheme = 'fruits'): SlotResult {
        const theme = SlotMachine.THEMES[themeName];
        const symbolsList = theme.symbols;

        const reels = [
            Math.floor(Math.random() * symbolsList.length),
            Math.floor(Math.random() * symbolsList.length),
            Math.floor(Math.random() * symbolsList.length),
        ];

        const s0 = symbolsList[reels[0]];
        const s1 = symbolsList[reels[1]];
        const s2 = symbolsList[reels[2]];

        let payout = 0;
        let isJackpot = false;

        if (s0 === s1 && s1 === s2) {
            // Three of a kind
            const multi = theme.payouts[s0] || 2;
            payout = bet * multi;
            // Last symbol in list is the jackpot
            if (s0 === symbolsList[symbolsList.length - 1]) isJackpot = true;
        } else if (s0 === s1 || s1 === s2 || s0 === s2) {
            // Two of a kind — devolver a aposta (empata)
            payout = bet;
        }

        return {
            reels,
            symbols: [s0, s1, s2],
            payout,
            isJackpot
        };
    }
}
