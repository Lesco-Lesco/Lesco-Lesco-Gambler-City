import { LudoGame } from './LudoGame';
import { InputManager } from '../Core/InputManager';
import { BichoManager } from '../BichoManager';
import { EconomyManager } from '../Core/EconomyManager';
import { isMobile } from '../Core/MobileDetect';
import { UIScale } from '../Core/UIScale';
import { MINIGAME_THEMES } from '../Core/MinigameThemes';
import { drawMinigameBackground, drawMinigameTitle, drawMinigameFooter } from '../Core/MinigameBackground';
import type { IMinigameUI } from './BaseMinigame';
import { SoundManager } from '../Core/SoundManager';

const TRACK_SIZE = 40;

export class LudoUI implements IMinigameUI {
    private game: LudoGame;
    private hasSettled: boolean = false;
    private onClose: (moneyChange: number) => void;
    private onPlayAgain: (moneyChange: number) => void;
    private diceAnimTimer: number = 0;
    private lastDiceDisplay: number = 1;

    constructor(
        game: LudoGame,
        onClose: (moneyChange: number) => void,
        onPlayAgain: (moneyChange: number) => void,
    ) {
        this.game = game;
        this.onClose = onClose;
        this.onPlayAgain = onPlayAgain;
    }

    public update(dt: number) {
        const input = InputManager.getInstance();
        const bmanager = BichoManager.getInstance();
        const { step } = EconomyManager.getInstance().getBetLimits();

        // NPC turn update
        this.game.updateNPC(dt);

        if (this.diceAnimTimer > 0) this.diceAnimTimer -= dt;

        if (this.game.phase === 'betting') {
            this.hasSettled = false;
            if (input.wasPressedOrHeld('ArrowUp', dt) || input.wasPressedOrHeld('KeyW', dt)) {
                this.game.betAmount = Math.min(this.game.maxBet, this.game.betAmount + step);
                SoundManager.getInstance().play('menu_select');
            }
            if (input.wasPressedOrHeld('ArrowDown', dt) || input.wasPressedOrHeld('KeyS', dt)) {
                this.game.betAmount = Math.max(this.game.minBet, this.game.betAmount - step);
                SoundManager.getInstance().play('menu_select');
            }
            if (input.wasPressed('Space') || input.wasPressed('Enter') || input.wasPressed('KeyE')) {
                if (bmanager.playerMoney >= this.game.betAmount) {
                    bmanager.playerMoney -= this.game.betAmount;
                    this.game.startRound(this.game.betAmount);
                    SoundManager.getInstance().play('bet_place');
                }
            }
        } else if (this.game.phase === 'playing') {
            if (this.game.turnIndex === 0) {
                // Human's turn
                if (!this.game.hasRolled) {
                    if (input.wasPressed('Space') || input.wasPressed('Enter') || input.wasPressed('KeyE')) {
                        this.game.rollDice();
                        this.diceAnimTimer = 0.4;
                        SoundManager.getInstance().play('dice_roll');
                    }
                } else {
                    const movable = this.game.getMovablePawns(0, this.game.diceValue);
                    if (movable.length > 0) {
                        if (input.wasPressed('ArrowLeft') || input.wasPressed('KeyA')) {
                            const idx = movable.indexOf(this.game.selectedPawnIndex);
                            this.game.selectedPawnIndex = movable[(idx - 1 + movable.length) % movable.length];
                            SoundManager.getInstance().play('menu_select');
                        }
                        if (input.wasPressed('ArrowRight') || input.wasPressed('KeyD')) {
                            const idx = movable.indexOf(this.game.selectedPawnIndex);
                            this.game.selectedPawnIndex = movable[(idx + 1) % movable.length];
                            SoundManager.getInstance().play('menu_select');
                        }
                        if (input.wasPressed('Space') || input.wasPressed('Enter') || input.wasPressed('KeyE')) {
                            if (movable.includes(this.game.selectedPawnIndex)) {
                                this.game.movePawn(0, this.game.selectedPawnIndex);
                                SoundManager.getInstance().play('dice_roll');
                            }
                        }
                    }
                }
            }
        } else if (this.game.phase === 'result') {
            if (!this.hasSettled) {
                if (this.game.winner?.isHuman) {
                    bmanager.playerMoney += this.game.betAmount * 2;
                }
                this.hasSettled = true;
            }
            if (input.wasPressed('Space') || input.wasPressed('Enter') || input.wasPressed('KeyE')) {
                const win = this.game.winner?.isHuman ? this.game.betAmount * 2 : 0;
                if (bmanager.playerMoney < this.game.minBet) {
                    bmanager.addNotification('Sem grana para apostar!', 3);
                    this.onClose(win);
                } else {
                    SoundManager.getInstance().play(win > 0 ? 'win_small' : 'lose');
                    this.onPlayAgain(win);
                    this.game.reset();
                }
            }
        }

        if (input.wasPressed('Escape')) {
            const finalWin = (this.game.phase === 'result' && this.game.winner?.isHuman) ? this.game.betAmount * 2 : 0;
            this.onClose(finalWin);
        }
    }

