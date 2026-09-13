import type { CapturedPost, LibrarySnapshot, QuickDraft, Settings, TopicCard } from '../domain/types';

export type Command =
  | { type: 'capture'; posts: CapturedPost[] }
  | { type: 'snapshot' }
  | { type: 'pagePosts' }
  | { type: 'publicSettings' }
  | { type: 'openQuickDraft'; postId: string }
  | { type: 'setSettings'; settings: Settings }
  | { type: 'setSaved'; id: string; saved: boolean }
  | { type: 'upsertDraft'; draft: QuickDraft }
  | { type: 'deleteDraft'; id: string }
  | { type: 'upsertTopic'; card: TopicCard }
  | { type: 'deleteTopic'; id: string }
  | { type: 'importBackup'; data: Omit<LibrarySnapshot, 'settings'> }
  | { type: 'clearExpired' };

export type Notification = { type: 'dataChanged' } | { type: 'settingsChanged' } | { type: 'navigateQuickDraft'; postId: string };

export async function sendCommand<T>(command: Command): Promise<T> {
  const response = await chrome.runtime.sendMessage(command) as { ok: boolean; data?: T; error?: string };
  if (!response?.ok) throw new Error(response?.error ?? '扩展后台未响应');
  return response.data as T;
}
