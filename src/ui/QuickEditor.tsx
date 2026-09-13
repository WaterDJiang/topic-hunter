import { ArrowLeft, ArrowUpRight, Copy, Feather, RotateCcw, Sparkles, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { quickPrompt } from '../domain/prompts';
import type { LibrarySnapshot, QuickDraft } from '../domain/types';
import { aiOrigin, clearAIInProgress, configured, markAIInProgress, runAI } from '../lib/ai';
import { sendCommand } from '../lib/messages';
import { dateTime, metric } from './format';
import styles from './ui.module.css';

interface Props {
  snapshot: LibrarySnapshot;
  postId: string;
  onBack: () => void;
}

export function QuickEditor({ snapshot, postId, onBack }: Props) {
  const post = snapshot.posts.find(item => item.id === postId);
  const stored = snapshot.quickDrafts.find(item => item.sourcePostId === postId);
  const [draft, setDraft] = useState<QuickDraft>(() => stored ?? {
    id: postId, sourcePostId: postId, perspective: '', text: '',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => () => controller.current?.abort(), []);
  if (!post) return <div className={styles.emptyState}><h2>素材不存在</h2><button type="button" onClick={onBack}>返回候选</button></div>;

  const update = (patch: Partial<QuickDraft>) => {
    const next = { ...draft, ...patch, updatedAt: new Date().toISOString() };
    setDraft(next);
    saveQueue.current = saveQueue.current.then(async () => { await sendCommand({ type: 'upsertDraft', draft: next }); }).catch(error => {
      setMessage(error instanceof Error ? error.message : '草稿保存失败');
    });
  };
  const copy = async (text: string, success: string) => {
    try { await navigator.clipboard.writeText(text); setMessage(success); }
    catch { setMessage('复制失败，请手动选择正文'); }
  };
  const generate = async () => {
    if (!configured(snapshot.settings.ai) || working) return;
    let host: string;
    try { host = new URL(aiOrigin(snapshot.settings.ai)).host; }
    catch (error) { setMessage(error instanceof Error ? error.message : '接口地址无效'); return; }
    const nextController = new AbortController();
    controller.current = nextController;
    setWorking(true);
    setMessage(`将向 ${host} 发送这条素材`);
    // Permission must be requested during the original click gesture.
    const request = runAI(snapshot.settings.ai, quickPrompt(post, snapshot.settings.profile, draft.perspective), nextController.signal);
    void request.catch(() => undefined);
    try {
      await markAIInProgress('quick');
      const result = await request;
      update({ text: result });
      await clearAIInProgress();
      setMessage('短推已生成，可继续修改后复制');
    } catch (error) {
      if (!nextController.signal.aborted) {
        await clearAIInProgress();
        setMessage(error instanceof Error ? error.message : '生成失败，可复制提示词继续');
      }
    } finally { setWorking(false); controller.current = null; }
  };
  const cancel = () => {
    controller.current?.abort();
    void clearAIInProgress();
    setMessage('已取消；现有草稿已保留');
  };
  const remove = async () => {
    await saveQueue.current;
    await sendCommand({ type: 'deleteDraft', id: draft.id });
    setDraft({ ...draft, text: '', perspective: '' });
    setMessage('草稿已删除');
  };

  return <div className={styles.editorPage}>
    <button type="button" className={styles.backButton} onClick={onBack}><ArrowLeft size={16} /> 返回候选</button>
    <div className={styles.editorIntro}>
      <span className={styles.eyebrow}>DRAFT / 02</span>
      <h2>让好素材，变成你的表达<span className={styles.titlePoint}>.</span></h2>
      <p>保留启发，写出自己的判断。复制后由你到 X 粘贴发布。</p>
    </div>
    <div className={styles.editorColumns}>
      <section className={styles.editorMain}>
        <div className={styles.paperLabel}><Feather size={16} /> 快速短推 <span>可编辑草稿</span></div>
        <label className={styles.fieldLabel} htmlFor="perspective">我的观点或例子 <small>可选</small></label>
        <textarea id="perspective" className={styles.smallTextarea} value={draft.perspective} onChange={event => update({ perspective: event.target.value })} placeholder="你想补充什么判断、经验或不同角度？" />
        <div className={styles.actionPair}>
          <button type="button" className={styles.primaryButton} disabled={!configured(snapshot.settings.ai) || working} onClick={() => void generate()}><Sparkles size={16} /> {working ? '生成中…' : '生成短推'}</button>
          <button type="button" className={styles.outlineButton} onClick={() => void copy(quickPrompt(post, snapshot.settings.profile, draft.perspective), '改写提示词已复制')}><Copy size={16} /> 复制改写提示词</button>
        </div>
        {!configured(snapshot.settings.ai) && <p className={styles.helper}>未配置接口，可先手写，或复制提示词到外部 AI。</p>}
        {working && <button type="button" className={styles.textButton} onClick={cancel}><X size={15} /> 取消生成</button>}
        <label className={styles.fieldLabel} htmlFor="draft-text">可编辑短推正文</label>
        <div className={styles.draftPaper}>
          <textarea id="draft-text" value={draft.text} onChange={event => update({ text: event.target.value })} placeholder="从这里开始写你的版本…" />
          <div className={styles.paperFoot}><span>本地自动保存</span><span>{[...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(draft.text)].length} 字符 · 发布前请在 X 核对长度</span></div>
        </div>
        <div className={styles.editorFooter}>
          <button type="button" className={styles.copyButton} disabled={!draft.text.trim()} onClick={() => void copy(draft.text, '已复制，可到 X 粘贴发布')}><Copy size={17} /> 复制稿件</button>
          <button type="button" className={styles.textButton} onClick={() => void remove()}><Trash2 size={15} /> 删除草稿</button>
        </div>
        {message && <p role="status" className={styles.inlineMessage}>{message}</p>}
      </section>
      <aside className={styles.sourcePanel}>
        <span className={styles.eyebrow}>SOURCE / 01</span>
        <h3>这条灵感从哪里来</h3>
        <div className={styles.sourceQuote}>“{post.text}”</div>
        <div className={styles.sourceMeta}><span>@{post.authorHandle ?? '未知作者'}</span><span>{dateTime(post.publishedAt)}</span></div>
        <div className={styles.metricRow}><span>{metric(post.latestMetrics.views)} 阅读</span><span>{metric(post.latestMetrics.likes)} 赞</span><span>{metric(post.latestMetrics.replies)} 回复</span></div>
        {!post.isComplete && <p className={styles.caution}>正文可能截断，请打开原帖核对。</p>}
        <a href={post.url} target="_blank" rel="noreferrer" className={styles.sourceLink}>查看原帖 <ArrowUpRight size={16} /></a>
        <div className={styles.sourceNote}><RotateCcw size={15} /><span>传播原因只能推测；个人经历和外部事实需自行核实。</span></div>
      </aside>
    </div>
  </div>;
}
