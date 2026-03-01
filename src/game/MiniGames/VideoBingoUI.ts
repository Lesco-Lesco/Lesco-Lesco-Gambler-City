import { VideoBingoGame } from './VideoBingoGame';
import { UIScale } from '../Core/UIScale';

export class VideoBingoUI {
    private game: VideoBingoGame;
    private onExit: (payout: number) => void;
    private onPlayAgain: (payout: number) => void;

    constructor(
        game: VideoBingoGame,
        onExit: (payout: number) => void,
        onPlayAgain: (payout: number) => void
    ) {
        this.game = game;
        this.onExit = onExit;
        this.onPlayAgain = onPlayAgain;
    }

    public update(_dt: number) {
        const input = (window as any).gameInput; // Hack to get input manager if not passed
        if (!input) return;

        if (this.game.phase === 'betting') {
            if (input.wasPressed('Space')) {
                const bmanager = (window as any).bmanager;
                if (bmanager && bmanager.playerMoney >= 10) {
                    bmanager.playerMoney -= 10;
                    this.game.start();
                }
            }
        } else if (this.game.phase === 'picking') {
            if (this.game.selectedCardIndex === -1) this.game.selectedCardIndex = 0;

            if (input.wasPressed('ArrowLeft')) this.game.selectedCardIndex = (this.game.selectedCardIndex % 2 === 0) ? this.game.selectedCardIndex + 1 : this.game.selectedCardIndex - 1;
            if (input.wasPressed('ArrowRight')) this.game.selectedCardIndex = (this.game.selectedCardIndex % 2 === 1) ? this.game.selectedCardIndex - 1 : this.game.selectedCardIndex + 1;
            if (input.wasPressed('ArrowUp') || input.wasPressed('ArrowDown')) {
                this.game.selectedCardIndex = (this.game.selectedCardIndex + 2) % 4;
            }

            if (input.wasPressed('Space') || input.wasPressed('Enter')) {
                this.game.selectCard(this.game.selectedCardIndex, 10);
                this.startDrawing();
            }
        } else if (this.game.phase === 'result') {
            if (input.wasPressed('Space') || input.wasPressed('Enter')) {
                this.onPlayAgain(this.game.totalPayout);
            }
        }

        if (input.wasPressed('Escape')) {
            if (this.drawInterval) clearInterval(this.drawInterval);
            const payout = (this.game.phase === 'result') ? this.game.totalPayout : 0;
            this.onExit(payout);
        }

    }

    private startDrawing() {
        if (this.drawInterval) clearInterval(this.drawInterval);
        this.drawInterval = setInterval(() => {
            const num = this.game.drawNext();
            if (num === null) {
                if (this.drawInterval) clearInterval(this.drawInterval);
            }
        }, 300); // 300ms for a better "revision" experience
    }

    private drawInterval: any = null;

    public draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
        const s = UIScale.s.bind(UIScale);
        ctx.fillStyle = '#0a0a20'; // Electric Blue/Black
        ctx.fillRect(0, 0, w, h);

        ctx.textAlign = 'center';
        ctx.fillStyle = '#00ffff';
        ctx.font = `bold ${UIScale.r(30)}px "Segoe UI"`;
        ctx.fillText("VIDEO BINGO ELETRÔNICO", w / 2, s(50));

        this.drawCards(ctx, w, h);
        this.drawDrawnNumbers(ctx, w, h);
        this.drawCurrentBall(ctx, w, h);

