import type { Scene } from '../Core/Loop';
import { InputManager } from '../Core/InputManager';
import { UIScale } from '../Core/UIScale';

export class GameOverScene implements Scene {
    public name = 'gameover';
    private input: InputManager;
    private screenW: number = 0;
    private screenH: number = 0;
    private time: number = 0;

    private sarcasticPhrases: string[] = [
        "Acabou a mamata, playboy. O banco mandou lembranças!",
        "Perdeu tudo? O GPS não ensina a sair do buraco não.",
        "Tá liso, hein? Vai pedir esmola na praça agora.",
        "O banco sempre ganha, e você... bom, você é você.",
        "Ih, ficou sem um tostão. Quer que eu te empreste 10 conto?",
        "Volta pro Shopping que lá o ar condicionado é de graça.",
        "A vida é dura, e sem dinheiro ela é pior ainda.",
        "Bateu o desespero? Vai catar latinha no Beco do Matadouro.",
    ];

    private currentPhrase: string = "";
    public onRestart?: () => void;

    constructor() {
        this.input = InputManager.getInstance();
        this.pickRandomPhrase();
    }

    private pickRandomPhrase() {
        this.currentPhrase = this.sarcasticPhrases[Math.floor(Math.random() * this.sarcasticPhrases.length)];
    }

    public onEnter() {
        this.pickRandomPhrase();
        this.time = 0;
    }

    public update(dt: number) {
        this.time += dt;
        if (this.input.wasPressed('Space') || this.input.wasPressed('Enter')) {
            if (this.onRestart) this.onRestart();
        }
    }

    public resize(w: number, h: number) {
        this.screenW = w;
        this.screenH = h;
    }

    public render(ctx: CanvasRenderingContext2D) {
        const s = UIScale.s.bind(UIScale);

        // Dark background
        ctx.fillStyle = '#050208';
        ctx.fillRect(0, 0, this.screenW, this.screenH);

        const centerX = this.screenW / 2;
        const centerY = this.screenH / 2;

        // Static Glitch Effect
        for (let i = 0; i < 50; i++) {
            const gx = Math.random() * this.screenW;
            const gy = Math.random() * this.screenH;
            const gw = Math.random() * s(100);
            const gh = 1;
            ctx.fillStyle = `rgba(255, 0, 0, ${Math.random() * 0.1})`;
            ctx.fillRect(gx, gy, gw, gh);
        }

        // --- END GAME text ---
        const pulse = Math.sin(this.time * 5) * 0.1 + 0.9;
        ctx.save();
        ctx.translate(centerX, centerY - s(60));
        ctx.scale(pulse, pulse);

        ctx.fillStyle = '#ff0000';
        ctx.font = `bold ${UIScale.r(82)}px "Press Start 2P", Courier, monospace`;
        ctx.textAlign = 'center';
        ctx.shadowColor = '#880000';
        ctx.shadowBlur = s(20);
        ctx.fillText('END GAME', 0, 0);
        ctx.restore();

        // --- Sarcastic Phrase ---
        ctx.fillStyle = '#ccc';
        ctx.font = `${UIScale.r(20)}px "Press Start 2P", Courier, monospace`;
        ctx.textAlign = 'center';
        ctx.shadowBlur = 0;

        // Wrap text if needed
        const words = this.currentPhrase.split(' ');
        let line = '';
        let y = centerY + s(40);
        const maxWidth = this.screenW * 0.8;

        for (const word of words) {
            const testLine = line + word + ' ';
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && line !== '') {
                ctx.fillText(line, centerX, y);
                line = word + ' ';
                y += s(30);
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, centerX, y);

        // --- Restart Hint ---
        if (Math.floor(this.time * 2) % 2 === 0) {
            ctx.fillStyle = '#ffcc00';
            ctx.font = `${UIScale.r(16)}px "Press Start 2P", Courier, monospace`;
            ctx.fillText('PRESSIONE [ESPAÇO] PARA TENTAR NOVAMENTE', centerX, this.screenH - s(100));
        }
    }
}
