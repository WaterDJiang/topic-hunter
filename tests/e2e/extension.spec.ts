import { expect, test, chromium } from '@playwright/test';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('built extension supports local quick draft and topic paths at 360px', async () => {
  const extensionPath = path.resolve('.output/chrome-mv3');
  const userDataDir = await mkdtemp(path.join(tmpdir(), 'topic-hunter-e2e-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).host;
    const page = await context.newPage();
    await mkdir('output/playwright', { recursive: true });
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await expect(page.getByText('还没有捕获素材')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    const now = new Date().toISOString();
    const post = {
      id: '123456789012345678', url: 'https://x.com/sample/status/123456789012345678',
      text: '一个能引发讨论的简短观点。', authorId: '55', authorHandle: 'sample',
      publishedAt: now, capturedAt: now, lastSeenAt: now, saved: false,
      isComplete: true, quotedPostId: null, language: 'zh', latestMetricSource: 'graphql',
      latestMetrics: { views: 12000, likes: 160, replies: 42, reposts: 4, bookmarks: null, followers: 1200 },
    };
    await page.evaluate(async item => {
      await chrome.runtime.sendMessage({ type: 'importBackup', data: { posts: [item], observations: [{ id: 'obs-1', postId: item.id, observedAt: item.lastSeenAt, source: 'graphql', metrics: item.latestMetrics }], quickDrafts: [], topicCards: [] } });
    }, post);
    await expect(page.getByText('一个能引发讨论的简短观点。')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: 'output/playwright/sidepanel-discover.png', fullPage: true });
    await page.getByRole('button', { name: '快速改写' }).click();
    await expect(page.getByText('让好素材，变成你的表达.')).toBeVisible();
    await page.locator('#draft-text').fill('我的判断：好观点需要自己的证据，而不只是更响亮的措辞。');
    await page.screenshot({ path: 'output/playwright/sidepanel-quick.png', fullPage: true });
    await page.getByRole('button', { name: '复制稿件' }).click();
    await expect(page.getByText('已复制，可到 X 粘贴发布')).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: '快速改写' }).click();
    await expect(page.locator('#draft-text')).toHaveValue('我的判断：好观点需要自己的证据，而不只是更响亮的措辞。');
    await page.getByRole('button', { name: '返回候选' }).click();
    await page.getByRole('button', { name: '选题库' }).click();
    await expect(page.getByText('还没有选题卡。先从素材库选 1–10 条。')).toBeVisible();

    await page.getByRole('button', { name: '发现' }).click();
    await page.getByRole('checkbox', { name: '选择 @sample 的帖子' }).check();
    await page.getByRole('button', { name: '深挖选题' }).click();
    await page.locator('#topic-content').fill('## 样本观察\n一条可追溯的素材。\n\n## 短推角度\n从自己的经验补充。');
    await page.getByRole('button', { name: '保存选题卡' }).click();
    await expect(page.getByText('选题卡已保存')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: 'output/playwright/sidepanel-topic.png', fullPage: true });
    const workspace = await context.newPage();
    await workspace.setViewportSize({ width: 1440, height: 900 });
    await workspace.goto(`chrome-extension://${extensionId}/workspace.html`);
    await expect(workspace.getByRole('region', { name: '素材列表' }).getByText('一个能引发讨论的简短观点。')).toBeVisible();
    await workspace.screenshot({ path: 'output/playwright/workspace-library.png', fullPage: true });

    const xPage = await context.newPage();
    let graphqlRequests = 0;
    let graphqlText = '页面响应中的完整帖子';
    await xPage.route('https://x.com/test', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<html><body><article data-testid="tweet"><a href="/sample/status/323456789012345678"><time datetime="${new Date().toISOString()}">今天</time></a><div data-testid="tweetText">页面可见的帖子</div><div role="group"><button data-testid="reply" aria-label="42 Replies. Reply">42</button><button data-testid="retweet" aria-label="4 reposts. Repost">4</button><button data-testid="like" aria-label="160 Likes. Like">160</button><a href="/sample/status/323456789012345678/analytics" aria-label="12000 views. View post analytics">12K</a><button data-testid="bookmark" aria-label="Bookmark">2</button></div></article></body></html>` }));
    await xPage.route('https://x.com/i/api/graphql/**', route => {
      graphqlRequests += 1;
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { tweet: {
        rest_id: '323456789012345678',
        core: { user_results: { result: { rest_id: '55', legacy: { screen_name: 'sample', followers_count: 1200 } } } },
        legacy: { full_text: graphqlText, created_at: new Date().toUTCString(), favorite_count: 160, reply_count: 42, retweet_count: 4, bookmark_count: 2 },
        views: { count: '12000' },
      } } }) });
    });
    await xPage.goto('https://x.com/test');
    await expect(xPage.locator('[data-topic-hunter-badge]')).toBeVisible();
    await expect.poll(async () => {
      const snapshot = await workspace.evaluate(async () => chrome.runtime.sendMessage({ type: 'snapshot' }));
      return snapshot.data.posts.find((item: { id: string }) => item.id === '323456789012345678');
    }).toMatchObject({
      isComplete: true,
      latestMetricSource: 'dom',
      latestMetrics: { views: 12000, likes: 160, replies: 42, reposts: 4, bookmarks: 2, followers: null },
    });
    await expect(workspace.getByRole('region', { name: '素材列表' }).getByText('页面可见的帖子')).toBeVisible();
    await xPage.evaluate(() => fetch('/i/api/graphql/abc/TweetDetail').then(response => response.json()));
    await expect(workspace.getByRole('region', { name: '素材列表' }).getByText('页面响应中的完整帖子')).toBeVisible();
    expect(graphqlRequests).toBe(1);

    await workspace.getByRole('button', { name: '暂停采集' }).click();
    await expect(xPage.locator('[data-topic-hunter-badge]')).toHaveCount(0);
    graphqlText = '暂停期间不应写入的新正文';
    await xPage.evaluate(() => fetch('/i/api/graphql/abc/TweetDetail').then(response => response.json()));
    const paused = await workspace.evaluate(async () => chrome.runtime.sendMessage({ type: 'snapshot' }));
    expect(paused.data.posts.find((item: { id: string }) => item.id === '323456789012345678').text).toBe('页面响应中的完整帖子');
    await workspace.getByRole('button', { name: '恢复采集' }).click();
    await expect(xPage.locator('[data-topic-hunter-badge]')).toBeVisible();
    graphqlText = '恢复后写入的完整正文';
    await xPage.evaluate(() => fetch('/i/api/graphql/abc/TweetDetail').then(response => response.json()));
    await expect(workspace.getByRole('region', { name: '素材列表' }).getByText('恢复后写入的完整正文')).toBeVisible();
    expect(graphqlRequests).toBe(3);

    const secondXTab = await context.newPage();
    let secondTabRequests = 0;
    await secondXTab.route('https://x.com/test', route => route.fulfill({ contentType: 'text/html', body: '<html><body><article data-testid="tweet"><a href="/sample/status/323456789012345678"><time datetime="2026-09-13T08:00:00Z">今天</time></a><div data-testid="tweetText">同一帖</div><div role="group"></div></article></body></html>' }));
    await secondXTab.route('https://x.com/i/api/graphql/**', route => {
      secondTabRequests += 1;
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { tweet: {
        rest_id: '323456789012345678',
        core: { user_results: { result: { rest_id: '55', legacy: { screen_name: 'sample', followers_count: 1200 } } } },
        legacy: { full_text: '第二个标签再次看到同一帖', created_at: new Date().toUTCString(), favorite_count: 170, reply_count: 44 },
        views: { count: '13000' },
      } } }) });
    });
    await secondXTab.goto('https://x.com/test');
    await expect(secondXTab.locator('[data-topic-hunter-badge]')).toBeVisible();
    await secondXTab.evaluate(() => fetch('/i/api/graphql/abc/TweetDetail').then(response => response.json()));
    await expect(workspace.getByRole('region', { name: '素材列表' }).getByText('第二个标签再次看到同一帖')).toBeVisible();
    const afterSecondTab = await workspace.evaluate(async () => chrome.runtime.sendMessage({ type: 'snapshot' }));
    expect(afterSecondTab.data.posts.filter((item: { id: string }) => item.id === '323456789012345678')).toHaveLength(1);
    expect(afterSecondTab.data.observations.filter((item: { postId: string }) => item.postId === '323456789012345678').length).toBeGreaterThanOrEqual(2);
    expect(secondTabRequests).toBe(1);

    const truncatedTab = await context.newPage();
    await truncatedTab.route('https://x.com/test', route => route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: `<html><body><article data-testid="tweet"><a href="/sample/status/423456789012345678"><time datetime="${new Date().toISOString()}">今天</time></a><div data-testid="tweetText">可见但截断的长帖开头</div><button>Show more</button><div role="group"><button data-testid="like" aria-label="160 Likes. Like">160</button><a href="/sample/status/423456789012345678/analytics" aria-label="12000 views. View post analytics">12K</a></div></article></body></html>`,
    }));
    await truncatedTab.goto('https://x.com/test');
    await expect.poll(async () => {
      const snapshot = await workspace.evaluate(async () => chrome.runtime.sendMessage({ type: 'snapshot' }));
      return snapshot.data.posts.find((item: { id: string }) => item.id === '423456789012345678');
    }).toMatchObject({ isComplete: false, latestMetrics: { views: 12000, likes: 160, followers: null } });
    await expect(workspace.getByRole('region', { name: '素材列表' }).getByText('可见但截断的长帖开头')).toHaveCount(0);

    await workspace.evaluate(async () => {
      const timestamp = new Date().toISOString();
      const posts = Array.from({ length: 1_000 }, (_, index) => {
        const id = (5_000_000_000_000_000_000n + BigInt(index)).toString();
        return {
          id, url: `https://x.com/sample/status/${id}`, text: `第 ${index} 条测试素材`, authorId: '55', authorHandle: 'sample',
          publishedAt: timestamp, capturedAt: timestamp, lastSeenAt: timestamp, saved: false,
          isComplete: true, quotedPostId: null, language: 'zh', latestMetricSource: 'graphql',
          latestMetrics: { views: 12000, likes: 160, replies: 42, reposts: 4, bookmarks: null, followers: 1200 },
        };
      });
      await chrome.runtime.sendMessage({ type: 'importBackup', data: { posts, observations: [], quickDrafts: [], topicCards: [] } });
    });
    await expect(workspace.getByText('1002 条命中', { exact: true })).toBeVisible();
    await expect(workspace.getByText('已捕获 1003 条 · 当前预设命中 1002 条', { exact: true })).toBeVisible();
    expect(await workspace.locator('article').count()).toBeLessThan(30);
  } finally {
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
  }
});
