import { BookOpen, BriefcaseBusiness, Coins, Heart, MapPinned, MoreHorizontal, Search, Stethoscope } from 'lucide-react';
import type { SessionCategory } from '../lib/session';

const categories: Array<{ id: SessionCategory; label: string; Icon: typeof BriefcaseBusiness }> = [
  { id: 'career', label: '事业工作', Icon: BriefcaseBusiness },
  { id: 'relationship', label: '感情婚姻', Icon: Heart },
  { id: 'wealth', label: '财运投资', Icon: Coins },
  { id: 'study', label: '学业考试', Icon: BookOpen },
  { id: 'health', label: '健康调养', Icon: Stethoscope },
  { id: 'lost_item', label: '寻人寻物', Icon: Search },
  { id: 'travel', label: '出行远近', Icon: MapPinned },
  { id: 'other', label: '其他', Icon: MoreHorizontal },
];

interface Props {
  question: string;
  category: SessionCategory | null;
  onQuestionChange(value: string): void;
  onCategoryChange(value: SessionCategory): void;
  onStart(): void;
}

export function HomeScreen({ question, category, onQuestionChange, onCategoryChange, onStart }: Props) {
  const valid = question.trim().length >= 10 && question.trim().length <= 500 && Boolean(category);
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
            maxLength={500}
          />
          <span className="character-count">{question.length} / 500</span>
        </div>
        <div className="category-field">
          <div className="field-label">选择事项</div>
          <div className="category-row">
            {categories.map(({ id, label, Icon }) => (
              <button
                type="button"
                key={id}
                className={category === id ? 'category-button category-button--selected' : 'category-button'}
                onClick={() => onCategoryChange(id)}
                aria-pressed={category === id}
              >
                <Icon size={19} strokeWidth={1.6} />
                <span>{label}</span>
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
