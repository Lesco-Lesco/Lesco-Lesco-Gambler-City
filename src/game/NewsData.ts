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
    id: "v3.0.0",
    title: "SANTA CRUZ EM FOCO",
    date: "Abril, 2026",
    description: [
        "A CIDADE NÃO DORME, SANTA CRUZ!",
        "",
        "• RANKING GLOBAL NO AR: Os fliperamas agora estão ligados na rede mundial! Seu nome no topo do placar de Santa Cruz pro mundo inteiro ver.",
        "• O FUTURO É DIGITAL: Tão dizendo que quem ficar no Top 100, ou roubar o recorde de alguém, vai ganhar uma 'arte digital única' no futuro. Será?",
        "• A CIDADE FALA: O povo tá mais fofoqueiro que nunca! Pare nas esquinas e janelas. Conversar e escutar é o ponto forte da nossa cidade.",
        "• ÚLTIMO SUSPIRO: A vovó te salva UMA VEZ com 50 mangos. Zerou de novo? É vala! Game Over sem choro.",
        "",
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
