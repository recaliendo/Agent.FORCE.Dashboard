import type { ConnectorStatus, ProjectStatus } from './types';

/**
 * One semantic status vocabulary for the whole app. Surfaces pick a tone from
 * here instead of choosing colours locally, and always render the label as
 * text so status never depends on colour alone.
 */
export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export function projectStatusTone(status: ProjectStatus): StatusTone {
  switch (status) {
    case 'Ready': return 'success';
    case 'Building':
    case 'Planning': return 'info';
    case 'Needs QA':
    case 'Needs Attention': return 'warning';
    case 'Unknown': return 'warning';
    default: return 'neutral';
  }
}

export const CONNECTOR_STATUS_LABEL: Record<ConnectorStatus, string> = {
  connected: 'Connected',
  needs_setup: 'Needs setup',
  attention: 'Needs attention',
  unknown: 'Unverified'
};

export function connectorStatusTone(status: ConnectorStatus): StatusTone {
  switch (status) {
    case 'connected': return 'success';
    case 'attention': return 'danger';
    case 'needs_setup': return 'warning';
    default: return 'neutral';
  }
}

/** Readiness-style score (higher is better) → tone. */
export function scoreTone(value: number): StatusTone {
  return value >= 70 ? 'success' : value >= 40 ? 'warning' : 'danger';
}

/** Risk score (higher is worse) → tone. */
export function riskTone(value: number): StatusTone {
  return value >= 70 ? 'danger' : value >= 40 ? 'warning' : 'success';
}
