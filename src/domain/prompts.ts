import type { CreatorProfile, Post } from './types';

function profileLines(profile: CreatorProfile): string {
  return [
    `关注领域：${profile.field || '未指定'}`,
    `目标读者：${profile.audience || '未指定'}`,
    `输出语言：${profile.language || '中文'}`,
    `已有观点：${profile.viewpoint || '未指定'}`,
  ].join('\n');
}

function source(post: Post): string {
  const m = post.latestMetrics;
  return [
    `原帖：${post.url}`,
    `作者：${post.authorHandle ? `@${post.authorHandle}` : '未知'}`,
    `正文：${post.text}`,
    `完整性：${post.isComplete ? '完整' : '可能截断'}`,
    `发布时间：${post.publishedAt ?? '未知'}`,
    `观测时间：${post.lastSeenAt}`,
    `阅读：${m.views ?? '未知'}；点赞：${m.likes ?? '未知'}；回复：${m.replies ?? '未知'}；转发：${m.reposts ?? '未知'}`,
  ].join('\n');
}

export function quickPrompt(post: Post, profile: CreatorProfile, perspective: string): string {
  return [
    '你是内容创作者的写作助手。根据来源帖子写一条可编辑的原创短推。',
    '保留启发，但不要近似复述原帖；写出独立判断或不同切入点。不得虚构我的个人经历、评论观点或外部事实。未知事实不要补齐。只输出短推正文，不要标题或解释。',
    '尽量简洁；字符数由我在 X 发布前自行检查。',
    profileLines(profile),
    `我想补充的观点或例子：${perspective || '未提供；不要编造个人经历'}`,
    source(post),
  ].join('\n\n');
}

export function topicPrompt(posts: Post[], profile: CreatorProfile): string {
  return [
    '你是内容选题编辑。综合下面 1–10 条来源帖子，产出可编辑的中文 Markdown 选题卡。',
    '结构必须包含：样本观察（主题、表达结构、可见互动信号）、3 个短推角度（核心观点、开头方向、作者需补充的经验或例子）、2 个长文选题（核心问题、目标读者、差异化切入点、3–5 点提纲）、来源引用、待核实事项。',
    '传播原因必须明确写“推测”；不得把相关性写成因果。不得虚构作者个人经历、评论内容或外部事实。只分析给定样本，出处使用原帖 URL。',
    profileLines(profile),
    posts.map((post, index) => `样本 ${index + 1}\n${source(post)}`).join('\n\n'),
  ].join('\n\n');
}
