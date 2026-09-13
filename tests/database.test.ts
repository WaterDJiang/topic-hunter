import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { EMPTY_METRICS, type CapturedPost, type QuickDraft, type TopicCard } from '../src/domain/types';
import { clearExpiredCandidates, getSnapshot, replaceFromBackup, saveCapture, setPostSaved, upsertQuickDraft, upsertTopicCard } from '../src/lib/database';

const id = '423456789012345678';
const captured: CapturedPost = {
  id, url: `https://x.com/sample/status/${id}`, text: '完整正文', authorId: '55', authorHandle: 'sample',
  publishedAt: '2026-09-13T08:00:00.000Z', isComplete: true, quotedPostId: null, language: 'zh',
  metrics: { ...EMPTY_METRICS, views: 100, likes: 20 }, source: 'graphql',
};

describe('persistent library', () => {
  it('merges repeated captures, keeps observations and protects referenced posts', async () => {
    await saveCapture(captured);
    await saveCapture({ ...captured, text: '截断内容', isComplete: false, metrics: { ...EMPTY_METRICS }, source: 'dom' });
    let snapshot = await getSnapshot();
    expect(snapshot.posts).toHaveLength(1);
    expect(snapshot.posts[0]).toMatchObject({ text: '完整正文', latestMetrics: { views: 100, likes: 20 } });
    expect(snapshot.observations).toHaveLength(2);
    const now = new Date().toISOString();
    const draft: QuickDraft = { id, sourcePostId: id, text: '我写的短推', perspective: '', createdAt: now, updatedAt: now };
    await upsertQuickDraft(draft);
    expect(await clearExpiredCandidates(new Date(Date.now() + 31 * 86_400_000))).toBe(0);
    await setPostSaved(id, true);
    snapshot = await getSnapshot();
    const topic: TopicCard = { id: 'topic-1', sourcePostIds: [id], content: '用户已编辑的选题', status: 'adopted', createdAt: now, updatedAt: now };
    await upsertTopicCard(topic);
    const firstObservation = snapshot.observations[0];
    const firstPost = snapshot.posts[0];
    if (!firstObservation || !firstPost) throw new Error('测试准备失败');
    const sameObservation = { ...firstObservation, id: 'another-backup-id' };
    await replaceFromBackup({ posts: [{ ...firstPost, text: '导入内容' }], observations: [sameObservation], quickDrafts: [{ ...draft, text: '导入稿件' }], topicCards: [{ ...topic, content: '导入选题' }] });
    snapshot = await getSnapshot();
    expect(snapshot.posts[0]?.text).toBe('完整正文');
    expect(snapshot.observations).toHaveLength(2);
    expect(snapshot.quickDrafts[0]?.text).toBe('我写的短推');
    expect(snapshot.topicCards[0]?.content).toBe('用户已编辑的选题');
  });
});
