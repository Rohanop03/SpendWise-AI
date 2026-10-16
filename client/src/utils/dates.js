import dayjs from 'dayjs';

/** Whole days from today (local) until an ISO `YYYY-MM-DD` date. Negative when past. */
export function daysUntil(isoDate, today = dayjs()) {
  if (!isoDate) return null;
  const target = dayjs(isoDate);
  if (!target.isValid()) return null;
  return target.startOf('day').diff(today.startOf('day'), 'day');
}

/** "today", "tomorrow", "in 5 days", "3 days ago". */
export function relativeDays(days) {
  if (days === null || days === undefined) return '';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  return days > 0 ? `in ${days} days` : `${Math.abs(days)} days ago`;
}

export function formatDate(isoDate, pattern = 'D MMM YYYY') {
  if (!isoDate) return '';
  const value = dayjs(isoDate);
  return value.isValid() ? value.format(pattern) : String(isoDate);
}

export function todayIso() {
  return dayjs().format('YYYY-MM-DD');
}

export function todayLabel() {
  return dayjs().format('ddd, D MMM');
}

export function monthLabel(isoDate) {
  return formatDate(isoDate, 'MMMM YYYY');
}
