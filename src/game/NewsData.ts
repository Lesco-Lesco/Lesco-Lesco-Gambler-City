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
        "Confira o guia atualizado de lazer e cultura em nosso bairro:",
        "",
        "--- ATRAÇÕES LOCAIS ---",
        "• TRADIÇÃO: O Marco Imperial e a Praça Herval seguem como pontos de encontro para o clássico Dominó entre veteranos.",
        "• DIVERSÃO NOS BARES: Desfrute de simulações de Corridas de Galgos, Equinos e o novo Vídeo-Entretenimento premiado.",
        "• CENTROS DE LAZER: Fliperamas espalhados pela cidade agora contam com Air Pong, Faroeste, Tanques e o duelo Risca Faca.",
        "• SUBSOLO DISCRETO: Visitantes da Estação e do Shopping podem encontrar áreas reservadas para máquinas de sorte e precisão.",
        "• DESAFIOS URBANOS: Pelas calçadas, cidadãos testam hability em Purrinha, Palitinho, Ronda, Dados e o exótico Fan-Tan.",
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
