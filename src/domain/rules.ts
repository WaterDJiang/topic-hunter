import type { CaptureRule, Metrics, Post } from './types';

export const DEFAULT_RULES: CaptureRule[] = [
  { id: 'high-interaction', enabled: true, maxCharacters: 280, maxAgeDays: 7, maxFollowers: null, minViews: 10_000, minLikes: 100, minReplies: 20 },
  { id: 'small-account', enabled: true, maxCharacters: 280, maxAgeDays: 7, maxFollowers: 10_000, minViews: null, minLikes: 30, minReplies: 10 },
];

export function visibleCharacters(text: string): number {
  return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].length;
}

export function ruleReasons(post: Pick<Post, 'text' | 'isComplete' | 'publishedAt' | 'latestMetrics'>, rule: CaptureRule, now = new Date()): string[] {
  if (!rule.enabled || !post.isComplete || visibleCharacters(post.text) > rule.maxCharacters || !post.publishedAt) return [];
  const age = now.getTime() - Date.parse(post.publishedAt);
  if (!Number.isFinite(age) || age < 0 || age > rule.maxAgeDays * 86_400_000) return [];
  const metrics = post.latestMetrics;
  if (rule.maxFollowers !== null && (metrics.followers === null || metrics.followers > rule.maxFollowers)) return [];
  const thresholds: [keyof Metrics, number | null, string][] = [
    ['views', rule.minViews, '阅读'],
    ['likes', rule.minLikes, '点赞'],
    ['replies', rule.minReplies, '回复'],
  ];
  return thresholds.flatMap(([key, minimum, label]) => {
    const value = metrics[key];
    return minimum !== null && value !== null && value >= minimum
      ? [`${label} ${value.toLocaleString('zh-CN')} ≥ ${minimum.toLocaleString('zh-CN')}`]
      : [];
  });
}

export function matchingRules(post: Post, rules: CaptureRule[], now = new Date()): { rule: CaptureRule; reasons: string[] }[] {
  return rules.flatMap(rule => {
    const reasons = ruleReasons(post, rule, now);
    return reasons.length ? [{ rule, reasons }] : [];
  });
}
