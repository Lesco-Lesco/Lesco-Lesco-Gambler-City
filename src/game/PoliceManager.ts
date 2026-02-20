export type PoliceRaidPhase = 'none' | 'interruption' | 'gamble_check' | 'double_or_nothing' | 'dice_battle' | 'dice_battle_result' | 'consequence';

export class PoliceManager {
    private static instance: PoliceManager;

    public phase: PoliceRaidPhase = 'none';
    public confiscatedAmount: number = 0;
    public raidCooldown: number = 0; // In seconds
    private raidCheckTimer: number = 0;
    private readonly RAID_CHECK_INTERVAL: number = 5; // Check every 5 seconds
    public giroflexTimer: number = 0;
    public currentJoke: string = '';
    public currentProvocation: string = '';

    private jokes: string[] = [
        "Apostando na rua? Achei que era um cidadão de bem.",
        "Essa banca aqui não tem alvará, e o seu bolso também não.",
        "Cinco contra um? Só se for eu contra vocês na delegacia.",
        "O azar não é perder o jogo, é eu aparecer no meio dele.",
        "Isso aqui é contravenção, mas o cafézinho pode resolver... brincadeira, perdeu tudo.",
        "Belo par de ases, pena que o meu é de algemas."
    ];

    private provocations: string[] = [
        "E aí, vai encarar a banca do Estado? Aposta mínima de 150.",
        "Quer ser a banca por um momento? 150 na mão e a gente vê quem tem sorte.",
        "Se ganhar de mim, leva o dobro. Se não, a viatura tá te esperando.",
        "Dobra ou nada? 150 pilares pra ver se você é homem de sorte.",
        "O Estado aceita desafios. 150 reais, topa?"
    ];

    private sarcasm: string[] = [
        "Obrigado pela contribuição aos servidores da cidade. Continue assim!",
        "A prefeitura agradece sua 'generosidade'.",
        "É por gente como você que o café da delegacia nunca acaba.",
        "Uma pequena doação para o setor de segurança... muito bem.",
        "Pelo menos você sabe quando baixar a cabeça. Boa noite, cidadão."
    ];

    private alerts: string[] = [
        "O jogo de azar é o caminho mais rápido para a cadeia... ou pra ficar liso.",
        "Vi muita gente boa perdendo o rumo nesses becos.",
        "Divertido enquanto dura, triste quando a gente chega.",
        "A sorte é cega, mas a polícia tem olhos em todo lugar.",
        "Cuidado com o que aposta, o preço pode ser alto demais."
    ];

    private constructor() { }

    public static getInstance(): PoliceManager {
        if (!PoliceManager.instance) {
            PoliceManager.instance = new PoliceManager();
        }
        return PoliceManager.instance;
    }

    public update(dt: number, x?: number, y?: number, playerMoney?: number, isIllegalActivity?: boolean) {
        if (this.raidCooldown > 0) this.raidCooldown -= dt;

        if (this.phase !== 'none') {
            this.giroflexTimer += dt;
        } else {
            this.giroflexTimer = 0;

            // Continuous Raid Check ONLY during illegal activity (flagrante)
            if (this.raidCooldown <= 0 && isIllegalActivity && x !== undefined && y !== undefined && playerMoney !== undefined) {
                this.raidCheckTimer += dt;
                if (this.raidCheckTimer >= this.RAID_CHECK_INTERVAL) {
                    this.raidCheckTimer = 0;
                    if (playerMoney > 10) {
                        const chance = this.getRaidChance(x, y);
                        if (Math.random() < chance) {
                            this.triggerRaid(0);
                        }
                    }
                }
            }
        }
    }

    public triggerRaid(betAmount: number) {
        this.phase = 'interruption';
        this.confiscatedAmount = betAmount;
        this.currentJoke = this.jokes[Math.floor(Math.random() * this.jokes.length)];
        this.raidCooldown = 60; // 1 minute between raids
    }

    public getRandomAlert(): string {
        return this.alerts[Math.floor(Math.random() * this.alerts.length)];
    }

    public getRandomSarcasticComment(): string {
        return this.sarcasm[Math.floor(Math.random() * this.sarcasm.length)];
    }

    public getRandomProvocation(): string {
        return this.provocations[Math.floor(Math.random() * this.provocations.length)];
    }

    public isPeriphery(x: number, y: number): boolean {
        // Periphery definitions based on MapData research
        const isFarLeft = x < 40;
        const isFarRight = x > 220;
        const isSouthWestFavela = (x > 45 && x < 215 && y > 200);
        return isFarLeft || isFarRight || isSouthWestFavela;
    }

    public getRaidChance(x: number, y: number): number {
        if (this.raidCooldown > 0) return 0;

        // Periodic check chances (lower than end-game chances)
        let chance = 0.02; // 2% every 5 seconds ~ 24% per minute in normal areas

        if (this.isPeriphery(x, y)) {
            chance = 0.08; // 8% every 5 seconds ~ 63% per minute in periphery
        } else {
            // Near shopping (X:130, Y:125)
            const distToShop = Math.sqrt((x - 130) ** 2 + (y - 125) ** 2);
            if (distToShop < 40) chance = 0.005; // 0.5% every 5 seconds
        }

        return chance;
    }

    public reset() {
        this.phase = 'none';
        this.confiscatedAmount = 0;
        this.currentJoke = '';
        this.currentProvocation = '';
    }
}
