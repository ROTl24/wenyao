import { Download, Share2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { desktop } from '../lib/desktop';
import './PwaInstallPrompt.css';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type InstallMode = 'hidden' | 'prompt' | 'ios-help';

const DISMISS_KEY = 'wenyao-pwa-install-dismissed';

function isStandalone() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return (window.matchMedia?.('(display-mode: standalone)').matches ?? false)
    || navigatorWithStandalone.standalone === true;
}

function isAppleMobile() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function wasDismissed() {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === 'true';
  } catch {
    return false;
  }
}

function rememberDismissal() {
  try {
    window.localStorage.setItem(DISMISS_KEY, 'true');
  } catch {
    // The prompt still closes for this visit when browser storage is unavailable.
  }
}

export function PwaInstallPrompt() {
  const [mode, setMode] = useState<InstallMode>('hidden');
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    if (
      !import.meta.env.PROD
      || desktop.runtime.kind !== 'web'
      || !['http:', 'https:'].includes(window.location.protocol)
      || isStandalone()
      || wasDismissed()
    ) return;

    if (isAppleMobile()) setMode('ios-help');

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
      setMode('prompt');
    };
    const onInstalled = () => {
      rememberDismissal();
      setInstallPrompt(null);
      setMode('hidden');
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    rememberDismissal();
    setInstallPrompt(null);
    setMode('hidden');
  };

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    dismiss();
  };

  if (mode === 'hidden') return null;

  return (
    <aside className="pwa-install-card" aria-label="安装问爻手机版">
      <span className="pwa-install-card__icon" aria-hidden="true">
        {mode === 'prompt' ? <Download size={18} /> : <Share2 size={18} />}
      </span>
      <div>
        <strong>{mode === 'prompt' ? '安装到手机' : '添加到主屏幕'}</strong>
        <p>{mode === 'prompt'
          ? '安装后可独立打开，排盘、历史和内置古籍支持离线使用。'
          : '请在 Safari 点“分享”，再选“添加到主屏幕”。首次离线前请先完整打开一次。'}</p>
      </div>
      {mode === 'prompt' ? <button type="button" onClick={() => void install()}>安装</button> : null}
      <button className="pwa-install-card__close" type="button" aria-label="关闭安装提示" onClick={dismiss}><X size={17} /></button>
    </aside>
  );
}
