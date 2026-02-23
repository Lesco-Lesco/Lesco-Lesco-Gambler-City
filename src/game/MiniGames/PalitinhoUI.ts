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
            if (this.input.wasPressed('Escape')) this.onClose(0);
        } else if (phase === 'dice_roll') {
            this.game.update(dt);
        } else if (phase === 'choosing') {
            if (this.input.wasPressed('ArrowLeft') || this.input.wasPressed('KeyA')) {
                this.selectedIdx = (this.selectedIdx + 2) % 3;
            }
            if (this.input.wasPressed('ArrowRight') || this.input.wasPressed('KeyD')) {
                this.selectedIdx = (this.selectedIdx + 1) % 3;
            }
            if (this.input.wasPressed('Enter') || this.input.wasPressed('KeyE')) {
                this.game.chooseMatchstick(this.selectedIdx);
            }
        } else if (phase === 'reveal') {
            // One second pause then result
            setTimeout(() => this.game.calculateResult(), 1500);
            this.game.phase = 'flipping' as any; // Hack to avoid multi-trigger
        } else if (phase === 'result') {
            if (this.input.wasPressed('Space') || this.input.wasPressed('KeyR')) {
                this.onPlayAgain(this.game.settle());
            } else if (this.input.wasPressed('Enter') || this.input.wasPressed('KeyE') || this.input.wasPressed('Escape')) {
                this.onClose(this.game.settle());
            }
        }
    }

    public draw(ctx: CanvasRenderingContext2D, screenW: number, screenH: number) {
        const s = UIScale.s.bind(UIScale);

        // Concrete/Sidewalk Background
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(0, 0, screenW, screenH);

        // Add some "concrete" texture/noise
        ctx.save();
        ctx.globalAlpha = 0.1;
        for (let i = 0; i < 500; i++) {
            ctx.fillStyle = i % 2 === 0 ? '#fff' : '#000';
            ctx.fillRect(Math.random() * screenW, Math.random() * screenH, 2, 2);
        }

        // Pavement cracks
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, screenH * 0.3); ctx.lineTo(screenW, screenH * 0.35);
        ctx.moveTo(screenW * 0.7, 0); ctx.lineTo(screenW * 0.75, screenH);
        ctx.stroke();
        ctx.restore();

        const centerX = screenW / 2;
        const centerY = screenH / 2;

        ctx.fillStyle = '#ff66cc';
        ctx.font = `bold ${UIScale.r(36)}px "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('PALITINHO', centerX, s(80));

        const phase = this.game.phase;

        if (phase === 'betting') {
            this.drawBettingUI(ctx, centerX, centerY);
        } else if (phase === 'dice_roll') {
            this.drawDiceUI(ctx, centerX, centerY);
        } else if (phase === 'choosing' || (phase as any) === 'flipping' || phase === 'reveal' || phase === 'result') {
            this.drawMatchsticks(ctx, centerX, centerY);
            this.drawPlayersUI(ctx, centerX, centerY + s(120));
            if (phase === 'result') {
                ctx.fillStyle = '#fff';
                ctx.font = `${UIScale.r(24)}px sans-serif`;
                ctx.fillText(this.game.resultMessage, centerX, centerY + s(200));
                ctx.font = `${UIScale.r(14)}px monospace`;
                const resultHint = isMobile()
                    ? '[OK] JOGAR NOVAMENTE | [E] SAIR'
                    : 'ESPAÇO JOGAR NOVAMENTE | ENTER SAIR';
                ctx.fillText(resultHint, centerX, centerY + s(240));
            }
        }
    }

    private drawBettingUI(ctx: CanvasRenderingContext2D, centerX: number, centerY: number) {
        ctx.fillStyle = '#fff';
        ctx.font = `${UIScale.r(24)}px sans-serif`;
        ctx.fillText('APOSTA MÍNIMA: R$ ' + this.game.selectedBet, centerX, centerY);
    }

    private drawDiceUI(ctx: CanvasRenderingContext2D, centerX: number, centerY: number) {
        const s = UIScale.s.bind(UIScale);

        ctx.fillStyle = '#fff';
        ctx.font = `bold ${UIScale.r(20)}px "Segoe UI", sans-serif`;
        ctx.fillText('QUEM COMEÇA?', centerX, centerY - s(100));

        const spacing = s(180);
        const startX = centerX - spacing;

        this.game.players.forEach((p, i) => {
            const x = startX + i * spacing;
            ctx.fillStyle = '#fff';
            ctx.font = `${UIScale.r(14)}px monospace`;
            ctx.fillText(p.name.toUpperCase(), x, centerY + s(60));
            this.drawSingleDice(ctx, x, centerY, p.diceValue);
        });
    }

    private drawSingleDice(ctx: CanvasRenderingContext2D, x: number, y: number, value: number) {
        const s = UIScale.s.bind(UIScale);
        const size = s(40);

        // Dice Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(x - size / 2 + s(4), y - size / 2 + s(4), size, size);

        // Dice Body
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#333';
        ctx.lineWidth = s(2);
        ctx.beginPath();
        ctx.roundRect(x - size / 2, y - size / 2, size, size, s(4));
        ctx.fill();
        ctx.stroke();

        // Dots
        ctx.fillStyle = '#111';
        const r = s(3);
        const offset = size / 4;
        if (value % 2 !== 0) {
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }
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

    private drawPlayersUI(ctx: CanvasRenderingContext2D, centerX: number, y: number) {
        const s = UIScale.s.bind(UIScale);
        const spacing = s(150);
        const startX = centerX - spacing;

        this.game.players.forEach((p, i) => {
            const px = startX + i * spacing;
            const isTurn = this.game.currentPlayerIdx === p.order && this.game.phase === 'choosing';

            ctx.fillStyle = isTurn ? '#ff66cc' : (p.isLoser ? '#ff3333' : '#fff');
            ctx.font = (isTurn ? 'bold ' : '') + `${UIScale.r(18)}px sans-serif`;
            ctx.fillText(p.name.toUpperCase(), px, y);

            if (isTurn) {
                ctx.font = `${UIScale.r(12)}px monospace`;
                ctx.fillText('SUA VEZ!', px, y + s(20));
            }
        });
    }

    private drawMatchsticks(ctx: CanvasRenderingContext2D, centerX: number, centerY: number) {
        const s = UIScale.s.bind(UIScale);
        const spacing = s(120);
        const startX = centerX - spacing;

        this.game.matchsticks.forEach((m, i) => {
            const x = startX + i * spacing;
            const isSelected = this.selectedIdx === i && this.game.phase === 'choosing' && this.game.players.find(p => p.isHuman)?.order === this.game.currentPlayerIdx;
            const isPicked = m.pickedBy !== null;
            const isReveal = this.game.phase === 'result' || (this.game.phase as any) === 'flipping';

            // Area highlight
            if (isSelected) {
                ctx.fillStyle = 'rgba(255, 102, 204, 0.1)';
                ctx.beginPath();
                ctx.arc(x, centerY, s(60), 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#ff66cc';
                ctx.lineWidth = s(2);
                ctx.stroke();
            }

            // Matchstick
            if (isPicked) {
                const headY = isReveal && m.isBroken ? centerY - s(10) : centerY - s(70);

                // Shadow
                ctx.fillStyle = 'rgba(0,0,0,0.4)';
                ctx.fillRect(x, centerY - s(40), s(6), s(80));

                // Wood Stick
                const woodGrad = ctx.createLinearGradient(x - s(4), 0, x + s(4), 0);
                woodGrad.addColorStop(0, '#d2b48c');
                woodGrad.addColorStop(0.5, '#f5deb3');
                woodGrad.addColorStop(1, '#d2b48c');
                ctx.fillStyle = woodGrad;
                ctx.fillRect(x - s(4), centerY - s(50), s(8), s(100));

                // Texture lines on wood
                ctx.strokeStyle = '#8b4513';
                ctx.globalAlpha = 0.3;
                ctx.beginPath();
                ctx.moveTo(x - s(2), centerY - s(40)); ctx.lineTo(x - s(2), centerY + s(40));
                ctx.stroke();
                ctx.globalAlpha = 1;

                if (isReveal && m.isBroken) {
                    // Splintered break
                    ctx.fillStyle = '#111';
                    ctx.beginPath();
                    ctx.moveTo(x - s(5), centerY - s(15));
                    ctx.lineTo(x + s(5), centerY - s(12));
                    ctx.lineTo(x + s(5), centerY - s(18));
                    ctx.fill();
                }

                // Phosphorous Head
                const headGrad = ctx.createRadialGradient(x - s(2), headY - s(2), s(1), x, headY, s(8));
                headGrad.addColorStop(0, '#ff4444');
                headGrad.addColorStop(1, '#880000');
                ctx.fillStyle = headGrad;
                ctx.beginPath();
                ctx.ellipse(x, headY, s(7), s(10), 0, 0, Math.PI * 2);
                ctx.fill();

                // Name label
                ctx.fillStyle = isReveal && m.isBroken ? '#ff4444' : '#fff';
                ctx.font = `bold ${UIScale.r(12)}px monospace`;
                ctx.fillText(m.pickedBy?.toUpperCase() || '', x, centerY + s(70));
            } else {
                ctx.fillStyle = 'rgba(255,255,255,0.1)';
                ctx.font = `bold ${UIScale.r(40)}px serif`;
                ctx.fillText('?', x, centerY);
            }
        });
    }
}
