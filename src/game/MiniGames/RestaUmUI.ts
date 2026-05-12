import { RestaUmGame } from './RestaUmGame';
import { InputManager } from '../Core/InputManager';
import { isMobile } from '../Core/MobileDetect';
import { UIScale } from '../Core/UIScale';
import { MINIGAME_THEMES } from '../Core/MinigameThemes';
import { drawMinigameBackground, drawMinigameTitle, drawMinigameFooter } from '../Core/MinigameBackground';
import type { IMinigameUI } from './BaseMinigame';
import { SoundManager } from '../Core/SoundManager';
import { AchievementManager } from '../Core/AchievementManager';

export class RestaUmUI implements IMinigameUI {
    private game: RestaUmGame;
    private hasSettled: boolean = false;
    private onClose: (moneyChange: number) => void;
    private onPlayAgain: (moneyChange: number) => void;
    // Cursor for keyboard navigation
    private cursorRow: number = 3;
    private cursorCol: number = 3;

    constructor(
        game: RestaUmGame,
        onClose: (moneyChange: number) => void,
        onPlayAgain: (moneyChange: number) => void,
    ) {
        this.game = game;
        this.onClose = onClose;
        this.onPlayAgain = onPlayAgain;
    }

    public update(_dt: number) {
        const input = InputManager.getInstance();
        // Update logic
        const achManager = AchievementManager.getInstance();

        if (this.game.phase === 'playing') {
            // Keyboard navigation
            if (input.wasPressed('ArrowUp') || input.wasPressed('KeyW')) {
                this.cursorRow = Math.max(0, this.cursorRow - 1);
            }
            if (input.wasPressed('ArrowDown') || input.wasPressed('KeyS')) {
                this.cursorRow = Math.min(6, this.cursorRow + 1);
            }
            if (input.wasPressed('ArrowLeft') || input.wasPressed('KeyA')) {
                this.cursorCol = Math.max(0, this.cursorCol - 1);
            }
            if (input.wasPressed('ArrowRight') || input.wasPressed('KeyD')) {
                this.cursorCol = Math.min(6, this.cursorCol + 1);
            }
            if (input.wasPressed('Space') || input.wasPressed('Enter') || input.wasPressed('KeyE')) {
                if (this.game.board[this.cursorRow][this.cursorCol] !== -1) {
                    const acted = this.game.selectCell(this.cursorRow, this.cursorCol);
                    if (acted) SoundManager.getInstance().play('menu_confirm');
                }
            }
        } else if (this.game.phase === 'result') {
            if (!this.hasSettled) {
                // Record as arcade end for scoring purposes
                achManager.recordArcadeEnd('resta_um', this.game.score);
                this.hasSettled = true;
            }
            if (input.wasPressed('Space') || input.wasPressed('Enter') || input.wasPressed('KeyE')) {
                SoundManager.getInstance().play(this.game.score > 100 ? 'win_small' : 'lose');
                this.onPlayAgain(0);
                this.game.reset();
                this.hasSettled = false;
            }
        }

        if (input.wasPressed('Escape')) {
            this.onClose(0);
        }
    }

    public render(ctx: CanvasRenderingContext2D, width: number, height: number) {
        const theme = MINIGAME_THEMES.resta_um;
        drawMinigameBackground(ctx, width, height, theme);
        drawMinigameTitle(ctx, width, height, theme, 'RESTA UM');

        const cx = width / 2;
        const cy = height / 2;

        this.drawBoard(ctx, cx, cy, width, height, theme);
        this.drawStatus(ctx, cx, height, theme);
        if (this.game.phase === 'result') {
            this.drawResultUI(ctx, cx, cy, theme);
        }

        const hint = isMobile()
            ? '[DPAD] Mover • [OK] Pular/Selecionar • [ ✕ ] Sair'
            : '↑↓←→ Cursor • ESPAÇO Selecionar/Pular • ESC Sair';
        drawMinigameFooter(ctx, width, height, theme, hint);
    }

