const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

export function getLocalDate(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function addCalendarDays(dateString, days) {
  const match = datePattern.exec(dateString);
  if (!match) throw new Error('Calendar dates must use YYYY-MM-DD.');
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function isReminderEligible({ leadDays, localDate, targetDate }) {
  if (!targetDate) return false;
  const thresholdDate = addCalendarDays(targetDate, -leadDays);
  return localDate >= thresholdDate && localDate <= targetDate;
}

export function formatEventDate(dateString, timeZone) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'long',
    timeZone,
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

/** The calendar date "today" for a user, in their IANA timezone (UTC if unset or invalid). */
export function getUserToday(timeZone, instant = new Date()) {
  try {
    return getLocalDate(instant, timeZone || 'UTC');
  } catch {
    return getLocalDate(instant, 'UTC');
  }
}
