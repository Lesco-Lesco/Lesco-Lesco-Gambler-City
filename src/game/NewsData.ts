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
    id: "v3.1.0",
    title: "SANTA CRUZ EM FOCO",
    date: "Atualização Oficial",
    description: [
        "• RANKING GLOBAL 100%: A conexão mundial estabilizou! Cada centavo ganho, conquista e aposta na cidade agora te levam ao topo do placar geral.",
        "• ECONOMIA FIXA: Chega de negociar. As mesas agora cobram cotas únicas de aposta baseadas no volume do seu bolso.",
        "• TRÂNSITO LIVRE: Morador não dorme mais no asfalto! Aprenderam a atravessar a rua rapidinho para liberar a via.",
        "• PROMOÇÃO NO FLIPERAMA: O dono enlouqueceu! As fichas estão em promoção, agora R$ 10 rendem 3 créditos.",
        "• SINUCA AFIADA: Taco calibrado! Toque leve para mirar com precisão, ou segure para girar o taco mais rápido.",
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
