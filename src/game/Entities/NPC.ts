/**
 * NPC entity — procedural street characters with physics and personality.
 * Features:
 * - AABB Collision (stops wall clipping)
 * - Sarcastic/Begging Dialogue System
 * - Enter/Exit Building logic
 */

import { Camera } from '../Core/Camera';
import { TileMap } from '../World/TileMap';
import { TILE_TYPES } from '../World/MapData';
import { drawCharacter } from './CharacterRenderer';
import type { CharacterAppearance } from './CharacterRenderer';
import { ProgressionManager } from '../Core/ProgressionManager';


export type NPCType = 'citizen' | 'homeless' | 'gambler' | 'info' | 'pedinte' | 'promoter' | 'police' | 'casino_promoter' | 'preacher';
export type MinigameType = 'purrinha' | 'dados' | 'ronda' | 'domino' | 'cara_coroa' | 'palitinho' | 'fan_tan' | 'jokenpo' | null;

interface NPCAppearance extends CharacterAppearance {
    // NPC-specific appearance can be extended here if needed
}

/** Seeded random for NPC consistency */
function seededRandom(seed: number): number {
    const n = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
    return n - Math.floor(n);
}

function randomColor(seed: number, r: number[], g: number[], b: number[]): string {
    const rv = r[0] + seededRandom(seed) * (r[1] - r[0]);
    const gv = g[0] + seededRandom(seed + 100) * (g[1] - g[0]);
    const bv = b[0] + seededRandom(seed + 200) * (b[1] - b[0]);
    return `rgb(${Math.floor(rv)}, ${Math.floor(gv)}, ${Math.floor(bv)})`;
}

