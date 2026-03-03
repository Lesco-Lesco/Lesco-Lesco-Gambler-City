import React, { useEffect, useState } from 'react';
import { InputManager } from '../game/Core/InputManager';
import Joystick from './Joystick';

const MobileControls: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [isPortrait, setIsPortrait] = useState(false);

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
        return () => {
            window.removeEventListener('resize', check);
            window.removeEventListener('orientationchange', check);
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

    return (
        <div className="mobile-controls">
            {/* LEFT SIDE — Joystick */}
            <Joystick size={Math.min(window.innerWidth * 0.22, window.innerHeight * 0.35)} />

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
