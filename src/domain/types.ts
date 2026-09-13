export type MetricSource = 'graphql' | 'dom';

export interface Metrics {
  views: number | null;
  likes: number | null;
  replies: number | null;
  reposts: number | null;
  bookmarks: number | null;
  followers: number | null;
}

export interface CapturedPost {
  id: string;
  url: string;
  text: string;
  authorId: string | null;
  authorHandle: string | null;
  publishedAt: string | null;
  isComplete: boolean;
  quotedPostId: string | null;
  language: string | null;
  metrics: Metrics;
  source: MetricSource;
}

export interface Post extends Omit<CapturedPost, 'metrics' | 'source'> {
  capturedAt: string;
  lastSeenAt: string;
  saved: boolean;
  latestMetrics: Metrics;
  latestMetricSource: MetricSource;
}

export interface MetricObservation {
  id: string;
  postId: string;
  observedAt: string;
  source: MetricSource;
  metrics: Metrics;
}

export interface CaptureRule {
  id: 'high-interaction' | 'small-account';
  enabled: boolean;
  maxCharacters: number;
  maxAgeDays: number;
  maxFollowers: number | null;
  minViews: number | null;
  minLikes: number | null;
  minReplies: number | null;
}

export interface CreatorProfile {
  field: string;
  audience: string;
  language: string;
  viewpoint: string;
}

export interface AIConfig {
  endpoint: string;
  model: string;
  apiKey: string;
}

export interface Settings {
  captureEnabled: boolean;
  rules: CaptureRule[];
  profile: CreatorProfile;
  ai: AIConfig;
  theme: 'system' | 'light' | 'dark';
}

export interface PublicSettings {
  captureEnabled: boolean;
  rules: CaptureRule[];
}

export interface QuickDraft {
  id: string;
  sourcePostId: string;
  perspective: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export type TopicStatus = 'considering' | 'adopted' | 'discarded';

export interface TopicCard {
  id: string;
  sourcePostIds: string[];
  content: string;
  status: TopicStatus;
  createdAt: string;
  updatedAt: string;
}

export interface LibrarySnapshot {
  posts: Post[];
  observations: MetricObservation[];
  quickDrafts: QuickDraft[];
  topicCards: TopicCard[];
  settings: Settings;
  captureError?: string | null;
}

export const EMPTY_METRICS: Metrics = {
  views: null,
  likes: null,
  replies: null,
  reposts: null,
  bookmarks: null,
  followers: null,
};