// --- DIALOGUE DATA ---
const DIALOGUES = {
    citizen: [
        ["Tá perigoso aqui hoje, hein?", "Fica esperto com o celular."],
        ["A prefeitura esqueceu da gente...", "Olha esse buraco na rua!"],
        ["O bicho tá pegando lá na praça.", "Melhor não andar sozinho."],
        ["Sabe onde tem um jogo bom?", "Tô querendo apostar uns trocados."],
        ["Eles dizem que vão arrumar, mas nunca arrumam.", "Política é tudo igual."],
        ["Cuidado com a carteira, amigo.", "Tem muito malandro por aí."],
        ["A passagem do trem subiu de novo.", "Sempre sobra pra gente."],
        ["Dizem que o Shopping é chique, mas só vou lá pra usar o banheiro.", "Shopping de Santa Cruz é outro nível."],
        ["Bela noite pra uma cerveja, não acha?", "Pena que o bolso tá vazio."],
        ["Viu o preço da carne?", "Vou virar vegetariano na marra."],
        ["Esse sol de Santa Cruz não é de Deus.", "Tô derretendo no asfalto."],
        ["Amanhã tem feira, né?", "Vou ver se compro umas frutas baratas."],
        ["Fui no orelhão e engoliu minha ficha.", "Sacanagem isso daí."],
        ["Tu viu a nova fita do fliperama?", "O moleque da rua de baixo zerou com uma ficha só."],
        ["Minha mãe mandou comprar pão, mas parei pra ver o movimento.", "Se ela descobre, eu apanho."],
        ["Tô indo na locadora alugar um jogo pro fim de semana.", "Espero que não tenham levado o de futebol."],
        ["Comprei um rádio de pilha novo.", "Agora escuto o jogo do Mengão onde eu for."],
        ["Você acredita em assombração?", "Eu juro que vi um negócio esquisito no cemitério ontem."],
        ["Menino, vai pra casa que tua mãe tá te chamando!", "Ah, sempre sobra pra mim..."],
        ["Esse tênis tá de rosca, cara.", "Pisei numa poça ali atrás, mó cheiro ruim."],
        ["Alguém me pediu informação agora pouco.", "Mandei ir pro lado errado sem querer. Deus perdoe."],
        ["O padeiro disse que amanhã não tem pão francês.", "O forno quebrou de novo, vê se pode."],
        ["Fui tentar a sorte hoje cedo e perdi vintão.", "Minha mulher vai me matar se descobrir."],
        ["Você viu que abriram uma lan house perto do colégio?", "A meninada não quer mais saber de jogar bola na rua."]
    ],
    station_hints: [
        ["Ouviu esse barulho de fichas? Não é o trem não...", "Tem gente ganhando o dia lá no subsolo."],
        ["Cuidado com o 'all-in' ali perto dos trilhos.", "Vi um cara entrar com o terno e sair de bermuda hoje."],
        ["O porão da estação tem mais história que os trilhos.", "Se o leão deixar você passar, a sorte te abraça."],
        ["Escutei que o blackjack lá embaixo tá fervendo.", "As cartas giram mais rápido que os rodeiros do trem."],
        ["Dizem que se você bater 3 vezes na viga certa, o 'Leão' aparece.", "Cuidado pra não apostar a passagem de volta."],
        ["A sorte mora no subsolo hoje, doutor.", "Viu aquele brilho vindo do ralo? É ouro, ou quase isso."],
        ["O trem tá atrasado, mas a roleta tá a mil.", "Quem desce na plataforma 3 sabe do que eu tô falando."],
        ["O fiscal finge que não vê, e a gente finge que não aposta.", "A lei do silêncio vale mais que o bilhete."],
        ["Já viu o homem do terno cinza?", "Ele é quem manda no baralho por aqui."],
        ["Se ouvir um apito diferente, esconde o dinheiro.", "A ronda deles não é pra ver passagem, é pra limpar os bolsos."],
        ["A estação guarda segredos que nem o maquinista sabe.", "O maquinista não, mas o pipoqueiro da esquina sabe de tudo."],
        ["Não compra passagem falsa ali no beco.", "A catraca apita e os guardas não têm paciência com espertinho."],
        ["Dizem que o primeiro trem do dia traz os maiores vencedores.", "Mas o último trem da noite leva os mais desesperados."]
    ],
    sarcastic: [
        ["Olha a roupa desse playboy...", "Achou que aqui era a Zona Sul?"],
        ["Tá perdido, doutor?", "O GPS não funciona na favela não."],
        ["Dinheiro não nasce em árvore, sabia?", "Me arruma 50 conto que eu te ensino a viver."],
        ["Vai ficar olhando ou vai passar o pix?", "Tô cobrando aluguel visual."],
        ["Gostou do que viu?", "Tira foto que dura mais, amigão."],
        ["Tá olhando pro lado errado, turista.", "Aqui a vida real acontece no chão sujo, não na vitrine."],
        ["Se você tá procurando o Cristo Redentor, pegou o ônibus errado.", "Aqui só tem santo de barro e cruz de madeira."],
        ["O patrão resolveu passear no asfalto quente?", "Cuidado pra não derreter esse sapato caro."],
        ["Essa cara de bobo você treinou ou é natural?", "Se quiser eu te ensino a andar igual malandro."],
        ["Veio cobrar o aluguel?", "Avisa o senhorio que o cachorro comeu o carnê desse mês."]
    ],
    homeless: [
        ["Tem um trocado pro café?", "Deus te abençoe..."],
        ["A rua tá fria hoje...", "Me ajuda aí, irmão."],
        ["Tô com fome... fortalece o lanche?", "Qualquer moeda serve."],
        ["Dizem que a sorte mora no subsolo do shopping.", "Mas eu só moro na calçada, esperando um milagre."],
        ["Aquele beco ali tem cheiro de comida de bacana.", "Alguém tá ganhando muito dinheiro lá embaixo hoje."],
        ["Não entra naquele porão não, irmão.", "Vi gente entrar sorrindo e sair sem nem as calças."],
        ["O shopping brilha por fora, mas o porão devora.", "Cuidado com o que você aposta lá embaixo."],
        ["O vento aqui na esquina corta como navalha.", "Perto do bicheiro sempre é mais quente."],
        ["Vi você olhando pro cassino.", "O brilho nos olhos de quem vai perder tudo é inconfundível."],
        ["Ontem ganharam um prêmio grande lá dentro.", "O cara pagou um jantar pra todo mundo da rua."],
        ["Não dorme no ponto, a polícia tá vindo.", "Eles não gostam de quem tem menos que eles."],
        ["Eu já fui rei dessa cidade, sabia?", "As cartas me deram tudo, e as roletas me tomaram de volta."],
        ["Moeda de dez centavos já paga o pão de ontem.", "Não me negue a esmola, que amanhã pode ser você aqui."],
        ["Dorme com um olho aberto se for pro beco do matadouro.", "Lá eles tiram sua alma e vendem no mercado negro da sorte."],
        ["Os ratos daqui têm mais dinheiro que eu.", "Eles comem os restos de lagosta que o pessoal do cassino joga fora."],
        ["Deus tá vendo o que a gente passa.", "E o Diabo tá rindo de camarote no subsolo da estação."]
    ],
    pedinte_aggressive: [
        ["Ei doutor! Preciso comer!", "Não vai negar um prato de comida?", "Tô vendo essa carteira cheia aí!"],
        ["Qual foi? Vai passar direto?", "Ajuda quem precisa!", "A humidade dói, sabia?"],
        ["Vai lá pro cassino gastar tudo?", "Me dá 10 que eu te dou um palpite de ouro!"],
        ["Vi você olhando pro 'Leão'.", "Aquele ali é o porteiro do inferno... ou do céu."],
        ["Sumiram com o meu parceiro ali no fundo.", "Ganhou muito e não deixaram ele sair com o prêmio."],
        ["A sorte tá no ar, doutor! Sinto cheiro de jackpot.", "Me ajuda agora que eu te abençoo a banca!"],
        ["Não vira a cara não, playboy!", "A fome não escolhe hora nem lugar, libera a nota!"],
        ["Tô de olho em você ganhando nessas mesas.", "Reparte com os cria pra sorte não sumir!"],
        ["Se você não me der um trocado eu vou azarar o seu jogo!", "Olho gordo de pobre é brabo, eu tô te avisando!"],
        ["Abre a mão, parceiro!", "Aqui é Santa Cruz, quem não divide, não multiplica!"]
    ],
    gambler: [
        ["Hoje eu quebro a banca!", "Sente o cheiro da vitória."],
        ["O bicho tá viciado ali na esquina.", "Se der zebra eu tô ferrado."],
        ["Quer jogar? Aposta mínima de 10.", "Vem perder dinheiro comigo."],
        ["Tô sentindo que meu dia chegou.", "A sorte grande tá me esperando na próxima esquina."],
        ["Se eu ganhar hoje, compro uma brasília amarela.", "Se eu perder, vou voltar a pé pro bairro."],
        ["Apostei o dinheiro do leite das crianças.", "A patroa não pode saber, hoje eu tenho que dobrar o valor."],
        ["Tem dias que a gente só perde, impressionante.", "Mas a esperança é o que faz a gente continuar girando a roleta."],
        ["Eu sou o terror das casas de aposta.", "Eles tremem quando me veem chegar com a capivara na cabeça."],
        ["Você conhece a técnica da mão dupla?", "Você joga com uma mão e esconde o choro com a outra."],
        ["Me deseje sorte, forasteiro.", "Hoje o Lesco Lesco vai me pagar tudo que me deve."]
    ],
    purrinha: [
        ["Quantas pedras você acha que eu tenho?", "Essa mão aqui vale ouro."],
        ["Purrinha é arte, o resto é sorte.", "Cuidado com o meu palpite!"],
        ["Lê minha mente ou lê minha mão?", "Só não vale chorar depois."],
        ["O segredo tá no dedinho...", "Apanha 10 e vê se ganha."],
        ["Eu treinei a vida toda pra jogar isso aqui.", "Minha mão fechada é um cofre sem segredo."],
        ["Pensa bem antes de gritar o número.", "Aqui a gente pega mentiroso no ato."],
        ["O suor na tua testa diz que você tem três na mão.", "Ou será que você tá blefando pra mim?"],
        ["Purrinha não é jogo de criança.", "Criança chora, adulto paga a aposta em dinheiro vivo."]
    ],
    dados: [
        ["Os dados não mentem jamais.", "Sorte no jogo, azar nos amores."],
        ["Cada número conta sua história.", "Beco do Matadouro nunca falha."],
        ["Quer ver o 6-6 brilhar?", "A carapaça tá quente hoje."],
        ["Joga os ossos e reza!", "Mão gelada não ganha aposta."],
        ["Cuidado com os cantos da parede.", "O dado que quica estranho, tira dinheiro de quem é tonto."],
        ["Quem soprar o dado antes de jogar, perde a vez.", "Aqui a gente confia na gravidade e no pulso firme."],
        ["Se cair fora da roda, a casa leva a aposta.", "Fica o aviso, não tem choro nem vela."],
        ["Os ossos antigos falam verdades duras.", "Prepare o bolso que a maré tá secando."]
    ],
    ronda: [
        ["A banca sempre ganha? Hoje não.", "Escolha sua carta com sabedoria."],
        ["Ronda de elite é aqui, parceiro.", "O baralho tá pegando fogo!"],
        ["Corta o deck ou corta o papo.", "Essa dama aqui é traiçoeira."],
        ["Olho no descarte, malandro...", "A sorte é um bicho brabo."],
        ["A matemática da Ronda exige mente fria.", "E você tá suando que nem porco no rolete."],
        ["Aquele ali no canto tá contando carta.", "Deixa ele achar que a gente não sabe."],
        ["O Coringa sorri pra todo mundo, mas só beija um.", "Vem beijar a sorte, vem."],
        ["Se a carta voar com o vento, o jogo é anulado.", "Segura firme que aqui bate rajada forte da estação."]
    ],
    domino: [
        ["Quer ver o 'carro-chefe' passar?", "Aqui o jogo é de mestre."],
        ["Lê a mesa ou dorme no cesto.", "Dominó na praça é tradição, playboy."],
        ["Quem não tem peça, comprou a briga.", "Bate com a 'bucha' pra ver se dói."],
        ["Passou a vez? Já era, a fila anda.", "Aqui ninguém alivia pra retardatário."],
        ["A peça de branco-branco não serve pra nada.", "Mas às vezes ela salva a vida da gente no final."],
        ["Não bate na mesa com força não, jovem.", "Respeita os mais velhos que aqui tem história."],
        ["Você tá escondendo pedra na manga, é?", "Tô de olho nessa mãozinha de seda aí."],
        ["Vou trancar a mesa agora mesmo.", "Pode preparar as notas pra pagar o prejuízo."]
    ],
    propaganda_purrinha: [
        ["Ei! Quer aprender a arte da Purrinha?", "A tradição aqui na Igreja é forte!", "Vem ver quem tem a mão mais rápida."],
        ["Opa, o jogo de purrinha vai começar!", "Aqui não é sorte, é leitura de mente!", "Chega mais, aposta mínima de 10."],
        ["Mão fechada, aposta aberta!", "Traga seu dinheiro e deixe sua hesitação em casa!", "Só os corajosos jogam purrinha no adro da igreja!"],
        ["Venham, venham ver o mestre das pedras!", "Quem acertar o número leva o triplo!", "Sinta a emoção do palpite perfeito."]
    ],
    propaganda_dados: [
        ["Os dados estão rolando no Matadouro!", "Cuidado pra não perder as calças!", "Sorte pura, sem enganação."],
        ["Quer testar sua sorte nos ossos?", "O Beco do Matadouro é onde a mágica acontece!", "Vem dobrar seus trocados aqui."],
        ["O som dos ossos batendo na parede é o canto da sereia!", "Ouça o chamado, aposte alto e ganhe mais alto ainda!", "A roda de dados mais honesta da zona oeste!"],
        ["Não tenha medo de jogar os dados, o pior que pode acontecer é você ir pra casa a pé!", "Aposte com força, ganhe com glória!"]
    ],
    propaganda_ronda: [
        ["A Ronda na Estação não para!", "Baralho novo, sorte nova!", "Ganhei do trem, vou ganhar de você."],
        ["Quer uma partida rápida de Ronda?", "Aqui é o jogo dos espertos!", "Vem pra banca, o jogo tá quente."],
        ["Cartas na mesa, dinheiro no bolso!", "O trem apita lá em cima, mas o lucro canta aqui embaixo!", "Venha fazer parte da roda da fortuna!"],
        ["O baralho não mente pra quem sabe ler o destino!", "Ronda de alta tensão para jogadores de alta pressão!", "Chega mais!"]
    ],
    jokenpo: [
        ["Pedra, papel ou tesoura?", "Duvido que você ganhe de mim."],
        ["Jo ken po! Escolha rápido.", "Minha mão é mais rápida que seu olho."],
        ["Um jogo clássico pros clássicos.", "Aposta 10 e vê se dá sorte."],
        ["Tesoura corta papel, mas não corta minha sorte.", "Vem pro duelo de mãos!"],
        ["Eu nunca escolho pedra, confia em mim.", "A verdade é que eu sempre escolho pedra na primeira rodada."],
        ["Você não tem agilidade mental pra esse jogo milenar.", "Papel embrulha a pedra e embrulha o seu choro."],
        ["Adivinha o que eu vou colocar?", "Isso mesmo, é exatamente o que vai te vencer."],
        ["O pulso firme dita a vitória.", "Quem treme na hora de mostrar o dedo, já perdeu."]
    ],
    cara_coroa: [
        ["Cara ou coroa? A sorte está no ar!", "Uma moeda, dois destinos."],
        ["Escolha um lado e reze.", "O metal nunca mente."],
        ["O giro da moeda decide quem manda.", "Cuidado pra não perder a cabeça... ou a cara."],
        ["A gravidade é o único juiz aqui.", "Sinta o peso do metal antes do tombo."],
        ["Tem moeda viciada por aí, mas a nossa é abençoada pelo padre.", "Acredita na força do destino."],
        ["Coroa é rei, Cara é súdito.", "Qual dos dois você quer ser no final da noite?"],
        ["O tilintar do cobre no asfalto é a trilha sonora da alegria.", "Deixa rolar, deixa girar."],
        ["Quem apostou cara chora, quem apostou coroa comemora.", "É a lei da selva de pedra."]
    ],
    palitinho: [
        ["Quem tirar o palito curto paga o pato.", "Sorte no palitinho, azar no amor."],
        ["Mãos escondidas, segredos revelados.", "Não quebre o palito!"],
        ["A ordem dos dados é a ordem do destino.", "Três palitos, uma decepção... pra alguém."],
        ["Sinta a madeira, escolha com a alma.", "Quem rola o dado mais alto, escolhe o destino mais cedo."],
        ["Os palitos não diferenciam o rico do pobre.", "Aqui todo mundo sua frio antes de abrir a mão."],
        ["Dizem que o palito comprido atrai inveja.", "O palito curto atrai a dívida."],
        ["Fica de olho na mão do padeiro.", "Ele tem os dedos grossos e sempre tenta dar o migué."],
        ["A brincadeira é de criança, mas a grana apostada é de adulto responsável."]
    ],
    fan_tan: [
        ["O mistério do arroz...", "Conte os grãos e vença a banca."],
        ["A sabedoria milenar do Fan-Tan.", "O dragão guia a sua sorte."],
        ["Quatro em quatro, o resto é o que importa.", "O cesto esconde o que o seu olho não viu."],
        ["O dragão de ouro protege quem sabe contar.", "Deixe o arroz fluir, e a sorte virá."],
        ["Lembra: o quatro é o zero na contagem da vida.", "Sinta a seda vermelha e faça sua aposta."],
        ["Quem precisa de sorte quando se tem paciência?", "O Fan-Tan é o jogo da paz... e do lucro."],
        ["A paciência oriental em contraste com a pressa carioca.", "Aqui a gente medita enquanto perde o dinheiro."],
        ["Não empurre a vareta, deixe ela deslizar.", "A pressa é a inimiga do grão."],
        ["Você viu quatro, mas na verdade sobraram três.", "O olho do dragão é implacável na contagem."],
        ["A serenidade antes do resultado é o verdadeiro prêmio.", "O dinheiro é só um bônus terreno."]
    ],
    police: [
        ["O jogo de azar é o caminho mais rápido para a cadeia... ou pra ficar liso.", "Vi muita gente boa perdendo o rumo nesses becos."],
        ["Divertido enquanto dura, triste quando a gente chega.", "A sorte é cega, mas a polícia tem olhos em todo lugar."],
        ["Cuidado com o que aposta, o preço pode ser alto demais.", "Belo dia pra uma batida, não acha?"],
        ["Documentos? Ah, deixa pra lá, tô vendo que o problema é outro.", "Esse 'Lesco Lesco' ainda vai te meter em encrenca."],
        ["Se eu pegar você jogando, o prejuízo vai ser grande.", "A lei é clara, mas o seu juízo parece meio nublado."],
        ["Circulando, circulando! Não quero aglomeração aqui.", "A ordem é prioridade, o resto é conversa."],
        ["Estou de olho naquele bicheiro ali..", "Um dia a casa cai, e cai pesada."],
        ["Já pagou o café da guarnição hoje?", "Ou prefere explicar o que tem nessa carteira lá na delegacia?"],
        ["O bicho só corre se a gente deixar.", "E ultimamente a gente tem andado bem devagar."],
        ["A calçada não é lugar pra ficar moscando.", "A não ser que esteja esperando um milagre... ou a viatura."],
        ["Se eu escutar gritaria de aposta, eu desço o cassetete na mesa.", "E depois recolho o dinheiro como prova do crime, claro."],
        ["Mantenha as mãos onde eu possa ver.", "E se tiver nota de cinquenta aí, pode mostrar também."],
        ["Estamos garantindo a segurança de Santa Cruz.", "Segurança de quem pode pagar por ela, obviamente."]
    ],
    casino_promoter: [
        ["O shopping é para gastar seu suor, o porão é para colher os frutos.", "Já sentiu que hoje é o seu dia de virar o jogo?"],
        ["Tem uma reunião importante acontecendo ali embaixo... só para quem tem visão.", "O café é por nossa conta, a sorte é por sua."],
        ["Cansado de olhar vitrines? Ali no subsolo a diversão é mais lucrativa.", "O segredo do shopping não está nas lojas, está no que elas escondem."],
        ["O leão guarda a porta, mas o seu olhar de vencedor é a única senha necessária.", "O barulho lá embaixo é música para quem gosta de notas novas."],
        ["A roleta da vida gira mais rápido naquele beco, quer ver onde ela para?", "Não deixa outro levar o que o destino separou para você."],
        ["O ar-condicionado lá embaixo é o melhor da cidade, e as máquinas nunca dormem.", "Quem conhece o caminho não perde tempo batendo perna no corredor."],
        ["O brilho das luzes lá embaixo é hipnotizante, não acha?", "Vem sentir o arrepio que só o risco calculado pode te dar."],
        ["Já viu o que acontece quando o 'Lesco Lesco' encontra o bolso cheio?", "Dizem que o porão do shopping tem mais ouro que as joalherias do térreo."],
        ["A banca está esperando um cavalheiro com a sua coragem. Vai deixar ela esperando?", "O prêmio está maduro, só falta alguém para colher."],
        ["Não é jogo, é investimento emocional... com retorno imediato em papel moeda.", "Vem fugir desse sol e ver como a sorte se refresca no subsolo."],
        ["O patrão mandou dizer que a mesa está posta. O banquete é de fichas.", "Viu aquele sorriso de quem saiu por ali agora? Pode ser o seu."],
        ["As máquinas estão inquietas hoje, parece que o jackpot está para explodir.", "Sabe a diferença entre um comprador e um vencedor? A direção que eles tomam."],
        ["O destino sussurrou seu nome lá embaixo. Eu só estou aqui para repetir.", "A oportunidade não bate na porta, ela fica esperando você descer a escada."],
        ["Tapete vermelho na entrada, luz neon e ficha caindo.", "O paraíso existe e fica debaixo dos nossos pés."],
        ["Quem tem medo de arriscar, passa a vida contando moeda.", "Venha contar notas de cem na nossa sala VIP."],
        ["A entrada é discreta, mas a saída pode ser triunfal.", "Venha fazer história no subterrâneo das riquezas."],
        ["Sente esse aroma? É cheiro de riqueza recém-impressa.", "Temos roleta, cartas e a maior hospitalidade da zona oeste."]
    ],
    preacher: [
        ["A salvação não custa nada, mas vale tudo!", "Arrependam-se, o fim está próximo!"],
        ["Deus abençoe Santa Cruz!", "Busquem o Reino de Deus em primeiro lugar."],
        ["O jogo tira o pão, mas a fé traz a vida.", "Jesus te ama, irmão!"],
        ["A sorte é passageira, mas a glória de Deus é eterna.", "Venha ouvir a palavra!"],
        ["Troque os dados pela Bíblia!", "Não há jackpot maior que a paz de espírito."],
        ["A porta da igreja está aberta para todos os humildes.", "Deus não olha a carteira, olha o coração."],
        ["Fuja das tentações do subsolo!", "A luz de Deus brilha mais que o neon."],
        ["Um minuto de oração vale mais que uma hora de aposta.", "Deus tem um plano para você."],
        ["O diabo atua nas sombras das vielas, mas o Senhor caminha na luz da praça!", "Vem para a luz!"],
        ["Não jogue sua alma fora apostando contra o mal!", "A banca do diabo sempre vence, só o Senhor perdoa as dívidas!"],
        ["O vício te aprisiona, mas a verdade te libertará!", "Aleluia!"],
        ["Esses cassinos clandestinos são portas largas para a perdição!", "Aperta o passo para a porta estreita da Igreja!"],
        ["Deus está vendo você esconder esse dinheiro da sua família!", "Arrependa-se antes que seja tarde demais!"]
    ],
    // --- LOCATION SPECIFIC DIALOGUES ---
    loc_shopping: [
        ["O shopping tá cheio hoje, hein?", "Muita gente e pouco dinheiro no bolso."],
        ["Dizem que o ar-condicionado lá dentro é um paraíso.", "Pena que tudo é tão caro."],
        ["Cuidado com quem te aborda no estacionamento.", "Tem muito malandro de olho em quem ganha no jogo."],
        ["Esperando minha patroa sair das compras...", "O cartão de crédito já tá chorando."],
        ["Viu aquele movimento ali no fundo do shopping?", "Tem um segredo que pouca gente conhece."],
        ["Vim só pra comer na praça de alimentação e ir embora.", "Aquele hambúrguer dali é bom demais."],
        ["Estacionei o carro longe, espero que ninguém risque a pintura.", "Tem muito moleque de bicicleta por aí."],
        ["As lojas tão em promoção, mas a promoção deles é tudo pela metade do dobro.", "Eu não caio nessa ladainha."]
    ],
    loc_church: [
        ["Que a paz do Senhor esteja com você, irmão.", "Belo dia para agradecer."],
        ["O padre hoje estava inspirado na homilia.", "Falou muito sobre o pecado da ganância."],
        ["Venho aqui pra pedir proteção, o mundo tá brabo.", "Um pouco de fé não faz mal a ninguém."],
        ["Sempre rezo antes de fazer minha fezinha.", "Deus escreve certo por linhas tortas."],
        ["Domingo de manhã é sagrado, venho logo pra primeira missa.", "Depois passo na padaria e volto em paz pra casa."],
        ["O sino tocou, é hora de parar o que tá fazendo e refletir.", "Santa Cruz precisa de mais oração e menos barulho de ficha."],
        ["A escadaria da igreja sempre tem alguém precisando de ajuda.", "A caridade é o dever de quem tem um pouco a mais."],
        ["Sinto uma energia boa quando chego perto dessa praça da igreja.", "Como se um manto me cobrisse."]
    ],
    loc_station: [
        ["O ramal de Santa Cruz tá um caos hoje.", "O trem das oito ainda não passou."],
        ["Muita gente chegando do centro.", "A estação nunca dorme, né?"],
        ["Cuidado com o celular aqui na plataforma.", "O gatuno não perdoa nem quem tá com pressa."],
        ["Tá sabendo de algum jogo bom aqui por perto?", "Dizem que o subsolo da estação esconde tesouros."],
        ["Essas escadas são perigosas quando chove.", "Quase escorreguei e fui parar lá nos trilhos semana passada."],
        ["Ouvi o guarda apitar, achei que ia perder o trem.", "Corri tanto que quase deixei o chinelo pra trás."],
        ["O pastel da estação é gorduroso, mas salva a vida do trabalhador.", "Sempre pego um de carne com caldo de cana."],
        ["O vai e vem aqui é frenético. Cada um com sua cruz e seu destino.", "Eu tô só de passagem."]
    ],
    loc_square: [
        ["Nada como o frescor dessa árvore pra pensar na vida.", "O tempo passa devagar aqui na praça."],
        ["O papo aqui é sempre bom, mas a sorte é arisca.", "Viu quem ganhou o bicho hoje?"],
        ["Só falta um café pra esse dia ficar perfeito.", "A vida é um jogo de dominó: tem que saber bater."],
        ["Essa fonte traz uma paz, não traz?", "Melhor lugar pra ver o movimento."],
        ["Tem uns pombos folgados aqui, quase comeram meu biscoito.", "Eles sabem que a gente tem pena de enxotar."],
        ["Vou sentar aqui nesse banco e não sair mais hoje.", "Minhas costas não aguentam mais o asfalto."],
        ["Os velhinhos do dominó ali tão brigando de novo.", "Parece que a bucha de sena deu problema."],
        ["Sempre tem um ventinho bom que passa pela estátua.", "É o frescor que salva do calorão do meio dia."]
    ]
};

