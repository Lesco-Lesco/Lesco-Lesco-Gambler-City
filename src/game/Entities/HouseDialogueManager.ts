
import { TileMap } from '../World/TileMap';
import { Camera } from '../Core/Camera';
import { MAP_WIDTH, MAP_HEIGHT, TILE_TYPES } from '../World/MapData';
import { SoundManager } from '../Core/SoundManager';

interface House {
    x: number;
    y: number;
    width: number;
    height: number;
    isPeripheral: boolean;
    dialogueCooldown: number; // Time until next potential conversation
    activeDialogue: string | null;
    activeTimer: number; // Duration of current bubble

    // Script System
    scriptQueue: string[]; // Lines waiting to be said
    scriptDelayCallback: number; // Time until next line
}

// --- SCRIPTS ---
// Format: simply an array of strings played in sequence.

const ARGUMENTS_PERIPHERAL = [
    ["CADÊ MEU DINHEIRO?!", "Gastei no bicho, calma!", "CALMA?! VOU TE MATAR!", "SOCORRO!"],
    ["SAI DAÍ MOLEQUE!", "Tô só olhando, tia!", "VAI PRA CASA AGORA!", "Que saco..."],
    ["Quem é essa aí no zap?", "É minha prima, doida.", "Prima de quem?!", "Da sua mãe!"],
    ["Abaixa esse som!", "Tô curtindo, pô!", "TÁ TREMENDO A JANELA!", "Você é muito chata!"],
    ["Você bebeu de novo?", "Só uma latinha...", "TÁ CHEIRANDO A CACHAÇA!", "Me deixa em paz."],
    ["Onde você tava até agora?!", "No Bar do Luiz, ué.", "COM QUE DINHEIRO?!", "Ganhei na Ronda... ou quase isso."],
    ["Cala a boca e come!", "Essa comida tá sem sal.", "ENTÃO COZINHA VOCÊ!", "Grossa..."],
    ["A vizinha disse que te viu com outra.", "Vizinha fofoqueira, você acredita?", "ELA TIROU FOTO!", "Apaga isso agora!"],
    ["Mãe, cadê meu tênis?", "Onde você deixou, ué.", "TÔ ATRASADO!", "Problema seu, não sou sua empregada!"],
    ["Tira o pé do sofá!", "Tô descansando, pô.", "VAI DESCANSAR LÁ FORA!", "Casa é minha também."],
    ["Quem quebrou o copo de requeijão?!", "Foi o gato!", "A GENTE NÃO TEM GATO!", "Foi o vento..."],
    ["Desliga esse videogame!", "Só mais essa fase, mãe!", "JÁ MANDEI DESLIGAR!", "Ah, perdi minha vida!"],
    ["Tu pegou minha camisa de time?", "Tava limpa, peguei emprestada.", "TÁ TODA SUJA DE KETCHUP!", "Foi mal, comi um dogão."],
    ["Vai arrumar um emprego, preguiçoso!", "Tô esperando chamarem da firma.", "TÁ ESPERANDO DEITADO?!", "Amanhã eu vou lá."],
    ["Cadê o troco do pão?", "Comprei figurinha pro álbum.", "EU NÃO ACREDITO NISSO!", "Tirei a brilhante do Ronaldo!"]
];

const GOSSIP_PERIPHERAL = [
    ["Viu o vizinho novo?", "Aquele do carro vermelho?", "Dizem que é bicheiro.", "Misericórdia!"],
    ["A polícia passou aqui...", "Procurando quem?", "O filho da Maria.", "Sabia que ia dar ruim."],
    ["Vai ter churrasco hoje?", "Só se você pagar.", "Tô liso, irmão.", "Então fica com fome."],
    ["Viu a briga na esquina hoje?", "Foi por causa de jogo?", "Sempre é por causa de jogo.", "Povo não aprende."],
    ["Dizem que o Shopping vai fechar.", "Mentira, acabou de abrir!", "Ouvi falar que deu rolo com os fiscais.", "Santa Cruz não é pra amadores."],
    ["O carteiro não passa mais lá na rua de cima.", "Assaltaram ele?", "Pior, o cachorro do Seu Zé não deixa.", "Aquele vira-lata é brabo."],
    ["Menina, cê não sabe...", "O que foi agora?", "A filha da Neide fugiu com o palhaço do circo.", "Gente do céu!"],
    ["A luz cortou de novo na vila.", "Gato mal feito dá nisso.", "E a carne no freezer?", "Já era, vai ter que assar hoje."],
    ["Dizem que tem assombração na estação.", "Eu que não passo lá de madrugada.", "O trem fantasma da meia-noite.", "Vira essa boca pra lá."],
    ["O dono da padaria comprou carro zero.", "Vendendo pão dormido?", "Deve tá na purrinha todo dia.", "Dinheiro atrai dinheiro."]
];

