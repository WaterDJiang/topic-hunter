import { expect, it } from 'vitest';
import { DEFAULT_RULES, matchingRules } from '../src/domain/rules';
import { EMPTY_METRICS, type Post } from '../src/domain/types';

it('filters 10,000 local posts and reports the v1 domain performance measurement', () => {
  const now = new Date('2026-09-13T12:00:00.000Z');
  const posts: Post[] = Array.from({ length: 10_000 }, (_, index) => ({
    id: String(10_000_000_000_000_000n + BigInt(index)), url: `https://x.com/sample/status/${10_000_000_000_000_000n + BigInt(index)}`,
    text: `第 ${index} 条：一个简短但值得写的观点。`, authorId: '55', authorHandle: 'sample',
    publishedAt: '2026-09-13T08:00:00.000Z', capturedAt: '2026-09-13T09:00:00.000Z', lastSeenAt: '2026-09-13T10:00:00.000Z',
    isComplete: true, quotedPostId: null, language: 'zh', saved: false,
    latestMetrics: { ...EMPTY_METRICS, views: 12_000, likes: 120, replies: 25, followers: 1200 }, latestMetricSource: 'graphql',
  }));
  const durations: number[] = [];
  for (let run = 0; run < 5; run += 1) {
    const start = performance.now();
    const result = posts.filter(post => matchingRules(post, DEFAULT_RULES, now).length > 0);
    durations.push(performance.now() - start);
    expect(result).toHaveLength(10_000);
  }
  durations.sort((a, b) => a - b);
  const p95 = durations[Math.ceil(durations.length * .95) - 1] ?? Infinity;
  console.info(`domain filter: 10,000 posts, p95=${p95.toFixed(1)}ms, node=${process.version}`);
  if (process.env.TOPIC_HUNTER_PERF_ASSERT === '1') expect(p95).toBeLessThanOrEqual(500);
});
