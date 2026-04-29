import { BichoManager } from './BichoManager';
import { ProgressionManager } from './Core/ProgressionManager';
import { SoundManager } from './Core/SoundManager';

export class CheatManager {
    private static instance: CheatManager;
    private sequence: string = '';
    private cheatActivated: boolean = false;
    private lastKeyTime: number = 0;
    private readonly TIMEOUT_MS = 3000;
    private initialized: boolean = false;

    private constructor() {}

    public static getInstance(): CheatManager {
        if (!CheatManager.instance) {
            CheatManager.instance = new CheatManager();
        }
        return CheatManager.instance;
    }

    public init() {
        if (this.initialized) return;
        
        console.log('[CheatManager] Inicializado. Código: LLGC');
        
        window.addEventListener('keydown', (e) => {
            if (this.cheatActivated) return;
            
            // Ignora teclas de controle
            if (e.key.length > 1 && e.key !== 'Escape' && e.key !== 'Backspace') return;

            if (e.key === 'Escape' || e.key === 'Backspace') {
                this.sequence = '';
                return;
            }

            const char = e.key.toUpperCase();
            if (/[A-Z]/.test(char)) {
                this.lastKeyTime = Date.now();
                this.sequence += char;
                console.log('[CheatManager] Tecla:', char, 'Sequência:', this.sequence);
                
                if (this.sequence.endsWith('LLGC')) {
                    this.activateCheat();
                }

                if (this.sequence.length > 10) {
                    this.sequence = this.sequence.slice(-4);
                }
            }
        });

        this.initialized = true;
    }

    public update(_dt: number) {
        if (this.cheatActivated) return;
        
        if (this.sequence.length > 0 && Date.now() - this.lastKeyTime > this.TIMEOUT_MS) {
            this.sequence = '';
        }
    }

    private activateCheat() {
        if (this.cheatActivated) return;
        this.cheatActivated = true;
        
        const bmanager = BichoManager.getInstance();
        const pmanager = ProgressionManager.getInstance();
        
        bmanager.playerMoney = 999999;
        pmanager.unlockAllGamesForCheat();

        SoundManager.getInstance().play('achievement_unlock');
        bmanager.addNotification('💸 CHEAT: DINHEIRO E JOGOS LIBERADOS!', 5);
        
        console.log('%c[CheatManager] CHEAT ATIVADO COM SUCESSO!', 'color: #00ff00; font-weight: bold; font-size: 16px;');
    }

    public isCheatActive(): boolean {
        return this.cheatActivated;
    }
}
