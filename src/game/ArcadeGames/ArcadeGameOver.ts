/**
 * Shared Game Over screen utilities for all arcade games.
 * Motivational phrases and consistent game over rendering.
 */
import { UIScale } from '../Core/UIScale';

const MOTIVATIONAL_PHRASES: string[] = [
    'Quase lá! Na próxima você consegue!',
    'Não desista! Todo mestre já foi um desastre!',
    'Perdeu? Faz parte! O importante é se divertir!',
    'A derrota é só o começo da vitória!',
    'Caiu? Levanta! O jogo recomeça agora!',
    'Grandes jogadores perdem antes de vencer!',
    'Relaxa, até o Pac-Man morria de vez em quando!',
    'O score é passageiro, a diversão é eterna!',
    'Tente de novo! A máquina tá esperando!',
    'Errar faz parte do processo!',
    'Você foi bem! Agora vai ser melhor ainda!',
    'Ninguém nasce sabendo jogar... treino é tudo!',
    'Game over é só uma pausa pra respirar!',
    'Sua hora vai chegar, continua treinando!',
    'Cada derrota é uma lição disfarçada!',
    'Pra que desistir? O recorde tá te chamando!',
    'Não é sobre ganhar, é sobre apertar os botões com estilo!',
    'O fliperama não julga... ele espera sua próxima moeda!',
    'Persistência é a mãe da habilidade!',
    'O segredo? Jogar de novo até virar mestre!',
    'Você perdeu a batalha, não a guerra!',
    'Boa tentativa! Agora mostra do que é capaz!',
    'Até os pros já zeraram a vida mil vezes!',
    'O game over não é o fim, é o recomeço!',
    'Respira fundo e bota mais uma moeda!',
    'Se fosse fácil, não teria graça!',
    'Tá difícil? Ótimo! É assim que se evolui!',
    'Jogar é como viver: cai, levanta, e vai de novo!',
    'O fliperama acredita em você, sabia?',
    'Recorde não se faz na primeira tentativa!',
];

export function getMotivationalPhrase(): string {
    return MOTIVATIONAL_PHRASES[Math.floor(Math.random() * MOTIVATIONAL_PHRASES.length)];
}

/**
 * Renders a polished, consistent Game Over overlay for any arcade game.
 */
export function renderArcadeGameOver(
    ctx: CanvasRenderingContext2D,
    screenW: number,
    screenH: number,
    score: number,
    phrase: string
) {
    const s = UIScale.s.bind(UIScale);
    const r = UIScale.r.bind(UIScale);
    const cx = screenW / 2;
    const cy = screenH / 2;

    // Dark overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, screenW, screenH);

    // Neon border box
    const boxW = s(420);
    const boxH = s(320);
    const boxX = cx - boxW / 2;
    const boxY = cy - boxH / 2 - s(10);

    // Box background
    ctx.fillStyle = 'rgba(5, 5, 20, 0.95)';
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, s(12));
    ctx.fill();

    // Animated neon border
    const time = Date.now();
    const hue = (time / 15) % 360;
    ctx.strokeStyle = `hsl(${hue}, 100%, 55%)`;
    ctx.lineWidth = s(3);
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, s(12));
    ctx.stroke();

    // Inner glow line
    ctx.strokeStyle = `hsla(${hue}, 100%, 70%, 0.3)`;
    ctx.lineWidth = s(1);
    ctx.beginPath();
    ctx.roundRect(boxX + s(4), boxY + s(4), boxW - s(8), boxH - s(8), s(10));
    ctx.stroke();

    // "GAME OVER" title with glow
    ctx.save();
    ctx.shadowBlur = 25;
    ctx.shadowColor = '#ff3344';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff3344';
    ctx.font = `bold ${r(38)}px monospace`;
    ctx.fillText('GAME OVER', cx, boxY + s(55));
    ctx.shadowBlur = 0;
    ctx.restore();

    // Horizontal divider
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(boxX + s(30), boxY + s(75));
    ctx.lineTo(boxX + boxW - s(30), boxY + s(75));
    ctx.stroke();

    // Score label
    ctx.fillStyle = '#888';
    ctx.font = `${r(14)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('PONTUAÇÃO FINAL', cx, boxY + s(100));

    // Score value (big, golden, glowing)
    ctx.save();
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ffcc00';
    ctx.fillStyle = '#ffcc00';
    ctx.font = `bold ${r(48)}px monospace`;
    ctx.fillText(`${score}`, cx, boxY + s(145));
    ctx.shadowBlur = 0;
    ctx.restore();

    // Star decoration around score
    ctx.fillStyle = '#ffcc00';
    ctx.font = `${r(18)}px monospace`;
    const scoreText = `${score}`;
    const scoreWidth = ctx.measureText(scoreText).width;
    ctx.fillText('★', cx - scoreWidth / 2 - s(25), boxY + s(140));
    ctx.fillText('★', cx + scoreWidth / 2 + s(15), boxY + s(140));

    // Motivational phrase
    ctx.fillStyle = '#aaddff';
    ctx.font = `italic ${r(13)}px monospace`;
    ctx.textAlign = 'center';

    // Word wrap the phrase
    const maxLineW = boxW - s(50);
    const words = phrase.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    for (const word of words) {
        const testLine = currentLine ? currentLine + ' ' + word : word;
        if (ctx.measureText(testLine).width > maxLineW) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    }
    if (currentLine) lines.push(currentLine);

    const phraseY = boxY + s(185);
    lines.forEach((line, i) => {
        ctx.fillText(line, cx, phraseY + i * s(18));
    });

    // Action button — pulsing
    const btnW = s(280);
    const btnH = s(44);
    const btnX = cx - btnW / 2;
    const btnY = boxY + boxH - s(70);
    const pulse = 0.8 + Math.sin(time / 300) * 0.2;

    // Button background
    ctx.fillStyle = `rgba(0, 255, 100, ${0.15 * pulse})`;
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, s(8));
    ctx.fill();

    // Button border
    ctx.strokeStyle = `rgba(0, 255, 100, ${0.8 * pulse})`;
    ctx.lineWidth = s(2);
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, s(8));
    ctx.stroke();

    // Button text
    ctx.fillStyle = `rgba(255, 255, 255, ${0.7 + 0.3 * pulse})`;
    ctx.font = `bold ${r(16)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('[ ESPAÇO ] CONTINUAR', cx, btnY + btnH / 2 + s(5));

    // Small hint
    ctx.fillStyle = '#555';
    ctx.font = `${r(10)}px monospace`;
    ctx.fillText('ESC para sair', cx, btnY + btnH + s(18));
}
