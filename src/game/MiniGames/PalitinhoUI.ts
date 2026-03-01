import { PalitinhoGame } from './PalitinhoGame';
import { InputManager } from '../Core/InputManager';
import { isMobile } from '../Core/MobileDetect';
import { UIScale } from '../Core/UIScale';

export class PalitinhoUI {
    private game: PalitinhoGame;
    private input: InputManager;
    private onClose: (moneyChange: number) => void;
    private onPlayAgain: (moneyChange: number) => void;
    private selectedIdx: number = 0;

    constructor(game: PalitinhoGame, onClose: (moneyChange: number) => void, onPlayAgain: (moneyChange: number) => void) {
        this.game = game;
        this.input = InputManager.getInstance();
        this.onClose = onClose;
        this.onPlayAgain = onPlayAgain;
    }

    public update(dt: number) {
        const phase = this.game.phase;

        if (phase === 'betting') {
            if (this.input.wasPressed('ArrowUp') || this.input.wasPressed('KeyW')) {
                this.game.selectedBet = Math.min(this.game.maxBet, this.game.selectedBet + 10);
            }
            if (this.input.wasPressed('ArrowDown') || this.input.wasPressed('KeyS')) {
                this.game.selectedBet = Math.max(this.game.minBet, this.game.selectedBet - 10);
            }
            if (this.input.wasPressed('Enter') || this.input.wasPressed('KeyE')) {
                this.game.confirmBet(this.game.selectedBet);
            }
        } else if (phase === 'dice_roll') {
            this.game.update(dt);
        } else if (phase === 'choosing') {
            if (this.input.wasPressed('ArrowLeft') || this.input.wasPressed('KeyA')) {
                this.selectedIdx = (this.selectedIdx + 3) % 4; // 4 sticks
            }
            if (this.input.wasPressed('ArrowRight') || this.input.wasPressed('KeyD')) {
                this.selectedIdx = (this.selectedIdx + 1) % 4; // 4 sticks
            }
            if (this.input.wasPressed('Enter') || this.input.wasPressed('KeyE')) {
                this.game.chooseMatchstick(this.selectedIdx);
            }
        } else if (phase === 'reveal') {
            setTimeout(() => this.game.calculateResult(), 1500);
            this.game.phase = 'flipping' as any;
        } else if (phase === 'result') {
            if (this.input.wasPressed('Space') || this.input.wasPressed('KeyR')) {
                this.onPlayAgain(this.game.settle());
            }
        }

        if (this.input.wasPressed('Escape')) {
            const moneyChange = (this.game.phase === 'result') ? this.game.settle() : 0;
            this.onClose(moneyChange);
        }
    }



    public draw(ctx: CanvasRenderingContext2D, screenW: number, screenH: number) {
        const s = UIScale.s.bind(UIScale);
        const cx = screenW / 2;
        const mobile = isMobile();
        const fScale = mobile ? 1.1 : 1.0;

        // ── Fundo: calçada ──
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(0, 0, screenW, screenH);

        ctx.save();
        ctx.globalAlpha = 0.08;
        for (let i = 0; i < 300; i++) {
            ctx.fillStyle = i % 2 === 0 ? '#fff' : '#000';
            ctx.fillRect(Math.random() * screenW, Math.random() * screenH, 2, 2);
        }
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, screenH * 0.3); ctx.lineTo(screenW, screenH * 0.35);
        ctx.moveTo(screenW * 0.7, 0); ctx.lineTo(screenW * 0.75, screenH);
        ctx.stroke();
        ctx.restore();

        // ── Zonas de layout proporcionais ──
        const TITLE_H = screenH * 0.12;
        const CONTENT_H = screenH * 0.62;
        const FOOTER_H = screenH * 0.26;

        const titleY = TITLE_H * 0.65;
        const contentY = TITLE_H + CONTENT_H * 0.5; // centro da área de conteúdo
        const footerTop = TITLE_H + CONTENT_H;

