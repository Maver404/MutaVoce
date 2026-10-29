import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { engine } from './audio/AudioEngine';
import { connectEngine } from './audio/bridge';
import { useApp } from './state/store';
import './styles/app.css';

connectEngine();

if (import.meta.env.DEV) Object.assign(window, { __mv: { engine, store: useApp } });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