const ONELINERS_PERIPHERAL = [
    ["Olha a boca, rapá!"],
    ["Se a polícia bater, ninguém viu nada."],
    ["Traz a cerveja, caramba!"],
    ["Vai dar ruim isso aí..."],
    ["Desce daí agora, seu sem vergonha!"],
    ["Sai daí, folgado!"],
    ["Desce daí, pilantra!"],
    ["Cadê o dinheiro do aluguel?"],
    ["Vizinho fofoqueiro é fogo."],
    ["Para de gritar, tem gente dormindo!"],
    ["O bicho deu zebra hoje, hein?"],
    ["Quem não deve, não teme... mas eu temo."],
    ["Bota fé que amanhã a sorte vira."],
    ["Não encosta no meu carro!"],
    ["Hoje é dia de maldade no fliperama."],
    ["Bota o lixo pra fora!"],
    ["Cuidado com a linha com cerol!"],
    ["Ô de casa! Tem alguém aí?"],
    ["Onde que eu deixei a chave do portão..."],
    ["Menino, vem almoçar!"],
    ["Desliga a mangueira, tá gastando água!"],
    ["Vou mandar benzer essa casa."],
    ["Só me falta essa agora."],
    ["Deus me livre e guarde."]
];

const TV_RADIO = [
    ["GOOOOOL FLAMENGOOO!", "Aumenta aí!", "Chupa vascaíno!"],
    ["Interrompemos a programação...", "Ih, deu ruim pra alguém.", "Aumenta pra eu ouvir."],
    ["...a previsão do tempo...", "Vai chover amanhã?", "Diz que sim.", "Vou tirar a roupa do varal."],
    ["...e o dólar fechou em alta...", "E eu com isso? Ganho em real.", "Tudo vai ficar mais caro.", "Isso que é vida."],
    ["Ligue djá! O seu futuro nas cartas...", "Gente enganando gente.", "Vai que é verdade?", "Boboca."],
    ["...no capítulo de hoje da novela...", "Não me conta! Quero assistir.", "A mocinha vai descobrir tudo.", "Ah, você estragou!"],
    ["Compre o carro zero com parcelas que cabem no seu bolso!", "Cabe no bolso do dono do banco, né?", "Aumenta o volume que eu quero ouvir os gols."],
    ["...sorteio da telesena é neste domingo...", "Você comprou a sua?", "Todo mês eu compro, uma hora sai.", "Esperança é a última que morre."]
];

const ARGUMENTS_CENTRAL = [
    ["Apaga essa luz!", "Tô lendo!", "São 3 da manhã!", "E daí?"],
    ["Você não lavou a louça.", "Lavo amanhã.", "Vai lavar AGORA.", "Que chatice."],
    ["O cachorro fugiu de novo!", "Deixou o portão aberto?", "Foi você!", "Eu não!"],
    ["Cadê a chave do carro?", "Não sei, você que usou por último.", "MENTIRA!", "Procura no sofá..."],
    ["Você esqueceu nosso aniversário!", "Não esqueci, o presente tá chegando.", "TÁ CHEGANDO DESDE O ANO PASSADO!", "Calma, amor..."],
    ["Você estourou o limite do cartão?!", "Eram parcelas sem juros!", "COMO VAMOS PAGAR?", "Mês que vem a gente vê."],
    ["Abaixa a tampa do vaso!", "Esqueci, desculpa.", "TODO DIA É ISSO!", "Tá bom, tá bom."],
    ["Quem mexeu no termostato da geladeira?", "A cerveja não tava gelando.", "As verduras congelaram tudo!", "Pelo menos a breja tá trincando."],
    ["Já disse pra não pisar no tapete de sapato!", "Tô com pressa!", "LIMPEI HOJE DE MANHÃ!", "Na volta eu passo o pano, juro."],
    ["Você vai sair com essa roupa?", "Qual o problema?", "Parece um maloqueiro.", "A moda agora é essa, mãe."]
];

