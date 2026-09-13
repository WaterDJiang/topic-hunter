import { afterEach, expect, it, vi } from 'vitest';
import { aiOrigin, runAI } from '../src/lib/ai';

const config = {
  endpoint: 'https://ai.example.com/v1/chat/completions',
  model: 'test-model',
  apiKey: 'secret-value',
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('rejects insecure or credential-bearing AI endpoints', () => {
  expect(() => aiOrigin({ ...config, endpoint: 'http://ai.example.com/v1/chat/completions' })).toThrow('HTTPS');
  expect(() => aiOrigin({ ...config, endpoint: 'https://name:pass@ai.example.com/v1/chat/completions' })).toThrow('HTTPS');
});

it('does not send selected content when host permission is denied', async () => {
  const request = vi.fn().mockResolvedValue(false);
  const fetchMock = vi.fn();
  vi.stubGlobal('chrome', { permissions: { request } });
  vi.stubGlobal('fetch', fetchMock);
  await expect(runAI(config, 'one selected post', new AbortController().signal)).rejects.toThrow('未授权');
  expect(request).toHaveBeenCalledWith({ origins: ['https://ai.example.com/*'] });
  expect(fetchMock).not.toHaveBeenCalled();
});

it('sends only the explicit prompt and returns the text response', async () => {
  const permissionRequest = vi.fn().mockResolvedValue(true);
  vi.stubGlobal('chrome', { permissions: { request: permissionRequest } });
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '  我的新角度  ' } }] }) });
  vi.stubGlobal('fetch', fetchMock);
  const signal = new AbortController().signal;
  const result = runAI(config, 'one selected post', signal);
  expect(permissionRequest).toHaveBeenCalledWith({ origins: ['https://ai.example.com/*'] });
  await expect(result).resolves.toBe('我的新角度');
  expect(fetchMock).toHaveBeenCalledWith(config.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer secret-value' },
    body: JSON.stringify({ model: 'test-model', messages: [{ role: 'user', content: 'one selected post' }], stream: false }),
    signal,
  });
});
