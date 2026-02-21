import React, { useEffect, useState } from 'react';
import { InputManager } from '../game/Core/InputManager';

const MobileControls: React.FC = () => {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
            const smallerScreen = window.innerWidth <= 1024; // Common breakpoint for mobile/tablets
            setIsMobile(hasTouch && smallerScreen);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    if (!isMobile) return null;

    const input = InputManager.getInstance();

    const handleTouch = (code: string, isPressed: boolean) => (e: React.TouchEvent | React.MouseEvent) => {
        e.preventDefault();
        input.setKeyState(code, isPressed);
    };

    return (
        <div className="mobile-controls">
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

            <div className="action-buttons">
                <button
                    className="mobile-btn interact"
                    onTouchStart={handleTouch('KeyE', true)}
                    onTouchEnd={handleTouch('KeyE', false)}
                    onMouseDown={handleTouch('KeyE', true)}
                    onMouseUp={handleTouch('KeyE', false)}
                >AÇÃO (E)</button>
            </div>
        </div>
    );
};

export default MobileControls;
