/**
 * MinigameMusicProfiles — Perfis musicais exclusivos por minigame.
 *
 * Cada perfil define a "voz" harmônica do seu respectivo jogo:
 *  - scale: frequências Hz da escala (determinam a melodia procedural)
 *  - waveform: timbre do oscilador chiptune
 *  - volume: volume das notas procedurais (propositalmente baixo ~8–13%)
 *  - noteDuration: duração de cada nota em ms
 *  - stepMode: 'cycle' percorre a escala em ordem | 'random' escolhe aleatoriamente
 *  - winFanfare / loseFanfare: sequência de notas para resultado
 */

export type ChiptuneWaveform = OscillatorType; // 'square' | 'triangle' | 'sawtooth' | 'sine'
export type StepMode = 'cycle' | 'random';

export interface MinigameMusicProfile {
    id: string;
    scale: number[];          // Frequências Hz
    waveform: ChiptuneWaveform;
    volume: number;           // 0.0 – 1.0
    noteDuration: number;     // Milissegundos
    stepMode: StepMode;
    winFanfare: number[];     // Frequências Hz da fanfara de vitória
    loseFanfare: number[];    // Frequências Hz da fanfara de derrota
}

export const MINIGAME_MUSIC_PROFILES: Record<string, MinigameMusicProfile> = {

    // ──────────────────────────────────────────────
    // 🔴 VÍDEO BINGO
    // Pentatônica de Lá menor — festivo, animado.
    // Cada número sorteado avança ciclicamente na escala,
    // criando uma melodia ascendente acidental.
    // ──────────────────────────────────────────────
    videobingo: {
        id: 'videobingo',
        scale: [220, 261.6, 329.6, 392, 440, 523.2, 659.2], // A3 C4 E4 G4 A4 C5 E5
        waveform: 'square',
        volume: 0.05,
        noteDuration: 130,
        stepMode: 'cycle',
        winFanfare:  [440, 523.2, 659.2, 880],   // A4→C5→E5→A5
        loseFanfare: [329.6, 293.6, 261.6, 220],  // E4→D4→C4→A3
    },

    // ──────────────────────────────────────────────
    // ♠️ BLACKJACK
    // Blues de Ré menor — jazzístico, tenso, sofisticado.
    // Notas longas e suaves que se movem livremente pela escala,
    // evocando a tensão de uma mesa de cassino.
    // ──────────────────────────────────────────────
    blackjack: {
        id: 'blackjack',
        scale: [146.8, 174.6, 196, 207.6, 220, 261.6, 293.6], // D3 F3 G3 Ab3 A3 C4 D4
        waveform: 'triangle',
        volume: 0.10,
        noteDuration: 180,
        stepMode: 'random',
        winFanfare:  [293.6, 349.2, 440, 587.3],  // D4→F4→A4→D5
        loseFanfare: [293.6, 261.6, 233.1, 220],  // D4→C4→Bb3→A3
    },

    // ──────────────────────────────────────────────
    // 🎲 DADOS
    // Sol maior — enérgico, percussivo, imprevisível.
    // Notas curtas e aleatórias como um dado rolar.
    // ──────────────────────────────────────────────
    dice: {
        id: 'dice',
        scale: [196, 220, 246.9, 293.6, 329.6, 392], // G3 A3 B3 D4 E4 G4
        waveform: 'square',
        volume: 0.13,
        noteDuration: 90,
        stepMode: 'random',
        winFanfare:  [392, 493.9, 587.3, 784],   // G4→B4→D5→G5
        loseFanfare: [196, 174.6, 164.8, 146.8], // G3→F3→E3→D3
    },

    // ──────────────────────────────────────────────
    // 🐴 CORRIDA DE CAVALOS
    // Mixolídio de Sol — épico, cinematográfico.
    // Oscila para cima e para baixo mimetizando o galope,
    // como uma fanfara de hipódromo 8-bit.
    // ──────────────────────────────────────────────
    horse: {
        id: 'horse',
        scale: [196, 220, 246.9, 261.6, 293.6, 329.6, 349.2, 392], // G3→G4 Mixolídio
        waveform: 'sawtooth',
        volume: 0.11,
        noteDuration: 110,
        stepMode: 'cycle',
        winFanfare:  [392, 493.9, 587.3, 784],   // G4→B4→D5→G5 — fanfara épica
        loseFanfare: [392, 329.6, 261.6, 196],   // G4→E4→C4→G3
    },

    // ──────────────────────────────────────────────
    // 🐕 CORRIDA DE CÃES
    // Pentatônica de Mi menor — similar aos cavalos,
    // mas mais caótico e urgente (cães são imprevisíveis).
    // ──────────────────────────────────────────────
    dog: {
        id: 'dog',
        scale: [164.8, 196, 220, 246.9, 293.6, 329.6], // E3 G3 A3 B3 D4 E4
        waveform: 'sawtooth',
        volume: 0.11,
        noteDuration: 100,
        stepMode: 'random',
        winFanfare:  [329.6, 392, 493.9, 659.2], // E4→G4→B4→E5
        loseFanfare: [164.8, 146.8, 130.8, 123.5], // E3→D3→C3→B2
    },

    // ──────────────────────────────────────────────
    // 🎰 SLOT MACHINE
    // Pentatônica de Dó maior — clássico de cassino 8-bit.
    // Notas muito curtas ascendentes a cada rolagem,
    // como os cliques mecânicos de um caça-níqueis.
    // ──────────────────────────────────────────────
    slot: {
        id: 'slot',
        scale: [261.6, 293.6, 329.6, 392, 440, 523.2], // C4 D4 E4 G4 A4 C5
        waveform: 'square',
        volume: 0.10,
        noteDuration: 80,
        stepMode: 'cycle',
        winFanfare:  [261.6, 329.6, 392, 523.2, 659.2, 1046.5], // C4→E4→G4→C5→E5→C6 jackpot!
        loseFanfare: [261.6, 246.9, 233.1, 220],                 // C4→B3→Bb3→A3
    },

    // ──────────────────────────────────────────────
    // ♟️ PÔQUER
    // Menor harmônica de Lá — sombrio, calculado, mental.
    // O mais silencioso de todos (volume 0.08) — deve ser
    // quase imperceptível, como um pensamento.
    // ──────────────────────────────────────────────
    poker: {
        id: 'poker',
        scale: [110, 123.5, 130.8, 146.8, 164.8, 174.6, 207.6, 220], // A2→A3 harmônica menor
        waveform: 'triangle',
        volume: 0.08,
        noteDuration: 220,
        stepMode: 'random',
        winFanfare:  [220, 261.6, 329.6, 440],   // A3→C4→E4→A4
        loseFanfare: [220, 207.6, 174.6, 164.8], // A3→G#3→F3→E3 — dissonância
    },

    // ──────────────────────────────────────────────
    // 🦜 JOGO DO BICHO
    // Modo Frígio de Mi — sabor ibérico-brasileiro,
    // místico e popular. O "b2" (F3 em Em frígio)
    // dá esse toque de candomblé/nordeste único.
    // ──────────────────────────────────────────────
    bicho: {
        id: 'bicho',
        scale: [164.8, 174.6, 196, 220, 246.9, 261.6, 293.6, 329.6], // E3→E4 frígio
        waveform: 'square',
        volume: 0.12,
        noteDuration: 150,
        stepMode: 'cycle',
        winFanfare:  [329.6, 392, 440, 493.9, 659.2], // E4→G4→A4→B4→E5
        loseFanfare: [164.8, 146.8, 130.8, 123.5, 82.4], // E3→D3→C3→B2→E2
    },

    // ──────────────────────────────────────────────
    // 🀱 DOMINÓ
    // Pentatônica de Ré menor — cadenciado, estratégico.
    // Notas deliberadas como uma peça pousando na mesa.
    // Sempre em ciclo — o dominó tem ordem e regras.
    // ──────────────────────────────────────────────
    domino: {
        id: 'domino',
        scale: [146.8, 174.6, 196, 220, 261.6, 293.6], // D3 F3 G3 A3 C4 D4
        waveform: 'triangle',
        volume: 0.09,
        noteDuration: 160,
        stepMode: 'cycle',
        winFanfare:  [293.6, 349.2, 440, 587.3],  // D4→F4→A4→D5
        loseFanfare: [146.8, 130.8, 116.5, 110],  // D3→C3→Bb2→A2
    },

    // ──────────────────────────────────────────────
    // ✊ PEDRA-PAPEL-TESOURA (JOKENPO)
    // Escala de tons inteiros — estranha, suspensa.
    // Nenhuma nota "repousa", refletindo a imprevisibilidade
    // do jogo onde tudo pode mudar com um gesto.
    // ──────────────────────────────────────────────
    jokenpo: {
        id: 'jokenpo',
        scale: [261.6, 293.6, 329.6, 369.9, 415.3, 466.2], // Whole-tone C4→A#4
        waveform: 'square',
        volume: 0.13,
        noteDuration: 100,
        stepMode: 'random',
        winFanfare:  [261.6, 329.6, 415.3, 523.2], // C4→E4→G#4→C5
        loseFanfare: [261.6, 233.1, 207.6, 185],   // C4→Bb3→G#3→F#3
    },

    // ──────────────────────────────────────────────
    // 🀄 FAN-TAN
    // Pentatônica chinesa em Fá — o único minigame
    // com timbre SINE puro, mais etéreo e oriental.
    // Notas longas e meditativas como contar grãos de arroz.
    // ──────────────────────────────────────────────
    fantan: {
        id: 'fantan',
        scale: [174.6, 196, 220, 261.6, 293.6, 349.2], // F3 G3 A3 C4 D4 F4
        waveform: 'sine',
        volume: 0.10,
        noteDuration: 200,
        stepMode: 'cycle',
        winFanfare:  [349.2, 440, 523.2, 698.5], // F4→A4→C5→F5
        loseFanfare: [174.6, 146.8, 130.8, 110], // F3→D3→C3→A2
    },

    // ──────────────────────────────────────────────
    // 🃏 RONDA
    // Pentatônica de Sol menor — carioca, suave.
    // Notas tranquilas que fluem como um jogo de cartas
    // numa mesa de bar no Rio de Janeiro.
    // ──────────────────────────────────────────────
    ronda: {
        id: 'ronda',
        scale: [196, 233.1, 261.6, 293.6, 349.2, 392], // G3 Bb3 C4 D4 F4 G4
        waveform: 'triangle',
        volume: 0.10,
        noteDuration: 150,
        stepMode: 'cycle',
        winFanfare:  [392, 466.2, 587.3, 784],   // G4→Bb4→D5→G5
        loseFanfare: [196, 174.6, 155.6, 146.8], // G3→F3→Eb3→D3
    },

    // ──────────────────────────────────────────────
    // 🍬 PALITINHO
    // Pentatônica de Ré maior — leve, infantil, playful.
    // Remete a brincadeiras de criança na calçada,
    // que é exatamente o que o palitinho é.
    // ──────────────────────────────────────────────
    palitinho: {
        id: 'palitinho',
        scale: [293.6, 329.6, 369.9, 440, 493.9], // D4 E4 F#4 A4 B4
        waveform: 'square',
        volume: 0.11,
        noteDuration: 120,
        stepMode: 'random',
        winFanfare:  [293.6, 369.9, 440, 587.3], // D4→F#4→A4→D5
        loseFanfare: [246.9, 220, 185, 146.8],   // B3→A3→F#3→D3
    },

    // ──────────────────────────────────────────────
    // 🖐️ PORRINHA (PURRINHA)
    // Pentatônica de Mi maior — agudo, informal, de bar.
    // Sons que lembram o movimento de mostrar os dedos
    // e gritar "porrinha!" ganhando a rodada.
    // ──────────────────────────────────────────────
    purrinha: {
        id: 'purrinha',
        scale: [329.6, 369.9, 415.3, 493.9, 554.4], // E4 F#4 G#4 B4 C#5
        waveform: 'square',
        volume: 0.12,
        noteDuration: 110,
        stepMode: 'random',
        winFanfare:  [329.6, 415.3, 493.9, 659.2], // E4→G#4→B4→E5
        loseFanfare: [329.6, 293.6, 261.6, 246.9], // E4→D4→C4→B3
    },

    // ──────────────────────────────────────────────
    // 🪙 CARA OU COROA (HEADS & TAILS)
    // Dois tons alternados — simples como o jogo.
    // Ca-ra / Co-ro-a — dois estados, duas notas.
    // Elegante na sua simplicidade.
    // ──────────────────────────────────────────────
    headstails: {
        id: 'headstails',
        scale: [392, 523.2], // G4 / C5 — apenas dois tons alternando
        waveform: 'triangle',
        volume: 0.14,
        noteDuration: 160,
        stepMode: 'cycle',
        winFanfare:  [392, 523.2, 659.2, 784],   // G4→C5→E5→G5
        loseFanfare: [392, 349.2, 293.6, 261.6], // G4→F4→D4→C4
    },
};
