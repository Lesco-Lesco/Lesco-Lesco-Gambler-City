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
    date: "Edição Especial de Apostas",
    description: [
        "*** ALERTA GERAL: O DONO ENLOUQUECEU! ***",
        "Coloque sua grana na mesa e encare as máquinas de Santa Cruz. O placar global não perdoa covardes: cada ficha e cada recorde batido te empurram para o topo do submundo das apostas de LLGC. A banca está aberta, faça sua jogada.",
        "",
        "• VALORIUM (TITAN'S FURY): Pancadaria franca com combos de 3 hits e Valkor em modo Rage no final!",
        "• PINBALL SUNSET: Física de precisão nas bolinhas e luzes neon. Acabe com a banca!",
        "• SINUCA & BOTÃO: Clássicos de boteco. Mostre que é o rei do giz e da palheta e fature alto.",
        "• FACAS, DUELOS & TANKS: Risca Faca, Faroeste, Tanks e AirPong para quem tem sangue frio.",
        "• RANKING GLOBAL: O Jogador S, oponente digno e veterano dos jogos de luta, já tá treinando combos em Valorium! Vai encarar o placar dele ou vai amarelar?",
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
