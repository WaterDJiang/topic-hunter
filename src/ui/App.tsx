import { Archive, ArrowUpRight, BookOpenText, Compass, Pause, Play, Settings2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Settings } from '../domain/types';
import { clearAIInProgress, interruptedAI } from '../lib/ai';
import { sendCommand } from '../lib/messages';
import { Discover } from './Discover';
import { QuickEditor } from './QuickEditor';
import { SettingsPanel } from './SettingsPanel';
import { TopicWorkbench } from './TopicWorkbench';
import { useLibrary } from './useLibrary';
import styles from './ui.module.css';

type View = 'discover' | 'quick' | 'topics' | 'settings';

export function App({ compact }: { compact: boolean }) {
  const { snapshot, error, refresh } = useLibrary();
  const [view, setView] = useState<View>('discover');
  const [quickPostId, setQuickPostId] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState('');

  useEffect(() => {
    void chrome.storage.local.get('pendingQuickPostId').then(async stored => {
      if (typeof stored.pendingQuickPostId === 'string') {
        setQuickPostId(stored.pendingQuickPostId);
        setView('quick');
        await chrome.storage.local.remove('pendingQuickPostId');
      }
    });
    void interruptedAI().then(kind => {
      if (kind) { setNotice('上次生成已中断，草稿仍在；需要时请手动重试。'); void clearAIInProgress(); }
    });
    const listener = (message: { type?: string; postId?: string }) => {
      if (message?.type === 'navigateQuickDraft' && typeof message.postId === 'string') {
        setQuickPostId(message.postId);
        setView('quick');
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const quick = (id: string) => { setQuickPostId(id); setView('quick'); };
  const toggleCapture = async () => {
    if (!snapshot) return;
    const settings: Settings = { ...snapshot.settings, captureEnabled: !snapshot.settings.captureEnabled };
    try { await sendCommand({ type: 'setSettings', settings }); setNotice(settings.captureEnabled ? '已恢复采集' : '已暂停采集'); }
    catch (failure) { setNotice(failure instanceof Error ? failure.message : '切换失败'); }
  };
  const openWorkspace = () => void chrome.tabs.create({ url: chrome.runtime.getURL('workspace.html') });
  const nav = [
    { view: 'discover' as const, label: '发现', icon: Compass },
    { view: 'topics' as const, label: '选题库', icon: BookOpenText },
    { view: 'settings' as const, label: '设置', icon: Settings2 },
  ];
  const theme = snapshot?.settings.theme ?? 'system';

  return <div className={`${styles.shell} ${compact ? styles.compact : styles.wide}`} data-theme={theme}>
    {!compact && <nav className={styles.rail} aria-label="主导航">
      <div className={styles.brand}><span className={styles.brandMark}>T<span>/</span>H</span><div><strong>Topic Hunter</strong><small>发现值得表达的角度</small></div></div>
      <div className={styles.railDivider} />
      <span className={styles.railLabel}>WORKSPACE</span>
      {nav.map(item => <button type="button" key={item.view} className={`${styles.railItem} ${view === item.view ? styles.railActive : ''}`} onClick={() => setView(item.view)}><item.icon size={18} /> {item.label}</button>)}
      <div className={styles.railBottom}><div className={styles.railStamp}>从浏览里<br />捡回好问题<span>✳</span></div><span>LOCAL FIRST / V0.1</span></div>
    </nav>}
    <div className={styles.mainArea}>
      <header className={styles.topBar}>
        {compact ? <div className={styles.brandCompact}><span className={styles.brandMark}>T<span>/</span>H</span><strong>Topic Hunter</strong></div> : <span className={styles.breadcrumb}>工作台 <span>/</span> {view === 'quick' ? '快速改写' : nav.find(item => item.view === view)?.label}</span>}
        <div className={styles.topActions}>
          <span className={`${styles.captureState} ${snapshot?.settings.captureEnabled ? '' : styles.paused}`}><span className={styles.statusPulse} />{snapshot?.settings.captureEnabled ? '正在捕获' : '已暂停'}</span>
          <button type="button" className={styles.iconButton} onClick={() => void toggleCapture()} title={snapshot?.settings.captureEnabled ? '暂停采集' : '恢复采集'} aria-label={snapshot?.settings.captureEnabled ? '暂停采集' : '恢复采集'}>{snapshot?.settings.captureEnabled ? <Pause size={16} /> : <Play size={16} />}</button>
          {compact && <button type="button" className={styles.iconButton} onClick={openWorkspace} aria-label="打开全页工作台" title="打开全页工作台"><ArrowUpRight size={17} /></button>}
        </div>
      </header>
      {compact && <nav className={styles.compactNav} aria-label="主导航">{nav.map(item => <button type="button" key={item.view} className={view === item.view ? styles.compactNavActive : ''} onClick={() => setView(item.view)}><item.icon size={16} />{item.label}</button>)}</nav>}
      {notice && <div className={styles.notice} role="status">{notice}<button type="button" onClick={() => setNotice('')} aria-label="关闭提示">×</button></div>}
      {error && <div className={styles.errorBox} role="alert">读取本地资料失败：{error} <button type="button" onClick={() => void refresh()}>重试</button></div>}
      {snapshot?.captureError && <div className={styles.errorBox} role="alert">{snapshot.captureError}</div>}
      {!snapshot && !error && <div className={styles.loading}><span className={styles.loadingMark}>✳</span> 正在打开本地工作台…</div>}
      {snapshot && <main className={styles.content}>
        {view === 'discover' && <Discover snapshot={snapshot} compact={compact} selected={selected} onSelected={setSelected} onQuick={quick} onDeep={() => setView('topics')} />}
        {view === 'quick' && <QuickEditor key={quickPostId} snapshot={snapshot} postId={quickPostId} onBack={() => setView('discover')} />}
        {view === 'topics' && <TopicWorkbench snapshot={snapshot} selectedPostIds={[...selected]} onBack={() => setView('discover')} />}
        {view === 'settings' && <SettingsPanel snapshot={snapshot} />}
      </main>}
      <footer className={styles.appFooter}><Archive size={13} /> 素材保存在本地浏览器 · 只捕获你打开的 X 页面</footer>
    </div>
  </div>;
}
