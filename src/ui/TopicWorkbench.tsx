import { ArrowLeft, ArrowUpRight, BookOpenText, Copy, Download, Save, Sparkles, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { topicPrompt } from '../domain/prompts';
import type { LibrarySnapshot, TopicCard, TopicStatus } from '../domain/types';
import { aiOrigin, clearAIInProgress, configured, markAIInProgress, runAI } from '../lib/ai';
import { downloadText } from '../lib/backup';
import { sendCommand } from '../lib/messages';
import { dateTime } from './format';
import styles from './ui.module.css';

const STATUS: Record<TopicStatus, string> = { considering: '待考虑', adopted: '已采用', discarded: '放弃' };

interface Props {
  snapshot: LibrarySnapshot;
  selectedPostIds: string[];
  onBack: () => void;
}

export function TopicWorkbench({ snapshot, selectedPostIds, onBack }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const existing = snapshot.topicCards.find(card => card.id === activeId);
  const sourceIds = existing?.sourcePostIds ?? selectedPostIds;
  const sources = sourceIds.map(id => snapshot.posts.find(post => post.id === id)).filter(post => post !== undefined);
  const validSelection = sources.length >= 1 && sources.length <= 10;
  const prompt = validSelection ? topicPrompt(sources, snapshot.settings.profile) : '';
  const currentContent = content;

  const openCard = (card: TopicCard) => {
    setActiveId(card.id);
    setContent(card.content);
    setMessage('');
  };
  const createNew = () => { setActiveId(null); setContent(''); setMessage(''); };
  const copy = async (value: string, label: string) => {
    try { await navigator.clipboard.writeText(value); setMessage(`${label}已复制`); }
    catch { setMessage('复制失败，请手动选择正文'); }
  };
  const generate = async () => {
    if (!validSelection || !configured(snapshot.settings.ai) || working) return;
    let host: string;
    try { host = new URL(aiOrigin(snapshot.settings.ai)).host; }
    catch (error) { setMessage(error instanceof Error ? error.message : '接口地址无效'); return; }
    const nextController = new AbortController();
    controller.current = nextController;
    setWorking(true);
    setMessage(`将向 ${host} 发送 ${sources.length} 条素材`);
    // Permission must be requested during the original click gesture.
    const request = runAI(snapshot.settings.ai, prompt, nextController.signal);
    void request.catch(() => undefined);
    try {
      await markAIInProgress('topic');
      setContent(await request);
      await clearAIInProgress();
      setMessage('选题已生成，请检查来源和待核实事项后保存');
    } catch (error) {
      if (!nextController.signal.aborted) {
        await clearAIInProgress();
        setMessage(error instanceof Error ? error.message : '生成失败，可复制提示词继续');
      }
    } finally { setWorking(false); controller.current = null; }
  };
  const save = async (status: TopicStatus = existing?.status ?? 'considering') => {
    if (!currentContent.trim() || !validSelection) return;
    const now = new Date().toISOString();
    const card: TopicCard = {
      id: existing?.id ?? crypto.randomUUID(), sourcePostIds: sourceIds,
      content: currentContent, status,
      createdAt: existing?.createdAt ?? now, updatedAt: now,
    };
    await sendCommand({ type: 'upsertTopic', card });
    setActiveId(card.id);
    setContent(card.content);
    setMessage('选题卡已保存');
  };
  const remove = async () => {
    if (!existing) return;
    await sendCommand({ type: 'deleteTopic', id: existing.id });
    createNew();
    setMessage('选题卡已删除，来源素材仍保留');
  };
  const exportMarkdown = () => {
    if (!existing) return;
    const links = sources.map((post, index) => `- [来源 ${index + 1}](${post.url})`).join('\n');
    downloadText(`topic-hunter-${existing.id}.md`, `${existing.content}\n\n## 来源\n${links}\n\n创建：${existing.createdAt}  更新：${existing.updatedAt}\n`, 'text/markdown;charset=utf-8');
    setMessage('Markdown 已导出');
  };

  return <div className={styles.topicPage}>
    <button type="button" className={styles.backButton} onClick={onBack}><ArrowLeft size={16} /> 返回素材</button>
    <div className={styles.editorIntro}><span className={styles.eyebrow}>STUDIO / 03</span><h2>把信号，写成下一个话题<span className={styles.titlePoint}>.</span></h2><p>多条素材放在一起看，找出值得展开的问题。</p></div>
    <div className={styles.topicColumns}>
      <aside className={styles.topicList}>
        <div className={styles.listHeading}><BookOpenText size={17} /> 选题库 <span>{snapshot.topicCards.length}</span></div>
        <button type="button" className={styles.outlineButton} onClick={createNew}>＋ 从已选素材新建</button>
        {snapshot.topicCards.length === 0 && <p className={styles.muted}>还没有选题卡。先从素材库选 1–10 条。</p>}
        {[...snapshot.topicCards].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).map(card => <button type="button" key={card.id} className={`${styles.topicListItem} ${activeId === card.id ? styles.topicListActive : ''}`} onClick={() => openCard(card)}>
          <span>{card.content.split('\n').find(line => line.trim())?.replace(/^#+\s*/, '').slice(0, 44) || '未命名选题'}</span>
          <small>{STATUS[card.status]} · {dateTime(card.updatedAt)}</small>
        </button>)}
      </aside>
      <section className={styles.topicEditor}>
        <div className={styles.paperLabel}><Sparkles size={16} /> {existing ? '编辑选题卡' : '生成新选题'} <span>{sources.length} 条来源</span></div>
        {sources.length > 0 ? <div className={styles.sourceChips}>{sources.map(post => <a key={post.id} href={post.url} target="_blank" rel="noreferrer">@{post.authorHandle ?? '未知作者'} <ArrowUpRight size={13} /></a>)}</div> : <p className={styles.caution}>先返回素材库选择 1–10 条帖子。</p>}
        {!existing && <div className={styles.actionPair}>
          <button type="button" className={styles.primaryButton} disabled={!validSelection || !configured(snapshot.settings.ai) || working} onClick={() => void generate()}><Sparkles size={16} /> {working ? '生成中…' : '生成选题'}</button>
          <button type="button" className={styles.outlineButton} disabled={!validSelection} onClick={() => void copy(prompt, '选题提示词')}><Copy size={16} /> 复制提示词</button>
        </div>}
        {!configured(snapshot.settings.ai) && !existing && <p className={styles.helper}>未配置接口，可复制提示词到外部 AI，再把结果贴入下方编辑区。</p>}
        {working && <button type="button" className={styles.textButton} onClick={() => { controller.current?.abort(); void clearAIInProgress(); setMessage('已取消'); }}><X size={15} /> 取消生成</button>}
        <label className={styles.fieldLabel} htmlFor="topic-content">选题内容 <small>Markdown 可编辑</small></label>
        <textarea id="topic-content" className={styles.topicTextarea} value={currentContent} onChange={event => setContent(event.target.value)} placeholder={'## 样本观察\n\n## 短推角度 1–3\n\n## 长文选题 1–2\n\n## 来源与待核实事项'} />
        <div className={styles.editorFooter}>
          <button type="button" className={styles.copyButton} disabled={!currentContent.trim() || !validSelection} onClick={() => void save()}><Save size={16} /> 保存选题卡</button>
          <button type="button" className={styles.outlineButton} disabled={!currentContent.trim()} onClick={() => void copy(currentContent, '选题内容')}><Copy size={16} /> 复制</button>
          {existing && <button type="button" className={styles.textButton} onClick={exportMarkdown}><Download size={16} /> Markdown</button>}
        </div>
        {existing && <div className={styles.statusRow}>状态：{(Object.keys(STATUS) as TopicStatus[]).map(status => <button type="button" key={status} className={existing.status === status ? styles.statusActive : styles.statusButton} onClick={() => void save(status)}>{STATUS[status]}</button>)}<button type="button" className={styles.textButton} onClick={() => void remove()}><Trash2 size={15} /> 删除</button></div>}
        {message && <p role="status" className={styles.inlineMessage}>{message}</p>}
      </section>
    </div>
  </div>;
}
