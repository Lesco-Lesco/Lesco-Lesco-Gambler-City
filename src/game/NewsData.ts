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
    id: "v1.5.0",
    title: "REFORMA URBANA EM SANTA CRUZ!",
    date: "Fevereiro, 2026",
    description: [
        "A Prefeitura de Lesco Lesco City celebra a conclusão do plano de modernização no bairro de Santa Cruz:",
        "",
        "--- NOTAS DO DIA ---",
        "• LESCO LESCO MAIS VERDE: Plantio estratégico de árvores e revitalização das fontes na praça central.",
        "• FLUXO PEATONAL: O trânsito de veículos foi removido para garantir a segurança dos pedestres locais.",
        "• A ESTAÇÃO VIVE: Novas passarelas e conexões foram abertas no complexo ferroviário santa-cruzense.",
        "• CLUBE EXCLUSIVO? Fontes não oficiais sugerem que o subsolo da estação agora abriga um novo ponto de 'entretenimento de elite'. A Guarda Municipal não comenta sobre barulhos de fichas após a meia-noite.",
        "",
        "Explore as melhorias do bairro. O progresso de Lesco Lesco City não para!",
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
            "",
            "Aperte qualquer tecla para entrar no bairro..."
        ]
    };
}
