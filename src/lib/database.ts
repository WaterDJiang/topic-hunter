import { openDB } from 'idb';
import type { CapturedPost, LibrarySnapshot, MetricObservation, Post, QuickDraft, TopicCard } from '../domain/types';

const DATABASE = 'topic-hunter';
const VERSION = 1;

let connection: ReturnType<typeof openDB> | null = null;

function getDB(): ReturnType<typeof openDB> {
  connection ??= openDB(DATABASE, VERSION, {
    upgrade(db) {
      db.createObjectStore('posts', { keyPath: 'id' });
      const observations = db.createObjectStore('observations', { keyPath: 'id' });
      observations.createIndex('postId', 'postId');
      db.createObjectStore('quickDrafts', { keyPath: 'id' });
      db.createObjectStore('topicCards', { keyPath: 'id' });
    },
  });
  return connection;
}

export async function saveCapture(captured: CapturedPost): Promise<Post> {
  const db = await getDB();
  const now = new Date().toISOString();
  const transaction = db.transaction(['posts', 'observations'], 'readwrite');
  const existing = await transaction.objectStore('posts').get(captured.id) as Post | undefined;
  const latestMetrics = { ...captured.metrics };
  if (existing) {
    for (const key of Object.keys(latestMetrics) as (keyof typeof latestMetrics)[]) {
      latestMetrics[key] ??= existing.latestMetrics[key];
    }
  }
  const post: Post = {
    id: captured.id,
    url: captured.url,
    text: captured.isComplete || !existing?.isComplete ? captured.text : existing.text,
    authorId: captured.authorId ?? existing?.authorId ?? null,
    authorHandle: captured.authorHandle ?? existing?.authorHandle ?? null,
    publishedAt: captured.publishedAt ?? existing?.publishedAt ?? null,
    isComplete: captured.isComplete || existing?.isComplete === true,
    quotedPostId: captured.quotedPostId ?? existing?.quotedPostId ?? null,
    language: captured.language ?? existing?.language ?? null,
    capturedAt: existing?.capturedAt ?? now,
    lastSeenAt: now,
    saved: existing?.saved ?? false,
    latestMetrics,
    latestMetricSource: captured.source,
  };
  const observation: MetricObservation = {
    id: crypto.randomUUID(), postId: captured.id, observedAt: now,
    source: captured.source, metrics: captured.metrics,
  };
  await transaction.objectStore('posts').put(post);
  await transaction.objectStore('observations').put(observation);
  await transaction.done;
  return post;
}

export async function getSnapshot(): Promise<Omit<LibrarySnapshot, 'settings'>> {
  const db = await getDB();
  const [posts, observations, quickDrafts, topicCards] = await Promise.all([
    db.getAll('posts'), db.getAll('observations'), db.getAll('quickDrafts'), db.getAll('topicCards'),
  ]);
  return { posts: posts as Post[], observations: observations as MetricObservation[], quickDrafts: quickDrafts as QuickDraft[], topicCards: topicCards as TopicCard[] };
}

export async function setPostSaved(id: string, saved: boolean): Promise<void> {
  const db = await getDB();
  const post = await db.get('posts', id) as Post | undefined;
  if (!post) throw new Error('未找到素材');
  await db.put('posts', { ...post, saved });
}

export async function upsertQuickDraft(draft: QuickDraft): Promise<void> {
  const db = await getDB();
  await db.put('quickDrafts', draft);
}

export async function deleteQuickDraft(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('quickDrafts', id);
}

export async function upsertTopicCard(card: TopicCard): Promise<void> {
  const db = await getDB();
  await db.put('topicCards', card);
}

export async function deleteTopicCard(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('topicCards', id);
}

export async function clearExpiredCandidates(now = new Date()): Promise<number> {
  const db = await getDB();
  const { posts, quickDrafts, topicCards } = await getSnapshot();
  const referenced = new Set([
    ...quickDrafts.map(draft => draft.sourcePostId),
    ...topicCards.flatMap(card => card.sourcePostIds),
  ]);
  const expired = posts.filter(post => !post.saved && !referenced.has(post.id) && now.getTime() - Date.parse(post.lastSeenAt) > 30 * 86_400_000);
  const transaction = db.transaction(['posts', 'observations'], 'readwrite');
  for (const post of expired) {
    await transaction.objectStore('posts').delete(post.id);
    const keys = await transaction.objectStore('observations').index('postId').getAllKeys(post.id);
    for (const key of keys) await transaction.objectStore('observations').delete(key);
  }
  await transaction.done;
  return expired.length;
}

export async function replaceFromBackup(data: Omit<LibrarySnapshot, 'settings'>): Promise<void> {
  const db = await getDB();
  const transaction = db.transaction(['posts', 'observations', 'quickDrafts', 'topicCards'], 'readwrite');
  const fingerprint = (item: MetricObservation) => `${item.postId}|${item.observedAt}|${item.source}|${JSON.stringify(item.metrics)}`;
  const fingerprints = new Set((await transaction.objectStore('observations').getAll() as MetricObservation[]).map(fingerprint));
  for (const post of data.posts) {
    const existing = await transaction.objectStore('posts').get(post.id) as Post | undefined;
    if (!existing) await transaction.objectStore('posts').put(post);
  }
  for (const observation of data.observations) {
    const key = fingerprint(observation);
    if (fingerprints.has(key)) continue;
    const existing = await transaction.objectStore('observations').get(observation.id);
    if (!existing) {
      await transaction.objectStore('observations').put(observation);
      fingerprints.add(key);
    }
  }
  for (const draft of data.quickDrafts) {
    const existing = await transaction.objectStore('quickDrafts').get(draft.id);
    if (!existing) await transaction.objectStore('quickDrafts').put(draft);
  }
  for (const card of data.topicCards) {
    const existing = await transaction.objectStore('topicCards').get(card.id);
    if (!existing) await transaction.objectStore('topicCards').put(card);
  }
  await transaction.done;
}
