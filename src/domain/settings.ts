import { DEFAULT_RULES } from './rules';
import type { Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  captureEnabled: true,
  rules: DEFAULT_RULES,
  profile: { field: '', audience: '', language: '中文', viewpoint: '' },
  ai: { endpoint: '', model: '', apiKey: '' },
  theme: 'system',
};

export function normalizeSettings(value: unknown): Settings {
  const source = value && typeof value === 'object' ? value as Partial<Settings> : {};
  const profile = source.profile && typeof source.profile === 'object' ? source.profile : DEFAULT_SETTINGS.profile;
  const ai = source.ai && typeof source.ai === 'object' ? source.ai : DEFAULT_SETTINGS.ai;
  const numeric = (value: unknown, fallback: number | null) =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
  const rules = DEFAULT_RULES.map(defaultRule => {
    const selected = source.rules?.find(rule => rule?.id === defaultRule.id);
    if (!selected) return defaultRule;
    return {
      id: defaultRule.id,
      enabled: selected.enabled === true,
      maxCharacters: numeric(selected.maxCharacters, defaultRule.maxCharacters) ?? defaultRule.maxCharacters,
      maxAgeDays: numeric(selected.maxAgeDays, defaultRule.maxAgeDays) ?? defaultRule.maxAgeDays,
      maxFollowers: numeric(selected.maxFollowers, defaultRule.maxFollowers),
      minViews: numeric(selected.minViews, defaultRule.minViews),
      minLikes: numeric(selected.minLikes, defaultRule.minLikes),
      minReplies: numeric(selected.minReplies, defaultRule.minReplies),
    };
  });
  const text = (value: unknown, limit: number) => typeof value === 'string' ? value.slice(0, limit) : '';
  return {
    captureEnabled: source.captureEnabled !== false,
    rules,
    profile: {
      field: text(profile.field, 200),
      audience: text(profile.audience, 200),
      language: text(profile.language, 50) || '中文',
      viewpoint: text(profile.viewpoint, 1_000),
    },
    ai: {
      endpoint: text(ai.endpoint, 2_000),
      model: text(ai.model, 200),
      apiKey: text(ai.apiKey, 2_000),
    },
    theme: source.theme === 'light' || source.theme === 'dark' ? source.theme : 'system',
  };
}
