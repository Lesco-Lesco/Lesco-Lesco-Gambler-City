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
    id: "v3.1.2",
    title: "GAZETA DE LESCO-LESCO",
    date: "Edição Especial",
    description: [
        "Os moradores de Santa Cruz seguem agitados. Quem anda com os ouvidos abertos sabe que a cidade tem mais a oferecer do que aparenta.",
        "",
        "• FLIPERAMA: Oito máquinas abertas — de Valorium e Risca Faca até Sinuca e Air Pong. Cada recorde entra no placar global.",
        "• SR. S, frequentador assíduo dos jogos de luta, foi o primeiro a perguntar quando o Valorium estaria disponível. Já tá na cidade. Vai lá encarar.",
        "• PRAÇAS E ESQUINAS: Converse com os moradores. Quem pergunta certo descobre coisas que não estão em nenhum cartaz.",
        "• RANKING GLOBAL: Dizem que há gente de fora de olho nos primeiros do placar. Faça seu nome antes que outro faça o dele.",
    ]
};

const RECOMMENDATIONS = [
    "DICA: Preste atenção no que o povo fala! A maior riqueza de Santa Cruz tá na língua dos moradores.",
    "AVISO: Bater recorde não é só prestígio. Tem gente grande de olho nos 100 primeiros do placar global...",
    "BICA NO CANTO: Pare perto de janelas e cabines. A fofoca rola solta e você sempre descobre algo novo.",
    "ESTRATÉGIA: Troque ideia com a polícia e escute os pedintes. A malandragem se aprende no diálogo.",
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
