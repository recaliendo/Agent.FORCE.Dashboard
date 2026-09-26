export type ProjectRoute =
  | { kind: 'launch' }
  | { kind: 'project'; projectId: string }
  | { kind: 'not_found'; requestedId: string };

export function resolveProjectRoute(hash: string, projectIds: string[]): ProjectRoute {
  const match = /^#\/projects\/([^/?#]+)$/.exec(hash);
  if (!match) return { kind: 'launch' };
  const requestedId = decodeURIComponent(match[1]);
  return projectIds.includes(requestedId)
    ? { kind: 'project', projectId: requestedId }
    : { kind: 'not_found', requestedId };
}

export function projectHash(projectId: string) {
  return `#/projects/${encodeURIComponent(projectId)}`;
}