const CASUAL_CENTRAL = [
    ["Que calor insuportável.", "Liga o ventilador.", "Tá quebrado.", "Então sofre."],
    ["O preço da carne subiu.", "De novo?", "Tá impossível viver.", "Vou virar vegetariano."],
    ["Vai pedir pizza hoje?", "Se você pagar a taxa de entrega.", "Tô sem troco.", "Então vamos de miojo."],
    ["Viu o jornal hoje?", "Só tragédia.", "Santa Cruz tá mudando muito.", "Pra pior ou pra melhor?"],
    ["Amanhã tem feriado.", "Vou dormir até o meio dia.", "Não vai lavar o carro?", "Deixa sujo mesmo."],
    ["A rua tá um barulho hoje.", "É dia de feira na praça.", "Vou lá comer um pastel.", "Traz um de queijo pra mim."],
    ["Preciso de uma TV nova.", "Pra ver jogo do campeonato?", "Não, a novela tá numa imagem péssima.", "Gasta dinheiro com bobagem."],
    ["Ouviu falar do novo restaurante?", "Aquele perto da igreja?", "É, disseram que a fila é enorme.", "Prefiro a comida daqui de casa."],
    ["As crianças tão crescendo rápido.", "Já tão pedindo mesada.", "Vão ter que arrumar bico no shopping.", "Deus me livre, lá é perigoso."],
    ["O vizinho comprou um cachorro.", "Tomara que não lata a noite toda.", "Ele tem cara de bonzinho.", "Cachorro e dono, a gente nunca sabe."]
];

const ONELINERS_CENTRAL = [
    ["Que calor do cão!"],
    ["Alguém viu o gato?"],
    ["Aumenta a TV aí!"],
    ["Hoje tem jogo, silêncio!"],
    ["Essa conta de luz tá um absurdo."],
    ["Fecha a janela, vai chover."],
    ["Onde tá o controle?"],
    ["Que cheiro de queimado é esse?"],
    ["Não tem um doce nessa casa."],
    ["Quem deixou a porta da geladeira aberta?"],
    ["Tô precisando de férias."],
    ["O telefone não para de tocar."],
    ["Menino, sai da frente da TV!"],
    ["Esqueci de pagar o condomínio."],
    ["Domingo sem macarronada não é domingo."],
    ["Deixa as visitas chegarem pra ver a bagunça."],
    ["Vou dar uma deitada, não me acorde."],
    ["Esse bairro já foi mais tranquilo."]
];


export class HouseDialogueManager {
    private houses: House[] = [];
    private tileMap: TileMap;

    constructor(tileMap: TileMap) {
        this.tileMap = tileMap;
        this.scanHouses();
    }

    private scanHouses() {
        const step = 5;

        for (let y = 0; y < MAP_HEIGHT; y += step) {
            for (let x = 0; x < MAP_WIDTH; x += step) {
                // Check center tile
                const cx = x + Math.floor(step / 2);
                const cy = y + Math.floor(step / 2);
                const tile = this.tileMap.getTile(cx, cy);

                // EXCLUSIONS (Shopping, Church, Plaza, Station)
                if (tile === TILE_TYPES.SHOPPING || tile === TILE_TYPES.CHURCH ||
                    tile === TILE_TYPES.PLAZA || tile === TILE_TYPES.ENTRANCE) continue;

                // Manual Area Exclusions
                // Station
                if (cx >= 220 && cx <= 265 && cy >= 150 && cy <= 180) continue;
                // Marco Imperial
                if (cx >= 225 && cx <= 245 && cy >= 130 && cy <= 150) continue;
                // Marques de Herval
                if (cx >= 148 && cx <= 168 && cy >= 160 && cy <= 190) continue;

                if (this.isBuildingBlock(x, y, step)) {
                    // Check if it's peripheral (Western favela, Far East favela)
                    const isPeripheral = (x < 70 || x > 230 || y > 230 || (x > 160 && y < 100)); // Adjusted for map layout

                    this.houses.push({
                        x: x + step / 2,
                        y: y + step / 2,
                        width: step,
                        height: step,
                        isPeripheral,
                        dialogueCooldown: Math.random() * 30,
                        activeDialogue: null,
                        activeTimer: 0,
                        scriptQueue: [],
                        scriptDelayCallback: 0
                    });
                }
            }
        }
    }

    private isBuildingBlock(startX: number, startY: number, size: number): boolean {
        const cx = startX + Math.floor(size / 2);
        const cy = startY + Math.floor(size / 2);
        return this.tileMap.isBuilding(cx, cy);
    }

