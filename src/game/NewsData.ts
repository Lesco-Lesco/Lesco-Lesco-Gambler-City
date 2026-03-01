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
    id: "v1.7.0",
    title: "SANTA CRUZ EM FOCO",
    date: "Março, 2026",
    description: [
        "A Prefeitura apresenta as melhorias da semana em Santa Cruz:",
        "",
        "--- DESTAQUES ---",
        "• NOVO MAPA: Pressione 'M' para o guia oficial com nomes de ruas e zoom ('Z') para navegar pelos becos.",
        "• RUMORES: Moradores citam acessos ocultos no subsolo da estação ferroviária. Dizem que a sorte recompensa quem sabe procurar.",
        "• SEGURANÇA: Novo posto de informações no embarque da estação operando para auxílio geral.",
        "• AMBIENTE: Iluminação e atmosfera reajustadas para maior imersão nas caminhadas noturnas.",
        "",
    ]
};

const RECOMMENDATIONS = [
    "DICA: A Praça Marques de Herval é famosa pelo Dominó. Veteranos dizem que a sorte aceita desafios por lá.",
    "VISITA: No Marco Imperial ruge a Purrinha sob os olhos da história. Cuidado com quem desafia.",
    "LAZER: Boatos no Shopping Santa Cruz dizem que o subsolo guarda segredos que a Prefeitura nega existir.",
    "NOTURNO: Becos da Severiano de Heredia guardam rodas de Dados. Entre por sua conta e risco.",
    "RELATO: 'A estação tem acessos que não estão nos mapas oficiais', sussurra um passageiro.",
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