export class NPC {
    public x: number;
    public y: number;
    public type: NPCType;
    public name: string;
    public gameName?: string;
    public dialogue: string[] = [];
    private originalDialogue: string[] | null = null;

    // Appearance
    private appearance: NPCAppearance;

    // Physics
    public width: number = 0.8; // Collision box size
    public height: number = 0.8;
    private wanderTimer: number = 0;
    private wanderDirX: number = 0;
    private wanderDirY: number = 0;
    private wanderSpeed: number = 2.0; // Tiles per second
    private originX: number;
    private originY: number;
    private wanderRadius: number = 8.0; // Can roam further now

    // Stuck Detector
    private lastX: number = 0;
    private lastY: number = 0;
    private stuckTimer: number = 0;

    // Interaction
    public isPlayerNearby: boolean = false;
    public showDialogue: boolean = false;
    private dialogueTimer: number = 0;
    private currentDialogueIdx: number = 0;

    // State
    private isVisible: boolean = true;
    private enterBuildingTimer: number = 0;

    public minigameType: MinigameType = null;
    public isStationary: boolean = false;

    constructor(x: number, y: number, type: NPCType, name: string, gameName?: string, minigameType?: MinigameType, isStationary: boolean = false) {
        this.x = x;
        this.y = y;
        this.originX = x;
        this.originY = y;
        this.type = type;
        this.name = name;
        this.gameName = gameName;
        this.minigameType = minigameType || null;
        this.isStationary = isStationary;

        // Auto-assign random minigame if gambler and none specified
        if (this.type === 'gambler' && !this.minigameType) {
            const r = Math.random();
            if (r < 0.14) this.minigameType = 'purrinha';
            else if (r < 0.28) this.minigameType = 'dados';
            else if (r < 0.42) this.minigameType = 'ronda';
            else if (r < 0.56) this.minigameType = 'cara_coroa';
            else if (r < 0.7) this.minigameType = 'palitinho';
            else if (r < 0.84) this.minigameType = 'fan_tan';
            else this.minigameType = 'jokenpo';
        }

        const seed = x * 1000 + y;
        this.appearance = this.generateAppearance(seed);
        this.dialogue = this.generateDialogue(seed);
        this.originalDialogue = [...this.dialogue];
        this.wanderTimer = seededRandom(seed) * 3;
    }

