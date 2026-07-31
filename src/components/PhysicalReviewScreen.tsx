import { ArrowLeft, Check } from 'lucide-react';
import { useState } from 'react';
import { createTossFromValue, type LineValue } from '../lib/divination';
import {
  PHYSICAL_TOSS_OPTIONS,
  type PhysicalCastDraft,
} from '../lib/physicalCasting';
import { BeijingDateTimeField } from './BeijingDateTimeField';

const lineNames = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'];

interface Props {
  draft: PhysicalCastDraft;
  timeInput: string;
  timeError: string;
  finalizing: boolean;
  finalizeError: string;
  onTimeChange(value: string): void;
  onChangeLine(zeroIndex: number, value: LineValue): void;
  onConfirm(): void;
  onCancel(): void;
}

export function PhysicalReviewScreen({
  draft,
  timeInput,
  timeError,
  finalizing,
  finalizeError,
  onTimeChange,
  onChangeLine,
  onConfirm,
  onCancel,
}: Props) {
  const [editingLine, setEditingLine] = useState<number | null>(null);
  return (
    <main className="physical-review-screen" aria-busy={finalizing}>
      <header className="physical-review-header">
        <button className="text-button" type="button" disabled={finalizing} onClick={onCancel}>
          <ArrowLeft size={17} />
          放弃本次起卦
        </button>
        <span className="physical-route-badge">线下起卦 · 终审</span>
        <h1>六爻已成，请核对</h1>
        <p>确认六次实体钱象与起卦时间无误后，再建立排盘。</p>
      </header>

      <div className="physical-review-layout">
        <section className="physical-review-lines" aria-label="六爻钱象核对">
          {draft.lines.map((line, index) => {
            const toss = createTossFromValue(line.value);
            const option = PHYSICAL_TOSS_OPTIONS.find((item) => item.value === line.value)!;
            return (
              <article className="physical-review-line" key={index}>
                <span className="physical-review-line__position">{lineNames[index]}</span>
                <span className={`physical-review-line__mark physical-review-line__mark--${toss.baseYang ? 'yang' : 'yin'}`} aria-hidden="true"><i /><i /></span>
                <span className="physical-review-line__copy">
                  <strong>{option.countLabel} · {toss.label} {toss.value}</strong>
                  <small>{toss.moving ? '动爻' : '静爻'}</small>
                </span>
                <button
                  type="button"
                  aria-label={`修改${lineNames[index]}`}
                  disabled={finalizing}
                  onClick={() => setEditingLine(index)}
                >
                  修改
                </button>
                {editingLine === index && (
                  <div className="physical-review-editor" role="group" aria-label={`修改${lineNames[index]}`}>
                    {PHYSICAL_TOSS_OPTIONS.map((candidate) => (
                      <button
                        type="button"
                        key={candidate.value}
                        aria-pressed={candidate.value === line.value}
                        disabled={finalizing}
                        onClick={() => {
                          onChangeLine(index, candidate.value);
                          setEditingLine(null);
                        }}
                      >
                        <strong>{candidate.countLabel}</strong>
                        <small>{candidate.description}</small>
                      </button>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </section>

        <aside className="physical-review-summary">
          <BeijingDateTimeField
            id="physical-review-time"
            value={timeInput}
            error={timeError}
            disabled={finalizing}
            helperText=""
            layout="compact"
            onChange={onTimeChange}
          />
          <div className="physical-review-facts">
            <span>起卦方式<strong>线下起卦</strong></span>
            <span>铜钱规则<strong>字 2 · 背 3</strong></span>
            <span>已确认<strong>6 / 6 爻</strong></span>
          </div>
          {finalizeError && <p className="physical-finalize-error" role="alert">{finalizeError}</p>}
          <button
            className="primary-ink-button"
            type="button"
            disabled={Boolean(timeError) || finalizing}
            onClick={onConfirm}
          >
            <Check size={17} />
            {finalizing ? '正在保存…' : '确认并生成排盘'}
          </button>
          <small>确认后会保存本次记录，并进入古籍证据与 AI 解读流程。</small>
        </aside>
      </div>
    </main>
  );
}
