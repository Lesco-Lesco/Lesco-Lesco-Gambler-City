import React, { useEffect, useState } from 'react';
import { InputManager } from '../game/Core/InputManager';

const MobileControls: React.FC = () => {
    const [isMobile, setIsMobile] = useState(false);
    const [isPortrait, setIsPortrait] = useState(false);

    useEffect(() => {
        const check = () => {
            const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
            const smallScreen = Math.min(window.innerWidth, window.innerHeight) <= 1024;
            setIsMobile(hasTouch && smallScreen);
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

    // Not mobile at all — hide everything
    if (!isMobile) return null;

    // Mobile + Portrait → block with rotate message
    if (isPortrait) {
        return (
            <div className="rotate-overlay">
                <div className="rotate-icon">📱↔️</div>
                <div className="rotate-text">Gire o celular para o modo paisagem</div>
                <div className="rotate-sub">O jogo funciona apenas na horizontal</div>
            </div>
        );
    }

    // Mobile + Landscape → show controls
    const input = InputManager.getInstance();

    const handleTouch = (code: string, isPressed: boolean) => (e: React.TouchEvent | React.MouseEvent) => {
        e.preventDefault();
        input.setKeyState(code, isPressed);
    };

    return (
        <div className="mobile-controls">
            {/* LEFT SIDE — D-Pad */}
            <div className="d-pad">
                <button
                    className="mobile-btn d-btn-up"
                    onTouchStart={handleTouch('ArrowUp', true)}
                    onTouchEnd={handleTouch('ArrowUp', false)}
                    onMouseDown={handleTouch('ArrowUp', true)}
                    onMouseUp={handleTouch('ArrowUp', false)}
                >↑</button>
                <button
                    className="mobile-btn d-btn-left"
                    onTouchStart={handleTouch('ArrowLeft', true)}
                    onTouchEnd={handleTouch('ArrowLeft', false)}
                    onMouseDown={handleTouch('ArrowLeft', true)}
                    onMouseUp={handleTouch('ArrowLeft', false)}
                >←</button>
                <button
                    className="mobile-btn d-btn-right"
                    onTouchStart={handleTouch('ArrowRight', true)}
                    onTouchEnd={handleTouch('ArrowRight', false)}
                    onMouseDown={handleTouch('ArrowRight', true)}
                    onMouseUp={handleTouch('ArrowRight', false)}
                >→</button>
                <button
                    className="mobile-btn d-btn-down"
                    onTouchStart={handleTouch('ArrowDown', true)}
                    onTouchEnd={handleTouch('ArrowDown', false)}
                    onMouseDown={handleTouch('ArrowDown', true)}
                    onMouseUp={handleTouch('ArrowDown', false)}
                >↓</button>
            </div>

            {/* RIGHT SIDE — Action Buttons */}
            <div className="action-buttons">
                <button
                    className="mobile-btn action-run"
                    onTouchStart={handleTouch('ShiftLeft', true)}
                    onTouchEnd={handleTouch('ShiftLeft', false)}
                    onMouseDown={handleTouch('ShiftLeft', true)}
                    onMouseUp={handleTouch('ShiftLeft', false)}
                >🏃</button>
                <button
                    className="mobile-btn action-confirm"
                    onTouchStart={handleTouch('Space', true)}
                    onTouchEnd={handleTouch('Space', false)}
                    onMouseDown={handleTouch('Space', true)}
                    onMouseUp={handleTouch('Space', false)}
                >OK</button>
                <button
                    className="mobile-btn action-interact"
                    onTouchStart={handleTouch('KeyE', true)}
                    onTouchEnd={handleTouch('KeyE', false)}
                    onMouseDown={handleTouch('KeyE', true)}
                    onMouseUp={handleTouch('KeyE', false)}
                >E</button>
                <button
                    className="mobile-btn action-back"
                    onTouchStart={handleTouch('Escape', true)}
                    onTouchEnd={handleTouch('Escape', false)}
                    onMouseDown={handleTouch('Escape', true)}
                    onMouseUp={handleTouch('Escape', false)}
                >✕</button>
            </div>
        </div>
    );
};

export default MobileControls;
