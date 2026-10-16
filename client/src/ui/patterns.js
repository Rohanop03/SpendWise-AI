/** Six greyscale category patterns; fills reference ids defined once in <SvgDefs/>. */
export const PATTERNS = [
  { fill: 'url(#pat-solid)', id: 'pat-solid', label: 'Solid ink' },
  { fill: 'url(#pat-hatch)', id: 'pat-hatch', label: 'Diagonal hatch' },
  { fill: 'url(#pat-60)', id: 'pat-60', label: '60% grey' },
  { fill: 'url(#pat-dots)', id: 'pat-dots', label: 'Dot halftone' },
  { fill: 'url(#pat-30)', id: 'pat-30', label: '30% grey' },
  { fill: 'url(#pat-outline)', id: 'pat-outline', label: 'Outline' },
];

export function patternFor(index) {
  return PATTERNS[index % PATTERNS.length];
}
