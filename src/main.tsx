import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(<App />);

if (import.meta.env.PROD && ['http:', 'https:'].includes(window.location.protocol)) {
  void import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: true });
  });
}
