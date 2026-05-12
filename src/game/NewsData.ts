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
    id: "v3.1.1",
    title: "SANTA CRUZ EM FOCO",
    date: "Atualização Oficial",
    description: [
        "*** NOTA EXTRAORDINÁRIA ***",
        "RUMORES INDICAM QUE UM FORASTEIRO DE CABEÇORRA IMENSA, DO PORTE DE UMA CAIXA D'ÁGUA, ESTÁ DESCENDO PARA LESCO LESCO. O ILUDIDO VEM 'FAZER TESTES' E TENTAR A SORTE NO RANKING GLOBAL. BOAS-VINDAS AO ABATEDOURO! APROVEITAMOS PARA AVISAR AS FARMÁCIAS: MELHOR AUMENTAREM OS COMPRIMIDOS DE DOR DE CABEÇA. VÃO PRECISAR DE ASPIRINAS DO TAMANHO DE UMA PIZZA QUANDO A REALIDADE BATER NESSA MARQUISE CRANIANA.",
        "",
        "• SUNSET PARADISE: O novo Pinball de Santa Cruz! Física de precisão e luzes neon no litoral.",
        "• RANKING GLOBAL 100%: Cada centavo ganho, conquista e aposta te levam ao topo do placar.",
        "• ECONOMIA FIXA: As mesas agora cobram cotas únicas de aposta baseadas no volume do seu bolso.",
        "• PROMOÇÃO NO FLIPERAMA: O dono enlouqueceu! Agora R$ 10 rendem 3 créditos.",
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
