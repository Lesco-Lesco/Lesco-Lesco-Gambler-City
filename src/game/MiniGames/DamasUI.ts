import { DamasGame } from './DamasGame';
import { InputManager } from '../Core/InputManager';
import { BichoManager } from '../BichoManager';
import { EconomyManager } from '../Core/EconomyManager';
import { isMobile } from '../Core/MobileDetect';
import { UIScale } from '../Core/UIScale';
import { MINIGAME_THEMES } from '../Core/MinigameThemes';
import { drawMinigameBackground, drawMinigameTitle, drawMinigameFooter } from '../Core/MinigameBackground';
import type { IMinigameUI } from './BaseMinigame';
import { SoundManager } from '../Core/SoundManager';

export class DamasUI implements IMinigameUI {
    private game: DamasGame;
    private hasSettled: boolean = false;
    private onClose: (moneyChange: number) => void;
    private onPlayAgain: (moneyChange: number) => void;
    // Cursor for keyboard navigation
    private cursorRow: number = 5;
    private cursorCol: number = 0;

    constructor(
        game: DamasGame,
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

        // NPC update
        this.game.updateNPC(dt);

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
                    this.cursorRow = 5;
                    this.cursorCol = 0;
                }
            }
        } else if (this.game.phase === 'playing' && this.game.turnIndex === 0) {
            // Keyboard navigation
            if (input.wasPressed('ArrowUp') || input.wasPressed('KeyW')) {
                this.cursorRow = Math.max(0, this.cursorRow - 1);
            }
            if (input.wasPressed('ArrowDown') || input.wasPressed('KeyS')) {
                this.cursorRow = Math.min(7, this.cursorRow + 1);
            }
            if (input.wasPressed('ArrowLeft') || input.wasPressed('KeyA')) {
                this.cursorCol = Math.max(0, this.cursorCol - 1);
            }
            if (input.wasPressed('ArrowRight') || input.wasPressed('KeyD')) {
                this.cursorCol = Math.min(7, this.cursorCol + 1);
            }
            if (input.wasPressed('Space') || input.wasPressed('Enter') || input.wasPressed('KeyE')) {
                const acted = this.game.selectCell(this.cursorRow, this.cursorCol);
                if (acted) SoundManager.getInstance().play('menu_confirm');
            }
        } else if (this.game.phase === 'result') {
            if (!this.hasSettled) {
                if (this.game.winner === 0) {
                    bmanager.playerMoney += this.game.betAmount * 2;
                }
                this.hasSettled = true;
            }
            if (input.wasPressed('Space') || input.wasPressed('Enter') || input.wasPressed('KeyE')) {
                const win = this.game.winner === 0 ? this.game.betAmount * 2 : 0;
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
            const finalWin = (this.game.phase === 'result' && this.game.winner === 0) ? this.game.betAmount * 2 : 0;
            this.onClose(finalWin);
        }
    }

    public render(ctx: CanvasRenderingContext2D, width: number, height: number) {
        const theme = MINIGAME_THEMES.damas;
        drawMinigameBackground(ctx, width, height, theme);
        drawMinigameTitle(ctx, width, height, theme, 'JOGO DE DAMAS');

        const cx = width / 2;
        const cy = height / 2;

        if (this.game.phase === 'betting') {
            this.drawBettingUI(ctx, cx, cy, theme);
        } else {
            this.drawBoard(ctx, cx, cy, width, height, theme);
            this.drawStatus(ctx, cx, height, theme);
            this.drawPieceCount(ctx, cx, width, height, theme);
            if (this.game.phase === 'result') {
                this.drawResultUI(ctx, cx, cy, theme);
            }
        }

        const hint = isMobile()
            ? '[DPAD] Mover • [OK] Jogar • [ ✕ ] Sair'
            : '↑↓←→ Cursor • ESPAÇO Selecionar/Mover • ESC Sair';
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

        ctx.fillStyle = theme.textMuted;
        ctx.font = `${r(10)}px ${theme.bodyFont}`;
        ctx.fillText('Capture todas as peças ou bloqueie o adversário! • Damas viram rei!', cx, cy + s(70));
    }

    private drawStatus(ctx: CanvasRenderingContext2D, cx: number, height: number, theme: any) {
        const r = UIScale.r.bind(UIScale);
        const y = height * 0.13;
        ctx.fillStyle = theme.accent;
        ctx.font = `bold ${r(12)}px ${theme.bodyFont}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.game.message.toUpperCase(), cx, y);
    }

    private drawPieceCount(ctx: CanvasRenderingContext2D, cx: number, width: number, height: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const y = height * 0.86;

        // Human pieces
        ctx.fillStyle = '#e8e8e8';
        ctx.font = `bold ${r(20)}px ${theme.titleFont}`;
        ctx.textAlign = 'left';
        ctx.fillText(`⬜ ${this.game.countPieces(0)}`, s(20), y);

        // NPC pieces
        ctx.textAlign = 'right';
        ctx.fillText(`${this.game.countPieces(1)} ⬛`, width - s(20), y);

        // Turn indicator
        ctx.fillStyle = this.game.turnIndex === 0 ? '#4ade80' : '#f87171';
        ctx.font = `${r(10)}px ${theme.bodyFont}`;
        ctx.textAlign = 'center';
        const turnText = this.game.turnIndex === 0 ? 'SUA VEZ (BRANCAS)' : 'VEZ DO ADVERSÁRIO (PRETAS)';
        ctx.fillText(turnText, cx, y + s(18));
    }

    private drawBoard(ctx: CanvasRenderingContext2D, cx: number, cy: number, width: number, height: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const boardSize = Math.min(width * 0.75, height * 0.62);
        const cellSize = boardSize / 8;
        const bx = cx - boardSize / 2;
        const by = cy - boardSize * 0.42;

        // Board border glow
        ctx.shadowBlur = s(20);
        ctx.shadowColor = theme.accent + '55';
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.roundRect(bx - s(4), by - s(4), boardSize + s(8), boardSize + s(8), s(6));
        ctx.fill();
        ctx.shadowBlur = 0;

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const isDark = (r + c) % 2 === 1;
                const cx2 = bx + c * cellSize;
                const cy2 = by + r * cellSize;

                // Cell background
                let cellColor = isDark ? '#2d4a2d' : '#d4a96a';

                // Highlight selected cell
                if (this.game.selectedCell && this.game.selectedCell[0] === r && this.game.selectedCell[1] === c) {
                    cellColor = '#ffe066';
                }

                // Highlight valid destinations
                const isValidDest = this.game.validMoves.some(m => m[0] === r && m[1] === c);

                ctx.fillStyle = cellColor;
                ctx.fillRect(cx2, cy2, cellSize, cellSize);

                if (isValidDest) {
                    ctx.fillStyle = 'rgba(100, 255, 100, 0.35)';
                    ctx.fillRect(cx2, cy2, cellSize, cellSize);
                    // Dot indicator
                    ctx.fillStyle = 'rgba(100, 255, 100, 0.7)';
                    ctx.beginPath();
                    ctx.arc(cx2 + cellSize / 2, cy2 + cellSize / 2, cellSize * 0.18, 0, Math.PI * 2);
                    ctx.fill();
                }

                // Cursor
                if (this.cursorRow === r && this.cursorCol === c) {
                    const pulse = 0.5 + Math.sin(Date.now() / 200) * 0.5;
                    ctx.strokeStyle = `rgba(255,255,255,${0.5 + pulse * 0.5})`;
                    ctx.lineWidth = 2;
                    ctx.strokeRect(cx2 + 1, cy2 + 1, cellSize - 2, cellSize - 2);
                }

                // Piece
                const piece = this.game.board[r]?.[c];
                if (piece) {
                    this.drawPiece(ctx, cx2 + cellSize / 2, cy2 + cellSize / 2, cellSize * 0.38, piece);
                }

                // Coordinate labels (corners only)
                if (r === 7) {
                    ctx.fillStyle = isDark ? '#6b9e6b' : '#7a6040';
                    ctx.font = `${cellSize * 0.22}px monospace`;
                    ctx.textAlign = 'right';
                    ctx.textBaseline = 'bottom';
                    ctx.fillText(String.fromCharCode(97 + c), cx2 + cellSize - 1, cy2 + cellSize - 1);
                }
                if (c === 0) {
                    ctx.fillStyle = isDark ? '#6b9e6b' : '#7a6040';
                    ctx.font = `${cellSize * 0.22}px monospace`;
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'top';
                    ctx.fillText(`${8 - r}`, cx2 + 2, cy2 + 2);
                }
            }
        }
    }

    private drawPiece(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, piece: any) {
        const s = UIScale.s.bind(UIScale);
        const isHuman = piece.owner === 0;
        const baseColor = isHuman ? '#e8e8e8' : '#1a1a1a';
        const highlightColor = isHuman ? '#ffffff' : '#333333';
        const shadowColor = isHuman ? '#aaaaaa' : '#000000';

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(x + s(2), y + s(2), radius, radius * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();

        // Main body
        const grad = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, radius * 0.1, x, y, radius);
        grad.addColorStop(0, highlightColor);
        grad.addColorStop(1, baseColor);
        ctx.fillStyle = grad;
        ctx.shadowBlur = s(6);
        ctx.shadowColor = shadowColor;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Edge ring
        ctx.strokeStyle = isHuman ? '#888888' : '#555555';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.stroke();

        // King crown
        if (piece.isKing) {
            ctx.fillStyle = '#ffd700';
            ctx.shadowBlur = s(8);
            ctx.shadowColor = '#ffd700';
            ctx.font = `bold ${radius * 0.9}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('♛', x, y);
            ctx.shadowBlur = 0;
        }
    }

    private drawResultUI(ctx: CanvasRenderingContext2D, cx: number, cy: number, theme: any) {
        const r = UIScale.r.bind(UIScale);
        const s = UIScale.s.bind(UIScale);

        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        const won = this.game.winner === 0;
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
