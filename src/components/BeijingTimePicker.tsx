import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface Props {
  id: string;
  value: string;
  now: string;
  onApply(value: string): void;
  onClear(): void;
}

function parseTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59
    ? { hour: match[1], minute: match[2] }
    : null;
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function BeijingTimePicker({
  id,
  value,
  now,
  onApply,
  onClear,
}: Props) {
  const initialTime = parseTime(value) ?? parseTime(now)!;
  const [hour, setHour] = useState(initialTime.hour);
  const [minute, setMinute] = useState(initialTime.minute);
  const hourNumber = Number(hour);
  const minuteNumber = Number(minute);
  const valid = /^\d{1,2}$/.test(hour)
    && /^\d{1,2}$/.test(minute)
    && hourNumber >= 0
    && hourNumber <= 23
    && minuteNumber >= 0
    && minuteNumber <= 59;

  function stepHour(delta: number) {
    const current = Number.isInteger(hourNumber) && hourNumber >= 0 && hourNumber <= 23
      ? hourNumber
      : 0;
    setHour(pad((current + delta + 24) % 24));
  }

  function stepMinute(delta: number) {
    const current = Number.isInteger(minuteNumber) && minuteNumber >= 0 && minuteNumber <= 59
      ? minuteNumber
      : 0;
    setMinute(pad((current + delta + 60) % 60));
  }

  function apply() {
    if (valid) {
      onApply(`${pad(hourNumber)}:${pad(minuteNumber)}`);
    }
  }

  return (
    <div
      id={id}
      className="beijing-date-time-field__popover beijing-date-time-field__popover--time"
      role="dialog"
      aria-label="选择起卦时刻"
      onKeyDown={(event) => {
        if (event.key === 'Enter' && valid) {
          event.preventDefault();
          apply();
        }
      }}
    >
      <header className="beijing-time-picker__header">
        <strong>选择时刻</strong>
        <small>24 小时制</small>
      </header>

      <div className="beijing-time-picker__fields">
        <div className="beijing-time-picker__field">
          <span>时</span>
          <button type="button" aria-label="小时加一" onClick={() => stepHour(1)}>
            <ChevronUp size={17} aria-hidden="true" />
          </button>
          <input
            type="number"
            min={0}
            max={23}
            inputMode="numeric"
            aria-label="小时"
            value={hour}
            onChange={(event) => setHour(event.target.value)}
          />
          <button type="button" aria-label="小时减一" onClick={() => stepHour(-1)}>
            <ChevronDown size={17} aria-hidden="true" />
          </button>
        </div>
        <i aria-hidden="true">:</i>
        <div className="beijing-time-picker__field">
          <span>分</span>
          <button type="button" aria-label="分钟加一" onClick={() => stepMinute(1)}>
            <ChevronUp size={17} aria-hidden="true" />
          </button>
          <input
            type="number"
            min={0}
            max={59}
            inputMode="numeric"
            aria-label="分钟"
            value={minute}
            onChange={(event) => setMinute(event.target.value)}
          />
          <button type="button" aria-label="分钟减一" onClick={() => stepMinute(-1)}>
            <ChevronDown size={17} aria-hidden="true" />
          </button>
        </div>
      </div>

      <footer className="beijing-time-picker__footer">
        <button type="button" onClick={onClear}>清空</button>
        <button type="button" disabled={!valid} onClick={apply}>确定</button>
      </footer>
    </div>
  );
}
