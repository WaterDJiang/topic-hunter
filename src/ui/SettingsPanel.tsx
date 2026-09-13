import { Download, RotateCcw, Save, Settings2, Upload } from 'lucide-react';
import { useState } from 'react';
import { DEFAULT_RULES } from '../domain/rules';
import type { CaptureRule, LibrarySnapshot, Settings } from '../domain/types';
import { createBackup, downloadText, parseBackup } from '../lib/backup';
import { sendCommand } from '../lib/messages';
import styles from './ui.module.css';

export function SettingsPanel({ snapshot }: { snapshot: LibrarySnapshot }) {
  const [form, setForm] = useState<Settings>(snapshot.settings);
  const [message, setMessage] = useState('');
  const updateRule = (id: CaptureRule['id'], patch: Partial<CaptureRule>) => setForm(previous => ({
    ...previous, rules: previous.rules.map(rule => rule.id === id ? { ...rule, ...patch } : rule),
  }));
  const save = async () => {
    try { await sendCommand({ type: 'setSettings', settings: form }); setMessage('设置已保存'); }
    catch (error) { setMessage(error instanceof Error ? error.message : '保存失败'); }
  };
  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = parseBackup(await file.text());
      await sendCommand({ type: 'importBackup', data: { posts: parsed.posts, observations: parsed.observations, quickDrafts: parsed.quickDrafts, topicCards: parsed.topicCards } });
      setMessage(`导入完成：${parsed.posts.length} 条素材，已有编辑内容不会被覆盖`);
    } catch (error) { setMessage(error instanceof Error ? error.message : '导入失败'); }
  };
  const exportFile = () => {
    downloadText(`topic-hunter-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(createBackup(snapshot), null, 2), 'application/json;charset=utf-8');
    setMessage('JSON 备份已导出，不包含 AI 密钥');
  };
  return <div className={styles.settingsPage}>
    <div className={styles.editorIntro}><span className={styles.eyebrow}>CONTROL / 04</span><h2>把发现方式调成你的节奏<span className={styles.titlePoint}>.</span></h2><p>采集只发生在你打开的 X 页面。AI 仅在你点击生成后调用。</p></div>
    <div className={styles.settingsGrid}>
      <section className={styles.settingsSection}>
        <div className={styles.paperLabel}><Settings2 size={17} /> 发现规则 <span>默认值可恢复</span></div>
        {form.rules.map(rule => <div key={rule.id} className={styles.ruleCard}>
          <label className={styles.switchRow}><span><strong>{rule.id === 'high-interaction' ? '短内容高互动' : '小号发现'}</strong><small>{rule.id === 'high-interaction' ? '看可见互动信号' : '发现低粉作者的好内容'}</small></span><input type="checkbox" checked={rule.enabled} onChange={event => updateRule(rule.id, { enabled: event.target.checked })} /></label>
          <div className={styles.numberGrid}>
            <label>最大字符<input type="number" min="1" value={rule.maxCharacters} onChange={event => updateRule(rule.id, { maxCharacters: Number(event.target.value) })} /></label>
            <label>最近天数<input type="number" min="1" value={rule.maxAgeDays} onChange={event => updateRule(rule.id, { maxAgeDays: Number(event.target.value) })} /></label>
            {rule.id === 'small-account' && <label>粉丝上限<input type="number" min="0" value={rule.maxFollowers ?? ''} onChange={event => updateRule(rule.id, { maxFollowers: event.target.value === '' ? null : Number(event.target.value) })} /></label>}
            <label>阅读至少<input type="number" min="0" placeholder="不限制" value={rule.minViews ?? ''} onChange={event => updateRule(rule.id, { minViews: event.target.value === '' ? null : Number(event.target.value) })} /></label>
            <label>点赞至少<input type="number" min="0" placeholder="不限制" value={rule.minLikes ?? ''} onChange={event => updateRule(rule.id, { minLikes: event.target.value === '' ? null : Number(event.target.value) })} /></label>
            <label>回复至少<input type="number" min="0" placeholder="不限制" value={rule.minReplies ?? ''} onChange={event => updateRule(rule.id, { minReplies: event.target.value === '' ? null : Number(event.target.value) })} /></label>
          </div>
        </div>)}
        <button type="button" className={styles.textButton} onClick={() => setForm(previous => ({ ...previous, rules: DEFAULT_RULES }))}><RotateCcw size={15} /> 恢复默认规则</button>
      </section>
      <section className={styles.settingsSection}>
        <div className={styles.paperLabel}>创作定位 <span>选填</span></div>
        <div className={styles.fieldStack}><label>界面主题<select value={form.theme} onChange={event => setForm({ ...form, theme: event.target.value as Settings['theme'] })}><option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option></select></label></div>
        <div className={styles.fieldStack}>
          <label>关注领域<input value={form.profile.field} onChange={event => setForm({ ...form, profile: { ...form.profile, field: event.target.value } })} placeholder="例如：AI 产品、创业、写作" /></label>
          <label>目标读者<input value={form.profile.audience} onChange={event => setForm({ ...form, profile: { ...form.profile, audience: event.target.value } })} placeholder="例如：独立开发者" /></label>
          <label>输出语言<input value={form.profile.language} onChange={event => setForm({ ...form, profile: { ...form.profile, language: event.target.value } })} /></label>
          <label>已有观点<textarea value={form.profile.viewpoint} onChange={event => setForm({ ...form, profile: { ...form.profile, viewpoint: event.target.value } })} placeholder="你通常坚持的判断或立场" /></label>
        </div>
        <div className={styles.paperLabel}>AI 接口 <span>OpenAI 兼容格式</span></div>
        <p className={styles.helper}>点击生成时，将所选帖子正文、指标和创作定位发送至你配置的接口。密钥留在扩展可信存储中，不进入备份。</p>
        <div className={styles.fieldStack}>
          <label>Chat Completions 接口地址<input type="url" value={form.ai.endpoint} onChange={event => setForm({ ...form, ai: { ...form.ai, endpoint: event.target.value } })} placeholder="https://api.example.com/v1/chat/completions" /></label>
          <label>模型<input value={form.ai.model} onChange={event => setForm({ ...form, ai: { ...form.ai, model: event.target.value } })} placeholder="model-name" /></label>
          <label>API 密钥<input type="password" autoComplete="off" value={form.ai.apiKey} onChange={event => setForm({ ...form, ai: { ...form.ai, apiKey: event.target.value } })} placeholder="仅保存在本机扩展中" /></label>
        </div>
      </section>
      <section className={styles.settingsSection}>
        <div className={styles.paperLabel}>本地资料 <span>JSON 备份</span></div>
        <p className={styles.helper}>备份包含素材、观测、快速稿和选题卡；不包含密钥。导入会按 ID 合并，不覆盖现有编辑内容。</p>
        <div className={styles.actionPair}>
          <button type="button" className={styles.outlineButton} onClick={exportFile}><Download size={16} /> 导出备份</button>
          <label className={styles.fileButton}><Upload size={16} /> 导入备份<input type="file" accept="application/json,.json" onChange={event => void importFile(event.target.files?.[0])} /></label>
        </div>
        <button type="button" className={styles.textButton} onClick={() => void sendCommand<{ removed: number }>({ type: 'clearExpired' }).then(result => setMessage(`已清理 ${result.removed} 条过期自动候选`)).catch(error => setMessage(String(error)))}>清理 30 天前未收藏、未引用的候选</button>
      </section>
    </div>
    <div className={styles.settingsSave}><button type="button" className={styles.copyButton} onClick={() => void save()}><Save size={16} /> 保存设置</button>{message && <p role="status" className={styles.inlineMessage}>{message}</p>}</div>
  </div>;
}
