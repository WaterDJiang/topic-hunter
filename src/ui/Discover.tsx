import { ArrowUpRight, Bookmark, Check, Eye, Feather, Search, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useMemo, useRef, useState } from 'react';
import { matchingRules } from '../domain/rules';
import { averageViewsPerHour, latestMetricObservation, observedGrowth } from '../domain/metrics';
import type { LibrarySnapshot, Post } from '../domain/types';
import { sendCommand } from '../lib/messages';
import { dateTime, metric } from './format';
import styles from './ui.module.css';

type Preset = 'high-interaction' | 'small-account' | 'all';

interface Props {
  snapshot: LibrarySnapshot;
  compact: boolean;
  selected: Set<string>;
  onSelected: (selected: Set<string>) => void;
  onQuick: (id: string) => void;
  onDeep: () => void;
}

function PostCard({ post, selected, onToggle, onQuick, onSave, onEvidence, reasons }: {
  post: Post; selected: boolean; onToggle: () => void; onQuick: () => void; onSave: () => void; onEvidence?: () => void; reasons: string[];
}) {
  return <article className={`${styles.postCard} ${selected ? styles.postSelected : ''}`}>
    <div className={styles.postTop}>
      <label className={styles.selectPost}>
        <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`选择 @${post.authorHandle ?? '未知作者'} 的帖子`} />
        <span className={styles.author}>@{post.authorHandle ?? '未知作者'}</span>
      </label>
      <span className={styles.postTime}>{dateTime(post.publishedAt)}</span>
    </div>
    <p className={styles.postText}>{post.text}</p>
    <div className={styles.metricRow}>
      <span><b>{metric(post.latestMetrics.views)}</b> 阅读</span>
      <span><b>{metric(post.latestMetrics.likes)}</b> 赞</span>
      <span><b>{metric(post.latestMetrics.replies)}</b> 回复</span>
    </div>
    {reasons.length > 0 && <p className={styles.reason}><span className={styles.signalDot} /> 命中：{reasons[0]}</p>}
    {!post.isComplete && <p className={styles.caution}>正文可能截断，需打开原帖核对</p>}
    <div className={styles.postActions}>
      <button type="button" className={styles.smallPrimary} onClick={onQuick}><Feather size={15} /> 快速改写</button>
      {onEvidence && <button type="button" className={styles.iconButton} onClick={onEvidence} aria-label="查看素材证据" title="查看素材证据"><Eye size={16} /></button>}
      <button type="button" className={styles.iconButton} onClick={onSave} aria-label={post.saved ? '取消收藏' : '收藏素材'} title={post.saved ? '取消收藏' : '收藏素材'}>{post.saved ? <Check size={16} /> : <Bookmark size={16} />}</button>
      <a className={styles.iconButton} href={post.url} target="_blank" rel="noreferrer" aria-label="打开原帖" title="打开原帖"><ArrowUpRight size={16} /></a>
    </div>
  </article>;
}

