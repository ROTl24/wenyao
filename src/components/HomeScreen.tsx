import { isValidQuestion, QUESTION_LENGTH } from '../lib/question';
import {
  CASTING_METHOD_DESCRIPTIONS,
  CASTING_METHOD_LABELS,
  type CastingMethod,
} from '../lib/casting';
import type { SessionCategory } from '../lib/session';
import { SESSION_CATEGORY_LABELS } from '../lib/sessionCategories';
import { BeijingDateTimeField } from './BeijingDateTimeField';
import { CreatorLinks } from './CreatorLinks';
import { PwaInstallPrompt } from './PwaInstallPrompt';
import { desktop } from '../lib/desktop';

const categories: Array<{ id: SessionCategory; mark: string }> = [
  { id: 'career', mark: '事' },
  { id: 'relationship', mark: '情' },
  { id: 'wealth', mark: '财' },
  { id: 'study', mark: '学' },
  { id: 'health', mark: '养' },
  { id: 'lost_item', mark: '寻' },
  { id: 'travel', mark: '行' },
  { id: 'other', mark: '余' },
];

const castingMethods: readonly CastingMethod[] = ['digital', 'physical', 'random', 'time'];

interface Props {
  question: string;
  category: SessionCategory | null;
  castingMethod: CastingMethod | null;
  castingTimeInput: string;
  castingTimeError: string;
  starting: boolean;
  startError: string;
  onQuestionChange(value: string): void;
  onCategoryChange(value: SessionCategory): void;
  onCastingMethodChange(value: CastingMethod): void;
  onCastingTimeChange(value: string): void;
  onStart(): void;
}

export function HomeScreen({
  question,
  category,
  castingMethod,
  castingTimeInput,
  castingTimeError,
  starting,
  startError,
  onQuestionChange,
  onCategoryChange,
  onCastingMethodChange,
  onCastingTimeChange,
  onStart,
}: Props) {
  const valid = isValidQuestion(question)
    && Boolean(category)
    && Boolean(castingMethod)
    && (!castingMethod || !['physical', 'time'].includes(castingMethod) || !castingTimeError)
    && !starting;
  return (
    <main className="home-screen">
      <div className="mountain-wash mountain-wash--left" />
      <div className="mountain-wash mountain-wash--right" />
      <section className="question-composition">
        <div className="brand-seal" aria-hidden="true">爻</div>
        <h1>心有所问</h1>
        <p className="home-lead">{desktop.runtime.kind === 'web'
          ? '一事一占，凝神明问。起卦、排盘、历史与内置古籍均在本机运行。'
          : '一事一占，凝神明问。六爻成象后，再由古籍证据与 AI 共同解读。'}</p>
        <PwaInstallPrompt />
        <div className="question-field">
          <label htmlFor="question">所占之事</label>
          <textarea
            id="question"
            value={question}
            onChange={(event) => onQuestionChange(event.target.value)}
            placeholder="请写下一个具体、单一的问题，例如：未来三个月，我现在推进的项目能否顺利落地？"
            maxLength={QUESTION_LENGTH.max}
          />
          <span className="character-count">{question.length} / {QUESTION_LENGTH.max}</span>
        </div>
        <div className="category-field">
          <div className="field-label" id="category-label">选择事项</div>
          <div className="category-row" role="group" aria-labelledby="category-label">
            {categories.map(({ id, mark }) => (
              <button
                type="button"
                key={id}
                className={category === id ? 'category-button category-button--selected' : 'category-button'}
                onClick={() => onCategoryChange(id)}
                aria-pressed={category === id}
              >
                <span className="category-button__mark" aria-hidden="true">{mark}</span>
                <span className="category-button__label">{SESSION_CATEGORY_LABELS[id]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="casting-method-field">
          <div className="field-label" id="casting-method-label">选择起卦方式</div>
          <div className="casting-method-row" role="group" aria-labelledby="casting-method-label">
            {castingMethods.map((method) => (
              <button
                type="button"
                key={method}
                className={castingMethod === method
                  ? 'casting-method-button casting-method-button--selected'
                  : 'casting-method-button'}
                aria-pressed={castingMethod === method}
                onClick={() => onCastingMethodChange(method)}
                disabled={starting}
              >
                <strong>{CASTING_METHOD_LABELS[method]}</strong>
                <span>{CASTING_METHOD_DESCRIPTIONS[method]}</span>
              </button>
            ))}
          </div>
        </div>
        {(castingMethod === 'physical' || castingMethod === 'time') && (
          <BeijingDateTimeField
            id="casting-time"
            value={castingTimeInput}
            error={castingTimeError}
            disabled={starting}
            helperText={castingMethod === 'time'
              ? '默认当前时间，可修改到实际起念时刻；同一时辰内卦象相同'
              : '默认当前时间，可修改到实际摇卦时刻'}
            layout="wide"
            onChange={onCastingTimeChange}
          />
        )}
        <button className="primary-ink-button" type="button" disabled={!valid} onClick={onStart}>
          {starting ? '正在保存卦象…' : '开始起卦'}
        </button>
        {startError ? <p className="home-start-error" role="alert">{startError}</p> : null}
        <p className="ritual-note">静心片刻，专注于一件事</p>
        <CreatorLinks variant="compact" />
      </section>
    </main>
  );
}
