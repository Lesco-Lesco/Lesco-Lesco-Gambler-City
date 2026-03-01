import { RondaGame } from './RondaGame';
import type { Card } from './RondaGame';
import { InputManager } from '../Core/InputManager';
import { BichoManager } from '../BichoManager';
import { isMobile } from '../Core/MobileDetect';
import { UIScale } from '../Core/UIScale';

export class RondaUI {
    private game: RondaGame;
    private hasSettled: boolean = false;
    private onClose: (moneyChange: number) => void;
    private onPlayAgain: (moneyChange: number) => void;

    constructor(game: RondaGame, onClose: (moneyChange: number) => void, onPlayAgain: (moneyChange: number) => void) {
        this.game = game;
        this.onClose = onClose;
        this.onPlayAgain = onPlayAgain;
    }

    public draw(ctx: CanvasRenderingContext2D, width: number, height: number) {
        const s = UIScale.s.bind(UIScale);

        // Fundo feltro verde escuro
        const grad = ctx.createRadialGradient(width / 2, height / 2, s(50), width / 2, height / 2, width);
        grad.addColorStop(0, 'rgba(10, 40, 20, 0.98)');
        grad.addColorStop(1, 'rgba(5, 20, 10, 1.0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        const cx = width / 2;
        const mobile = isMobile();
        const fScale = mobile ? 1.1 : 1.0;

        // ── Zonas de layout proporcionais ──
        // Dividimos a altura em 4 faixas que cabem em qualquer tela
        const TITLE_ZONE = height * 0.10; // 0% → 10%  — título
        const BET_ZONE = height * 0.16; // 10% → 26% — aposta (só na fase betting)
        const CARDS_ZONE = height * 0.46; // 26% → 72% — cartas objetivo + baralho
        const FOOTER_ZONE = height * 0.28; // 72% → 100% — status + controles

        const titleY = TITLE_ZONE * 0.65;
        const betY = TITLE_ZONE + BET_ZONE * 0.55;
        const cardsTop = TITLE_ZONE + BET_ZONE;
        const cardsH = CARDS_ZONE;
        const footerTop = cardsTop + cardsH;

        // ── Título ──
        ctx.shadowBlur = s(14);
        ctx.shadowColor = '#44ff44';
        ctx.fillStyle = '#44ff44';
        ctx.font = `bold ${UIScale.r(mobile ? 18 : 22)}px "Press Start 2P", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('RONDA', cx, titleY);
        ctx.shadowBlur = 0;

        // ── Aposta (somente na fase betting) ──
        if (this.game.phase === 'betting') {
            ctx.fillStyle = '#aaa';
            ctx.font = `bold ${UIScale.r(mobile ? 10 : 12)}px "Press Start 2P", monospace`;
            ctx.fillText('SUA APOSTA', cx, betY - s(10));

            ctx.fillStyle = '#ffff00';
            ctx.font = `bold ${UIScale.r(mobile ? 38 : 52)}px "Segoe UI", sans-serif`;
            ctx.shadowBlur = s(18);
            ctx.shadowColor = 'rgba(255,255,0,0.3)';
            ctx.fillText(`R$ ${this.game.betAmount}`, cx, betY + s(mobile ? 28 : 36));
            ctx.shadowBlur = 0;
        }

        // ── Área de cartas: cartas objetivo (topo) + baralho revelado (centro-baixo) ──
        // Usamos proporções dentro de CARDS_ZONE para nunca se sobrepor

        // Cartas objetivo — ocupam o terço superior da cards zone
        const objSectionH = cardsH * 0.52;
        const objCenterY = cardsTop + objSectionH * 0.55;

        // Dimensão das cartas escala com a altura disponível
        const cardH = Math.min(objSectionH * 0.75, s(mobile ? 130 : 150));
        const cardW = cardH * 0.65;
        const cardSpacing = Math.min(cardW * 1.4, width * 0.22);

        // Container das cartas objetivo
        const containerW = Math.min(width - s(24), cardW * 2 + cardSpacing + s(40));
        const containerH = cardH + s(40);
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.beginPath();
        ctx.roundRect(cx - containerW / 2, objCenterY - containerH / 2 - s(6), containerW, containerH + s(6), s(16));
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#eee';
        ctx.font = `bold ${UIScale.r(mobile ? 8 : 10)}px "Press Start 2P", monospace`;
        ctx.fillText('ESCOLHA UMA CARTA', cx, objCenterY - containerH / 2 + s(mobile ? 12 : 16));

        this.drawCard(ctx, cx - cardSpacing * 0.5, objCenterY + s(mobile ? 6 : 4), this.game.objectiveCards[0], this.game.playerChoiceIndex === 0, false, cardW, cardH);
        this.drawCard(ctx, cx + cardSpacing * 0.5, objCenterY + s(mobile ? 6 : 4), this.game.objectiveCards[1], this.game.playerChoiceIndex === 1, false, cardW, cardH);

        // Indicadores de seleção
        if (this.game.phase === 'betting') {
            ctx.fillStyle = '#ffcc00';
            ctx.font = `bold ${UIScale.r(mobile ? 18 : 22)}px "Segoe UI", sans-serif`;
            const triY = objCenterY + cardH / 2 + s(18);
            ctx.fillText(this.game.playerChoiceIndex === 0 ? '▲' : '', cx - cardSpacing * 0.5, triY);
            ctx.fillText(this.game.playerChoiceIndex === 1 ? '▲' : '', cx + cardSpacing * 0.5, triY);
        }

        // Baralho revelado — segundo terço da cards zone
        const pileSectionH = cardsH * 0.48;
        const pileCenterY = cardsTop + objSectionH + pileSectionH * 0.48;
        const pileCardH = Math.min(pileSectionH * 0.80, s(mobile ? 120 : 150));
        const pileCardW = pileCardH * 0.65;

        ctx.textAlign = 'center';
        if (this.game.communityCards.length > 0) {
            const lastCard = this.game.communityCards[this.game.communityCards.length - 1];
            this.drawCard(ctx, cx, pileCenterY, lastCard, false, true, pileCardW, pileCardH);
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${UIScale.r(mobile ? 8 : 10)}px "Press Start 2P", monospace`;
            ctx.fillText('CARTA REVELADA', cx, pileCenterY - pileCardH / 2 - s(12));
        } else {
            this.drawCardBack(ctx, cx, pileCenterY, pileCardW, pileCardH);
            ctx.fillStyle = '#aaa';
            ctx.font = `bold ${UIScale.r(mobile ? 8 : 10)}px "Press Start 2P", monospace`;
            ctx.fillText('BARALHO', cx, pileCenterY - pileCardH / 2 - s(12));
        }

        // ── Rodapé: status + controles ──
        const statusY = footerTop + FOOTER_ZONE * 0.28;
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${UIScale.r(mobile ? 13 : 17) * fScale}px "Segoe UI", sans-serif`;
        ctx.shadowBlur = s(8);
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.fillText(this.game.message, cx, statusY);
        ctx.shadowBlur = 0;

        this.drawControlsUI(ctx, cx, height - s(mobile ? 16 : 20));
    }

    private drawControlsUI(ctx: CanvasRenderingContext2D, x: number, y: number) {
        const mobile = isMobile();
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = `${UIScale.r(mobile ? 8 : 9)}px "Press Start 2P", monospace`;
        ctx.textAlign = 'center';

        if (this.game.phase === 'betting') {
            const betHint = mobile
                ? '[↑↓] Aposta  [←→] Carta  [OK] JOGAR'
                : '[↑/↓] Aposta   [←/→] Carta   [ESPAÇO] JOGAR';
            ctx.fillText(betHint, x, y);
        } else {
            const playHint = mobile
                ? '[OK] Continuar   [✕] Sair'
                : '[ESPAÇO] Continuar   [ESC] Sair';
            ctx.fillText(playHint, x, y);
        }
    }

    private drawCard(ctx: CanvasRenderingContext2D, x: number, y: number, card: Card, selected = false, highlight = false, w: number, h: number) {
        const s = UIScale.s.bind(UIScale);
        ctx.save();

        if (selected) {
            ctx.shadowBlur = s(28);
            ctx.shadowColor = '#ffff00';
            ctx.fillStyle = 'rgba(255,255,0,0.08)';
            ctx.beginPath();
            ctx.roundRect(x - w / 2 - s(8), y - h / 2 - s(8), w + s(16), h + s(16), s(10));
            ctx.fill();
        }
        if (highlight) {
            ctx.shadowBlur = s(36);
            ctx.shadowColor = '#ffffff';
        }

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(x - w / 2, y - h / 2, w, h, s(7));
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = '#222';
        ctx.lineWidth = 1;
        ctx.stroke();

        const ranks = ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K'];
        const suits: Record<string, string> = { 'ouros': '♦', 'espadas': '♠', 'copas': '♥', 'paus': '♣' };

        ctx.fillStyle = (card.suit === 'copas' || card.suit === 'ouros') ? '#cc0000' : '#111';

        const fontSize = Math.floor(h * 0.32);
        ctx.font = `bold ${fontSize}px "Segoe UI", Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(ranks[card.rank - 1], x, y - h * 0.12);

        const suitSize = Math.floor(h * 0.36);
        ctx.font = `${suitSize}px Arial`;
        ctx.fillText(suits[card.suit], x, y + h * 0.34);

        ctx.font = `bold ${Math.floor(fontSize * 0.38)}px "Segoe UI", Arial`;
        ctx.textAlign = 'left';
        ctx.fillText(ranks[card.rank - 1], x - w / 2 + s(6), y - h / 2 + s(18));
        ctx.textAlign = 'right';
        ctx.fillText(ranks[card.rank - 1], x + w / 2 - s(6), y + h / 2 - s(8));

        ctx.restore();
    }

