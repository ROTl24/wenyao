import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, RotateCcw, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ALMANAC_MAX_YEAR,
  ALMANAC_MIN_YEAR,
  buildAlmanacDetail,
  buildAlmanacMonth,
  currentAlmanacSelection,
  parseAlmanacDate,
  type AlmanacSelection,
} from '../lib/almanac';
import { StemBranchText } from './StemBranchText';
import './CalendarScreen.css';

interface Props {
  selection: AlmanacSelection;
  onSelectionChange(selection: AlmanacSelection): void;
  onClose(): void;
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
const YEARS = Array.from(
  { length: ALMANAC_MAX_YEAR - ALMANAC_MIN_YEAR + 1 },
  (_, index) => ALMANAC_MIN_YEAR + index,
);
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

function moveMonth(year: number, month: number, delta: number) {
  const instant = new Date(Date.UTC(year, month - 1 + delta, 1));
  if (instant.getUTCFullYear() < ALMANAC_MIN_YEAR) {
    return { year: ALMANAC_MIN_YEAR, month: 1 };
  }
  if (instant.getUTCFullYear() > ALMANAC_MAX_YEAR) {
    return { year: ALMANAC_MAX_YEAR, month: 12 };
  }
  return {
    year: instant.getUTCFullYear(),
    month: instant.getUTCMonth() + 1,
  };
}

export function CalendarScreen({ selection, onSelectionChange, onClose }: Props) {
  const selectedDate = parseAlmanacDate(selection.date);
  const [visibleMonth, setVisibleMonth] = useState({
    year: selectedDate.year,
    month: selectedDate.month,
  });
  const [periodPickerOpen, setPeriodPickerOpen] = useState(false);
  const periodPickerRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(() => currentAlmanacSelection());
  const detail = useMemo(() => buildAlmanacDetail(selection), [selection]);
  const days = useMemo(
    () => buildAlmanacMonth(visibleMonth.year, visibleMonth.month),
    [visibleMonth],
  );

  useEffect(() => {
    if (!periodPickerOpen) return;
    const selected = periodPickerRef.current?.querySelector<HTMLElement>('[data-selected-year="true"]');
    selected?.scrollIntoView?.({ block: 'center' });
  }, [periodPickerOpen]);

  function selectToday() {
    const next = currentAlmanacSelection();
    const parts = parseAlmanacDate(next.date);
    setCurrent(next);
    onSelectionChange(next);
    setVisibleMonth({ year: parts.year, month: parts.month });
    setPeriodPickerOpen(false);
  }

  function selectDate(date: string) {
    const parts = parseAlmanacDate(date);
    onSelectionChange({ ...selection, date });
    if (parts.year !== visibleMonth.year || parts.month !== visibleMonth.month) {
      setVisibleMonth({ year: parts.year, month: parts.month });
    }
  }

  function changeVisibleMonth(delta: number) {
    setVisibleMonth((month) => moveMonth(month.year, month.month, delta));
    setPeriodPickerOpen(false);
  }

  return (
    <main className="calendar-screen" aria-label="问爻日历">
      <div className="calendar-workspace">
        <section className="calendar-month-panel" aria-labelledby="calendar-month-heading">
          <header className="calendar-month-header">
            <div>
              <p className="calendar-section-mark"><CalendarDays size={16} aria-hidden="true" />公历与农历</p>
              <h1 id="calendar-month-heading">{visibleMonth.year}年{visibleMonth.month}月</h1>
            </div>
            <div className="calendar-month-actions">
              <button
                type="button"
                aria-label="上个月"
                disabled={visibleMonth.year === ALMANAC_MIN_YEAR && visibleMonth.month === 1}
                onClick={() => changeVisibleMonth(-1)}
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <div className="calendar-period-control">
                <button
                  type="button"
                  className="calendar-period-button"
                  aria-label="选择年份和月份"
                  aria-expanded={periodPickerOpen}
                  onClick={() => setPeriodPickerOpen((open) => !open)}
                >
                  {visibleMonth.year}年 · {visibleMonth.month}月
                  <ChevronDown size={15} aria-hidden="true" />
                </button>
                {periodPickerOpen ? (
                  <div className="calendar-period-picker" ref={periodPickerRef} role="dialog" aria-label="选择年份和月份">
                    <div className="calendar-year-list" role="listbox" aria-label="年份">
                      {YEARS.map((year) => (
                        <button
                          type="button"
                          role="option"
                          aria-selected={year === visibleMonth.year}
                          data-selected-year={year === visibleMonth.year}
                          key={year}
                          onClick={() => setVisibleMonth((month) => ({ ...month, year }))}
                        >
                          {year}年
                        </button>
                      ))}
                    </div>
                    <div className="calendar-month-list" role="listbox" aria-label="月份">
                      {MONTHS.map((month) => (
                        <button
                          type="button"
                          role="option"
                          aria-selected={month === visibleMonth.month}
                          key={month}
                          onClick={() => {
                            setVisibleMonth((period) => ({ ...period, month }));
                            setPeriodPickerOpen(false);
                          }}
                        >
                          {month}月
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="下个月"
                disabled={visibleMonth.year === ALMANAC_MAX_YEAR && visibleMonth.month === 12}
                onClick={() => changeVisibleMonth(1)}
              >
                <ChevronRight size={18} aria-hidden="true" />
              </button>
              <button type="button" className="calendar-today-button" onClick={selectToday}>
                <RotateCcw size={15} aria-hidden="true" />回到今日
              </button>
            </div>
          </header>

          <div className="calendar-weekdays" aria-hidden="true">
            {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
          </div>
          <div className="calendar-month-grid" role="grid" aria-label={`${visibleMonth.year}年${visibleMonth.month}月`}>
            {days.map((day, index) => {
              const selected = day.date === selection.date;
              const today = day.date === current.date;
              const weekend = index % 7 > 4;
              return (
                <button
                  type="button"
                  role="gridcell"
                  className={[
                    'calendar-day',
                    !day.inCurrentMonth ? 'calendar-day--adjacent' : '',
                    selected ? 'calendar-day--selected' : '',
                    today ? 'calendar-day--today' : '',
                    weekend ? 'calendar-day--weekend' : '',
                  ].filter(Boolean).join(' ')}
                  aria-label={`${day.year}年${day.month}月${day.day}日，${day.solarTerm || `农历${day.lunarLabel}`}`}
                  aria-selected={selected}
                  aria-current={today ? 'date' : undefined}
                  disabled={!day.selectable}
                  key={day.date}
                  onClick={() => selectDate(day.date)}
                >
                  <strong>{day.day}</strong>
                  <span className={day.solarTerm ? 'calendar-day__term' : ''}>{day.solarTerm || day.lunarLabel}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="calendar-detail-panel" aria-labelledby="calendar-detail-heading">
          <header className="calendar-detail-header">
            <div>
              <h2 id="calendar-detail-heading">{detail.gregorianLabel}</h2>
              <p>{detail.lunarLabel}</p>
            </div>
            <button type="button" className="calendar-close-button" onClick={onClose}>
              <X size={17} aria-hidden="true" />返回
            </button>
          </header>

          <div className="calendar-pillars" aria-label="四柱">
            {detail.pillars.map((pillar) => (
              <div key={pillar.label}>
                <span>{pillar.label}</span>
                <strong><StemBranchText value={pillar.value} /></strong>
              </div>
            ))}
          </div>

          <dl className="calendar-facts" aria-label="黄历详情">
            {detail.directions.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.direction}</dd>
              </div>
            ))}
            <div>
              <dt>值神</dt>
              <dd>{detail.dayGod.name}<span>·</span>{detail.dayGod.type}<span>·</span>{detail.dayGod.luck}</dd>
            </div>
            <div>
              <dt>冲煞</dt>
              <dd>{detail.clash}</dd>
            </div>
            <div>
              <dt>星宿</dt>
              <dd>{detail.mansion.name}<span>·</span>{detail.mansion.luck}</dd>
            </div>
            <div>
              <dt>建除</dt>
              <dd>{detail.construction}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="calendar-hours" aria-labelledby="calendar-hours-heading">
        <header>
          <h2 id="calendar-hours-heading">十二时辰</h2>
          <p>{detail.selectedHour.label} · {detail.selectedHour.rangeLabel} · {detail.selectedHour.pillar}时</p>
        </header>
        <div className="calendar-hour-grid" role="listbox" aria-label="选择时辰">
          {detail.hours.map((hour) => (
            <button
              type="button"
              role="option"
              aria-selected={hour.id === selection.hourId}
              className={hour.id === selection.hourId ? 'calendar-hour--selected' : ''}
              key={hour.id}
              onClick={() => onSelectionChange({ ...selection, hourId: hour.id })}
            >
              <strong>{hour.label}</strong>
              <span>{hour.rangeLabel}</span>
              <em><StemBranchText value={hour.pillar} /></em>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
