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
    id: "v1.8.0",
    title: "SANTA CRUZ EM FOCO",
    date: "Março, 2026",
    description: [
        "A Prefeitura apresenta as melhorias da semana em Santa Cruz:",
        "",
        "--- DESTAQUES ---",
        "• BARES ABERTOS: Operando agora com Video Bingo e Corridas (Cavalos e Galgos). A diversão voltou ao balcão!",
        "• NOVO MAPA: Pressione 'M' para o guia oficial com nomes de ruas e zoom ('Z') para facilitar a navegação.",
        "• RUMORES: O subsolo do Shopping Santa Cruz guarda muito mais que depósitos. Dizem que a fortuna está lá embaixo.",
        "• AMBIENTE: Melhorias na iluminação das ruas para caminhadas noturnas mais seguras e imersivas.",
        "",
    ]
};

const RECOMMENDATIONS = [
    "DICA: A Praça Marques de Herval é famosa pelo Dominó. Veteranos dizem que a sorte aceita desafios por lá.",
    "VISITA: No Marco Imperial ruge a Purrinha sob os olhos da história. Cuidado com quem desafia.",
    "BOEMIA: Os bares locais agora têm Video Bingo e apostas em Corridas. A sorte ruge no balcão!",
    "LAZER: Boatos no Shopping Santa Cruz dizem que o subsolo guarda segredos que a Prefeitura nega existir.",
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
