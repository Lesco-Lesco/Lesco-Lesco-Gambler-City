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
    id: "v1.9.0",
    title: "SANTA CRUZ EM FOCO",
    date: "Março, 2026",
    description: [
        "Informativo oficial sobre o desenvolvimento urbano de Santa Cruz:",
        "",
        "--- DESTAQUES ---",
        "• FLIPERAMAS: Novos módulos eletrônicos instalados. Alguns operam em fase experimental — teste sua habilidade nos controles.",
        "• MATA-MATA: A mesa de bilhar agora exige precisão total. Regras clássicas para quem não tem medo de perder a vez.",
        "• ZONAS DE PAZ: Refúgios para diversão eletrônica parecem fora do radar da fiscalização. Aproveite sem pressão.",
        "• NOVO MAPA: Pressione 'M' para o guia oficial. Nomes de ruas e zoom ('Z') agora operam em resolução máxima.",
        "",
    ]
};

const RECOMMENDATIONS = [
    "DICA: A Praça Marques de Herval é famosa pelo Dominó. Veteranos dizem que a sorte aceita desafios por lá.",
    "VISITA: No Marco Imperial ruge a Purrinha sob os olhos da história. Cuidado com quem desafia.",
    "LAZER: Novos fliperamas estão espalhados pelo mapa. Dizem que os vizinhos nunca têm os mesmos jogos.",
    "ESTRATÉGIA: Na Sinuca Mata-Mata, uma tacada na branca concede liberdade dupla ao adversário. Mire bem.",
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
