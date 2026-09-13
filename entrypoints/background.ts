import { normalizeSettings, DEFAULT_SETTINGS } from '../src/domain/settings';
import { parseBackup } from '../src/lib/backup';
import { validateCapturedPost } from '../src/domain/capture';
import type { LibrarySnapshot, Settings } from '../src/domain/types';
import { clearExpiredCandidates, deleteQuickDraft, deleteTopicCard, getSnapshot, replaceFromBackup, saveCapture, setPostSaved, upsertQuickDraft, upsertTopicCard } from '../src/lib/database';
import type { Command, Notification } from '../src/lib/messages';

async function prepareStorage(): Promise<void> {
  await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  const stored = await chrome.storage.local.get('settings');
  if (!stored.settings) await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
}

let storageReady: Promise<void> | null = null;

function ready(): Promise<void> {
  storageReady ??= prepareStorage();
  return storageReady;
}

async function settings(): Promise<Settings> {
  await ready();
  const stored = await chrome.storage.local.get('settings');
  return normalizeSettings(stored.settings);
}

function notify(message: Notification): void {
  void chrome.runtime.sendMessage(message).catch(() => undefined);
  if (message.type === 'settingsChanged' || message.type === 'dataChanged') {
    void chrome.tabs.query({ url: 'https://x.com/*' }).then(tabs =>
      Promise.allSettled(tabs.flatMap(tab => tab.id === undefined ? [] : [chrome.tabs.sendMessage(tab.id, message)])),
    ).catch(error => console.error('Topic Hunter: X tab update failed', error));
  }
}

function fromExtensionPage(sender: chrome.runtime.MessageSender): boolean {
  return typeof sender.url === 'string' && sender.url.startsWith(chrome.runtime.getURL(''));
}

function fromXTab(sender: chrome.runtime.MessageSender): boolean {
  return typeof sender.url === 'string' && /^https:\/\/x\.com\//.test(sender.url) && sender.tab?.id !== undefined;
}

async function handle(command: Command, sender: chrome.runtime.MessageSender): Promise<unknown> {
  if (command.type === 'publicSettings') {
    const current = await settings();
    return { captureEnabled: current.captureEnabled, rules: current.rules };
  }
  if (command.type === 'pagePosts') {
    if (!fromXTab(sender)) throw new Error('仅 X 页面可读取帖子索引');
    return { posts: (await getSnapshot()).posts };
  }
  if (command.type === 'capture') {
    if (!fromXTab(sender) || !(await settings()).captureEnabled || !Array.isArray(command.posts)) return null;
    let captured = 0;
    for (const item of command.posts.slice(0, 100)) {
      const post = validateCapturedPost(item);
      if (!post) continue;
      await saveCapture(post);
      captured += 1;
    }
    if (captured) {
      await chrome.storage.local.remove('captureError');
      notify({ type: 'dataChanged' });
    }
    return { captured };
  }
  if (command.type === 'openQuickDraft') {
    const tabId = sender.tab?.id;
    if (!fromXTab(sender) || tabId === undefined || !/^\d{5,25}$/.test(command.postId)) throw new Error('无法打开快速稿');
    await chrome.storage.local.set({ pendingQuickPostId: command.postId });
    await chrome.sidePanel.open({ tabId });
    notify({ type: 'navigateQuickDraft', postId: command.postId });
    return null;
  }
  if (!fromExtensionPage(sender) && !(command.type === 'setSaved' && fromXTab(sender))) {
    throw new Error('该操作仅允许扩展页面发起');
  }
  switch (command.type) {
    case 'snapshot': {
      const stored = await chrome.storage.local.get('captureError');
      return { ...(await getSnapshot()), settings: await settings(), captureError: typeof stored.captureError === 'string' ? stored.captureError : null } satisfies LibrarySnapshot;
    }
    case 'setSettings': {
      const next = normalizeSettings(command.settings);
      await chrome.storage.local.set({ settings: next });
      notify({ type: 'settingsChanged' });
      return next;
    }
    case 'setSaved':
      await setPostSaved(command.id, command.saved);
      notify({ type: 'dataChanged' });
      return null;
    case 'upsertDraft':
      await upsertQuickDraft(command.draft);
      notify({ type: 'dataChanged' });
      return null;
    case 'deleteDraft':
      await deleteQuickDraft(command.id);
      notify({ type: 'dataChanged' });
      return null;
    case 'upsertTopic':
      await upsertTopicCard(command.card);
      notify({ type: 'dataChanged' });
      return null;
    case 'deleteTopic':
      await deleteTopicCard(command.id);
      notify({ type: 'dataChanged' });
      return null;
    case 'clearExpired': {
      const removed = await clearExpiredCandidates();
      notify({ type: 'dataChanged' });
      return { removed };
    }
    case 'importBackup':
      {
        const imported = parseBackup(JSON.stringify({ ...command.data, schemaVersion: 1, exportedAt: new Date().toISOString() }));
        await replaceFromBackup(imported);
      }
      notify({ type: 'dataChanged' });
      return null;
    default: throw new Error('未知命令');
  }
}

export default defineBackground(() => {
  void ready();
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  void chrome.alarms.create('cleanup-expired-candidates', { periodInMinutes: 1_440 });
  chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === 'cleanup-expired-candidates') void clearExpiredCandidates().then(removed => {
      if (removed) notify({ type: 'dataChanged' });
    });
  });
  chrome.runtime.onMessage.addListener((message: Command | Notification, sender, sendResponse) => {
    if (!message || typeof message !== 'object' || message.type === 'dataChanged' || message.type === 'settingsChanged' || message.type === 'navigateQuickDraft') return false;
    if (message.type === 'openQuickDraft' && !('postId' in message)) return false;
    void handle(message as Command, sender)
      .then(data => sendResponse({ ok: true, data }))
      .catch(async error => {
        if (message.type === 'capture') {
          try { await chrome.storage.local.set({ captureError: '采集异常，重载 X 页面后重试' }); }
          catch (storageError) { console.error('Topic Hunter: capture status could not be saved', storageError); }
          notify({ type: 'dataChanged' });
        }
        sendResponse({ ok: false, error: error instanceof Error ? error.message : '操作失败' });
      });
    return true;
  });
});