        // ── Título ──
        ctx.fillStyle = '#ff66cc';
        ctx.font = `bold ${UIScale.r(mobile ? 18 : 24)}px "Press Start 2P", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('PALITINHO', cx, titleY);

        const phase = this.game.phase;

        if (phase === 'betting') {
            this.drawBettingUI(ctx, cx, contentY, screenH);
        } else if (phase === 'dice_roll') {
            this.drawDiceUI(ctx, cx, contentY, fScale);
        } else if (phase === 'choosing' || (phase as any) === 'flipping' || phase === 'reveal' || phase === 'result') {
            this.drawMatchsticks(ctx, cx, contentY - s(mobile ? 20 : 30), screenW);
            this.drawPlayersUI(ctx, cx, footerTop + FOOTER_H * 0.22, fScale);

            if (phase === 'result') {
                ctx.fillStyle = '#fff';
                ctx.font = `bold ${UIScale.r(mobile ? 13 : 16)}px "Segoe UI", sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText(this.game.resultMessage, cx, footerTop + FOOTER_H * 0.50);

                ctx.fillStyle = 'rgba(255,255,255,0.35)';
                ctx.font = `${UIScale.r(mobile ? 8 : 9)}px "Press Start 2P", monospace`;
                const resultHint = mobile
                    ? '[OK] NOVAMENTE | [E] SAIR'
                    : 'ESPAÇO NOVAMENTE | ENTER SAIR';
                ctx.fillText(resultHint, cx, footerTop + FOOTER_H * 0.78);
            }
        }

        // Dica de controles (sempre visível)
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.font = `${UIScale.r(mobile ? 8 : 9)}px "Press Start 2P", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(mobile ? '[←→] Escolher  [E/OK] Confirmar  [✕] Sair' : '[←→] Escolher  [Enter] Confirmar  [ESC] Sair', cx, screenH - s(12));
    }

    private drawBettingUI(ctx: CanvasRenderingContext2D, cx: number, cy: number, _screenH: number) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();
        const fScale = mobile ? 1.1 : 1.0;

        ctx.fillStyle = '#ccc';
        ctx.font = `${UIScale.r(mobile ? 10 : 12)}px "Press Start 2P", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('APOSTA', cx, cy - s(50));

        ctx.fillStyle = '#ff66cc';
        ctx.font = `bold ${UIScale.r(mobile ? 40 : 52) * fScale}px "Segoe UI", sans-serif`;
        ctx.shadowBlur = UIScale.s(14);
        ctx.shadowColor = 'rgba(255,102,204,0.35)';
        ctx.fillText(`R$ ${this.game.selectedBet}`, cx, cy + s(10));
        ctx.shadowBlur = 0;

        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = `${UIScale.r(mobile ? 8 : 9)}px "Press Start 2P", monospace`;
        ctx.fillText(mobile ? '[↑↓] Valor  [E/OK] Confirmar' : '[W/S ou ↑↓] Valor  [Enter] Confirmar', cx, cy + s(60));
    }

    private drawDiceUI(ctx: CanvasRenderingContext2D, cx: number, cy: number, fScale: number) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();

        ctx.fillStyle = '#fff';
        ctx.font = `bold ${UIScale.r(mobile ? 11 : 14) * fScale}px "Press Start 2P", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('QUEM COMEÇA?', cx, cy - s(80));

        const spacing = s(mobile ? 75 : 110);
        const startX = cx - (spacing * 1.5);

        this.game.players.forEach((p, i) => {
            const x = startX + i * spacing;
            ctx.fillStyle = '#fff';
            ctx.font = `${UIScale.r(mobile ? 8 : 10)}px "Press Start 2P", monospace`;
            ctx.fillText(p.name.toUpperCase(), x, cy + s(55));
            this.drawSingleDice(ctx, x, cy, p.diceValue);
        });
    }

    private drawSingleDice(ctx: CanvasRenderingContext2D, x: number, y: number, value: number) {
        const s = UIScale.s.bind(UIScale);
        const size = s(38);

        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(x - size / 2 + s(3), y - size / 2 + s(3), size, size);

        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#333';
        ctx.lineWidth = s(2);
        ctx.beginPath();
        ctx.roundRect(x - size / 2, y - size / 2, size, size, s(4));
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#111';
        const r = s(3);
        const offset = size / 4;
        if (value % 2 !== 0) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
        if (value >= 2) {
            ctx.beginPath(); ctx.arc(x - offset, y - offset, r, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(x + offset, y + offset, r, 0, Math.PI * 2); ctx.fill();
        }
        if (value >= 4) {
            ctx.beginPath(); ctx.arc(x + offset, y - offset, r, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(x - offset, y + offset, r, 0, Math.PI * 2); ctx.fill();
        }
        if (value === 6) {
            ctx.beginPath(); ctx.arc(x - offset, y, r, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(x + offset, y, r, 0, Math.PI * 2); ctx.fill();
        }
    }

    private drawPlayersUI(ctx: CanvasRenderingContext2D, cx: number, y: number, fScale: number) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();
        const spacing = s(mobile ? 75 : 110);
        const startX = cx - (spacing * 1.5);

        this.game.players.forEach((p, i) => {
            const px = startX + i * spacing;
            const isTurn = this.game.currentPlayerIdx === p.order && this.game.phase === 'choosing';

            ctx.fillStyle = isTurn ? '#ff66cc' : (p.isLoser ? '#ff4444' : 'rgba(255,255,255,0.6)');
            ctx.font = (isTurn ? 'bold ' : '') + `${UIScale.r(mobile ? 10 : 12) * fScale}px "Press Start 2P", monospace`;
            ctx.textAlign = 'center';
            ctx.fillText(p.name.toUpperCase(), px, y);

            if (isTurn) {
                ctx.fillStyle = '#ff66cc';
                ctx.font = `${UIScale.r(mobile ? 8 : 9)}px "Press Start 2P", monospace`;
                ctx.fillText('SUA VEZ!', px, y + s(16));
            }
        });
    }

    private drawMatchsticks(ctx: CanvasRenderingContext2D, cx: number, cy: number, screenW: number) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();
        const fScale = mobile ? 1.1 : 1.0;

        // Espaçamento proporcional à largura disponível
        const spacing = Math.min(s(mobile ? 75 : 100), screenW * 0.22);
        const startX = cx - (spacing * 1.5);

        this.game.matchsticks.forEach((m, i) => {
            const x = startX + i * spacing;
            const isSelected = this.selectedIdx === i
                && this.game.phase === 'choosing'
                && this.game.players.find(p => p.isHuman)?.order === this.game.currentPlayerIdx;
            const isPicked = m.pickedBy !== null;
            const isReveal = this.game.phase === 'result' || (this.game.phase as any) === 'flipping';
            const stickH = s(mobile ? 90 : 110);

            if (isSelected) {
                ctx.fillStyle = 'rgba(255,102,204,0.1)';
                ctx.beginPath();
                ctx.arc(x, cy, s(55), 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#ff66cc';
                ctx.lineWidth = s(2);
                ctx.stroke();
            }

            if (isPicked) {
                const headY = isReveal && m.isBroken ? cy - s(8) : cy - stickH * 0.65;

                ctx.fillStyle = 'rgba(0,0,0,0.35)';
                ctx.fillRect(x, cy - stickH * 0.38, s(5), stickH * 0.75);

                const woodGrad = ctx.createLinearGradient(x - s(4), 0, x + s(4), 0);
                woodGrad.addColorStop(0, '#c2a07c');
                woodGrad.addColorStop(0.5, '#e8cfa0');
                woodGrad.addColorStop(1, '#c2a07c');
                ctx.fillStyle = woodGrad;
                ctx.fillRect(x - s(4), cy - stickH * 0.48, s(8), stickH);

                if (isReveal && m.isBroken) {
                    ctx.fillStyle = '#111';
                    ctx.beginPath();
                    ctx.moveTo(x - s(5), cy - s(14));
                    ctx.lineTo(x + s(5), cy - s(11));
                    ctx.lineTo(x + s(5), cy - s(17));
                    ctx.fill();
                }

                const headGrad = ctx.createRadialGradient(x - s(2), headY - s(2), s(1), x, headY, s(8));
                headGrad.addColorStop(0, '#ff4444');
                headGrad.addColorStop(1, '#880000');
                ctx.fillStyle = headGrad;
                ctx.beginPath();
                ctx.ellipse(x, headY, s(6), s(9), 0, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = isReveal && m.isBroken ? '#ff4444' : 'rgba(255,255,255,0.7)';
                ctx.font = `bold ${UIScale.r(mobile ? 9 : 10) * fScale}px "Press Start 2P", monospace`;
                ctx.textAlign = 'center';
                ctx.fillText(m.pickedBy?.toUpperCase() || '', x, cy + stickH * 0.62);
            } else {
                ctx.fillStyle = 'rgba(255,255,255,0.12)';
                ctx.font = `bold ${UIScale.r(mobile ? 30 : 38) * fScale}px serif`;
                ctx.textAlign = 'center';
                ctx.fillText('?', x, cy + s(12));
            }
        });
    }
}
