import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Restaurar tema guardado al iniciar
const THEMES: Record<string, { primary: string; bg: string; surface: string; id: string }> = {
  orange: { id:'orange', primary:'#ff8000', bg:'#0a0a0a', surface:'#171717' },
  blue:   { id:'blue',   primary:'#3b82f6', bg:'#0a0f1e', surface:'#111827' },
  green:  { id:'green',  primary:'#22c55e', bg:'#051a0a', surface:'#0f2d18' },
  purple: { id:'purple', primary:'#a855f7', bg:'#0d0a1e', surface:'#1a1030' },
  red:    { id:'red',    primary:'#ef4444', bg:'#0f0a0a', surface:'#1f1010' },
  cyan:   { id:'cyan',   primary:'#06b6d4', bg:'#020d12', surface:'#0c1f26' },
  light:  { id:'light',  primary:'#ff8000', bg:'#f5f5f5', surface:'#ffffff' },
};
const savedThemeId = localStorage.getItem('zigma_theme') || 'orange';
const t = THEMES[savedThemeId] || THEMES.orange;
const root = document.documentElement;
const isLight = t.id === 'light';
root.style.setProperty('--color-primary', t.primary);
root.style.setProperty('--color-background', t.bg);
root.style.setProperty('--color-surface', t.surface);
root.style.setProperty('--color-text', isLight ? '#111111' : '#ffffff');
root.style.setProperty('--color-text-muted', isLight ? '#555555' : '#a3a3a3');
root.style.setProperty('--color-border', isLight ? '#dddddd' : '#333333');
root.style.setProperty('--color-surface-hover', isLight ? '#eeeeee' : '#262626');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
