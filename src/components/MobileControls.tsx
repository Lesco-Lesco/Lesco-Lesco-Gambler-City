import React, { useEffect, useState } from 'react';
import { InputManager } from '../game/Core/InputManager';
import type { InputContext } from '../game/Core/InputManager';
import Joystick from './Joystick';
import DPad from './DPad';

const MobileControls: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [isPortrait, setIsPortrait] = useState(false);
    const [context, setContext] = useState<InputContext>('exploration');
    const [activeMini, setActiveMini] = useState<string | null>(null);

    useEffect(() => {
        const check = () => {
            const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
            const smallScreen = Math.min(window.innerWidth, window.innerHeight) <= 1024;
            setIsVisible(hasTouch && smallScreen);
            setIsPortrait(window.innerHeight > window.innerWidth);
        };

        check();
        window.addEventListener('resize', check);
        window.addEventListener('orientationchange', check);
        
        // Poll for context or active minigame changes (InputManager is not a React state)
        const interval = setInterval(() => {
            const input = InputManager.getInstance();
            const currentContext = input.getContext();
            const currentMinigame = input.getActiveMinigame();

            setContext(prev => prev !== currentContext ? currentContext : prev);
            setActiveMini(prev => prev !== currentMinigame ? currentMinigame : prev);
        }, 100);

        return () => {
            window.removeEventListener('resize', check);
            window.removeEventListener('orientationchange', check);
            clearInterval(interval);
        };
    }, []);

    if (!isVisible) return null;

    if (isPortrait) {
        return (
            <div className="rotate-overlay">
                <div className="rotate-icon">📱↔️</div>
                <div className="rotate-text">Gire o celular para o modo paisagem</div>
                <div className="rotate-sub">O jogo funciona apenas na horizontal</div>
            </div>
        );
    }

    const input = InputManager.getInstance();

    const handleTouch = (code: string, isPressed: boolean) => (e: React.TouchEvent | React.MouseEvent) => {
        e.preventDefault();
        input.setKeyState(code, isPressed);
    };

    // Determine glow color based on context
    const getGlowColor = () => {
        if (context === 'casino') return '#44ff88'; // Bicho Green
        if (context === 'exploration') return '#00bbff'; // Night Blue
        return '#ff2d95'; // Minigame Pink
    };

    return (
        <div className="mobile-controls" style={{ '--glow-color': getGlowColor() } as React.CSSProperties}>
            {/* LEFT SIDE — Switch between Joystick (Exploration/Tank) and DPad (Minigames/Casino) */}
            {context === 'exploration' || activeMini === 'tank_attack' ? (
                <Joystick 
                    size={Math.min(window.innerWidth * 0.22, window.innerHeight * 0.35)} 
                    variant={activeMini === 'tank_attack' ? 'tank' : 'default'}
                />
            ) : (
                <DPad size={Math.min(window.innerWidth * 0.22, window.innerHeight * 0.35)} />
            )}

            {/* RIGHT SIDE — Action Buttons (Ergonomic Curve) */}
            <div className="action-buttons">
                <button
                    className="mobile-btn action-run"
                    onTouchStart={handleTouch('ShiftLeft', true)}
                    onTouchEnd={handleTouch('ShiftLeft', false)}
                    onMouseDown={handleTouch('ShiftLeft', true)}
                    onMouseUp={handleTouch('ShiftLeft', false)}
                >
                    RUN
                </button>

                <button
                    className="mobile-btn action-confirm"
                    onTouchStart={handleTouch('Space', true)}
                    onTouchEnd={handleTouch('Space', false)}
                    onMouseDown={handleTouch('Space', true)}
                    onMouseUp={handleTouch('Space', false)}
                >
                    OK
                </button>

                <button
                    className="mobile-btn action-interact"
                    onTouchStart={handleTouch('KeyE', true)}
                    onTouchEnd={handleTouch('KeyE', false)}
                    onMouseDown={handleTouch('KeyE', true)}
                    onMouseUp={handleTouch('KeyE', false)}
                >
                    E
                </button>

                <button
                    className="mobile-btn action-back"
                    onTouchStart={handleTouch('Escape', true)}
                    onTouchEnd={handleTouch('Escape', false)}
                    onMouseDown={handleTouch('Escape', true)}
                    onMouseUp={handleTouch('Escape', false)}
                >
                    ✕
                </button>
            </div>
        </div>
    );
};

export default MobileControls;
