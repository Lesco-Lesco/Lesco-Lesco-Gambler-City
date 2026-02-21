import { useEffect, useRef } from 'react';
import { Renderer } from '../game/Core/Renderer';
import { GameLoop } from '../game/Core/Loop';
import type { ExplorationScene } from '../game/Scenes/ExplorationScene';
import type { CasinoScene } from '../game/Scenes/CasinoScene';
import type { GameOverScene } from '../game/Scenes/GameOverScene';
import { BichoManager } from '../game/BichoManager';
import MobileControls from './MobileControls';

const GameCanvas = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<{
        loop: GameLoop;
        renderer: Renderer;
        scene: ExplorationScene;
        casinoScene: CasinoScene;
        gameOverScene: GameOverScene;
    } | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const w = window.innerWidth;
        const h = window.innerHeight;

        let isMounted = true;
        let fpsInterval: number;

        const init = async () => {
            try {
                // Initialize renderer
                const renderer = new Renderer(canvas);
                const loop = new GameLoop(renderer.getContext());

                // Create scenes attempt
                let scene: ExplorationScene;
                let casinoScene: CasinoScene;
                let gameOverScene: GameOverScene;

                try {
                    const { ExplorationScene } = await import('../game/Scenes/ExplorationScene');
                    const { CasinoScene } = await import('../game/Scenes/CasinoScene');
                    const { GameOverScene } = await import('../game/Scenes/GameOverScene');

                    scene = new ExplorationScene(renderer, w, h);
                    casinoScene = new CasinoScene(w, h);
                    gameOverScene = new GameOverScene();

                    // Link Scenes
                    scene.onEnterCasino = () => {
                        // Clock system removed (Endless Night), Casino uses internal timers
                        loop.setScene('casino');
                    };

                    casinoScene.onSceneExitRequest = () => {
                        loop.setScene('exploration');
                    };

                    const handleGameOver = () => {
                        loop.setScene('gameover');
                    };

                    scene.onGameOver = handleGameOver;
                    casinoScene.onGameOver = handleGameOver;

                    gameOverScene.onRestart = () => {
                        // Reset global state
                        const bmanager = BichoManager.getInstance();
                        bmanager.playerMoney = 500; // Reset to starting amount
                        // We could also reset purrinha player money or other attributes if needed
                        loop.setScene('exploration');
                    };

                    console.log("Scenes initialized successfully");
                } catch (sceneErr: any) {
                    console.error("Scene Load Error:", sceneErr);
                    throw new Error("Scene Constructor/Module Failed: " + sceneErr.message);
                }

                if (!isMounted) return;

                // Register scenes
                loop.addScene(scene);
                loop.addScene(casinoScene);
                loop.addScene(gameOverScene);
                loop.setScene('exploration');

                // Start loop
                loop.start();
                engineRef.current = { loop, renderer, scene, casinoScene, gameOverScene };

                // Handle resize
                const handleResize = () => {
                    const dpr = window.devicePixelRatio || 1;
                    const rw = window.innerWidth * dpr;
                    const rh = window.innerHeight * dpr;

                    // Update canvas internal resolution
                    if (canvas) {
                        canvas.width = rw;
                        canvas.height = rh;
                    }

                    renderer.resize(rw, rh);
                    if (scene) scene.resize(rw, rh);
                    if (gameOverScene) gameOverScene.resize(rw, rh);
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
            <MobileControls />
        </>
    );
};

export default GameCanvas;
