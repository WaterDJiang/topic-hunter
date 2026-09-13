import { validateCapturedPost } from '../src/domain/capture';
import { matchingRules } from '../src/domain/rules';
import { EMPTY_METRICS, type CapturedPost, type Post, type PublicSettings } from '../src/domain/types';
import { sendCommand } from '../src/lib/messages';

const BADGE_STYLE = `
  :host { display: inline-flex; margin: 8px 0 2px; font: 12px/1.4 -apple-system, BlinkMacSystemFont, sans-serif; }
  .row { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
  .mark { color: #315cf5; border-left: 3px solid #315cf5; padding: 4px 7px; background: #eef2ff; border-radius: 3px 7px 7px 3px; font-weight: 650; }
  button { font: inherit; border: 1px solid #cbd5e1; border-radius: 6px; color: #1e293b; background: #fff; padding: 4px 8px; cursor: pointer; }
  button:hover, button:focus-visible { border-color: #315cf5; color: #315cf5; outline: none; }
`;

function statusId(article: Element): string | null {
  const timeLink = article.querySelector('time')?.closest('a');
  const primary = timeLink?.getAttribute('href')?.match(/\/status\/(\d{5,25})(?:\D|$)/)?.[1];
  if (primary) return primary;
  for (const link of article.querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]')) {
    const match = link.getAttribute('href')?.match(/\/status\/(\d{5,25})(?:\D|$)/);
    if (match?.[1]) return match[1];
  }
  return null;
}

function domFallback(article: Element, id: string): CapturedPost | null {
  const text = article.querySelector('[data-testid="tweetText"]')?.textContent?.trim();
  if (!text) return null;
  const visibleCount = (selector: string): number | null => {
    const element = article.querySelector(selector);
    const label = element?.getAttribute('aria-label')?.match(/^\s*(\d[\d,]*)(?=\s|$)/)?.[1];
    const raw = label ?? element?.textContent?.trim();
    if (!raw || !/^\d[\d,]*$/.test(raw)) return null;
    const value = Number(raw.replaceAll(',', ''));
    return Number.isSafeInteger(value) ? value : null;
  };
  const truncated = [...article.querySelectorAll('button,[role="button"],a')].some(element =>
    /^(show more|显示更多|展开)$/i.test(element.textContent?.trim() ?? ''),
  ) || /(?:…|\.\.\.)$/.test(text);
  const link = article.querySelector<HTMLAnchorElement>(`a[href*="/status/${id}"]`);
  const segment = link?.getAttribute('href')?.split('/')[1] ?? null;
  const handle = segment === 'i' ? null : segment;
  const time = article.querySelector('time')?.getAttribute('datetime') ?? null;
  return {
    id, url: `https://x.com/${handle ?? 'i/web'}/status/${id}`, text,
    authorId: null, authorHandle: handle, publishedAt: time,
    isComplete: !truncated, quotedPostId: null, language: null,
    metrics: {
      ...EMPTY_METRICS,
      views: visibleCount('a[href*="/analytics"]'),
      likes: visibleCount('[data-testid="like"],[data-testid="unlike"]'),
      replies: visibleCount('[data-testid="reply"]'),
      reposts: visibleCount('[data-testid="retweet"]'),
      bookmarks: visibleCount('[data-testid="bookmark"],[data-testid="removeBookmark"]'),
    }, source: 'dom',
  };
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  element.addEventListener('click', event => {
    event.stopPropagation();
    onClick();
  });
  return element;
}

