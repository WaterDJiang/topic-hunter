import { describe, expect, it } from 'vitest';
import { extractPosts, validateCapturedPost } from '../src/domain/capture';
import { averageViewsPerHour, observedGrowth } from '../src/domain/metrics';
import { DEFAULT_RULES, matchingRules, visibleCharacters } from '../src/domain/rules';
import { EMPTY_METRICS, type MetricObservation, type Post } from '../src/domain/types';
import { createBackup, parseBackup } from '../src/lib/backup';
import { DEFAULT_SETTINGS } from '../src/domain/settings';

const createdAt = 'Sun Sep 13 08:00:00 +0000 2026';

function tweet(id: string, text: string, options: { quote?: string; truncated?: boolean; views?: string } = {}) {
  return {
    __typename: 'Tweet', rest_id: id,
    core: { user_results: { result: { rest_id: '55', legacy: { screen_name: 'sample', followers_count: 1200 } } } },
    legacy: {
      full_text: text, created_at: createdAt, favorite_count: 130, reply_count: 25,
      retweet_count: 6, bookmark_count: 2, lang: 'zh', truncated: options.truncated ?? false,
      quoted_status_id_str: options.quote,
    },
    views: options.views === undefined ? undefined : { count: options.views },
  };
}

function post(metrics = { ...EMPTY_METRICS, views: 12_000, likes: 120, replies: 25, followers: 1200 }): Post {
  return {
    id: '123456789012345678', url: 'https://x.com/sample/status/123456789012345678',
    text: '一个简短但值得展开的观点。', authorId: '55', authorHandle: 'sample',
    publishedAt: '2026-09-13T08:00:00.000Z', capturedAt: '2026-09-13T09:00:00.000Z',
    lastSeenAt: '2026-09-13T09:00:00.000Z', saved: false, isComplete: true,
    quotedPostId: null, language: 'zh', latestMetrics: metrics, latestMetricSource: 'graphql',
  };
}

function observation(views: number | null, observedAt: string): MetricObservation {
  return { id: crypto.randomUUID(), postId: '123456789012345678', observedAt, source: 'graphql', metrics: { ...EMPTY_METRICS, views } };
}

describe('X response extraction', () => {
  it('keeps quote text separate and preserves unknown metrics', () => {
    const original = tweet('123456789012345678', '我自己的观点', { quote: '223456789012345678' });
    const quoted = tweet('223456789012345678', '被引用的原文', { views: '25000' });
    const found = extractPosts({ data: { entries: [{ content: { itemContent: { tweet_results: { result: { ...original, quoted_status_result: { result: quoted } } } } } }] } });
    expect(found).toHaveLength(2);
    expect(found.find(item => item.id === original.rest_id)).toMatchObject({ text: '我自己的观点', quotedPostId: quoted.rest_id, metrics: { views: null, likes: 130 } });
    expect(found.find(item => item.id === quoted.rest_id)?.text).toBe('被引用的原文');
  });

  it('marks truncated text incomplete, but accepts complete note text', () => {
    const partial = tweet('123456789012345678', '长帖开头…', { truncated: true });
    expect(extractPosts(partial)[0]?.isComplete).toBe(false);
    const withNote = { ...partial, note_tweet: { note_tweet_results: { result: { text: '这是一条完整的长帖正文' } } } };
    expect(extractPosts(withNote)[0]).toMatchObject({ text: '这是一条完整的长帖正文', isComplete: true });
  });

  it('rejects unsafe or malformed page messages and strips extras', () => {
    const item = extractPosts(tweet('123456789012345678', '测试正文'))[0];
    expect(item).toBeDefined();
    expect(validateCapturedPost({ ...item, cookie: 'secret' })).not.toHaveProperty('cookie');
    expect(validateCapturedPost({ ...item, metrics: { ...item?.metrics, likes: -5 } })).toBeNull();
    expect(validateCapturedPost({ ...item, url: 'https://evil.example/post' })).toBeNull();
  });
});

describe('candidate rules and observations', () => {
  it('uses visible grapheme length, age and concrete metrics', () => {
    expect(visibleCharacters('你👨‍👩‍👧‍👦')).toBe(2);
    const matches = matchingRules(post(), DEFAULT_RULES, new Date('2026-09-13T10:00:00Z'));
    expect(matches.map(item => item.rule.id)).toEqual(['high-interaction', 'small-account']);
    expect(matches[0]?.reasons).toContain('阅读 12,000 ≥ 10,000');
    expect(matchingRules({ ...post(), isComplete: false }, DEFAULT_RULES, new Date('2026-09-13T10:00:00Z'))).toEqual([]);
    expect(matchingRules({ ...post(), latestMetrics: { ...EMPTY_METRICS, likes: 35, replies: 11 } }, DEFAULT_RULES, new Date('2026-09-13T10:00:00Z'))).toEqual([]);
  });

  it('never confuses cumulative average with observed growth or masks a rollback', () => {
    const first = observation(1000, '2026-09-13T10:00:00Z');
    const second = observation(1600, '2026-09-13T11:00:00Z');
    expect(averageViewsPerHour(first, '2026-09-13T08:00:00Z')).toBe(500);
    expect(observedGrowth([first])).toBeNull();
    expect(observedGrowth([first, second])).toMatchObject({ kind: 'growth', perHour: 600 });
    expect(observedGrowth([second, first])).toMatchObject({ kind: 'growth', perHour: 600 });
    expect(observedGrowth([first, observation(900, '2026-09-13T11:00:00Z')])).toMatchObject({ kind: 'rollback' });
  });
});

describe('backup boundary', () => {
  it('never exports the AI key and rejects an invalid version before import', () => {
    const snapshot = { posts: [post()], observations: [], quickDrafts: [], topicCards: [], settings: { ...DEFAULT_SETTINGS, ai: { endpoint: 'https://example.com', model: 'x', apiKey: 'secret' } } };
    const text = JSON.stringify(createBackup(snapshot));
    expect(text).not.toContain('secret');
    expect(parseBackup(text).posts).toHaveLength(1);
    expect(() => parseBackup(text.replace('"schemaVersion":1', '"schemaVersion":9'))).toThrow('不支持备份版本');
  });
});
