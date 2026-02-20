import './game/Core/Polyfills';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

console.log('Main.tsx executing...');

// Debug Browser Zoom
if (window.devicePixelRatio !== 1) {
  console.warn(`%cBROWSER ZOOM DETECTED! Ratio: ${window.devicePixelRatio}. Please reset with Ctrl+0`, 'background: red; color: white; font-size: 20px;');
}


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
