export interface NewsItem {
    id: string;
    title: string;
    description: string[];
    date: string;
}

/**
 * Centralized news data for the NewspaperUI.
 * Focuses on high-level updates from the "Prefeitura de Lesco Lesco".
 */
export const LATEST_NEWS_BASE: NewsItem = {
    id: "v1.6.0",
    title: "SANTA CRUZ: SEGURANÇA E DIVERSÃO!",
    date: "Março, 2026",
    description: [
        "A Prefeitura e a Guarda Municipal de Lesco Lesco City apresentam as novas atualizações em Santa Cruz:",
        "",
        "--- DESTAQUES ---",
        "• ORDEM NA ESTAÇÃO: Uma nova unidade de atendimento policial foi instalada na entrada da estação ferroviária. 'Segurança em primeiro lugar', afirma o guarda de plantão, embora moradores relatem conversas amigáveis sobre o movimento local.",
        "• CASSINO APERFEIÇOADO: Relatos sugerem que as mesas de Poker e Blackjack no subsolo estão agora mais modernas, com regras aprimoradas e visual de alta fidelidade para os entusiastas da sorte.",
        "• AMBIENTE CONTROLADO: A iluminação rústica foi ajustada para garantir o clima perfeito em todos os pontos de encontro da cidade.",
        "• ECONOMIA DE RUA: Rumores indicam que novos limites de aposta foram estabelecidos para garantir que ninguém perca mais do que tem no bolso.",
        "",
        "Aproveite as melhorias e viva o espírito de Lesco Lesco City!",
    ]
};

const RECOMMENDATIONS = [
    "DICA DE TURISMO: A Praça Marques de Herval é famosa por suas partidas de dominó. Dizem que alguns 'veteranos' aceitam apostas para quem tem coragem.",
    "VISITE O MARCO IMPERIAL: Um local histórico e tranquilo... a menos que você esbarre em uma roda de Purrinha improvisada.",
    "OPÇÃO DE LAZER: Boatos de que nos fundos do Shopping Santa Cruz, a sorte pode mudar em um instante. Mas lembre-se: a prefeitura nega a existência de cassinos.",
    "PASSEIO NOTURNO: Os becos da Severiano de Heredia são pitorescos. Se vir um grupo jogando dados, apenas observe... ou tente a sorte.",
    "RELATO DE MORADOR: 'A estação nunca esteve tão movimentada, especialmente os acessos que não estão no mapa oficial', diz um passageiro anônimo.",
];

export function getFullNews(): NewsItem {
    const randomTip = RECOMMENDATIONS[Math.floor(Math.random() * RECOMMENDATIONS.length)];
    return {
        ...LATEST_NEWS_BASE,
        description: [
            ...LATEST_NEWS_BASE.description,
            "",
            "--- RECOMENDAÇÕES DA PREFEITURA ---",
            randomTip,
        ]
    };
}