    public render(ctx: CanvasRenderingContext2D, width: number, height: number) {
        const theme = MINIGAME_THEMES.ludo;
        drawMinigameBackground(ctx, width, height, theme);
        drawMinigameTitle(ctx, width, height, theme, 'LUDO — 1 VS 1');

        const cx = width / 2;
        const cy = height / 2;

        if (this.game.phase === 'betting') {
            this.drawBettingUI(ctx, cx, cy, theme);
        } else {
            this.drawBoard(ctx, cx, cy, width, height, theme);
            this.drawStatus(ctx, cx, height, theme);
            this.drawDiceArea(ctx, cx, height, theme);
            if (this.game.phase === 'result') {
                this.drawResultUI(ctx, cx, cy, theme);
            }
        }

        const hint = isMobile()
            ? '[DPAD] Selecionar • [OK] Rolar / Mover • [ ✕ ] Sair'
            : 'ESPAÇO Rolar/Mover • ← → Selecionar peça • ESC Sair';
        drawMinigameFooter(ctx, width, height, theme, hint);
    }

    private drawBettingUI(ctx: CanvasRenderingContext2D, cx: number, cy: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);

        ctx.fillStyle = theme.textMuted;
        ctx.font = `600 ${r(14)}px ${theme.bodyFont}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('VALOR DA PARTIDA', cx, cy - s(60));

        const isBroke = BichoManager.getInstance().playerMoney < this.game.minBet;
        ctx.fillStyle = isBroke ? '#f87171' : '#fff';
        ctx.font = `bold ${r(48)}px ${theme.titleFont}`;
        ctx.shadowBlur = s(20);
        ctx.shadowColor = theme.accent + '88';
        ctx.fillText(isBroke ? 'SEM GRANA!' : `R$ ${this.game.betAmount}`, cx, cy + s(10));
        ctx.shadowBlur = 0;

        // Rules hint
        ctx.fillStyle = theme.textMuted;
        ctx.font = `${r(10)}px ${theme.bodyFont}`;
        ctx.fillText('Ganhe: 2x • Tire 6 para sair da base • Capture peças inimigas!', cx, cy + s(70));
    }

    private drawStatus(ctx: CanvasRenderingContext2D, cx: number, height: number, theme: any) {
        const r = UIScale.r.bind(UIScale);
        const y = height * 0.13;

        ctx.fillStyle = theme.accent;
        ctx.font = `bold ${r(14)}px ${theme.bodyFont}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.game.message.toUpperCase(), cx, y);
    }

    private drawDiceArea(ctx: CanvasRenderingContext2D, cx: number, height: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const y = height * 0.87;
        const diceSize = s(32);

        // Dice
        const displayValue = this.diceAnimTimer > 0
            ? Math.ceil(Math.random() * 6)
            : (this.game.diceValue || this.lastDiceDisplay);

        if (this.game.diceValue > 0) this.lastDiceDisplay = this.game.diceValue;

        ctx.save();
        ctx.fillStyle = this.game.hasRolled ? theme.accent : '#ffffff22';
        ctx.shadowBlur = this.game.hasRolled ? s(15) : 0;
        ctx.shadowColor = theme.accent;
        const dx = cx - diceSize / 2;
        const dy = y - diceSize / 2;
        ctx.beginPath();
        ctx.roundRect(dx, dy, diceSize, diceSize, s(6));
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = this.game.hasRolled ? '#111' : theme.textMuted;
        ctx.font = `bold ${r(20)}px ${theme.titleFont}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${displayValue}`, cx, y);
        ctx.restore();

        // Hint
        if (!this.game.hasRolled && this.game.turnIndex === 0 && this.game.phase === 'playing') {
            ctx.fillStyle = theme.textMuted;
            ctx.font = `${r(10)}px ${theme.bodyFont}`;
            ctx.fillText('ESPAÇO para jogar o dado', cx, y + s(28));
        }
    }

    private drawBoard(ctx: CanvasRenderingContext2D, cx: number, cy: number, width: number, height: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const boardSize = Math.min(width, height) * 0.52;
        const cellSize = boardSize / 7;
        const bx = cx - boardSize / 2;
        const by = cy - boardSize * 0.3;

        // Board background
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.roundRect(bx - s(8), by - s(8), boardSize + s(16), boardSize + s(16), s(12));
        ctx.fill();

        // Board cells (simplified cross Ludo board — just show the 40-square track as a ring)
        const COLORS_HUMAN = '#e74c3c';
        const COLORS_NPC = '#2980b9';
        // Draw safe zones

        // Draw track cells as a ring
        const trackCells = this.getTrackCellPositions(bx, by, cellSize);

        // Background
        for (let i = 0; i < 40; i++) {
            const { x, y: cy2, w, h } = trackCells[i];
            // Highlight zones
            const isSafe = i === 0 || i === 20 || i === 10 || i === 30;
            ctx.fillStyle = isSafe ? '#1a4a2a' : '#2a2a2a';
            ctx.beginPath();
            ctx.roundRect(x, cy2, w, h, s(2));
            ctx.fill();
            ctx.strokeStyle = '#444';
            ctx.lineWidth = 0.5;
            ctx.stroke();
        }

        // Home bases
        this.drawBase(ctx, bx, by, cellSize, COLORS_HUMAN, this.game.players[0], theme);
        this.drawBase(ctx, bx + boardSize - cellSize * 2, by + boardSize - cellSize * 2, cellSize, COLORS_NPC, this.game.players[1], theme);

        // Pawns on track
        for (let pi = 0; pi < 2; pi++) {
            const player = this.game.players[pi];
            const color = pi === 0 ? COLORS_HUMAN : COLORS_NPC;
            for (let j = 0; j < player.pawns.length; j++) {
                const pawn = player.pawns[j];
                if (pawn.pos >= 0 && pawn.pos < TRACK_SIZE) {
                    const { x: px, y: py, w: pw, h: ph } = trackCells[pawn.pos];
                    const isSelected = pi === 0 && this.game.selectedPawnIndex === j && this.game.hasRolled;
                    this.drawPawn(ctx, px + pw / 2, py + ph / 2, cellSize * 0.35, color, isSelected, pawn.isHome);
                } else if (pawn.isHome) {
                    // Home area
                    const hx = pi === 0
                        ? (bx + cellSize * 3 + j * cellSize * 0.4)
                        : (bx + boardSize - cellSize * 3 + j * cellSize * 0.4);
                    const hy = pi === 0 ? (by + boardSize * 0.5 + j * cellSize * 0.4) : (by + boardSize * 0.5);
                    this.drawPawn(ctx, hx, hy, cellSize * 0.28, color, false, true);
                }
            }
        }
    }

    private getTrackCellPositions(bx: number, by: number, cellSize: number) {
        const w = cellSize * 0.75;
        const h = cellSize * 0.75;
        const cells: { x: number; y: number; w: number; h: number }[] = [];

        const boardW = cellSize * 7;
        const boardH = cellSize * 7;

        // Build a rough 40-cell ring around the board
        // Top row: cells 0-9 (left to right)
        for (let i = 0; i < 10; i++) cells.push({ x: bx + (i * boardW / 10), y: by, w, h });
        // Right col: cells 10-19 (top to bottom)
        for (let i = 0; i < 10; i++) cells.push({ x: bx + boardW - w, y: by + (i * boardH / 10), w, h });
        // Bottom row: cells 20-29 (right to left)
        for (let i = 0; i < 10; i++) cells.push({ x: bx + boardW - w - (i * boardW / 10), y: by + boardH - h, w, h });
        // Left col: cells 30-39 (bottom to top)
        for (let i = 0; i < 10; i++) cells.push({ x: bx, y: by + boardH - h - (i * boardH / 10), w, h });

        return cells;
    }

    private drawBase(ctx: CanvasRenderingContext2D, bx: number, by: number, cellSize: number, color: string, player: any, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const baseSize = cellSize * 2;

        ctx.fillStyle = color + '33';
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(bx, by, baseSize, baseSize, s(4));
        ctx.fill();
        ctx.stroke();

        // Pawns in base
        for (let j = 0; j < player.pawns.length; j++) {
            if (player.pawns[j].pos === -1 && !player.pawns[j].isHome) {
                const isSelected = player.isHuman && this.game.selectedPawnIndex === j && this.game.hasRolled;
                this.drawPawn(ctx, bx + (j === 0 ? baseSize * 0.3 : baseSize * 0.7), by + baseSize / 2, cellSize * 0.28, color, isSelected, false);
            }
        }

        ctx.fillStyle = color;
        ctx.font = `bold ${r(9)}px ${theme.bodyFont}`;
        ctx.textAlign = 'center';
        ctx.fillText(player.name.toUpperCase(), bx + baseSize / 2, by + baseSize + s(10));
    }

    private drawPawn(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, selected: boolean, isHome: boolean) {
        const s = UIScale.s.bind(UIScale);
        ctx.save();
        ctx.shadowBlur = selected ? s(12) : s(3);
        ctx.shadowColor = selected ? '#ffffff' : color + '88';
        ctx.fillStyle = isHome ? '#ffd700' : color;
        ctx.strokeStyle = selected ? '#fff' : 'rgba(0,0,0,0.4)';
        ctx.lineWidth = selected ? 2 : 1;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        if (isHome) {
            ctx.fillStyle = '#111';
            ctx.font = `bold ${radius * 0.9}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('★', x, y);
        }
        ctx.restore();
    }

    private drawResultUI(ctx: CanvasRenderingContext2D, cx: number, cy: number, theme: any) {
        const r = UIScale.r.bind(UIScale);
        const s = UIScale.s.bind(UIScale);

        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        const won = this.game.winner?.isHuman;
        ctx.fillStyle = won ? '#4ade80' : '#f87171';
        ctx.font = `bold ${r(54)}px ${theme.titleFont}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(won ? 'VITÓRIA!' : 'DERROTA', cx, cy - s(20));

        if (won) {
            ctx.fillStyle = theme.accent;
            ctx.font = `bold ${r(24)}px ${theme.bodyFont}`;
            ctx.fillText(`+ R$ ${this.game.betAmount * 2}`, cx, cy + s(40));
        }

        ctx.fillStyle = theme.textMuted;
        ctx.font = `600 ${r(12)}px ${theme.bodyFont}`;
        ctx.fillText(isMobile() ? '[OK] Continuar • [ ✕ ] Sair' : 'ESPAÇO PARA CONTINUAR', cx, cy + s(100));
    }
}
