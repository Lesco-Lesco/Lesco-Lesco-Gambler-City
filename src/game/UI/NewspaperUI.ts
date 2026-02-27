import { UIScale } from '../Core/UIScale';
import { getFullNews, type NewsItem } from '../NewsData';

export class NewspaperUI {
    private visible: boolean = true;
    private opacity: number = 0;
    private readonly MAX_OPACITY = 0.95;
    private activeNews: NewsItem;

    private readonly title = "OBSERVE SANTA CRUZ";

    constructor() {
        this.activeNews = getFullNews();
    }

    public update(dt: number, input: any) {
        if (!this.visible) return;

        // Fade in
        if (this.opacity < this.MAX_OPACITY) {
            this.opacity += dt * 1.5;
            if (this.opacity > this.MAX_OPACITY) this.opacity = this.MAX_OPACITY;
        }

        // Close logic
        if (this.opacity > 0.5 && input.anyKeyPressed()) {
            this.visible = false;
        }
    }

    public render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number) {
        if (!this.visible || this.opacity <= 0) return;

        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);

        ctx.save();
        ctx.globalAlpha = this.opacity;

        // Semi-transparent background overlay
        ctx.fillStyle = 'rgba(10, 10, 20, 0.75)';
        ctx.fillRect(0, 0, screenW, screenH);

        // Newspaper Container
        const paperW = Math.min(screenW - s(40), s(600));
        const paperH = Math.min(screenH - s(40), s(800));
        const px = (screenW - paperW) / 2;
        const py = (screenH - paperH) / 2;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(px + s(8), py + s(8), paperW, paperH);

        // Paper Surface (Old Paper Color)
        ctx.fillStyle = '#e4dcc4';
        ctx.fillRect(px, py, paperW, paperH);

        // Border
        ctx.strokeStyle = '#332b1e';
        ctx.lineWidth = s(3);
        ctx.strokeRect(px, py, paperW, paperH);

        ctx.save();
        // Define clipping area for the text (static page)
        ctx.beginPath();
        ctx.rect(px, py, paperW, paperH);
        ctx.clip();

        // Inner padding
        const pad = s(30);
        const contentX = px + pad;
        const contentY = py + pad;
        const contentW = paperW - pad * 2;

        ctx.textBaseline = 'top';

        // Header - Title
        ctx.textAlign = 'center';
        ctx.fillStyle = '#1a1a1a';
        ctx.font = `bold ${r(36)}px serif`;
        ctx.fillText(this.title, px + paperW / 2, contentY + s(10));

        // Header - Edition Info
        ctx.font = r(12) + 'px serif';
        ctx.fillText(`${this.activeNews.date} — Santa Cruz Neighborhood`, px + paperW / 2, contentY + s(55));

        // Divider
        ctx.beginPath();
        ctx.moveTo(contentX, contentY + s(75));
        ctx.lineTo(contentX + contentW, contentY + s(75));
        ctx.lineWidth = s(2);
        ctx.strokeStyle = '#1a1a1a';
        ctx.stroke();

        // Headline
        ctx.font = `bold ${r(24)}px serif`;
        const headlineY = contentY + s(100);
        this.drawTextWrapped(ctx, this.activeNews.title, px + paperW / 2, headlineY, contentW, s(30));

        // News Content (Static, no scroll)
        const newsStartYSchool = headlineY + s(70);
        ctx.textAlign = 'left';
        ctx.font = r(16) + 'px serif';
        ctx.fillStyle = '#222';

        let currentY = newsStartYSchool;

        for (const line of this.activeNews.description) {
            if (line === '') {
                currentY += s(12);
                continue;
            }

            const lines = this.wrapText(ctx, line, contentW);
            for (const l of lines) {
                // Draw only if it fits inside paper
                if (currentY < py + paperH - s(60)) {
                    ctx.fillText(l, contentX, currentY);
                }
                currentY += s(22);
            }
        }

        ctx.restore(); // End clipping

        // Footer Instructions (Static)
        ctx.textAlign = 'center';
        ctx.fillStyle = '#1a1a1a';
        ctx.font = `bold ${r(14)}px monospace`;
        const pulse = Math.sin(Date.now() / 300) * 0.2 + 0.8;
        ctx.globalAlpha = this.opacity * pulse;

        const footerY = py + paperH - s(35);
        ctx.fillText("[ APERTE QUALQUER TECLA PARA FECHAR ]", screenW / 2, footerY);

        ctx.restore();
    }

    private wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
        const words = text.split(' ');
        if (words.length === 0) return [];

        const lines = [];
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = ctx.measureText(currentLine + " " + word).width;
            if (width < maxWidth) {
                currentLine += " " + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);
        return lines;
    }

    private drawTextWrapped(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
        const lines = this.wrapText(ctx, text, maxWidth);
        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], x, y + (i * lineHeight));
        }
    }

    public isVisible(): boolean {
        return this.visible;
    }
}