        if (this.game.phase === 'result') {
            this.drawResult(ctx, w, h);
        } else if (this.game.phase === 'betting') {
            ctx.fillStyle = '#fff';
            ctx.font = `${UIScale.r(16)}px monospace`;
            ctx.fillText("Pressione [ESPAÇO] para comprar a entrada (R$10)", w / 2, h - s(30));
        } else if (this.game.phase === 'picking') {
            ctx.fillStyle = '#ffcc00';
            ctx.font = `${UIScale.r(18)}px monospace`;
            ctx.fillText("ESCOLHA SUA CARTELA COM AS SETAS E [ESPAÇO]", w / 2, h - s(30));
        }
    }

    private drawCards(ctx: CanvasRenderingContext2D, w: number, _h: number) {
        const s = UIScale.s.bind(UIScale);
        const cardW = s(160);
        const cardH = s(160);
        const spacing = s(30);

        this.game.cards.forEach((card, i) => {
            const row = Math.floor(i / 2);
            const col = i % 2;
            const x = (w / 2) - cardW - (spacing / 2) + col * (cardW + spacing);
            const y = s(100) + row * (cardH + spacing);

            const isPlayerCard = this.game.selectedCardIndex === i;
            const isSelected = this.game.phase === 'picking' && isPlayerCard;

            ctx.save();
            if (isSelected) {
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 4;
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#fff';
            } else if (isPlayerCard && this.game.phase !== 'picking') {
                ctx.strokeStyle = '#44ff44';
                ctx.lineWidth = 3;
            } else {
                ctx.strokeStyle = '#00ffff';
                ctx.lineWidth = 2;
                ctx.globalAlpha = (this.game.phase === 'picking') ? 0.4 : 1.0;
            }
            ctx.strokeRect(x, y, cardW, cardH);

            // Label
            ctx.fillStyle = isPlayerCard ? '#00ff00' : '#888';
            ctx.font = `bold ${UIScale.r(12)}px monospace`;
            ctx.textAlign = 'left';

            const nameToDraw = (this.game.phase === 'picking' && !isPlayerCard) ? "???" : card.playerName.toUpperCase();
            ctx.fillText(nameToDraw, x, y - s(8));

            ctx.restore();

            const cellW = cardW / 5;
            const cellH = cardH / 5;

            ctx.textAlign = 'center';
            for (let r = 0; r < 5; r++) {
                for (let c = 0; c < 5; c++) {
                    const val = card.numbers[r][c];
                    const marked = card.marked[r][c];
                    const isLast = val !== 0 && val === this.game.lastDrawnNumber;

                    if (marked) {
                        ctx.fillStyle = isPlayerCard ? 'rgba(0, 255, 0, 0.25)' : 'rgba(0, 255, 255, 0.15)';
                        ctx.fillRect(x + c * cellW, y + r * cellH, cellW, cellH);
                    }

                    if (isLast) {
                        ctx.strokeStyle = '#ffcc00';
                        ctx.lineWidth = 2;
                        ctx.strokeRect(x + c * cellW + 1, y + r * cellH + 1, cellW - 2, cellH - 2);
                    }

                    ctx.fillStyle = marked ? '#fff' : '#444';
                    ctx.font = `${UIScale.r(12)}px monospace`;
                    ctx.fillText(val === 0 ? "★" : val.toString(), x + c * cellW + cellW / 2, y + r * cellH + cellH / 2 + s(5));
                }
            }

            // Draw winning lines
            if (this.game.phase === 'result' && card.winningPatterns.length > 0) {
                ctx.strokeStyle = '#ffcc00';
                ctx.lineWidth = 4;
                card.winningPatterns.forEach(p => {
                    ctx.beginPath();
                    if (p.type === 'row') {
                        const py = y + p.index! * cellH + cellH / 2;
                        ctx.moveTo(x, py); ctx.lineTo(x + cardW, py);
                    } else if (p.type === 'col') {
                        const px = x + p.index! * cellW + cellW / 2;
                        ctx.moveTo(px, y); ctx.lineTo(px, y + cardH);
                    } else if (p.type === 'diag') {
                        if (p.index === 1) { // Main
                            ctx.moveTo(x, y); ctx.lineTo(x + cardW, y + cardH);
                        } else { // Anti
                            ctx.moveTo(x + cardW, y); ctx.lineTo(x, y + cardH);
                        }
                    } else if (p.type === 'corner') {
                        ctx.strokeRect(x, y, cellW, cellH);
                        ctx.strokeRect(x + cardW - cellW, y, cellW, cellH);
                        ctx.strokeRect(x, y + cardH - cellH, cellW, cellH);
                        ctx.strokeRect(x + cardW - cellW, y + cardH - cellH, cellW, cellH);
                    }
                    ctx.stroke();
                });
            }
        });
    }

    private drawCurrentBall(ctx: CanvasRenderingContext2D, w: number, h: number) {
        if (!this.game.lastDrawnNumber) return;
        const s = UIScale.s.bind(UIScale);

        ctx.save();
        const ballX = w / 2;
        const ballY = h / 2 - s(20);
        const ballR = s(35);

        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#00ffff';
        ctx.beginPath();
        ctx.arc(ballX, ballY, ballR, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#000';
        ctx.font = `bold ${UIScale.r(30)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.game.lastDrawnNumber.toString(), ballX, ballY);
        ctx.restore();
    }

    private drawDrawnNumbers(ctx: CanvasRenderingContext2D, w: number, h: number) {
        const s = UIScale.s.bind(UIScale);
        const balls = this.game.drawnHistory;
        if (balls.length === 0) return;

        const trayH = s(60);
        const trayY = h - trayH - s(60);
        const ballR = s(15);
        const spacing = s(10);

        // Take last 15 balls
        const recent = balls.slice(-15);
        const totalW = recent.length * (ballR * 2 + spacing);
        let startX = (w - totalW) / 2 + ballR;

        recent.forEach((num, i) => {
            const isLatest = i === recent.length - 1;
            ctx.fillStyle = isLatest ? '#fff' : '#009999';
            ctx.beginPath();
            ctx.arc(startX, trayY, ballR, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = isLatest ? '#000' : '#fff';
            ctx.font = `bold ${UIScale.r(12)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(num.toString(), startX, trayY);

            startX += ballR * 2 + spacing;
        });
    }

    private drawResult(ctx: CanvasRenderingContext2D, w: number, h: number) {
        const s = UIScale.s.bind(UIScale);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, w, h);
        ctx.textAlign = 'center';

        const won = this.game.winners.includes(this.game.selectedCardIndex);
        ctx.fillStyle = won ? '#00ff00' : '#ff4444';
        ctx.font = `bold ${UIScale.r(60)}px "Segoe UI"`;

        let resultText = "";
        if (this.game.winnerNames.length > 1) {
            resultText = "EMPATE!";
        } else if (won) {
            resultText = "BINGO!";
        } else {
            resultText = `${this.game.winnerNames[0]?.toUpperCase()} VENCEU!`;
        }

        ctx.fillText(resultText, w / 2, h / 2 - s(40));

        if (this.game.winnerNames.length > 1) {
            ctx.fillStyle = '#fff';
            ctx.font = `${UIScale.r(20)}px monospace`;
            ctx.fillText(`GANHADORES: ${this.game.winnerNames.join(", ")}`, w / 2, h / 2 + s(10));
        }

        if (won) {
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${UIScale.r(30)}px "Segoe UI"`;
            ctx.fillText(`PAGAMENTO: R$ ${this.game.totalPayout}`, w / 2, h / 2 + s(60));
        }

        ctx.fillStyle = '#888';
        ctx.font = `${UIScale.r(16)}px monospace`;
        ctx.fillText("Pressione [ESPAÇO] para continuar", w / 2, h / 2 + s(120));
    }
}
