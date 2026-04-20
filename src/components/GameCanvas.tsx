import { useEffect, useRef } from 'react';
import { Renderer } from '../game/Core/Renderer';
import { GameLoop } from '../game/Core/Loop';
import type { ExplorationScene } from '../game/Scenes/ExplorationScene';
import type { CasinoScene } from '../game/Scenes/CasinoScene';
import type { ChurchScene } from '../game/Scenes/ChurchScene';
import type { GameOverScene } from '../game/Scenes/GameOverScene';
import type { ScoreBreakdownScene } from '../game/Scenes/ScoreBreakdownScene';
import type { InitialsInputScene } from '../game/Scenes/InitialsInputScene';
import type { RankingScene } from '../game/Scenes/RankingScene';
import { RankingAPI } from '../game/Services/RankingAPI';
import { EconomyManager } from '../game/Core/EconomyManager';
import { AchievementManager } from '../game/Core/AchievementManager';
import { AchievementUI } from '../game/UI/AchievementUI';
import { BichoManager } from '../game/BichoManager';
import { BuffManager } from '../game/Core/BuffManager';
import { ProgressionManager } from '../game/Core/ProgressionManager';
import { UIScale } from '../game/Core/UIScale';
import { SoundManager } from '../game/Core/SoundManager';
import { InputManager } from '../game/Core/InputManager';
import MobileControls from './MobileControls';
import { useState } from 'react';

