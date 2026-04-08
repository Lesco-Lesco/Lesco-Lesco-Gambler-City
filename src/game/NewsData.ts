export interface NewsItem {
    id: string;
    title: string;
    description: string[];
    date: string;
}

/**
 * Centralized news data for the NewspaperUI.
 * 
 * --- REGRA DE OURO DO JORNAL ---
 * O conteúdo deve ser estritamente sucinto para caber em uma única página (sem scroll).
 * - Máximo de 4-5 tópicos por edição.
 * - Tópicos com no máximo 2-3 linhas cada.
 * - Evitar descrições longas; focar no que mudou ou em pistas rápidas.
 */
export const LATEST_NEWS_BASE: NewsItem = {
    id: "v2.2.2",
    title: "SANTA CRUZ EM FOCO",
    date: "Abril, 2026",
    description: [
        "SEGURA O CORAÇÃO, SANTA CRUZ!",
        "",
        "• PAZ NO BOTECO: Novo decreto! A PM não entra mais nos bares. Bingo e corridas estão blindados. O bicho só pega na rua, exceto pra quem joga dominó!",
        "• RETA DA BASE: Quer forrar o bolso? Vá pras beiras do mapa! Na periferia a aposta dobra e o coração dispara. Ação real!",
        "• SUBIDA DO MORRO: O bairro é escada, parceiro! Ganhe moral no Shopping e abra o Subsolo do Marco Imperial. Malandragem!",
        "• DINHEIRO NA MÃO: Esquece o troco! Agora é só nota de dez pra cima. Ganhou, levou, sem moedinha pra atrasar a banca.",
        "• ÚLTIMO SUSPIRO: A vovó te salva UMA VEZ com 50 mangos. Zerou de novo? É vala! Game Over sem choro. Se garanta no taco!",
        "",
    ]
};

const RECOMMENDATIONS = [
    "DICA: O Cassino da Estação só abre pra quem já é veterano. Ganhe moral no Shopping primeiro.",
    "AVISO: A vovó só dá os 50 mangos uma vez. Gastou, perdeu. Jogue cada real como se fosse o último!",
    "BICA NO CANTO: Se o NPC estiver 'em cooldown', aproveite para explorar outras rodas. O fiscal não dorme!",
    "ESTRATÉGIA: Agora as conquistas iniciais dão apenas prestígio. Dinheiro de verdade vem com a fama alta.",
];

export function getFullNews(): NewsItem {
    const randomTip = RECOMMENDATIONS[Math.floor(Math.random() * RECOMMENDATIONS.length)];
    return {
        ...LATEST_NEWS_BASE,
        description: [
            ...LATEST_NEWS_BASE.description,
            "--- DICAS DA PREFEITURA ---",
            randomTip,
        ]
    };
}
