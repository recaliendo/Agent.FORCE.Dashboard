import type { CharacterState } from '../characters/characterTypes';

const stateLabels: Record<CharacterState, string> = {
  idle: 'Standing by',
  scanning: 'Scanning',
  repairing: 'Repairing',
  reviewing: 'Reviewing',
  warning: 'Needs attention',
  blocked: 'Blocked',
  approved: 'Approved',
  completed: 'Completed'
};

export function getCharacterStateLabel(state: CharacterState) {
  return stateLabels[state];
}

export function CharacterStatusBadge({ state, compact = false }: { state: CharacterState; compact?: boolean }) {
  return (
    <span className={`character-status-badge character-state-${state} ${compact ? 'character-status-compact' : ''}`}>
      <i aria-hidden="true" />
      {stateLabels[state]}
    </span>
  );
}
