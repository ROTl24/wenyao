import { Check, ChevronDown, Copy, RotateCcw, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  formatPlateExport,
  PLATE_EXPORT_FORMAT_LABELS,
  type PlateExportFormat,
} from '../lib/plateExport';
import type { DivinationSession } from '../lib/session';

const FORMAT_STORAGE_KEY = 'wenyao:plate-copy-format';
const COPY_SUCCESS_DURATION = 2200;
const FORMATS = Object.keys(PLATE_EXPORT_FORMAT_LABELS) as PlateExportFormat[];

function isPlateExportFormat(value: unknown): value is PlateExportFormat {
  return FORMATS.includes(value as PlateExportFormat);
}

function readStoredFormat(): PlateExportFormat {
  try {
    const stored = window.localStorage.getItem(FORMAT_STORAGE_KEY);
    return isPlateExportFormat(stored) ? stored : 'text';
  } catch {
    return 'text';
  }
}

function storeFormat(format: PlateExportFormat): void {
  try {
    window.localStorage.setItem(FORMAT_STORAGE_KEY, format);
  } catch {
    // 浏览器禁用本地存储时，格式选择仍在当前页面内有效。
  }
}

interface Props {
  session: DivinationSession;
}

export function PlateCopyControl({ session }: Props) {
  const [format, setFormat] = useState<PlateExportFormat>(readStoredFormat);
  const [copied, setCopied] = useState(false);
  const [fallbackText, setFallbackText] = useState('');
  const [exportError, setExportError] = useState('');
  const resetTimerRef = useRef<number | null>(null);
  const fallbackRef = useRef<HTMLTextAreaElement>(null);
  const label = PLATE_EXPORT_FORMAT_LABELS[format];

  useEffect(() => () => {
    if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
  }, []);

  useEffect(() => {
    setCopied(false);
    setFallbackText('');
    setExportError('');
  }, [session.id]);

  useEffect(() => {
    if (!fallbackText) return;
    fallbackRef.current?.focus();
    fallbackRef.current?.select();
  }, [fallbackText]);

  const copy = async () => {
    let content: string;
    try {
      content = formatPlateExport(session, format);
      setExportError('');
    } catch (error) {
      console.error('排盘复制失败', error);
      setCopied(false);
      setFallbackText('');
      setExportError('排盘复制暂时失败，请保留当前记录并稍后重试。');
      return;
    }
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(content);
      setFallbackText('');
      setCopied(true);
      if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = window.setTimeout(() => setCopied(false), COPY_SUCCESS_DURATION);
    } catch {
      setCopied(false);
      setFallbackText(content);
    }
  };

  const changeFormat = (next: PlateExportFormat) => {
    setFormat(next);
    setCopied(false);
    setExportError('');
    storeFormat(next);
  };

  return (
    <>
      <div className="plate-copy-stack">
        <div className="plate-copy-control">
          <button className={copied ? 'plate-copy-button plate-copy-button--copied' : 'plate-copy-button'} type="button" onClick={copy}>
            {copied ? <Check aria-hidden="true" size={15} /> : <Copy aria-hidden="true" size={15} />}
            <span aria-live="polite">{copied ? `已复制 · ${label}` : `复制排盘 · ${label}`}</span>
          </button>
          <label className="plate-copy-format">
            <span className="sr-only">排盘复制格式</span>
            <select aria-label="排盘复制格式" value={format} onChange={(event) => changeFormat(event.target.value as PlateExportFormat)}>
              {FORMATS.map((item) => <option key={item} value={item}>{PLATE_EXPORT_FORMAT_LABELS[item]}</option>)}
            </select>
            <ChevronDown aria-hidden="true" size={14} />
          </label>
        </div>
        {exportError ? <p className="plate-copy-error" role="alert">{exportError}</p> : null}
      </div>

      {fallbackText ? (
        <div className="plate-copy-fallback-backdrop" role="presentation">
          <section aria-labelledby="plate-copy-fallback-title" aria-modal="true" className="plate-copy-fallback" role="dialog">
            <button aria-label="关闭手动复制窗口" className="plate-copy-fallback-close" type="button" onClick={() => setFallbackText('')}>
              <X aria-hidden="true" size={18} />
            </button>
            <p className="plate-copy-fallback-kicker">剪贴板未授权</p>
            <h3 id="plate-copy-fallback-title">请手动复制排盘</h3>
            <p>内容已为你完整选中。可按 Ctrl+C 复制，再粘贴给外部大模型。</p>
            <textarea aria-label="可手动复制的排盘内容" readOnly ref={fallbackRef} value={fallbackText} />
            <div className="plate-copy-fallback-actions">
              <button type="button" onClick={copy}><RotateCcw aria-hidden="true" size={15} />再次尝试复制</button>
              <button type="button" onClick={() => setFallbackText('')}>完成</button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
