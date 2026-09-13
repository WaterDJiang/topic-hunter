import type { AIConfig } from '../domain/types';

export function aiOrigin(config: AIConfig): string {
  let endpoint: URL;
  try { endpoint = new URL(config.endpoint); } catch { throw new Error('请输入完整的 HTTPS 接口地址'); }
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password) throw new Error('接口必须使用 HTTPS，且地址不能包含账号信息');
  return endpoint.origin;
}

export function configured(config: AIConfig): boolean {
  return Boolean(config.endpoint.trim() && config.model.trim() && config.apiKey.trim());
}

export async function runAI(config: AIConfig, prompt: string, signal: AbortSignal): Promise<string> {
  const origin = aiOrigin(config);
  if (!configured(config)) throw new Error('先在设置中填写接口、模型和密钥');
  const granted = await chrome.permissions.request({ origins: [`${origin}/*`] });
  if (!granted) throw new Error('未授权 AI 接口站点，可复制提示词继续');
  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({ model: config.model, messages: [{ role: 'user', content: prompt }], stream: false }),
    signal,
  });
  if (!response.ok) throw new Error(`接口请求失败：HTTP ${response.status}`);
  const json = await response.json() as { choices?: { message?: { content?: unknown } }[] };
  const text = json.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) throw new Error('接口返回了空内容或不兼容格式');
  return text.trim();
}

export async function markAIInProgress(kind: 'quick' | 'topic'): Promise<void> {
  await chrome.storage.local.set({ pendingAIOperation: { kind, startedAt: new Date().toISOString() } });
}

export async function clearAIInProgress(): Promise<void> {
  await chrome.storage.local.remove('pendingAIOperation');
}

export async function interruptedAI(): Promise<'quick' | 'topic' | null> {
  const result = await chrome.storage.local.get('pendingAIOperation');
  const operation = result.pendingAIOperation as { kind?: unknown } | undefined;
  const kind = operation?.kind;
  return kind === 'quick' || kind === 'topic' ? kind : null;
}
