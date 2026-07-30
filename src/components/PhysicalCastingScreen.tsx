import { ArrowLeft } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createTossFromValue, type LineValue } from '../lib/divination';
import {
  PHYSICAL_TOSS_OPTIONS,
  type PhysicalCastDraft,
} from '../lib/physicalCasting';
import { CastingProgress } from './CastingProgress';

const lineNames = ['第一爻', '第二爻', '第三爻', '第四爻', '第五爻', '第六爻'];

interface Props {
  draft: PhysicalCastDraft;
  onConfirm(value: LineValue): void;
  onCancel(): void;
}

export function PhysicalCastingScreen({ draft, onConfirm, onCancel }: Props) {
  const [selected, setSelected] = useState<LineValue | null>(null);
  const currentLineIndex = draft.lines.length + 1;
  const confirmed = useMemo(
    () => draft.lines.map((line) => createTossFromValue(line.value)),
    [draft.lines],
  );
  const preview = selected === null ? undefined : createTossFromValue(selected);

  useEffect(() => {
    setSelected(null);
  }, [draft.lines.length]);

  return (
    <main className="physical-casting-screen">
      <header className="physical-casting-intro">
        <button className="text-button" type="button" onClick={onCancel}>
          <ArrowLeft size={17} />
          返回问事
        </button>
        <span className="physical-route-badge">线下起卦</span>
        <h1>{lineNames[currentLineIndex - 1]}</h1>
        <p>摇动三枚实体铜钱，待钱象落定后，选择对应结果。</p>
      </header>

      <section className="physical-casting-panel" aria-labelledby="physical-options-title">
        <div className="physical-rule-note">
          <strong id="physical-options-title">记录本轮钱象</strong>
          <span>字面计 2，背面计 3；三枚铜钱合计成一爻</span>
        </div>
        <div className="physical-toss-options" role="group" aria-label={`${lineNames[currentLineIndex - 1]}钱象`}>
          {PHYSICAL_TOSS_OPTIONS.map((option) => {
            const toss = createTossFromValue(option.value);
            return (
              <button
                type="button"
                key={option.value}
                className={selected === option.value
                  ? 'physical-toss-option physical-toss-option--selected'
                  : 'physical-toss-option'}
                aria-pressed={selected === option.value}
                aria-label={`${option.countLabel}，${option.description}`}
                onClick={() => setSelected(option.value)}
              >
                <span className="physical-coin-faces" aria-hidden="true">
                  {toss.faces.map((face, index) => <i key={index}>{face === 'text' ? '字' : '背'}</i>)}
                </span>
                <strong>{option.countLabel}</strong>
                <small>{option.description}</small>
              </button>
            );
          })}
        </div>

        <div className="physical-toss-preview" aria-live="polite">
          {preview ? (
            <>
              <span>本爻预览</span>
              <strong>{preview.label} · {preview.value}</strong>
              <small>{preview.moving ? '动爻，成卦后阴阳将发生变化' : '静爻，变卦中保持不变'}</small>
            </>
          ) : (
            <>
              <span>本爻预览</span>
              <strong>请选择钱象</strong>
              <small>核对实体铜钱的字面与背面数量</small>
            </>
          )}
        </div>
        <button
          className="ritual-confirm"
          type="button"
          disabled={selected === null}
          onClick={() => {
            if (selected !== null) {
              const value = selected;
              setSelected(null);
              onConfirm(value);
            }
          }}
        >
          定此爻
        </button>
      </section>

      <CastingProgress
        confirmed={confirmed}
        currentLineIndex={currentLineIndex}
        preview={preview}
        currentStateLabel={selected === null ? '待选择' : '待确认'}
      />
    </main>
  );
}
