import type { HoursWindow } from './types';

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hour: number;
  minute: number;
  minutes: number;
}

export interface OpenStatus {
  state: 'open' | 'closed' | 'unknown';
  /** Plain-language status. Does not mean the restroom is vacant. */
  label: string;
  detail: string | null;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function parseClock(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour === 24 && minute === 0) return 24 * 60;
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function formatClock(value: string): string {
  const mins = parseClock(value);
  if (mins == null) return value;
  const normalized = mins === 1440 ? 0 : mins;
  const hour24 = Math.floor(normalized / 60) % 24;
  const minute = normalized % 60;
  const suffix = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minute.toString().padStart(2, '0')} ${suffix}`;
}

export function formatDayList(days: number[]): string {
  const unique = [...new Set(days)].filter((day) => day >= 0 && day <= 6).sort((a, b) => a - b);
  if (unique.length === 0) return 'No days';
  if (unique.length === 7) return 'Every day';
  const groups: number[][] = [];
  for (const day of unique) {
    const last = groups[groups.length - 1];
    if (last && last[last.length - 1] === day - 1) last.push(day);
    else groups.push([day]);
  }
  return groups
    .map((group) =>
      group.length >= 3
        ? `${DAY_NAMES[group[0]]}–${DAY_NAMES[group[group.length - 1]]}`
        : group.map((day) => DAY_NAMES[day]).join(', '),
    )
    .join(', ');
}

export function formatHoursList(hours: HoursWindow[] | null): string[] {
  if (hours == null) return ['Unknown'];
  if (hours.length === 0) return ['No open hours listed'];
  return hours.map((window) => {
    if (window.open === '00:00' && window.close === '24:00') {
      return `${formatDayList(window.days)}, 24 hours`;
    }
    return `${formatDayList(window.days)}, ${formatClock(window.open)}–${formatClock(window.close)}`;
  });
}

export function getZonedParts(now: Date, timeZone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const bag: Record<string, string> = {};
  for (const part of fmt.formatToParts(now)) {
    if (part.type !== 'literal') bag[part.type] = part.value;
  }
  let hour = Number(bag.hour);
  if (hour === 24) hour = 0;
  const minute = Number(bag.minute);
  const weekday = WEEKDAY_INDEX[bag.weekday];
  if (weekday == null || Number.isNaN(hour) || Number.isNaN(minute)) {
    throw new Error(`Could not read time zone ${timeZone}`);
  }
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    weekday,
    hour,
    minute,
    minutes: hour * 60 + minute,
  };
}

function minutesToClock(mins: number): string {
  if (mins === 1440) return '24:00';
  const hour = Math.floor(mins / 60);
  const minute = mins % 60;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

function windowIsOpen(window: HoursWindow, weekday: number, minutes: number): { endLabel: string } | null {
  const start = parseClock(window.open);
  const end = parseClock(window.close);
  if (start == null || end == null || start === end || start === 1440) return null;
  if (end > start) {
    if (window.days.includes(weekday) && minutes >= start && minutes < end) {
      if (start === 0 && end === 1440) return { endLabel: '24 hours' };
      return { endLabel: `until ${formatClock(minutesToClock(end))}` };
    }
    return null;
  }
  if (window.days.includes(weekday) && minutes >= start) {
    return { endLabel: `until ${formatClock(minutesToClock(end))}` };
  }
  const previous = (weekday + 6) % 7;
  if (window.days.includes(previous) && minutes < end) {
    return { endLabel: `until ${formatClock(minutesToClock(end))}` };
  }
  return null;
}

function nextOpening(hours: HoursWindow[], weekday: number, minutes: number): string | null {
  let best: { offset: number; start: number } | null = null;
  for (let offset = 0; offset <= 7; offset += 1) {
    const day = (weekday + offset) % 7;
    for (const window of hours) {
      if (!window.days.includes(day)) continue;
      const start = parseClock(window.open);
      const end = parseClock(window.close);
      if (start == null || end == null || start === end || start === 1440) continue;
      if (offset === 0 && minutes >= start) continue;
      if (!best || offset < best.offset || (offset === best.offset && start < best.start)) {
        best = { offset, start };
      }
    }
  }
  if (!best) return null;
  const when =
    best.offset === 0 ? 'Today' : best.offset === 1 ? 'Tomorrow' : DAY_NAMES[(weekday + best.offset) % 7];
  return `${when} ${formatClock(minutesToClock(best.start))}`;
}

export function getOpenStatus(hours: HoursWindow[] | null, timeZone: string, now: Date): OpenStatus {
  if (hours == null) {
    return { state: 'unknown', label: 'Hours: unknown', detail: null };
  }
  if (hours.length === 0) {
    return { state: 'closed', label: 'Hours: closed now', detail: 'No open hours listed' };
  }
  let parts: ZonedParts;
  try {
    parts = getZonedParts(now, timeZone);
  } catch {
    return { state: 'unknown', label: 'Hours: unknown', detail: 'Time zone could not be read' };
  }
  for (const window of hours) {
    const open = windowIsOpen(window, parts.weekday, parts.minutes);
    if (open) {
      return { state: 'open', label: 'Hours: open now', detail: open.endLabel };
    }
  }
  const next = nextOpening(hours, parts.weekday, parts.minutes);
  return {
    state: 'closed',
    label: 'Hours: closed now',
    detail: next ? `Opens ${next}` : null,
  };
}

export function formatTimestamp(iso: string | null, timeZone: string): string {
  if (!iso) return 'Unknown';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return 'Unknown';
  }
}
