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
            payouts: { '🍒': 3, '🍋': 5, '🔔': 8, '💎': 15, '7️⃣': 25, '⭐': 50 }
        },
        animals: {
            symbols: ['🐶', '🐱', '🦊', '🐯', '🦁', '🐉'],
            payouts: { '🐶': 3, '🐱': 5, '🦊': 8, '🐯': 15, '🦁': 25, '🐉': 50 }
        },
        shapes: {
            symbols: ['🔴', '🟦', '🔺', '⭐', '💎', '☀️'],
            payouts: { '🔴': 3, '🟦': 5, '🔺': 8, '⭐': 15, '💎': 25, '☀️': 50 }
        },
        food: {
            symbols: ['🍕', '🍔', '🍟', '🍦', '🍩', '🍰'],
            payouts: { '🍕': 3, '🍔': 5, '🍟': 8, '🍦': 15, '🍩': 25, '🍰': 50 }
        },
        ocean: {
            symbols: ['🐟', '🐙', '🐚', '🦀', '🦈', '🧜'],
            payouts: { '🐟': 3, '🐙': 5, '🐚': 8, '🦀': 15, '🦈': 25, '🧜': 50 }
        },
        space: {
            symbols: ['🚀', '🛸', '🪐', '👽', '☄️', '🌌'],
            payouts: { '🚀': 3, '🛸': 5, '🪐': 8, '👽': 15, '☄️': 25, '🌌': 50 }
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
            const multi = theme.payouts[s0] || 3;
            payout = bet * multi;
            // Last symbol in list is typically the jackpot
            if (s0 === symbolsList[symbolsList.length - 1]) isJackpot = true;
        } else if (s0 === s1 || s1 === s2 || s0 === s2) {
            // Two of a kind — small return
            payout = Math.floor(bet * 1.5);
        }

        return {
            reels,
            symbols: [s0, s1, s2],
            payout,
            isJackpot
        };
    }
}