    private generateAppearance(seed: number): NPCAppearance {
        // ... (Similar logic, tweaked colors)
        const isBeggar = this.type === 'homeless' || this.type === 'pedinte';
        if (isBeggar) {
            return {
                bodyColor: randomColor(seed, [50, 80], [40, 60], [30, 50]), // Drab
                legColor: randomColor(seed + 1, [30, 50], [30, 50], [20, 40]),
                skinColor: randomColor(seed + 2, [100, 160], [70, 120], [40, 90]),
                hasHat: seededRandom(seed + 3) > 0.4,
                hatColor: '#333',
            };
        }
        if (this.type === 'police') {
            return {
                bodyColor: '#1a237e', // Police Blue
                legColor: '#121212',  // Black pants
                skinColor: randomColor(seed + 2, [120, 210], [90, 160], [60, 110]),
                hasHat: true,
                hatColor: '#1a237e',
            };
        }
        return {
            bodyColor: randomColor(seed, [40, 200], [40, 200], [40, 200]),
            legColor: randomColor(seed + 1, [20, 60], [20, 60], [40, 90]),
            skinColor: randomColor(seed + 2, [120, 210], [90, 160], [60, 110]),
            hasHat: seededRandom(seed + 3) > 0.7,
            hatColor: randomColor(seed + 4, [20, 200], [20, 200], [20, 200]),
        };
    }

