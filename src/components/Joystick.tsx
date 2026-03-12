import React, { useRef, useState, useEffect } from 'react';
import { InputManager } from '../game/Core/InputManager';

interface JoystickProps {
    onMove?: (x: number, y: number) => void;
    size?: number;
    variant?: 'default' | 'tank';
}

const Joystick: React.FC<JoystickProps> = ({ onMove, size = 120, variant = 'default' }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const input = InputManager.getInstance();

    const handleStart = (clientX: number, clientY: number) => {
        setIsDragging(true);
        processInput(clientX, clientY);
    };

    const processInput = (clientX: number, clientY: number) => {
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        let dx = clientX - centerX;
        let dy = clientY - centerY;

        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDistance = rect.width / 2;

        if (distance > maxDistance) {
            dx = (dx / distance) * maxDistance;
            dy = (dy / distance) * maxDistance;
        }

        const normalizedX = dx / maxDistance;
        const normalizedY = dy / maxDistance;

        setPos({ x: dx, y: dy });
        input.setJoystickVector(normalizedX, normalizedY);
        if (onMove) onMove(normalizedX, normalizedY);
    };

    const handleMove = (clientX: number, clientY: number) => {
        if (!isDragging) return;
        processInput(clientX, clientY);
    };

    const handleEnd = () => {
        setIsDragging(false);
        setPos({ x: 0, y: 0 });
        input.setJoystickVector(0, 0);
        if (onMove) onMove(0, 0);
    };

    useEffect(() => {
        const onTouchMove = (e: TouchEvent) => {
            if (isDragging && e.touches.length > 0) {
                handleMove(e.touches[0].clientX, e.touches[0].clientY);
            }
        };

        const onMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                handleMove(e.clientX, e.clientY);
            }
        };

        const onEnd = () => handleEnd();

        if (isDragging) {
            window.addEventListener('touchmove', onTouchMove, { passive: false });
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('touchend', onEnd);
            window.addEventListener('mouseup', onEnd);
        }

        return () => {
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('touchend', onEnd);
            window.removeEventListener('mouseup', onEnd);
        };
    }, [isDragging]);

    return (
        <div
            ref={containerRef}
            className={`joystick-container variant-${variant}`}
            style={{ width: size, height: size }}
            onTouchStart={(e) => {
                if (e.touches.length > 0) {
                    handleStart(e.touches[0].clientX, e.touches[0].clientY);
                }
            }}
            onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
        >
            <div
                className="joystick-ring"
                style={{ width: size, height: size }}
            />
            <div
                className="joystick-knob"
                style={{
                    transform: `translate(${pos.x}px, ${pos.y}px)`,
                    width: size * 0.45,
                    height: size * 0.45
                }}
            />
        </div>
    );
};

export default Joystick;