const GameCanvas = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [showSplash, setShowSplash] = useState(false);
    const [splashFade, setSplashFade] = useState(true); // Start as visible
    const [isPaused, setIsPaused] = useState(false);
    const [pauseSelectedIndex, setPauseSelectedIndex] = useState(0);
    const vazarOptions = ["Picar a Mula", "Meter o Pé", "Sair Fora", "Vazar", "Dar no Pé", "Cair Fora", "Ralar Peito", "Zarpar"];
    const [vazarText, setVazarText] = useState("Vazar");
    
    const engineRef = useRef<{
        loop: GameLoop;
        renderer: Renderer;
        scene: ExplorationScene;
        casinoScene: CasinoScene;
        churchScene: ChurchScene;
        gameOverScene: GameOverScene;
        scoreBreakdown: ScoreBreakdownScene;
        initialsInput: InitialsInputScene;
        rankingScene: RankingScene;
    } | null>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Escape') {
                const loop = engineRef.current?.loop;
                if (!loop) return;
                
                // Only allow pausing in the main exploration scene and without any sub-contexts (dialogues, etc) active
                if (loop.getActiveScene()?.name === 'exploration' && InputManager.getInstance().getContext() === 'exploration') {
                    setIsPaused(prev => {
                        const next = !prev;
                        loop.setPaused(next);
                        if (next) {
                            setVazarText(vazarOptions[Math.floor(Math.random() * vazarOptions.length)]);
                            setPauseSelectedIndex(0);
                        }
                        return next;
                    });
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        if (!isPaused) return;
        
        const handlePauseNav = (e: KeyboardEvent) => {
            if (e.code === 'ArrowUp' || e.code === 'KeyW') {
                e.preventDefault();
                setPauseSelectedIndex(prev => (prev === 0 ? 1 : 0));
            } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
                e.preventDefault();
                setPauseSelectedIndex(prev => (prev === 1 ? 0 : 1));
            } else if (e.code === 'Enter' || e.code === 'Space') {
                e.preventDefault();
                const loop = engineRef.current?.loop;
                if (!loop) return;

                if (pauseSelectedIndex === 0) {
                    setIsPaused(false);
                    loop.setPaused(false);
                } else if (pauseSelectedIndex === 1) {
                    setIsPaused(false);
                    loop.setPaused(false);
                    loop.setScene('score_breakdown');
                }
            }
        };
        
        window.addEventListener('keydown', handlePauseNav, { passive: false });
        return () => window.removeEventListener('keydown', handlePauseNav);
    }, [isPaused, pauseSelectedIndex]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const w = window.innerWidth;
        const h = window.innerHeight;

        let isMounted = true;
        let fpsInterval: number;

        const triggerSplash = async () => {
            if (!isMounted) return;
            setSplashFade(true); // Ensure visible immediately
            setShowSplash(true);

            // Show for 1.0s
            await new Promise(r => setTimeout(r, 1000));

            setSplashFade(false); // Start fade out
            setTimeout(() => {
                if (isMounted) setShowSplash(false);
            }, 400); // Sharp fade out matching CSS (0.3s)
        };

        const init = async () => {
            try {
                // Initialize renderer
                const renderer = new Renderer(canvas);
                const loop = new GameLoop(renderer.getContext());

                // Create scenes attempt
                let scene: ExplorationScene;
                let gameOverScene: GameOverScene;
                let casinoShopping: CasinoScene;
                let casinoStation: CasinoScene;
                let churchScene: ChurchScene;
                let scoreBreakdown: import('../game/Scenes/ScoreBreakdownScene').ScoreBreakdownScene;
                let initialsInput: import('../game/Scenes/InitialsInputScene').InitialsInputScene;
                let rankingScene: import('../game/Scenes/RankingScene').RankingScene;

                try {
                    const { ExplorationScene } = await import('../game/Scenes/ExplorationScene');
                    const { CasinoScene } = await import('../game/Scenes/CasinoScene');
                    const { ChurchScene } = await import('../game/Scenes/ChurchScene');
                    const { GameOverScene } = await import('../game/Scenes/GameOverScene');
                    const { ScoreBreakdownScene } = await import('../game/Scenes/ScoreBreakdownScene');
                    const { InitialsInputScene } = await import('../game/Scenes/InitialsInputScene');
                    const { RankingScene } = await import('../game/Scenes/RankingScene');

                    scene = new ExplorationScene(renderer, w, h);
                    casinoShopping = new CasinoScene(w, h, 'shopping');
                    casinoStation = new CasinoScene(w, h, 'station');
                    churchScene = new ChurchScene(w, h);
                    gameOverScene = new GameOverScene();
                    scoreBreakdown = new ScoreBreakdownScene();
                    initialsInput = new InitialsInputScene();
                    rankingScene = new RankingScene();

                    // Link Scenes
                    scene.onEnterCasino = (type: 'shopping' | 'station' = 'shopping') => {
                        loop.setScene(type === 'station' ? 'casino_station' : 'casino_shopping');
                    };
                    scene.onEnterChurch = () => {
                        loop.setScene('church');
                    };

                    casinoShopping.onSceneExitRequest = () => loop.setScene('exploration');
                    casinoStation.onSceneExitRequest = () => loop.setScene('exploration');
                    churchScene.onSceneExitRequest = () => {
                        loop.setScene('exploration');
                    };

                    const handleGameOver = () => loop.setScene('gameover');
                    scene.onGameOver = handleGameOver;
                    casinoShopping.onGameOver = handleGameOver;
                    casinoStation.onGameOver = handleGameOver;

                    // END GAME → Score Breakdown
                    gameOverScene.onContinue = () => {
                        loop.setScene('score_breakdown');
                    };

                    // Score Breakdown → Initials Input OR Ranking
                    scoreBreakdown.onContinue = (enteredRanking: boolean) => {
                        if (enteredRanking) {
                            const pos = scoreBreakdown.getRankingPosition()!;
                            const bd  = scoreBreakdown.getBreakdown()!;
                            initialsInput.setData(pos, bd);
                            loop.setScene('initials_input');
                        } else {
                            // Skip initials, go straight to ranking
                            RankingAPI.getInstance().getRanking().then(r => {
                                rankingScene.setData(r, null);
                            }).catch(() => rankingScene.setData([], null));
                            loop.setScene('ranking');
                        }
                    };

                    // Initials confirmed → submit score → Ranking
                    initialsInput.onConfirm = async (initials, breakdown) => {
                        try {
                            const result = await RankingAPI.getInstance().submitScore(initials, breakdown);
                            rankingScene.setData(result.ranking, result.position);
                        } catch (err) {
                            console.error("Critical error during score submission:", err);
                            // Fallback to local data to not get stuck
                            rankingScene.setData([], null);
                        } finally {
                            loop.setScene('ranking');
                        }
                    };

                    // Ranking → Restart game
                    rankingScene.onRestart = () => {
                        EconomyManager.getInstance().reset();
                        AchievementManager.getInstance().reset();
                        AchievementUI.getInstance().reset();
                        BichoManager.getInstance().reset();
                        BuffManager.getInstance().reset();
                        ProgressionManager.getInstance().reset();
                        scene.resetPlayer();
                        triggerSplash();
                        loop.setScene('exploration');
                    };

                    // Register scenes
                    loop.addScene(scene);

                    casinoShopping.name = 'casino_shopping';
                    loop.addScene(casinoShopping);

                    casinoStation.name = 'casino_station';
                    loop.addScene(casinoStation);

                    churchScene.name = 'church';
                    loop.addScene(churchScene);

                    loop.addScene(gameOverScene);
                    loop.addScene(scoreBreakdown);
                    loop.addScene(initialsInput);
                    loop.addScene(rankingScene);
                    loop.setScene('exploration');

                    // Start loop
                    await document.fonts.ready; // Ensure custom fonts are loaded
                    loop.start();
                    triggerSplash(); // Show splash on first start
                    engineRef.current = { loop, renderer, scene, casinoScene: casinoShopping, churchScene, gameOverScene, scoreBreakdown, initialsInput, rankingScene };

                    console.log("Scenes initialized successfully");

                    // Initialize sound system
                    const sound = SoundManager.getInstance();
                    sound.init();

                    // Resume AudioContext on first user interaction (browser autoplay policy)
                    const resumeAudio = () => {
                        sound.resumeContext();
                        document.removeEventListener('click', resumeAudio);
                        document.removeEventListener('keydown', resumeAudio);
                        document.removeEventListener('touchstart', resumeAudio);
                    };
                    document.addEventListener('click', resumeAudio);
                    document.addEventListener('keydown', resumeAudio);
                    document.addEventListener('touchstart', resumeAudio);
                } catch (sceneErr: any) {
                    console.error("Scene Load Error:", sceneErr);
                    throw new Error("Scene Constructor/Module Failed: " + sceneErr.message);
                }

                // Handle resize
                const handleResize = () => {
                    const dpr = window.devicePixelRatio || 1;
                    const rw = window.innerWidth * dpr;
                    const rh = window.innerHeight * dpr;

                    // Update UI scale factor for responsive sizing
                    UIScale.update(rw, rh);

                    // Update canvas internal resolution
                    if (canvas) {
                        canvas.width = rw;
                        canvas.height = rh;
                    }

                    renderer.resize(rw, rh);
                    if (scene) scene.resize(rw, rh);
                    if (casinoShopping) casinoShopping.resize(rw, rh);
                    if (casinoStation) casinoStation.resize(rw, rh);
                    if (churchScene) churchScene.resize(rw, rh);
                    if (gameOverScene) gameOverScene.resize(rw, rh);
                    if (scoreBreakdown) scoreBreakdown.resize(rw, rh);
                    if (initialsInput) initialsInput.resize(rw, rh);
                    if (rankingScene) rankingScene.resize(rw, rh);
                };

                // Initial size
                handleResize(); // Call once to set initial size correctly
                window.addEventListener('resize', handleResize);

                // Update FPS
                fpsInterval = window.setInterval(() => {
                    if (scene) scene.setFPS(loop.getFPS());
                }, 500);

                return () => {
                    loop.stop();
                    window.clearInterval(fpsInterval);
                    window.removeEventListener('resize', handleResize);
                };
            } catch (err: any) {
                console.error("Initialization Error:", err);
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.fillStyle = '#880000';
                    ctx.fillRect(0, 0, w, h);
                    ctx.fillStyle = '#ffffff';
                    ctx.font = '20px monospace';
                    ctx.fillText("INITIALIZATION ERROR:", 50, 50);
                    ctx.fillText(err.toString(), 50, 80);
                    if (err.stack) {
                        const lines = err.stack.split('\n');
                        for (let i = 0; i < Math.min(lines.length, 15); i++) {
                            ctx.fillText(lines[i].trim(), 50, 120 + i * 25);
                        }
                    }
                }
            }
        };

        const cleanupPromise = init();

        return () => {
            isMounted = false;
            cleanupPromise.then(cleanup => cleanup && cleanup());
        };
    }, []);


    return (
        <>
            <canvas
                ref={canvasRef}
                style={{
                    display: 'block',
                    width: '100vw',
                    height: '100vh',
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    cursor: 'none',
                }}
            />

            {showSplash && (
                <div className={`splash-overlay ${splashFade ? 'visible' : ''}`}>
                    <img
                        src="/intro.jpg"
                        alt="Logo Intro"
                        className="splash-image"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                </div>
            )}

            {isPaused && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, width: '100vw', height: '100vh',
                    backgroundColor: 'rgba(0, 0, 0, 0.85)',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    zIndex: 9999,
                    fontFamily: '"Press Start 2P", monospace',
                    color: 'white'
                }}>
                    <h1 style={{ color: '#00ddff', textShadow: '0 0 10px #00ddff', marginBottom: '40px' }}>PAUSADO</h1>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                        <div 
                            onClick={() => {
                                setIsPaused(false);
                                engineRef.current?.loop.setPaused(false);
                            }}
                            onMouseEnter={() => setPauseSelectedIndex(0)}
                            style={{
                                padding: '15px 30px', minWidth: '250px', textAlign: 'center',
                                backgroundColor: pauseSelectedIndex === 0 ? '#222' : '#111', 
                                color: pauseSelectedIndex === 0 ? '#ffffff' : '#00ddff',
                                border: `2px solid ${pauseSelectedIndex === 0 ? '#ffffff' : '#00ddff'}`,
                                fontFamily: 'inherit', fontSize: '14px',
                                cursor: 'pointer',
                                textTransform: 'uppercase',
                                transform: pauseSelectedIndex === 0 ? 'scale(1.1)' : 'scale(1.0)',
                                transition: 'all 0.1s ease-in-out',
                                boxShadow: pauseSelectedIndex === 0 ? '0 0 15px rgba(255, 255, 255, 0.2)' : 'none'
                            }}
                        >
                            {pauseSelectedIndex === 0 ? '> CONTINUAR <' : 'CONTINUAR'}
                        </div>
                        
                        <div 
                            onClick={() => {
                                setIsPaused(false);
                                engineRef.current?.loop.setPaused(false);
                                engineRef.current?.loop.setScene('score_breakdown');
                            }}
                            onMouseEnter={() => setPauseSelectedIndex(1)}
                            style={{
                                padding: '15px 30px', minWidth: '250px', textAlign: 'center',
                                backgroundColor: pauseSelectedIndex === 1 ? '#222' : '#111', 
                                color: pauseSelectedIndex === 1 ? '#ffffff' : '#ff4422',
                                border: `2px solid ${pauseSelectedIndex === 1 ? '#ffffff' : '#ff4422'}`,
                                fontFamily: 'inherit', fontSize: '14px',
                                cursor: 'pointer',
                                textTransform: 'uppercase',
                                transform: pauseSelectedIndex === 1 ? 'scale(1.1)' : 'scale(1.0)',
                                transition: 'all 0.1s ease-in-out',
                                boxShadow: pauseSelectedIndex === 1 ? '0 0 15px rgba(255, 255, 255, 0.2)' : 'none'
                            }}
                        >
                            {pauseSelectedIndex === 1 ? `> ${vazarText} <` : vazarText}
                        </div>
                    </div>
                </div>
            )}

            <MobileControls />
        </>
    );
};

export default GameCanvas;
