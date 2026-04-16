/**
 * Adaptive chart utilities — "Modo Camaleão"
 * Handles name truncation, data grouping, and smart labels.
 */

const MAX_VISIBLE_ITEMS = 5;

/**
 * Truncate a long name intelligently.
 * "João da Silva Pereira" → "João da S."
 */
export function truncateName(name: string, maxLen = 14): string {
  if (!name || name.length <= maxLen) return name;
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name.slice(0, maxLen) + '…';
  // Keep first name + abbreviate rest
  const first = parts[0];
  const abbrev = parts.slice(1).map(p => p[0]?.toUpperCase() + '.').join(' ');
  const result = `${first} ${abbrev}`;
  return result.length <= maxLen + 4 ? result : first.slice(0, maxLen) + '…';
}

/**
 * Group items beyond maxVisible into an "Outros" bucket.
 * Returns a new array with at most maxVisible + 1 items (if "Outros" is created).
 */
export function groupOthers<T extends Record<string, any>>(
  data: T[],
  valueKey: string,
  nameKey = 'name',
  maxVisible = MAX_VISIBLE_ITEMS,
): T[] {
  if (data.length <= maxVisible) return data;

  const sorted = [...data].sort((a, b) => (b[valueKey] as number) - (a[valueKey] as number));
  const visible = sorted.slice(0, maxVisible);
  const rest = sorted.slice(maxVisible);
  const othersValue = rest.reduce((sum, item) => sum + (item[valueKey] as number), 0);

  if (othersValue > 0) {
    const othersItem = {
      [nameKey]: `Outros (${rest.length})`,
      [valueKey]: othersValue,
    } as T;
    return [...visible, othersItem];
  }
  return visible;
}

/**
 * Custom pie label that shows only percentage (no overlapping text).
 */
export function renderPiePercent({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: any): React.ReactElement | null {
  if (percent < 0.03) return null; // hide tiny slices
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  // We need to return a JSX element but avoid importing React here.
  // This function is meant to be passed to Recharts' label prop.
  return null; // Will use a string-returning version instead
}

/**
 * Simple percent label for pie chart (string-based).
 */
export function piePercentLabel({ percent }: { percent: number }): string {
  if (percent < 0.03) return '';
  return `${(percent * 100).toFixed(0)}%`;
}

/**
 * Format currency for tooltip.
 */
export function tooltipCurrencyFormatter(value: number): string {
  return `R$ ${value.toFixed(2)}`;
}

/**
 * Determine chart height based on item count (for vertical bar charts).
 */
export function adaptiveBarHeight(itemCount: number, minHeight = 200, perItem = 40): number {
  return Math.max(minHeight, Math.min(itemCount * perItem, 400));
}