    private drawCardBack(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
        const s = UIScale.s.bind(UIScale);
        ctx.fillStyle = '#882222';
        ctx.beginPath();
        ctx.roundRect(x - w / 2, y - h / 2, w, h, s(7));
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = s(3);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.beginPath();
        ctx.roundRect(x - w / 2 + s(8), y - h / 2 + s(8), w - s(16), h - s(16), s(4));
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath();
        ctx.arc(x, y, w / 3.5, 0, Math.PI * 2);
        ctx.stroke();
    }

    public update(_dt: number) {
        const input = InputManager.getInstance();
        const bmanager = BichoManager.getInstance();

        if (this.game.phase === 'betting') {
            this.hasSettled = false;

            if (input.wasPressed('ArrowUp') || input.wasPressed('KeyW')) {
                this.game.betAmount = Math.min(this.game.maxBet, this.game.betAmount + 10);
            }
            if (input.wasPressed('ArrowDown') || input.wasPressed('KeyS')) {
                this.game.betAmount = Math.max(this.game.minBet, this.game.betAmount - 10);
            }
            if (input.wasPressed('ArrowLeft') || input.wasPressed('KeyA')) {
                if (bmanager.playerMoney >= this.game.betAmount) {
                    bmanager.playerMoney -= this.game.betAmount;
                    this.game.chooseCard(0);
                }
            }
            if (input.wasPressed('ArrowRight') || input.wasPressed('KeyD')) {
                if (bmanager.playerMoney >= this.game.betAmount) {
                    bmanager.playerMoney -= this.game.betAmount;
                    this.game.chooseCard(1);
                }
            }
        } else if (this.game.phase === 'result') {
            if (!this.hasSettled) {
                this.hasSettled = true;
            }
            if (input.wasPressed('Space') || input.wasPressed('Enter')) {
                this.onPlayAgain(this.game.winAmount);
                this.game.reset();
            }
        }

        if (input.wasPressed('Escape')) {
            const finalPayout = (this.game.phase === 'result') ? this.game.winAmount : 0;
            this.onClose(finalPayout);
        }
    }

}
