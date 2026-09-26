import { getProjectReportStorageKey, safeReadJson, safeWriteJson } from '../storage';
import type { CouncilRun } from './councilTypes';

export function getCouncilRunStorageKey(projectId: string) {
  return `agent-force-council-runs:${projectId}`;
}

function isCouncilRunArray(value: unknown): value is CouncilRun[] {
  return Array.isArray(value) && value.every((item) => {
    if (!item || typeof item !== 'object') return false;
    const run = item as Partial<CouncilRun>;
    return (
      typeof run.id === 'string'
      && typeof run.projectId === 'string'
      && typeof run.startedAt === 'string'
      && Array.isArray(run.findings)
      && Array.isArray(run.productDirection)
      && Array.isArray(run.marketingDirection)
      && Array.isArray(run.engineeringRepairs)
    );
  });
}

export function safeReadCouncilRuns(projectId: string) {
  return safeReadJson<CouncilRun[]>(getCouncilRunStorageKey(projectId), [], isCouncilRunArray);
}

export function safeWriteCouncilRuns(projectId: string, runs: CouncilRun[]) {
  return safeWriteJson(getCouncilRunStorageKey(projectId), runs.slice(0, 12));
}

export { getProjectReportStorageKey };