    private generateDialogue(seed: number): string[] {
        // Universal Begging logic: Add begging line at end of ANY idle dialogue
        const beggingLine = seededRandom(seed) > 0.5 ? "Tem um trocado?" : "Fortalece aí o lanche.";

        let lines: string[] = [];

        if (this.type === 'pedinte') {
            const set = DIALOGUES.pedinte_aggressive;
            lines = set[Math.floor(seededRandom(seed) * set.length)];
            return lines; // Aggressive beggars just beg
        } else if (this.type === 'homeless') {
            const set = DIALOGUES.homeless;
            lines = set[Math.floor(seededRandom(seed) * set.length)];
            return lines;
        } else if (this.type === 'gambler') {
            // Use specialized dialogue if minigameType is known
            const set = (this.minigameType && (DIALOGUES as any)[this.minigameType])
                ? (DIALOGUES as any)[this.minigameType]
                : DIALOGUES.gambler;
            return set[Math.floor(seededRandom(seed) * set.length)];
        } else if (this.type === 'police') {
            const set = DIALOGUES.police;
            return set[Math.floor(seededRandom(seed) * set.length)];
        } else if (this.type === 'promoter') {
            // Propaganda logic based on minigameType
            const key = `propaganda_${this.minigameType || 'purrinha'}`;
            const set = (DIALOGUES as any)[key] || DIALOGUES.citizen;
            return set[Math.floor(seededRandom(seed) * set.length)];
        } else if (this.type === 'casino_promoter') {
            const set = DIALOGUES.casino_promoter;
            return set[Math.floor(seededRandom(seed) * set.length)];
        } else if (this.type === 'preacher') {
            const set = (DIALOGUES as any).preacher;
            return set[Math.floor(seededRandom(seed) * set.length)];
        } else {
            // Citizen/Info - Check for location-specific dialogues
            const sx = this.originX, sy = this.originY;
            if (sx >= 108 && sx <= 142 && sy >= 115 && sy <= 142) {
                const set = DIALOGUES.loc_shopping;
                lines = [...set[Math.floor(seededRandom(seed) * set.length)]];
            } else if (sx >= 125 && sx <= 135 && sy >= 81 && sy <= 85) {
                const set = DIALOGUES.loc_church;
                lines = [...set[Math.floor(seededRandom(seed) * set.length)]];
            } else if (sx >= 235 && sx <= 260 && sy >= 149 && sy <= 165) {
                const set = DIALOGUES.loc_station;
                lines = [...set[Math.floor(seededRandom(seed) * set.length)]];
            } else if ((sx >= 148 && sx <= 168 && sy >= 160 && sy <= 190) || (sx >= 225 && sx <= 245 && sy >= 130 && sy <= 149)) {
                const set = DIALOGUES.loc_square;
                lines = [...set[Math.floor(seededRandom(seed) * set.length)]];
            } else if (seededRandom(seed) > 0.7) {
                // 30% Chance of Sarcasm
                const set = DIALOGUES.sarcastic;
                lines = [...set[Math.floor(seededRandom(seed) * set.length)]];
            } else {
                const set = DIALOGUES.citizen;
                lines = [...set[Math.floor(seededRandom(seed) * set.length)]];
            }
            // Add begging to universal NPCs
            if (!this.gameName) {
                lines.push(beggingLine);
            }
            return lines;
        }
    }

