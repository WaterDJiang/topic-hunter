import type { CapturedPost, Metrics } from './types';

type RecordValue = Record<string, unknown>;

function object(value: unknown): RecordValue | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as RecordValue)
    : null;
}

function path(value: unknown, ...keys: string[]): unknown {
  return keys.reduce<unknown>((current, key) => object(current)?.[key], value);
}

function string(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function count(value: unknown): number | null {
  const numeric = typeof value === 'string' && /^\d+$/.test(value)
    ? Number(value)
    : value;
  return typeof numeric === 'number' && Number.isSafeInteger(numeric) && numeric >= 0
    ? numeric
    : null;
}

function date(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function tweetFromNode(value: RecordValue): CapturedPost | null {
  const wrapped = object(value.tweet) ?? value;
  const legacy = object(wrapped.legacy);
  const id = string(wrapped.rest_id) ?? string(legacy?.id_str);
  const noteText = string(path(wrapped, 'note_tweet', 'note_tweet_results', 'result', 'text'));
  const text = noteText ?? string(legacy?.full_text);
  if (!id || !/^\d{5,25}$/.test(id) || !text || text.length > 20_000) return null;

  const user = object(path(wrapped, 'core', 'user_results', 'result'));
  const userLegacy = object(user?.legacy);
  const handle = string(path(user, 'core', 'screen_name')) ?? string(userLegacy?.screen_name);
  const authorId = string(user?.rest_id) ?? string(path(user, 'core', 'id_str'));
  const metrics: Metrics = {
    views: count(path(wrapped, 'views', 'count')),
    likes: count(legacy?.favorite_count),
    replies: count(legacy?.reply_count),
    reposts: count(legacy?.retweet_count),
    bookmarks: count(legacy?.bookmark_count),
    followers: count(userLegacy?.followers_count),
  };

  return {
    id,
    url: `https://x.com/${handle ?? 'i/web'}/status/${id}`,
    text,
    authorId,
    authorHandle: handle,
    publishedAt: date(legacy?.created_at),
    isComplete: Boolean(noteText) || legacy?.truncated !== true,
    quotedPostId: string(legacy?.quoted_status_id_str)
      ?? string(path(wrapped, 'quoted_status_result', 'result', 'rest_id')),
    language: string(legacy?.lang),
    metrics,
    source: 'graphql',
  };
}

/** Extracts only tweet-shaped public fields from an already received X response. */
export function extractPosts(payload: unknown, maxPosts = 100): CapturedPost[] {
  const found = new Map<string, CapturedPost>();
  const seen = new WeakSet<object>();
  const stack: unknown[] = [payload];
  let visited = 0;

  while (stack.length && visited < 20_000 && found.size < maxPosts) {
    const next = stack.pop();
    if (!next || typeof next !== 'object' || seen.has(next)) continue;
    seen.add(next);
    visited += 1;
    if (Array.isArray(next)) {
      for (const child of next) stack.push(child);
      continue;
    }
    const record = next as RecordValue;
    const post = tweetFromNode(record);
    if (post) found.set(post.id, post);
    for (const [key, child] of Object.entries(record)) {
      if (key === 'entities' || key === 'media' || key === 'ext_alt_text') continue;
      if (child && typeof child === 'object') stack.push(child);
    }
  }
  return [...found.values()];
}

export function validateCapturedPost(value: unknown): CapturedPost | null {
  const raw = object(value);
  if (!raw || typeof raw.id !== 'string' || !/^\d{5,25}$/.test(raw.id)) return null;
  if (typeof raw.text !== 'string' || !raw.text.trim() || raw.text.length > 20_000) return null;
  if (typeof raw.url !== 'string' || !/^https:\/\/x\.com\/(?:[A-Za-z0-9_]+|i\/web)\/status\/\d{5,25}$/.test(raw.url)) return null;
  const metricsRaw = object(raw.metrics);
  if (!metricsRaw) return null;
  const keys: (keyof Metrics)[] = ['views', 'likes', 'replies', 'reposts', 'bookmarks', 'followers'];
  const metrics = {} as Metrics;
  for (const key of keys) {
    const original = metricsRaw[key];
    const parsed = count(original);
    if (original !== null && parsed === null) return null;
    metrics[key] = parsed;
  }
  const nullableString = (key: string, limit: number) =>
    typeof raw[key] === 'string' && (raw[key] as string).length <= limit ? (raw[key] as string) : null;
  return {
    id: raw.id,
    url: raw.url,
    text: raw.text,
    authorId: nullableString('authorId', 30),
    authorHandle: nullableString('authorHandle', 30),
    publishedAt: date(raw.publishedAt),
    isComplete: raw.isComplete === true,
    quotedPostId: nullableString('quotedPostId', 30),
    language: nullableString('language', 20),
    metrics,
    source: raw.source === 'dom' ? 'dom' : 'graphql',
  };
}
