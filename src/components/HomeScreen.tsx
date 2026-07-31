import { isValidQuestion, QUESTION_LENGTH } from '../lib/question';
import { CASTING_METHOD_LABELS, type CastingMethod, type SessionCategory } from '../lib/session';
import { SESSION_CATEGORY_LABELS } from '../lib/sessionCategories';
import { BeijingDateTimeField } from './BeijingDateTimeField';

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

interface Props {
  question: string;
  category: SessionCategory | null;
  castingMethod: CastingMethod | null;
  physicalTimeInput: string;
  physicalTimeError: string;
  onQuestionChange(value: string): void;
  onCategoryChange(value: SessionCategory): void;
  onCastingMethodChange(value: CastingMethod): void;
  onPhysicalTimeChange(value: string): void;
  onStart(): void;
}

export function HomeScreen({
  question,
  category,
  castingMethod,
  physicalTimeInput,
  physicalTimeError,
  onQuestionChange,
  onCategoryChange,
  onCastingMethodChange,
  onPhysicalTimeChange,
  onStart,
}: Props) {
  const valid = isValidQuestion(question)
    && Boolean(category)
    && Boolean(castingMethod)
    && (castingMethod !== 'physical' || !physicalTimeError);
  return (
    <main className="home-screen">
      <div className="mountain-wash mountain-wash--left" />
      <div className="mountain-wash mountain-wash--right" />
      <section className="question-composition">
        <div className="brand-seal" aria-hidden="true">爻</div>
        <h1>心有所问</h1>
        <p className="home-lead">一事一占，凝神明问。六爻成象后，再由古籍证据与 AI 共同解读。</p>
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
            {(['digital', 'physical'] as const).map((method) => (
              <button
                type="button"
                key={method}
                className={castingMethod === method
                  ? 'casting-method-button casting-method-button--selected'
                  : 'casting-method-button'}
                aria-pressed={castingMethod === method}
                onClick={() => onCastingMethodChange(method)}
              >
                <strong>{CASTING_METHOD_LABELS[method]}</strong>
                <span>{method === 'digital' ? '应用内完成六轮 3D 模拟投掷' : '摇实体铜钱后逐爻录入钱象'}</span>
              </button>
            ))}
          </div>
        </div>
        {castingMethod === 'physical' && (
          <BeijingDateTimeField
            id="physical-cast-time"
            value={physicalTimeInput}
            error={physicalTimeError}
            disabled={false}
            helperText="默认当前时间，可修改到实际摇卦时刻"
            layout="wide"
            onChange={onPhysicalTimeChange}
          />
        )}
        <button className="primary-ink-button" type="button" disabled={!valid} onClick={onStart}>开始起卦</button>
        <p className="ritual-note">静心片刻，专注于一件事</p>
      </section>
    </main>
  );
}
