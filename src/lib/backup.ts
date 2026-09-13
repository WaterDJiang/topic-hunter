import type { LibrarySnapshot, MetricObservation, Metrics, Post, QuickDraft, TopicCard } from '../domain/types';

export const BACKUP_VERSION = 1;

export interface BackupFile extends Omit<LibrarySnapshot, 'settings'> {
  schemaVersion: number;
  exportedAt: string;
}

export function createBackup(snapshot: LibrarySnapshot): BackupFile {
  return {
    schemaVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    posts: snapshot.posts,
    observations: snapshot.observations,
    quickDrafts: snapshot.quickDrafts,
    topicCards: snapshot.topicCards,
  };
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function id(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length < 200;
}

function postId(value: unknown): value is string {
  return typeof value === 'string' && /^\d{5,25}$/.test(value);
}

function date(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function nullableString(value: unknown, max: number): string | null {
  if (value === null) return null;
  if (typeof value === 'string' && value.length <= max) return value;
  throw new Error('备份字符串字段无效');
}

function metrics(value: unknown): Metrics {
  if (!record(value)) throw new Error('备份指标结构无效');
  const result = {} as Metrics;
  for (const key of ['views', 'likes', 'replies', 'reposts', 'bookmarks', 'followers'] as const) {
    const item = value[key];
    if (item !== null && (typeof item !== 'number' || !Number.isSafeInteger(item) || item < 0)) throw new Error(`备份指标 ${key} 无效`);
    result[key] = item;
  }
  return result;
}

function parsePost(value: unknown): Post {
  if (!record(value) || !postId(value.id) || typeof value.url !== 'string' ||
    !/^https:\/\/x\.com\/(?:[A-Za-z0-9_]+|i\/web)\/status\/\d{5,25}$/.test(value.url) ||
    typeof value.text !== 'string' || value.text.length > 20_000 ||
    !date(value.capturedAt) || !date(value.lastSeenAt) ||
    (value.publishedAt !== null && !date(value.publishedAt))) throw new Error('素材结构无效');
  return {
    id: value.id, url: value.url, text: value.text,
    authorId: nullableString(value.authorId, 30), authorHandle: nullableString(value.authorHandle, 30),
    publishedAt: value.publishedAt, capturedAt: value.capturedAt, lastSeenAt: value.lastSeenAt,
    isComplete: value.isComplete === true, quotedPostId: nullableString(value.quotedPostId, 30),
    language: nullableString(value.language, 20), saved: value.saved === true,
    latestMetrics: metrics(value.latestMetrics),
    latestMetricSource: value.latestMetricSource === 'dom' ? 'dom' : 'graphql',
  };
}

function parseObservation(value: unknown): MetricObservation {
  if (!record(value) || !id(value.id) || !postId(value.postId) || !date(value.observedAt) ||
    (value.source !== 'graphql' && value.source !== 'dom')) throw new Error('观测结构无效');
  return { id: value.id, postId: value.postId, observedAt: value.observedAt, source: value.source, metrics: metrics(value.metrics) };
}

function parseDraft(value: unknown): QuickDraft {
  if (!record(value) || !id(value.id) || !postId(value.sourcePostId) ||
    typeof value.text !== 'string' || value.text.length > 20_000 ||
    typeof value.perspective !== 'string' || value.perspective.length > 2_000 ||
    !date(value.createdAt) || !date(value.updatedAt)) throw new Error('快速稿结构无效');
  return { id: value.id, sourcePostId: value.sourcePostId, text: value.text, perspective: value.perspective, createdAt: value.createdAt, updatedAt: value.updatedAt };
}

function parseTopic(value: unknown): TopicCard {
  if (!record(value) || !id(value.id) || !Array.isArray(value.sourcePostIds) ||
    value.sourcePostIds.length < 1 || value.sourcePostIds.length > 10 ||
    value.sourcePostIds.some(item => !postId(item)) ||
    typeof value.content !== 'string' || value.content.length > 50_000 ||
    !['considering', 'adopted', 'discarded'].includes(String(value.status)) ||
    !date(value.createdAt) || !date(value.updatedAt)) throw new Error('选题结构无效');
  return { id: value.id, sourcePostIds: value.sourcePostIds, content: value.content, status: value.status as TopicCard['status'], createdAt: value.createdAt, updatedAt: value.updatedAt };
}

export function parseBackup(text: string): BackupFile {
  if (text.length > 50_000_000) throw new Error('备份文件超过 50 MB');
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new Error('备份不是有效 JSON'); }
  if (!record(data)) throw new Error('备份结构无效');
  if (data.schemaVersion !== BACKUP_VERSION) throw new Error(`不支持备份版本 ${String(data.schemaVersion)}`);
  for (const key of ['posts', 'observations', 'quickDrafts', 'topicCards']) {
    if (!Array.isArray(data[key])) throw new Error(`备份缺少 ${key}`);
  }
  const posts = (data.posts as unknown[]).map(parsePost);
  const observations = (data.observations as unknown[]).map(parseObservation);
  const quickDrafts = (data.quickDrafts as unknown[]).map(parseDraft);
  const topicCards = (data.topicCards as unknown[]).map(parseTopic);
  const postIds = new Set(posts.map(value => value.id));
  if (observations.some(value => !postIds.has(value.postId))) throw new Error('观测缺少来源素材');
  if (quickDrafts.some(value => !postIds.has(value.sourcePostId))) throw new Error('快速稿缺少来源素材');
  if (topicCards.some(value => value.sourcePostIds.some(sourceId => !postIds.has(sourceId)))) throw new Error('选题缺少来源素材');
  return {
    schemaVersion: BACKUP_VERSION,
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : '',
    posts,
    observations,
    quickDrafts,
    topicCards,
  };
}

export function downloadText(filename: string, text: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
