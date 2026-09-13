export function metric(value: number | null): string {
  return value === null ? '未知' : new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export function dateTime(value: string | null): string {
  if (!value) return '未知';
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(time) : '未知';
}
