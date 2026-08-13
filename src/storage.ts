import type { AgentProject, ConnectorHealthCheck, ProjectActivity } from './types';

export function safeReadJson<T>(key: string, fallback: T, validate?: (value: unknown) => value is T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    if (validate && !validate(parsed)) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

export function safeWriteJson<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function getProjectReportStorageKey(projectId: string) {
  return `agent-force-daily-reports:${projectId}`;
}

export function getConnectorHealthStorageKey(projectId: string) {
  return `agent-force-connector-health:${projectId}`;
}

export function getActivityStorageKey(projectId: string) {
  return `agent-force-activity:${projectId}`;
}

export function getRegistryStorageKey() {
  return 'agent-force-project-registry';
}

function isConnectorHealthMap(value: unknown): value is Record<string, ConnectorHealthCheck> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every((item) => {
    if (!item || typeof item !== 'object') return false;
    const check = item as Partial<ConnectorHealthCheck>;
    return (
      typeof check.connectorId === 'string'
      && typeof check.checkedAt === 'string'
      && typeof check.status === 'string'
      && typeof check.reason === 'string'
      && typeof check.nextStep === 'string'
      && typeof check.dataSource === 'string'
    );
  });
}

function isProjectActivityArray(value: unknown): value is ProjectActivity[] {
  return Array.isArray(value) && value.every((item) => {
    if (!item || typeof item !== 'object') return false;
    const activity = item as Partial<ProjectActivity>;
    return (
      typeof activity.id === 'string'
      && typeof activity.projectId === 'string'
      && typeof activity.type === 'string'
      && typeof activity.message === 'string'
      && typeof activity.createdAt === 'string'
    );
  });
}

function isProjectArray(value: unknown): value is AgentProject[] {
  return Array.isArray(value) && value.every((item) => {
    if (!item || typeof item !== 'object') return false;
    const project = item as Partial<AgentProject>;
    return (
      typeof project.id === 'string'
      && typeof project.name === 'string'
      && typeof project.callsign === 'string'
      && Array.isArray(project.agents)
      && Array.isArray(project.connectors)
      && Array.isArray(project.launchActions)
    );
  });
}

export function safeReadConnectorHealth(projectId: string) {
  return safeReadJson<Record<string, ConnectorHealthCheck>>(getConnectorHealthStorageKey(projectId), {}, isConnectorHealthMap);
}

export function safeWriteConnectorHealth(projectId: string, checks: Record<string, ConnectorHealthCheck>) {
  return safeWriteJson(getConnectorHealthStorageKey(projectId), checks);
}

export function safeReadActivity(projectId: string) {
  return safeReadJson<ProjectActivity[]>(getActivityStorageKey(projectId), [], isProjectActivityArray);
}

export function safeWriteActivity(projectId: string, activity: ProjectActivity[]) {
  return safeWriteJson(getActivityStorageKey(projectId), activity.slice(0, 40));
}

export function safeReadRegistry() {
  return safeReadJson<AgentProject[]>(getRegistryStorageKey(), [], isProjectArray);
}

export function safeWriteRegistry(projects: AgentProject[]) {
  return safeWriteJson(getRegistryStorageKey(), projects);
}
