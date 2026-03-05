/**
 * MinigameThemes — Centralized unique visual identity for every minigame.
 * Each game gets a completely distinct palette to avoid repetition.
 */

export interface MinigameTheme {
    /** Display name for the game */
    name: string;
    /** Background gradient [topColor, bottomColor] */
    bg: [string, string];
    /** Primary accent / glow color */
    accent: string;
    /** Secondary accent color */
    accentAlt: string;
    /** Main text color */
    text: string;
    /** Muted text color (hints, subtitles) */
    textMuted: string;
    /** Title font family string */
    titleFont: string;
    /** Body font family string */
    bodyFont: string;
    /** Optional border glow color (defaults to accent) */
    border?: string;
    /** Particle/sparkle color */
    particle?: string;
}

/**
 * All minigame themes indexed by a unique key.
 * NO two games share the same accent color.
 */
export const MINIGAME_THEMES: Record<string, MinigameTheme> = {
    // ── BAR GAMES ──────────────────────────────────────────
    dice: {
        name: 'DADOS DE RUA',
        bg: ['#0a1428', '#040810'],
        accent: '#00bbff',
        accentAlt: '#0066aa',
        text: '#e8f4ff',
        textMuted: 'rgba(150, 200, 255, 0.5)',
        titleFont: '"Press Start 2P", monospace',
        bodyFont: '"Inter", sans-serif',
        border: '#00bbff',
        particle: '#66ddff',
    },
    purrinha: {
        name: 'PURRINHA',
        bg: ['#1a1008', '#0a0804'],
        accent: '#f5a623',
        accentAlt: '#d4740e',
        text: '#fff5e0',
        textMuted: 'rgba(245, 200, 130, 0.5)',
        titleFont: '"Press Start 2P", monospace',
        bodyFont: '"Inter", sans-serif',
        border: '#f5a623',
        particle: '#ffcc66',
    },
    jokenpo: {
        name: 'JO KEN PO',
        bg: ['#1a0828', '#0a0412'],
        accent: '#ff2d95',
        accentAlt: '#7b2dff',
        text: '#ffe0f5',
        textMuted: 'rgba(255, 150, 220, 0.5)',
        titleFont: '"Press Start 2P", monospace',
        bodyFont: '"Inter", sans-serif',
        border: '#ff2d95',
        particle: '#ff66bb',
    },
    palitinho: {
        name: 'PALITINHO',
        bg: ['#1a1408', '#0a0a04'],
        accent: '#c4a55a',
        accentAlt: '#8b6914',
        text: '#fff8e0',
        textMuted: 'rgba(200, 180, 120, 0.5)',
        titleFont: '"Outfit", sans-serif',
        bodyFont: '"Inter", sans-serif',
        border: '#c4a55a',
        particle: '#ddc888',
    },
    ronda: {
        name: 'RONDA',
        bg: ['#200a0e', '#100408'],
        accent: '#e63946',
        accentAlt: '#a8001e',
        text: '#ffe0e4',
        textMuted: 'rgba(230, 140, 150, 0.5)',
        titleFont: '"Press Start 2P", monospace',
        bodyFont: '"Inter", sans-serif',
        border: '#e63946',
        particle: '#ff6670',
    },
    domino: {
        name: 'DOMINÓ',
        bg: ['#1a1a1a', '#080808'],
        accent: '#e0e0e0',
        accentAlt: '#555555',
        text: '#ffffff',
        textMuted: 'rgba(180, 180, 180, 0.5)',
        titleFont: '"Press Start 2P", monospace',
        bodyFont: '"Inter", sans-serif',
        border: '#888888',
        particle: '#cccccc',
    },
    fantan: {
        name: 'FAN TAN',
        bg: ['#200808', '#100404'],
        accent: '#ff3b3b',
        accentAlt: '#ffd700',
        text: '#fff5e0',
        textMuted: 'rgba(255, 200, 100, 0.5)',
        titleFont: '"Press Start 2P", monospace',
        bodyFont: '"Inter", sans-serif',
        border: '#ff3b3b',
        particle: '#ffd700',
    },
    headstails: {
        name: 'CARA OU COROA',
        bg: ['#141420', '#08080e'],
        accent: '#c0c0c0',
        accentAlt: '#ffd700',
        text: '#f0f0ff',
        textMuted: 'rgba(190, 190, 210, 0.5)',
        titleFont: '"Press Start 2P", monospace',
        bodyFont: '"Inter", sans-serif',
        border: '#c0c0c0',
        particle: '#ffd700',
    },
    horseracing: {
        name: 'GRANDE PRÊMIO',
        bg: ['#0a1a0a', '#040a04'],
        accent: '#228b22',
        accentAlt: '#ffd700',
        text: '#e0ffe0',
        textMuted: 'rgba(150, 220, 150, 0.5)',
        titleFont: '"Outfit", sans-serif',
        bodyFont: '"Inter", sans-serif',
        border: '#228b22',
        particle: '#44cc44',
    },
    dogracing: {
        name: 'CORRIDA DE CÃES',
        bg: ['#1a0a00', '#0a0400'],
        accent: '#ff6b00',
        accentAlt: '#00e5ff',
        text: '#fff0e0',
        textMuted: 'rgba(255, 180, 100, 0.5)',
        titleFont: '"Outfit", sans-serif',
        bodyFont: '"Inter", sans-serif',
        border: '#ff6b00',
        particle: '#ffaa44',
    },
    videobingo: {
        name: 'VIDEO BINGO',
        bg: ['#140a28', '#080414'],
        accent: '#7b2dff',
        accentAlt: '#00e5ff',
        text: '#f0e0ff',
        textMuted: 'rgba(180, 150, 255, 0.5)',
        titleFont: '"Press Start 2P", monospace',
        bodyFont: '"Inter", sans-serif',
        border: '#7b2dff',
        particle: '#aa66ff',
    },

    // ── CASINO GAMES ───────────────────────────────────────
    blackjack: {
        name: 'BLACKJACK',
        bg: ['#0a1a0a', '#040a04'],
        accent: '#daa520',
        accentAlt: '#1a5e1a',
        text: '#fff8e0',
        textMuted: 'rgba(218, 165, 32, 0.5)',
        titleFont: '"Outfit", sans-serif',
        bodyFont: '"Inter", sans-serif',
        border: '#daa520',
        particle: '#ffd700',
    },
    poker: {
        name: 'TEXAS HOLD\'EM',
        bg: ['#081408', '#040a04'],
        accent: '#ffd700',
        accentAlt: '#0a3a0a',
        text: '#fff8d0',
        textMuted: 'rgba(255, 215, 0, 0.4)',
        titleFont: '"Outfit", sans-serif',
        bodyFont: '"Inter", sans-serif',
        border: '#ffd700',
        particle: '#ffee88',
    },
    slot_machine: {
        name: 'CAÇA-NÍQUEL',
        bg: ['#1a0a30', '#0a0518'],
        accent: '#ff2d95',
        accentAlt: '#7b2dff',
        text: '#ffe0f5',
        textMuted: 'rgba(255, 150, 220, 0.4)',
        titleFont: '"Outfit", sans-serif',
        bodyFont: '"Inter", sans-serif',
        border: '#ff2d95',
        particle: '#ff66bb',
    },
    bicho: {
        name: 'JOGO DO BICHO',
        bg: ['#0d3d18', '#041806'],
        accent: '#44ff88',
        accentAlt: '#0d3d18',
        text: '#e0ffe8',
        textMuted: 'rgba(68, 255, 136, 0.4)',
        titleFont: '"Outfit", sans-serif',
        bodyFont: '"Inter", sans-serif',
        border: '#44ff88',
        particle: '#66ffaa',
    },

    // ── ARCADE GAMES ───────────────────────────────────────
    airpong: {
        name: 'AIR PONG',
        bg: ['#0a1028', '#040814'],
        accent: '#00ccff',
        accentAlt: '#ff4444',
        text: '#e0f8ff',
        textMuted: 'rgba(100, 200, 255, 0.5)',
        titleFont: '"Press Start 2P", monospace',
        bodyFont: '"Press Start 2P", monospace',
        border: '#00ccff',
        particle: '#88eeff',
    },
    tankattack: {
        name: 'TANK ATTACK',
        bg: ['#141a0a', '#080a04'],
        accent: '#7cb342',
        accentAlt: '#8b4513',
        text: '#e8f0d8',
        textMuted: 'rgba(124, 179, 66, 0.5)',
        titleFont: '"Press Start 2P", monospace',
        bodyFont: '"Press Start 2P", monospace',
        border: '#556b2f',
        particle: '#a0cc66',
    },
    faroeste: {
        name: 'FAROESTE',
        bg: ['#1a1408', '#0e0a04'],
        accent: '#d2691e',
        accentAlt: '#f5deb3',
        text: '#fff0d0',
        textMuted: 'rgba(210, 180, 130, 0.5)',
        titleFont: '"Press Start 2P", monospace',
        bodyFont: '"Press Start 2P", monospace',
        border: '#d2691e',
        particle: '#e8b866',
    },
    riscafaca: {
        name: 'RISCA FACA',
        bg: ['#1a0808', '#0e0404'],
        accent: '#cc0000',
        accentAlt: '#666666',
        text: '#ffe0e0',
        textMuted: 'rgba(200, 100, 100, 0.5)',
        titleFont: '"Press Start 2P", monospace',
        bodyFont: '"Press Start 2P", monospace',
        border: '#cc0000',
        particle: '#ff4444',
    },
    sinuca: {
        name: 'SINUCA',
        bg: ['#081a10', '#040e08'],
        accent: '#009966',
        accentAlt: '#2e8b57',
        text: '#e0fff0',
        textMuted: 'rgba(100, 200, 150, 0.5)',
        titleFont: '"Press Start 2P", monospace',
        bodyFont: '"Press Start 2P", monospace',
        border: '#009966',
        particle: '#44cc88',
    },

    // ── SELECTION MENUS ────────────────────────────────────
    arcade_menu: {
        name: 'FLIPERAMA',
        bg: ['#050a14', '#020408'],
        accent: '#00ff88',
        accentAlt: '#ff00ff',
        text: '#e0ffe8',
        textMuted: 'rgba(100, 255, 180, 0.4)',
        titleFont: '"Press Start 2P", monospace',
        bodyFont: '"Press Start 2P", monospace',
        border: '#00ff88',
        particle: '#66ffaa',
    },
    bar_menu: {
        name: 'BAR',
        bg: ['#1a1008', '#0a0804'],
        accent: '#e8a020',
        accentAlt: '#8b4513',
        text: '#fff0d0',
        textMuted: 'rgba(220, 180, 100, 0.4)',
        titleFont: '"Outfit", sans-serif',
        bodyFont: '"Inter", sans-serif',
        border: '#e8a020',
        particle: '#ffcc66',
    },
};
