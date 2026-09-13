import { extractPosts } from '../src/domain/capture';

export default defineUnlistedScript(() => {
  const bridge = document.currentScript;
  if (!bridge) return;
  let active = false;
  bridge.addEventListener('topic-hunter-control', event => {
    if (event instanceof CustomEvent) active = event.detail?.enabled === true;
  });

  const originalFetch = window.fetch;
  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const pending = originalFetch.call(window, input, init);
    void pending.then(response => {
      if (!active || !/\/graphql\//i.test(response.url) || !response.ok) return;
      const length = Number(response.headers.get('content-length'));
      if (Number.isFinite(length) && length > 5_000_000) return;
      if (!response.headers.get('content-type')?.includes('json')) return;
      void response.clone().text().then(text => {
        if (!active) return;
        if (text.length > 5_000_000) return;
        const payload: unknown = JSON.parse(text);
        const posts = extractPosts(payload);
        if (posts.length) bridge.dispatchEvent(new CustomEvent('topic-hunter-capture', { detail: posts }));
      }).catch(() => undefined);
    }, () => undefined);
    return pending;
  };
});
