/**
 * BaseMinigame — Shared interfaces for all minigames.
 * Each game class implements IMinigame; each UI class implements IMinigameUI.
 */

/**
 * Core contract for minigame logic classes (DiceGame, PurrinhaGame, etc.)
 */
export interface IMinigame {
    /** Current game phase (game-specific string union) */
    phase: string;

    /** Current bet amount */
    betAmount: number;

    /** Minimum bet allowed */
    minBet: number;

    /** Maximum bet allowed */
    maxBet: number;

    /** Update bet limits from EconomyManager */
    updateLimits(): void;

    /** Calculate net profit/loss for the player. Called after game ends. */
    settle(): number;

    /** Reset game state for a new round */
    reset(...args: any[]): void;
}

/**
 * Core contract for minigame UI/rendering classes.
 */
export interface IMinigameUI {
    /** Process input and advance UI state */
    update(dt: number): void;

    /** Render the minigame overlay */
    render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void;
}
