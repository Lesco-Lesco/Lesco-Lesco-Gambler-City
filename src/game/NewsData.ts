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
        "Confira as novidades do nosso bairro:",
        "",
        "• TRADIÇÃO: A Praça Herval e o Marco Imperial seguem como o coração do Dominó e da Purrinha.",
        "• JOGOS: Bares e Fliperamas agora contam com Galgos, Poker, Tank Attack e o intenso Risca Faca.",
        "• EXPLORAÇÃO: Máquinas de sorte estão escondidas no subsolo da Estação e do Shopping.",
        "• AMBIENTE: O protótipo ganha vida sonora, trazendo a imersão das ruas para o PC e Mobile.",
        "",
        "--- COMUNICADO ESPECIAL ---",
        "• NOTÁVEL: Saudamos a Madame M (renomada Dra. em Maricá). Que o Dominó na palma da mão traga as melhores lembranças e muita sorte!",
        "",
    ]
};

const RECOMMENDATIONS = [
    "DICA: A Praça Marques de Herval é famosa pelo Dominó. Veteranos dizem que a sorte aceita desafios por lá.",
    "VISITA: Pelas calçadas do Marco Imperial ruge a Purrinha sob os olhos da história. Cuidado com quem desafia.",
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
