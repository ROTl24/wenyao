import { isValidQuestion, QUESTION_LENGTH } from '../lib/question';
import type { SessionCategory } from '../lib/session';
import { SESSION_CATEGORY_LABELS } from '../lib/sessionCategories';

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
  onQuestionChange(value: string): void;
  onCategoryChange(value: SessionCategory): void;
  onStart(): void;
}

export function HomeScreen({ question, category, onQuestionChange, onCategoryChange, onStart }: Props) {
  const valid = isValidQuestion(question) && Boolean(category);
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
        <button className="primary-ink-button" type="button" disabled={!valid} onClick={onStart}>开始起卦</button>
        <p className="ritual-note">静心片刻，专注于一件事</p>
      </section>
    </main>
  );
}
