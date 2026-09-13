import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Topic Hunter',
    description: '随浏览发现 X 高表现内容，快速改写或深挖选题。',
    permissions: ['storage', 'sidePanel', 'alarms'],
    host_permissions: ['https://x.com/*'],
    optional_host_permissions: ['https://*/*'],
    icons: { 16: '/icon-16.png', 32: '/icon-32.png', 48: '/icon-48.png', 128: '/icon-128.png' },
    action: { default_title: '打开 Topic Hunter', default_icon: { 16: '/icon-16.png', 32: '/icon-32.png' } },
    web_accessible_resources: [
      { resources: ['x-observer.js'], matches: ['https://x.com/*'] },
    ],
  },
});