    public getUniqueId(): string {
        return `npc_${this.name}_${Math.floor(this.originX)}_${Math.floor(this.originY)}`;
    }

    public update(dt: number, playerX: number, playerY: number, tileMap: TileMap) {
        if (!this.isVisible) {
            // Hidden (inside building)
            this.enterBuildingTimer -= dt;
            if (this.enterBuildingTimer <= 0) {
                this.isVisible = true; // Reappear
                this.x = this.originX; // Teleport back to spawn vicinity (or door)
                this.y = this.originY; // Simplified logic
            }
            return;
        }

        // --- BEHAVIOR ---
        // 0. Exclusion Zone: Shopping Side Entrance (114, 120)
        // If too close, push away with higher priority than wandering
        // EXCEPT for casino promoters who invite people in.
        const isCasinoPromoter = this.type === 'casino_promoter';
        const distToEntrance = Math.sqrt((this.x - 114) ** 2 + (this.y - 120) ** 2);
        const exclusionRadius = 2.5;
        if (!isCasinoPromoter && distToEntrance < exclusionRadius) {
            // Protect against division by zero if NPC is exactly at (114, 120)
            const safeDist = Math.max(distToEntrance, 0.001);
            const pushDirX = (this.x - 114) / safeDist;
            const pushDirY = (this.y - 120) / safeDist;
            const pushForce = (exclusionRadius - safeDist) * 1.5; // Slightly reduced force

            this.wanderDirX = pushDirX;
            this.wanderDirY = pushDirY;
            this.wanderSpeed = 0.8 + pushForce; // Lower base speed for smoother exit
            this.wanderTimer = 0.5; // Reset wander after escaping
        }

        if (!this.isStationary) {
            this.wanderTimer -= dt;
            if (this.wanderTimer <= 0) {
                // Random chance to "enter" building if near one/on sidewalk
                if (Math.random() < 0.05 && this.type !== 'pedinte') {
                    const tile = tileMap.getTile(this.x, this.y);
                    if (tile === 2 || tile === 13) {
                        this.isVisible = false;
                        this.enterBuildingTimer = 10 + Math.random() * 20;
                        return;
                    }
                }

                // Pick new direction
                this.wanderTimer = 4 + Math.random() * 8;
                const currentTile = tileMap.getTile(this.x, this.y);
                const isOnStreet = currentTile === TILE_TYPES.STREET;

                // If on street, FORCE walking (don't stop in the middle of the road)
                if (isOnStreet || Math.random() > 0.3) {
                    this.wanderDirX = (Math.random() - 0.5) * 2;
                    this.wanderDirY = (Math.random() - 0.5) * 2;
                    const len = Math.sqrt(this.wanderDirX ** 2 + this.wanderDirY ** 2);
                    if (len > 0) { this.wanderDirX /= len; this.wanderDirY /= len; }
                    
                    // Walk slightly faster if crossing the street
                    this.wanderSpeed = (0.5 + Math.random() * 0.4) * (isOnStreet ? 1.5 : 1.0);
                    
                    // Don't wander too long if crossing, to re-evaluate quickly
                    if (isOnStreet) this.wanderTimer = 1.0 + Math.random() * 1.5;
                } else {
                    this.wanderDirX = 0; this.wanderDirY = 0; // Idle
                }
            }
        } else {
            // Stationary NPCs never move
            this.wanderDirX = 0;
            this.wanderDirY = 0;
        }

        // --- PHYSICS (AABB) ---
        // Only move if not talking and NOT stationary
        if (!this.showDialogue && !this.isStationary) {
            let nextX = this.x + this.wanderDirX * this.wanderSpeed * dt;
            let nextY = this.y + this.wanderDirY * this.wanderSpeed * dt;

            // Personal Space from Player (Avoid running INTO player)
            const distP = Math.sqrt((nextX - playerX) ** 2 + (nextY - playerY) ** 2);
            if (distP < 1.0) {
                // Too close, stop or move away
                // Just stop for now to avoid "running wildly"
                nextX = this.x;
                nextY = this.y;
            }

            // Constrain to wander radius
            const dist = Math.sqrt((nextX - this.originX) ** 2 + (nextY - this.originY) ** 2);
            if (dist > this.wanderRadius) {
                // Turn back to origin
                const dx = this.originX - this.x;
                const dy = this.originY - this.y;
                const dlen = Math.sqrt(dx * dx + dy * dy);
                if (dlen > 0) {
                    this.wanderDirX = dx / dlen;
                    this.wanderDirY = dy / dlen;
                    // Reset wander timer to force a new choice once back in range
                    this.wanderTimer = 2.0;
                }
            }

            // AABB Collision Check (Realistic Asymmetric Bounds)
            const padN = 0.05;
            const padW = 0.05;
            const padS = 0.45;
            const padE = 0.45;

            const canWalkNPC = (cx: number, cy: number) => {
                // Check all 4 corners with asymmetric padding
                const cornersWalkable =
                    tileMap.isWalkable(cx - padW, cy - padN) &&
                    tileMap.isWalkable(cx + padE, cy - padN) &&
                    tileMap.isWalkable(cx - padW, cy + padS) &&
                    tileMap.isWalkable(cx + padE, cy + padS);

                if (!cornersWalkable) return false;

                // Additional NPC restriction (avoiding entrances/special tiles)
                const tile = tileMap.getTile(cx, cy);
                return tile !== TILE_TYPES.ENTRANCE;
            };

            if (canWalkNPC(nextX, this.y)) this.x = nextX;
            if (canWalkNPC(this.x, nextY)) this.y = nextY;

            // --- STUCK DETECTOR ---
            // If we haven't moved much AND we are trying to move, teleport to spawn
            const moveDist = Math.abs(this.x - this.lastX) + Math.abs(this.y - this.lastY);
            const isTryingToMove = Math.abs(this.wanderDirX) > 0.01 || Math.abs(this.wanderDirY) > 0.01;

            if (moveDist < 0.05 && isTryingToMove) {
                this.stuckTimer += dt;
                if (this.stuckTimer > 5.0) {
                    // Teleport to origin (unstuck)
                    this.x = this.originX;
                    this.y = this.originY;
                    this.stuckTimer = 0;
                }
            } else {
                this.stuckTimer = 0;
                this.lastX = this.x;
                this.lastY = this.y;
            }
        }

        // --- PLAYER INTERACTION ---
        const dx = this.x - playerX;
        const dy = this.y - playerY;
        const distSqToPlayer = dx * dx + dy * dy;
        this.isPlayerNearby = distSqToPlayer < 4.0; // 2.0 squared

        if (this.isPlayerNearby && !this.showDialogue) {
            this.showDialogue = true;
            this.currentDialogueIdx = 0;
            this.dialogueTimer = 0;

            // Dynamic logic: override dialogue if locked or on cooldown
            const pm = ProgressionManager.getInstance();
            const uid = this.getUniqueId();

            if (this.minigameType && !pm.isGameUnlocked(this.minigameType)) {
                // Don't show dialogue bubble for locked games to avoid redundancy with the bottom HUD bar
                this.dialogue = [];
            } else if (pm.isOnCooldown(uid)) {
                this.dialogue = [pm.getCooldownMessage(uid, 'street_npc')];
            } else {
                // Restore original dialogue if needed? 
                // Actually NPC is reconstructed/reset if we want, but let's just re-generate for now if we were overridden
                // Better: store originalDialogue
                if (!this.originalDialogue) {
                    this.originalDialogue = [...this.dialogue];
                }
                this.dialogue = [...this.originalDialogue!];
            }
        }

        if (this.showDialogue) {
            // Look at player
            // ... (optional direction logic)

            this.dialogueTimer += dt;
            // Advance text every 3s
            if (this.dialogueTimer > 3.0) {
                this.currentDialogueIdx++;
                this.dialogueTimer = 0;
                if (this.currentDialogueIdx >= this.dialogue.length) {
                    this.currentDialogueIdx = 0; // Loop or end? Loop for now
                }
            }
        }

        if (!this.isPlayerNearby) {
            this.showDialogue = false;
        }
    }

