import { CalendarDays, Clock3 } from 'lucide-react';
import { formatShanghaiDateTimeInput } from '../lib/shanghaiTime';

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
  const noteId = `${id}-note`;
  const errorId = `${id}-error`;
  const describedBy = error ? errorId : helperText ? noteId : undefined;

  return (
    <div
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
          onClick={() => onChange(formatShanghaiDateTimeInput())}
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
              aria-describedby={describedBy}
              onChange={(event) => onChange(`${event.target.value}T${time}`)}
            />
            <CalendarDays size={17} aria-hidden="true" />
          </div>
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
              onChange={(event) => onChange(`${date}T${event.target.value}`)}
            />
            <Clock3 size={17} aria-hidden="true" />
          </div>
        </div>
      </div>

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