export default defineContentScript({
  matches: ['https://x.com/*'],
  runAt: 'document_start',
  async main(ctx) {
    let publicSettings: PublicSettings = { captureEnabled: false, rules: [] };
    let posts = new Map<string, Post>();
    let bridge: HTMLScriptElement | null = null;
    let scheduled = false;
    const seenDom = new Map<string, number>();

    const control = () => bridge?.dispatchEvent(new CustomEvent('topic-hunter-control', { detail: { enabled: publicSettings.captureEnabled } }));
    const refresh = async () => {
      try {
        const snapshot = await sendCommand<{ posts: Post[] }>({ type: 'pagePosts' });
        posts = new Map(snapshot.posts.map(post => [post.id, post]));
        scan();
      } catch { /* background may be restarting; next update retries */ }
    };
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      ctx.setTimeout(() => { scheduled = false; scan(); }, 180);
    };
    const scan = () => {
      if (!ctx.isValid) return;
      if (!publicSettings.captureEnabled) {
        document.querySelectorAll('[data-topic-hunter-badge]').forEach(item => { item.remove(); });
        return;
      }
      document.querySelectorAll('article[data-testid="tweet"]').forEach(article => {
        const id = statusId(article);
        if (!id) return;
        const post = posts.get(id);
        if (!post && Date.now() - (seenDom.get(id) ?? 0) > 60_000) {
          const fallback = domFallback(article, id);
          if (fallback) {
            seenDom.set(id, Date.now());
            void sendCommand({ type: 'capture', posts: [fallback] }).catch(() => undefined);
          }
        }
        const current = post;
        const reasons = current ? matchingRules(current, publicSettings.rules).flatMap(item => item.reasons) : [];
        const label = current?.saved ? '已保存' : reasons.length ? `命中 · ${reasons[0]}` : '素材';
        let host = article.querySelector<HTMLElement>('[data-topic-hunter-badge]');
        if (host && host.dataset.topicHunterBadge !== id) { host.remove(); host = null; }
        if (!host) {
          host = document.createElement('span');
          host.dataset.topicHunterBadge = id;
          const shadow = host.attachShadow({ mode: 'open' });
          const style = document.createElement('style');
          style.textContent = BADGE_STYLE;
          const row = document.createElement('span');
          row.className = 'row';
          const mark = document.createElement('span');
          mark.className = 'mark';
          mark.dataset.label = '';
          const saveButton = button('保存', () => void sendCommand({ type: 'setSaved', id, saved: !posts.get(id)?.saved }).catch(() => undefined));
          saveButton.dataset.save = '';
          row.append(mark,
            button('快速改写', () => void sendCommand({ type: 'openQuickDraft', postId: id }).catch(() => undefined)),
            saveButton);
          shadow.append(style, row);
          const toolbar = article.querySelector('[role="group"]');
          (toolbar ?? article).append(host);
        }
        const mark = host.shadowRoot?.querySelector<HTMLElement>('[data-label]');
        if (mark && mark.textContent !== label) mark.textContent = label;
        const saveButton = host.shadowRoot?.querySelector<HTMLButtonElement>('[data-save]');
        const saveLabel = current?.saved ? '取消收藏' : '保存';
        if (saveButton && saveButton.textContent !== saveLabel) saveButton.textContent = saveLabel;
      });
    };

    await injectScript('/x-observer.js', {
      keepInDom: true,
      modifyScript(script) {
        script.addEventListener('topic-hunter-capture', event => {
          if (!(event instanceof CustomEvent) || !Array.isArray(event.detail)) return;
          const captured = event.detail.slice(0, 100).map(validateCapturedPost).filter((post): post is CapturedPost => post !== null);
          if (captured.length) void sendCommand({ type: 'capture', posts: captured }).catch(() => undefined);
        });
      },
    }).then(result => { bridge = result.script; });

    try {
      publicSettings = await sendCommand<PublicSettings>({ type: 'publicSettings' });
      control();
      await refresh();
    } catch { /* visible DOM can still be browsed normally */ }

    const observer = new MutationObserver(schedule);
    observer.observe(document, { subtree: true, childList: true });
    chrome.runtime.onMessage.addListener(message => {
      if (message?.type === 'settingsChanged') {
        void sendCommand<PublicSettings>({ type: 'publicSettings' }).then(value => {
          publicSettings = value; control(); schedule();
        });
      }
      if (message?.type === 'dataChanged') void refresh();
    });
    ctx.onInvalidated(() => observer.disconnect());
  },
});
