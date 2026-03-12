import React from 'react';
import { InputManager } from '../game/Core/InputManager';

interface DPadProps {
    size?: number;
}

const DPad: React.FC<DPadProps> = ({ size = 160 }) => {
    const input = InputManager.getInstance();

    const handleTouch = (code: string, isPressed: boolean) => (e: React.TouchEvent | React.MouseEvent) => {
        e.preventDefault();
        input.setKeyState(code, isPressed);
    };

    const btnSize = size / 3;

    return (
        <div className="dpad-container" style={{ width: size, height: size }}>
            {/* UP */}
            <button
                className="dpad-btn dpad-up"
                style={{ width: btnSize, height: btnSize, top: 0, left: btnSize }}
                onTouchStart={handleTouch('ArrowUp', true)}
                onTouchEnd={handleTouch('ArrowUp', false)}
                onMouseDown={handleTouch('ArrowUp', true)}
                onMouseUp={handleTouch('ArrowUp', false)}
            >
                <span className="dpad-arrow">▲</span>
            </button>

            {/* DOWN */}
            <button
                className="dpad-btn dpad-down"
                style={{ width: btnSize, height: btnSize, bottom: 0, left: btnSize }}
                onTouchStart={handleTouch('ArrowDown', true)}
                onTouchEnd={handleTouch('ArrowDown', false)}
                onMouseDown={handleTouch('ArrowDown', true)}
                onMouseUp={handleTouch('ArrowDown', false)}
            >
                <span className="dpad-arrow">▼</span>
            </button>

            {/* LEFT */}
            <button
                className="dpad-btn dpad-left"
                style={{ width: btnSize, height: btnSize, top: btnSize, left: 0 }}
                onTouchStart={handleTouch('ArrowLeft', true)}
                onTouchEnd={handleTouch('ArrowLeft', false)}
                onMouseDown={handleTouch('ArrowLeft', true)}
                onMouseUp={handleTouch('ArrowLeft', false)}
            >
                <span className="dpad-arrow">◀</span>
            </button>

            {/* RIGHT */}
            <button
                className="dpad-btn dpad-right"
                style={{ width: btnSize, height: btnSize, top: btnSize, right: 0 }}
                onTouchStart={handleTouch('ArrowRight', true)}
                onTouchEnd={handleTouch('ArrowRight', false)}
                onMouseDown={handleTouch('ArrowRight', true)}
                onMouseUp={handleTouch('ArrowRight', false)}
            >
                <span className="dpad-arrow">▶</span>
            </button>

            {/* CENTER PIXEL */}
            <div className="dpad-center" style={{ width: btnSize, height: btnSize, top: btnSize, left: btnSize }} />
        </div>
    );
};

export default DPad;