export function Discover({ snapshot, compact, selected, onSelected, onQuick, onDeep }: Props) {
  const [preset, setPreset] = useState<Preset>('high-interaction');
  const [query, setQuery] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [language, setLanguage] = useState('');
  const [ageDays, setAgeDays] = useState('');
  const [minViews, setMinViews] = useState('');
  const [minLikes, setMinLikes] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => snapshot.posts.filter(post => {
    const matchesSearch = !query || `${post.text} ${post.authorHandle ?? ''}`.toLowerCase().includes(query.toLowerCase());
    if (!matchesSearch) return false;
    if (language && post.language !== language) return false;
    if (ageDays && (!post.publishedAt || Date.now() - Date.parse(post.publishedAt) > Number(ageDays) * 86_400_000)) return false;
    if (minViews && (post.latestMetrics.views === null || post.latestMetrics.views < Number(minViews))) return false;
    if (minLikes && (post.latestMetrics.likes === null || post.latestMetrics.likes < Number(minLikes))) return false;
    if (preset === 'all') return true;
    return matchingRules(post, snapshot.settings.rules).some(item => item.rule.id === preset);
  }).sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt)), [snapshot.posts, snapshot.settings.rules, query, preset, language, ageDays, minViews, minLikes]);
  const languages = [...new Set(snapshot.posts.map(post => post.language).filter((value): value is string => Boolean(value)))].sort();
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 192,
    overscan: 5,
    getItemKey: index => filtered[index]?.id ?? index,
  });
  const changeFilter = (change: () => void) => { change(); scrollRef.current?.scrollTo(0, 0); };
  const active = snapshot.posts.find(post => post.id === activeId) ?? filtered[0] ?? null;
  const observations = active ? snapshot.observations.filter(item => item.postId === active.id) : [];
  const growth = observedGrowth(observations);
  const viewsObservation = latestMetricObservation(observations, 'views');
  const average = viewsObservation && active ? averageViewsPerHour(viewsObservation, active.publishedAt) : null;
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onSelected(next);
    setActiveId(id);
  };
  const save = async (post: Post) => {
    try { await sendCommand({ type: 'setSaved', id: post.id, saved: !post.saved }); setMessage(post.saved ? '已取消收藏' : '素材已保存'); }
    catch (error) { setMessage(error instanceof Error ? error.message : '保存失败'); }
  };
  return <div className={styles.discoverLayout}>
    <section className={styles.discoverList} aria-label="素材列表">
      <div className={styles.sectionLead}>
        <div><span className={styles.eyebrow}>SIGNAL / 01</span><h2>发现值得写的瞬间<span className={styles.titlePoint}>.</span></h2></div>
        <span className={styles.countPill}>{filtered.length} 条命中</span>
      </div>
      <p className={styles.captureSummary}>已捕获 {snapshot.posts.length} 条 · 当前预设命中 {filtered.length} 条</p>
      <fieldset className={styles.filterBar}><legend className={styles.srOnly}>筛选预设</legend>
        <button type="button" className={preset === 'high-interaction' ? styles.filterActive : styles.filterButton} onClick={() => changeFilter(() => setPreset('high-interaction'))}>高互动</button>
        <button type="button" className={preset === 'small-account' ? styles.filterActive : styles.filterButton} onClick={() => changeFilter(() => setPreset('small-account'))}>小号发现</button>
        <button type="button" className={preset === 'all' ? styles.filterActive : styles.filterButton} onClick={() => changeFilter(() => setPreset('all'))}>全部</button>
      </fieldset>
      <label className={styles.searchBox}><span className={styles.srOnly}>搜索正文或作者</span><Search size={16} /><input value={query} onChange={event => changeFilter(() => setQuery(event.target.value))} placeholder="搜索正文或作者" /></label>
      <button type="button" className={styles.advancedToggle} onClick={() => setAdvanced(!advanced)} aria-expanded={advanced}><SlidersHorizontal size={14} /> {advanced ? '收起筛选' : '按语言、时间和指标筛选'}</button>
      {advanced && <div className={styles.advancedFilters}>
        <label>语言<select value={language} onChange={event => changeFilter(() => setLanguage(event.target.value))}><option value="">全部语言</option>{languages.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label>发布时间<select value={ageDays} onChange={event => changeFilter(() => setAgeDays(event.target.value))}><option value="">不限</option><option value="1">近 1 天</option><option value="7">近 7 天</option><option value="30">近 30 天</option></select></label>
        <label>阅读至少<input type="number" min="0" placeholder="不限" value={minViews} onChange={event => changeFilter(() => setMinViews(event.target.value))} /></label>
        <label>点赞至少<input type="number" min="0" placeholder="不限" value={minLikes} onChange={event => changeFilter(() => setMinLikes(event.target.value))} /></label>
      </div>}
      <div className={styles.listScroll} ref={scrollRef}>
        {filtered.length === 0 ? <div className={styles.emptyState}>
          <div className={styles.emptySymbol}>✳</div>
          <h3>{snapshot.posts.length === 0 ? '还没有捕获素材' : '当前筛选没有命中'}</h3>
          <p>{snapshot.posts.length === 0 ? '打开或刷新 X 页面后浏览首页、搜索、列表、主页或帖子详情。插件只观察已加载的内容。' : `已捕获 ${snapshot.posts.length} 条；当前预设没有命中。可查看全部，或调整设置中的阈值。`}</p>
          {snapshot.posts.length > 0 && <button type="button" className={styles.outlineButton} onClick={() => changeFilter(() => setPreset('all'))}>查看全部 {snapshot.posts.length} 条素材</button>}
        </div> : <div className={styles.virtualCanvas} style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map(row => {
            const post = filtered[row.index];
            if (!post) return null;
            return <div key={row.key} ref={virtualizer.measureElement} data-index={row.index} className={styles.virtualItem} style={{ transform: `translateY(${row.start}px)` }}>
              <PostCard post={post} selected={selected.has(post.id)} onToggle={() => toggle(post.id)} onQuick={() => onQuick(post.id)} onEvidence={compact ? undefined : () => setActiveId(post.id)} onSave={() => void save(post)} reasons={matchingRules(post, snapshot.settings.rules).flatMap(item => item.reasons)} />
            </div>;
          })}
        </div>}
      </div>
      {message && <p className={styles.inlineMessage} role="status">{message}</p>}
      <div className={styles.selectionBar}>
        <span><b>{selected.size}</b> 条已选</span>
        <button type="button" className={styles.primaryButton} disabled={selected.size < 1 || selected.size > 10} onClick={onDeep}><Sparkles size={16} /> 深挖选题</button>
      </div>
      {selected.size > 10 && <p className={styles.caution}>一次最多选 10 条素材</p>}
    </section>
    {!compact && <aside className={styles.evidencePanel} aria-label="素材证据">
      <span className={styles.eyebrow}>EVIDENCE / SOURCE</span>
      {active ? <>
        <h3>原帖证据</h3>
        <p className={styles.evidenceText}>{active.text}</p>
        <a className={styles.sourceLink} href={active.url} target="_blank" rel="noreferrer">查看 @ {active.authorHandle ?? '未知作者'} 原帖 <ArrowUpRight size={15} /></a>
        <div className={styles.evidenceRule} />
        <dl className={styles.evidenceGrid}>
          {([['views', '阅读'], ['likes', '点赞'], ['replies', '回复'], ['reposts', '转发']] as const).map(([key, label]) => {
            const item = latestMetricObservation(observations, key);
            return <div key={key}><dt>{label}</dt><dd>{metric(active.latestMetrics[key])}</dd><small>{item ? `${dateTime(item.observedAt)} · ${item.source === 'graphql' ? '页面响应' : '可见内容'}` : '观测未知'}</small></div>;
          })}
        </dl>
        <p className={styles.metaLine}>最后采集 {dateTime(active.lastSeenAt)}</p>
        <p className={styles.metaLine}>平均热度：{average === null ? '未知' : `${metric(Math.round(average))} 累计阅读／小时`}</p>
        <p className={styles.metaLine}>{growth === null ? '新增阅读／小时：需要两次有效观测' : growth.kind === 'rollback' ? '两次观测间计数回落' : `两次观测间新增 ${metric(Math.round(growth.perHour))} 阅读／小时`}</p>
        {growth && <p className={styles.metaLine}>区间：{dateTime(growth.from)} → {dateTime(growth.to)}</p>}
        <button type="button" className={styles.outlineButton} onClick={() => onQuick(active.id)}><Feather size={16} /> 用这条快速改写</button>
      </> : <p className={styles.muted}>选择一条素材，查看来源与指标。</p>}
    </aside>}
  </div>;
}
