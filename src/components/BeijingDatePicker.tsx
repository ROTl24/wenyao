import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface Props {
  id: string;
  value: string;
  today: string;
  onSelect(value: string): void;
  onClear(): void;
}

interface DateParts {
  year: number;
  month: number;
  day: number;
}

interface CalendarDay extends DateParts {
  value: string;
  inCurrentMonth: boolean;
}

const weekDays = ['一', '二', '三', '四', '五', '六', '日'];

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function toDateValue({ year, month, day }: DateParts) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function parseDateValue(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  const instant = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return instant.getUTCFullYear() === parts.year
    && instant.getUTCMonth() + 1 === parts.month
    && instant.getUTCDate() === parts.day
    ? parts
    : null;
}

function calendarDays(year: number, month: number): CalendarDay[] {
  const firstWeekDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const mondayOffset = (firstWeekDay + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => {
    const instant = new Date(Date.UTC(year, month - 1, index - mondayOffset + 1));
    const parts = {
      year: instant.getUTCFullYear(),
      month: instant.getUTCMonth() + 1,
      day: instant.getUTCDate(),
    };
    return {
      ...parts,
      value: toDateValue(parts),
      inCurrentMonth: parts.year === year && parts.month === month,
    };
  });
}

export function BeijingDatePicker({
  id,
  value,
  today,
  onSelect,
  onClear,
}: Props) {
  const initialDate = parseDateValue(value) ?? parseDateValue(today)!;
  const [visibleMonth, setVisibleMonth] = useState({
    year: initialDate.year,
    month: initialDate.month,
  });
  const days = calendarDays(visibleMonth.year, visibleMonth.month);

  function changeMonth(delta: number) {
    const instant = new Date(Date.UTC(visibleMonth.year, visibleMonth.month - 1 + delta, 1));
    setVisibleMonth({
      year: instant.getUTCFullYear(),
      month: instant.getUTCMonth() + 1,
    });
  }

  return (
    <div
      id={id}
      className="beijing-date-time-field__popover beijing-date-time-field__popover--date"
      role="dialog"
      aria-label="选择起卦日期"
    >
      <header className="beijing-date-picker__header">
        <strong aria-live="polite">{visibleMonth.year}年{visibleMonth.month}月</strong>
        <div>
          <button type="button" aria-label="上个月" onClick={() => changeMonth(-1)}>
            <ChevronLeft size={17} aria-hidden="true" />
          </button>
          <button type="button" aria-label="下个月" onClick={() => changeMonth(1)}>
            <ChevronRight size={17} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="beijing-date-picker__week" aria-hidden="true">
        {weekDays.map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="beijing-date-picker__days">
        {days.map((day) => {
          const selected = day.value === value;
          const isToday = day.value === today;
          return (
            <button
              type="button"
              key={day.value}
              className={[
                !day.inCurrentMonth ? 'beijing-date-picker__day--adjacent' : '',
                selected ? 'beijing-date-picker__day--selected' : '',
                isToday ? 'beijing-date-picker__day--today' : '',
              ].filter(Boolean).join(' ')}
              aria-label={`${day.year}年${day.month}月${day.day}日`}
              aria-pressed={selected}
              aria-current={isToday ? 'date' : undefined}
              onClick={() => onSelect(day.value)}
            >
              {day.day}
            </button>
          );
        })}
      </div>

      <footer className="beijing-date-picker__footer">
        <button type="button" onClick={onClear}>清空</button>
        <button type="button" onClick={() => onSelect(today)}>今日</button>
      </footer>
    </div>
  );
}