    public update(dt: number, playerX: number, playerY: number) {
        for (const house of this.houses) {

            // --- 1. Update Active Dialogue ---
            if (house.activeDialogue) {
                house.activeTimer -= dt;
                if (house.activeTimer <= 0) {
                    house.activeDialogue = null;
                }
            }

            // --- 2. Process Scripts (Conversation Flow) ---
            if (house.scriptQueue.length > 0) {
                house.scriptDelayCallback -= dt;

                // If it's time for the next line AND the previous one is done (or almost done)
                if (house.scriptDelayCallback <= 0) {
                    // Play next line
                    const line = house.scriptQueue.shift();
                    if (line) {
                        house.activeDialogue = line;
                        // Time to read: 2s base + 0.1s per character
                        const readTime = 2.0 + (line.length * 0.05);
                        house.activeTimer = readTime;

                        // Sound trigger: Play bip when a new line appears
                        SoundManager.getInstance().play('dialogue_bip');

                        // Delay before NEXT line: readTime + small pause
                        house.scriptDelayCallback = readTime + 0.5 + Math.random() * 1.0;
                    }
                }

                // If script is running, we don't start new random ones
                continue;
            }

            // --- 3. Trigger New Condition (Strict Proximity) ---

            // Distance check: "Eavesdropping" distance (very close)
            const dist = Math.sqrt((house.x - playerX) ** 2 + (house.y - playerY) ** 2);
            const EAVESDROP_DIST = 4.5; // Very close, basically passing by on sidewalk

            // If player is far, we might cooldown, but we NEVER trigger.
            if (dist > EAVESDROP_DIST) {
                // Decay cooldown slowly even if far, so when you return they might talk
                house.dialogueCooldown -= dt * 0.5;
                continue;
            }

            // If close, update cooldown normally
            house.dialogueCooldown -= dt;

            if (house.dialogueCooldown <= 0) {
                // Trigger a script!
                this.startScript(house);

                // Reset Cooldown (Reduced Frequency: ~2-4 minutes per house)
                house.dialogueCooldown = 120 + Math.random() * 120;
            }
        }
    }

    private startScript(house: House) {
        let scriptPool: string[][] = [];

        if (house.isPeripheral) {
            // Favela / Periphery
            const roll = Math.random();
            // 60% chance of one-liner (short interaction)
            if (roll < 0.60) scriptPool = ONELINERS_PERIPHERAL;
            // 20% chance of Argument
            else if (roll < 0.80) scriptPool = ARGUMENTS_PERIPHERAL;
            // 10% chance of Gossip
            else if (roll < 0.90) scriptPool = GOSSIP_PERIPHERAL;
            // 10% chance of TV
            else scriptPool = TV_RADIO;
        } else {
            // Central / Middle Class
            const roll = Math.random();
            // 70% chance of one-liner
            if (roll < 0.70) scriptPool = ONELINERS_CENTRAL;
            // 15% chance of Casual conversation
            else if (roll < 0.85) scriptPool = CASUAL_CENTRAL;
            // 10% chance of Argument
            else if (roll < 0.95) scriptPool = ARGUMENTS_CENTRAL;
            // 5% chance of TV
            else scriptPool = TV_RADIO;
        }

        // Pick a random script from the pool
        const script = scriptPool[Math.floor(Math.random() * scriptPool.length)];

        // Clone it so we can shift() from it without ruining the source
        house.scriptQueue = [...script];
        house.scriptDelayCallback = 0; // Start immediately
    }

    public draw(ctx: CanvasRenderingContext2D, camera: Camera) {
        for (const house of this.houses) {
            if (house.activeDialogue) {
                const { sx, sy } = camera.worldToScreen(house.x, house.y);
                const z = camera.zoom;

                if (sx < -100 || sx > camera.screenWidth + 100 || sy < -100 || sy > camera.screenHeight + 100) continue;

                this.drawBubble(ctx, sx, sy - 15 * z, house.activeDialogue, z, house.isPeripheral);
            }
        }
    }

    private drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, z: number, isPeripheral: boolean) {
        ctx.save();
        ctx.font = `${Math.max(11, 8.8 * z)}px monospace`;
        const metrics = ctx.measureText(text);
        const padding = 5 * z;
        const w = metrics.width + padding * 2;
        const h = 18 * z;

        // Argument Check
        const isArgument = text === text.toUpperCase() && /[A-Z]/.test(text); // All caps -> Argument

        if (isArgument) {
            x += (Math.random() - 0.5) * 4;
            y += (Math.random() - 0.5) * 4;
        }

        // Box Style
        ctx.fillStyle = isArgument ? 'rgba(50, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.85)';
        if (isPeripheral && !isArgument) ctx.fillStyle = 'rgba(30, 30, 10, 0.9)'; // Variation

        ctx.fillRect(x - w / 2, y - h, w, h);

        // Border
        ctx.strokeStyle = isArgument ? '#ff3333' : '#ffffff';
        ctx.lineWidth = isArgument ? 2 : 1;
        ctx.strokeRect(x - w / 2, y - h, w, h);

        // Text
        ctx.fillStyle = isArgument ? '#ffcccc' : '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x, y - h / 2);

        // Tail
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 5 * z, y + 8 * z);
        ctx.lineTo(x + 5 * z, y);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
        ctx.restore();
    }
}