    public draw(ctx: CanvasRenderingContext2D, camera: Camera) {
        if (!this.isVisible) return;

        drawCharacter(ctx, camera, this.x, this.y, this.appearance, {
            isMoving: false,
            isRunning: false,
            animFrame: 0,
            direction: 'down',
        });
    }

    public drawUI(ctx: CanvasRenderingContext2D, camera: Camera) {
        if (!this.isVisible) return;

        const { sx, sy } = camera.worldToScreen(this.x, this.y);
        const z = camera.zoom;

        // Dialogue Bubble
        if (this.showDialogue && this.dialogue.length > 0) {
            this.drawBubble(ctx, sx, sy - 35 * z, this.dialogue[this.currentDialogueIdx], z);
        }

        // E Prompt
        if (this.isPlayerNearby && !this.showDialogue) {
            ctx.fillStyle = '#ffdd00';
            ctx.font = `bold ${10 * z}px monospace`;
            ctx.textAlign = 'center';
            ctx.fillText(this.gameName ? "▶ E - Jogar" : "▶ E - Ouvir", sx, sy - 25 * z);
        }
    }

    private drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, z: number) {
        ctx.save();
        ctx.font = `${Math.max(10, 8 * z)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic'; // Standard baseline for consistent vertical centering within our math
        const metrics = ctx.measureText(text);
        const w = metrics.width + 10 * z;
        const h = 16 * z;

        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(x - w / 2, y - h, w, h);

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - w / 2, y - h, w, h);

        ctx.fillStyle = '#fff';
        ctx.fillText(text, x, y - 5 * z);
        ctx.restore();
    }
    public getInteractionType(): string | null {
        if (!this.isPlayerNearby) return null;
        if (this.type === 'gambler' && this.gameName) return 'purrinha';
        return 'dialogue';
    }
}
