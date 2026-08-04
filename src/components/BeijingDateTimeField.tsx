import { CalendarDays, Clock3 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatLunarDateLabel } from '../lib/lunarCalendar';
import { formatShanghaiDateTimeInput } from '../lib/shanghaiTime';
import { BeijingDatePicker } from './BeijingDatePicker';
import { BeijingTimePicker } from './BeijingTimePicker';

interface Props {
  id: string;
  value: string;
  error: string;
  disabled: boolean;
  helperText: string;
  layout: 'wide' | 'compact';
  onChange(value: string): void;
}

function splitDateTime(value: string) {
  const separatorIndex = value.indexOf('T');
  if (separatorIndex === -1) {
    return { date: value, time: '' };
  }
  return {
    date: value.slice(0, separatorIndex),
    time: value.slice(separatorIndex + 1),
  };
}

export function BeijingDateTimeField({
  id,
  value,
  error,
  disabled,
  helperText,
  layout,
  onChange,
}: Props) {
  const { date, time } = splitDateTime(value);
  const [openPicker, setOpenPicker] = useState<'date' | 'time' | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const dateTriggerRef = useRef<HTMLButtonElement>(null);
  const timeTriggerRef = useRef<HTMLButtonElement>(null);
  const noteId = `${id}-note`;
  const errorId = `${id}-error`;
  const lunarDateId = `${id}-lunar-date`;
  const describedBy = error ? errorId : helperText ? noteId : undefined;
  const lunarDateLabel = formatLunarDateLabel(date);
  const dateDescribedBy = error
    ? errorId
    : [describedBy, lunarDateLabel ? lunarDateId : null].filter(Boolean).join(' ') || undefined;
  const nowValue = formatShanghaiDateTimeInput();
  const { date: today, time: nowTime } = splitDateTime(nowValue);

  useEffect(() => {
    if (!openPicker) return undefined;
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpenPicker(null);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        const trigger = openPicker === 'date' ? dateTriggerRef.current : timeTriggerRef.current;
        trigger?.focus();
        setOpenPicker(null);
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openPicker]);

  useEffect(() => {
    if (disabled) setOpenPicker(null);
  }, [disabled]);

  function closePickerAndFocus(type: 'date' | 'time') {
    const trigger = type === 'date' ? dateTriggerRef.current : timeTriggerRef.current;
    trigger?.focus();
    setOpenPicker(null);
  }

  function openFromKeyboard(event: React.KeyboardEvent, type: 'date' | 'time') {
    if ((event.altKey && event.key === 'ArrowDown') || event.key === 'F4') {
      event.preventDefault();
      setOpenPicker(type);
    }
  }

  return (
    <div
      ref={rootRef}
      className={[
        'beijing-date-time-field',
        `beijing-date-time-field--${layout}`,
        error ? 'beijing-date-time-field--invalid' : '',
        disabled ? 'beijing-date-time-field--disabled' : '',
      ].filter(Boolean).join(' ')}
      role="group"
      aria-label="起卦时间（北京时间）"
      aria-describedby={describedBy}
    >
      <div className="beijing-date-time-field__heading">
        <span className="beijing-date-time-field__title">
          起卦时间
          <small>北京时间</small>
        </span>
        <button
          className="beijing-date-time-field__now"
          type="button"
          disabled={disabled}
          onClick={() => {
            setOpenPicker(null);
            onChange(formatShanghaiDateTimeInput());
          }}
          aria-label="使用当前北京时间"
        >
          此刻
        </button>
      </div>

      <div className="beijing-date-time-field__controls">
        <div className="beijing-date-time-field__segment">
          <label htmlFor={`${id}-date`}>日期</label>
          <div className="beijing-date-time-field__input-wrap">
            <input
              id={`${id}-date`}
              type="date"
              value={date}
              disabled={disabled}
              aria-invalid={Boolean(error)}
              aria-describedby={dateDescribedBy}
              onFocus={() => setOpenPicker(null)}
              onKeyDown={(event) => openFromKeyboard(event, 'date')}
              onChange={(event) => onChange(`${event.target.value}T${time}`)}
            />
            <button
              ref={dateTriggerRef}
              className="beijing-date-time-field__picker-trigger"
              type="button"
              disabled={disabled}
              aria-label="打开日期选择面板"
              aria-haspopup="dialog"
              aria-expanded={openPicker === 'date'}
              aria-controls={`${id}-date-picker`}
              onClick={() => setOpenPicker((current) => current === 'date' ? null : 'date')}
            >
              <CalendarDays size={17} aria-hidden="true" />
            </button>
          </div>
          {lunarDateLabel ? (
            <span
              id={lunarDateId}
              className="beijing-date-time-field__lunar-date"
              aria-live="polite"
            >
              {lunarDateLabel}
            </span>
          ) : null}
        </div>
        <div className="beijing-date-time-field__segment">
          <label htmlFor={`${id}-time`}>时刻</label>
          <div className="beijing-date-time-field__input-wrap">
            <input
              id={`${id}-time`}
              type="time"
              step={60}
              value={time}
              disabled={disabled}
              aria-invalid={Boolean(error)}
              aria-describedby={describedBy}
              onFocus={() => setOpenPicker(null)}
              onKeyDown={(event) => openFromKeyboard(event, 'time')}
              onChange={(event) => onChange(`${date}T${event.target.value}`)}
            />
            <button
              ref={timeTriggerRef}
              className="beijing-date-time-field__picker-trigger"
              type="button"
              disabled={disabled}
              aria-label="打开时刻选择面板"
              aria-haspopup="dialog"
              aria-expanded={openPicker === 'time'}
              aria-controls={`${id}-time-picker`}
              onClick={() => setOpenPicker((current) => current === 'time' ? null : 'time')}
            >
              <Clock3 size={17} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {openPicker === 'date' && (
        <BeijingDatePicker
          id={`${id}-date-picker`}
          value={date}
          today={today}
          onSelect={(nextDate) => {
            onChange(`${nextDate}T${time}`);
            closePickerAndFocus('date');
          }}
          onClear={() => {
            onChange(`T${time}`);
            closePickerAndFocus('date');
          }}
        />
      )}

      {openPicker === 'time' && (
        <BeijingTimePicker
          id={`${id}-time-picker`}
          value={time}
          now={nowTime}
          onApply={(nextTime) => {
            onChange(`${date}T${nextTime}`);
            closePickerAndFocus('time');
          }}
          onClear={() => {
            onChange(`${date}T`);
            closePickerAndFocus('time');
          }}
        />
      )}

      {(error || helperText) && (
        <div className="beijing-date-time-field__support">
          {error ? (
            <p id={errorId} role="alert">{error}</p>
          ) : (
            <span id={noteId}>{helperText}</span>
          )}
        </div>
      )}
    </div>
  );
}