    private drawStatus(ctx: CanvasRenderingContext2D, cx: number, height: number, theme: any) {
        const r = UIScale.r.bind(UIScale);
        const y = height * 0.13;
        ctx.fillStyle = theme.accent;
        ctx.font = `bold ${r(14)}px ${theme.bodyFont}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.game.message.toUpperCase(), cx, y);

        if (this.game.phase === 'playing') {
            const yBot = height * 0.86;
            ctx.fillStyle = theme.textMuted;
            ctx.font = `bold ${r(18)}px ${theme.titleFont}`;
            ctx.fillText(`PEÇAS: ${this.game.remainingPegs}`, cx, yBot);
        }
    }

    private drawBoard(ctx: CanvasRenderingContext2D, cx: number, cy: number, width: number, height: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const boardSize = Math.min(width * 0.7, height * 0.6);
        const cellSize = boardSize / 7;
        const bx = cx - boardSize / 2;
        const by = cy - boardSize * 0.45;

        // Circular wooden board background (cross shape inscribed)
        ctx.fillStyle = '#4a2f1d';
        ctx.shadowBlur = s(25);
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.beginPath();
        ctx.arc(cx, cy - boardSize * 0.45 + boardSize/2, boardSize * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = '#352113';
        ctx.lineWidth = s(6);
        ctx.stroke();

        for (let r = 0; r < 7; r++) {
            for (let c = 0; c < 7; c++) {
                const cellVal = this.game.board[r][c];
                if (cellVal === -1) continue; // Outside

                const cx2 = bx + c * cellSize + cellSize / 2;
                const cy2 = by + r * cellSize + cellSize / 2;
                const holeRadius = cellSize * 0.25;

                // Hole background
                ctx.fillStyle = '#2b1b11';
                ctx.beginPath();
                ctx.arc(cx2, cy2, holeRadius, 0, Math.PI * 2);
                ctx.fill();

                // Highlight valid destinations
                const isValidDest = this.game.validDests.some(d => d[0] === r && d[1] === c);
                if (isValidDest) {
                    ctx.fillStyle = 'rgba(100, 255, 100, 0.4)';
                    ctx.beginPath();
                    ctx.arc(cx2, cy2, holeRadius, 0, Math.PI * 2);
                    ctx.fill();
                }

                // Cursor highlight
                if (this.cursorRow === r && this.cursorCol === c) {
                    const pulse = 0.5 + Math.sin(Date.now() / 200) * 0.5;
                    ctx.strokeStyle = `rgba(255,255,255,${0.5 + pulse * 0.5})`;
                    ctx.lineWidth = s(2);
                    ctx.beginPath();
                    ctx.arc(cx2, cy2, holeRadius * 1.5, 0, Math.PI * 2);
                    ctx.stroke();
                }

                // Selected Peg glow
                if (this.game.selectedCell && this.game.selectedCell[0] === r && this.game.selectedCell[1] === c) {
                    ctx.shadowBlur = s(15);
                    ctx.shadowColor = theme.accent;
                    ctx.strokeStyle = theme.accent;
                    ctx.lineWidth = s(3);
                    ctx.beginPath();
                    ctx.arc(cx2, cy2, holeRadius * 1.5, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.shadowBlur = 0;
                }

                // Draw Peg
                if (cellVal === 1) {
                    const radius = holeRadius * 1.1;
                    const isSelected = this.game.selectedCell && this.game.selectedCell[0] === r && this.game.selectedCell[1] === c;
                    
                    const grad = ctx.createRadialGradient(cx2 - radius*0.3, cy2 - radius*0.3, radius*0.1, cx2, cy2, radius);
                    grad.addColorStop(0, '#f0f0f0'); // Highlight
                    grad.addColorStop(1, '#8fa3b0'); // Marble base
                    
                    ctx.fillStyle = grad;
                    ctx.shadowBlur = isSelected ? s(10) : s(4);
                    ctx.shadowColor = isSelected ? '#fff' : 'rgba(0,0,0,0.5)';
                    ctx.beginPath();
                    ctx.arc(cx2, cy2, radius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.shadowBlur = 0;
                }
            }
        }
    }

    private drawResultUI(ctx: CanvasRenderingContext2D, cx: number, cy: number, theme: any) {
        const r = UIScale.r.bind(UIScale);
        const s = UIScale.s.bind(UIScale);

        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        const won = this.game.winner;
        ctx.fillStyle = won ? '#4ade80' : '#f87171';
        ctx.font = `bold ${r(48)}px ${theme.titleFont}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        let msg = 'DERROTA';
        if (this.game.remainingPegs === 1) msg = 'PERFEITO!';
        else if (this.game.remainingPegs === 2) msg = 'ÓTIMO!';
        else if (this.game.remainingPegs === 3) msg = 'BOM!';
        else if (this.game.remainingPegs === 4) msg = 'RAZOÁVEL';
        ctx.fillText(msg, cx, cy - s(20));

        ctx.fillStyle = theme.accent;
        ctx.font = `bold ${r(24)}px ${theme.bodyFont}`;
        ctx.fillText(`PONTUAÇÃO: ${this.game.score}`, cx, cy + s(40));

        ctx.fillStyle = theme.textMuted;
        ctx.font = `600 ${r(12)}px ${theme.bodyFont}`;
        ctx.fillText(isMobile() ? '[OK] Nova Partida • [ ✕ ] Sair' : 'ESPAÇO NOVA PARTIDA • ESC SAIR', cx, cy + s(100));
    }
}
