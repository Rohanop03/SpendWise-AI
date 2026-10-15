const PRESET_IDS = new Set([
  'all_time',
  'this_month',
  'last_month',
  'last_3_months',
  'this_year',
  'last_12_months',
  'custom',
]);

export const DASHBOARD_PERIODS = [
  { id: 'all_time', label: 'All Time' },
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'last_3_months', label: 'Last 3 Months' },
  { id: 'this_year', label: 'This Year' },
  { id: 'last_12_months', label: 'Last 12 Months' },
  { id: 'custom', label: 'Custom' },
];

export function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getPresetRange(preset, today = new Date()) {
  const year = today.getFullYear();
  const month = today.getMonth();

  switch (preset) {
    case 'this_month':
      return {
        endDate: formatLocalDate(new Date(year, month + 1, 0)),
        startDate: formatLocalDate(new Date(year, month, 1)),
      };
    case 'last_month':
      return {
        endDate: formatLocalDate(new Date(year, month, 0)),
        startDate: formatLocalDate(new Date(year, month - 1, 1)),
      };
    case 'last_3_months':
      return {
        endDate: formatLocalDate(today),
        startDate: formatLocalDate(new Date(year, month - 2, 1)),
      };
    case 'this_year':
      return {
        endDate: formatLocalDate(today),
        startDate: formatLocalDate(new Date(year, 0, 1)),
      };
    case 'last_12_months':
      return {
        endDate: formatLocalDate(today),
        startDate: formatLocalDate(new Date(year - 1, month, today.getDate())),
      };
    default:
      return { endDate: '', startDate: '' };
  }
}

export function normalizePreset(value) {
  return PRESET_IDS.has(value) ? value : 'last_12_months';
}
