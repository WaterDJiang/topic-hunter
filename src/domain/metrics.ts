import type { MetricObservation, Metrics } from './types';

export function latestMetricObservation(observations: MetricObservation[], key: keyof Metrics): MetricObservation | null {
  return observations
    .filter(item => item.metrics[key] !== null)
    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0] ?? null;
}

export function averageViewsPerHour(observation: MetricObservation, publishedAt: string | null): number | null {
  const views = observation.metrics.views;
  if (views === null || !publishedAt) return null;
  const hours = (Date.parse(observation.observedAt) - Date.parse(publishedAt)) / 3_600_000;
  return Number.isFinite(hours) && hours > 0 ? views / hours : null;
}

export type Growth =
  | { kind: 'growth'; perHour: number; from: string; to: string }
  | { kind: 'rollback'; from: string; to: string }
  | null;

export function observedGrowth(observations: MetricObservation[]): Growth {
  const valid = observations.filter(item => item.metrics.views !== null).sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
  if (valid.length < 2) return null;
  const previous = valid[valid.length - 2];
  const latest = valid[valid.length - 1];
  if (!previous || !latest || previous.metrics.views === null || latest.metrics.views === null) return null;
  const hours = (Date.parse(latest.observedAt) - Date.parse(previous.observedAt)) / 3_600_000;
  if (!Number.isFinite(hours) || hours <= 0) return null;
  if (latest.metrics.views < previous.metrics.views) return { kind: 'rollback', from: previous.observedAt, to: latest.observedAt };
  return { kind: 'growth', perHour: (latest.metrics.views - previous.metrics.views) / hours, from: previous.observedAt, to: latest.observedAt };
}
