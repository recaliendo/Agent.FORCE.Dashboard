import { ArrowRight, ShieldCheck } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { AgentCharacter, CharacterState } from '../characters/characterTypes';
import type { CharacterSignal } from '../characters/characterEngine';
import { CharacterAvatar } from './CharacterAvatar';
import { CharacterStatusBadge } from './CharacterStatusBadge';

interface CharacterStageProps {
  signal?: CharacterSignal;
  character?: AgentCharacter;
  state?: CharacterState;
  eyebrow?: string;
  title?: string;
  reason?: string;
  output?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
  className?: string;
}

export function CharacterStage({
  signal,
  character: directCharacter,
  state: directState,
  eyebrow = 'Advisor Signal',
  title,
  reason,
  output,
  actionLabel,
  onAction,
  compact = false,
  className = ''
}: CharacterStageProps) {
  const character = signal?.character ?? directCharacter;
  if (!character) return null;

  const state = signal?.state ?? directState ?? character.state;
  const resolvedReason = signal?.reason ?? reason ?? character.description;
  const resolvedAction = actionLabel ?? signal?.nextAction ?? 'View Role Details';

  return (
    <section
      className={`character-stage glass-panel ${compact ? 'character-stage-compact' : ''} ${className}`}
      style={{ '--character-accent': character.accentColor } as CSSProperties}
      aria-label={`${eyebrow}: ${character.displayName}, ${character.archetype}`}
    >
      <span className="character-stage-cinema character-stage-cinema-a" aria-hidden="true" />
      <span className="character-stage-cinema character-stage-cinema-b" aria-hidden="true" />
      <CharacterAvatar character={character} state={state} compact={compact} />
      <div className="character-stage-copy">
        <div className="character-stage-topline">
          <div className="eyebrow"><ShieldCheck size={15} /> {eyebrow}</div>
          <CharacterStatusBadge state={state} compact={compact} />
        </div>
        <h3>{title ?? character.displayName}</h3>
        <strong>{character.archetype}</strong>
        <p>{resolvedReason}</p>
        <div className="character-stage-intel">
          <span><small>Owner</small>{character.primarySurfaces[0]}</span>
          <span><small>Next move</small>{resolvedAction}</span>
        </div>
        {output && <span className="character-output">{output}</span>}
        <div className="character-motif-list" aria-label={`${character.displayName} visual role signals`}>
          {character.visualMotifs.slice(0, compact ? 2 : 3).map((motif) => <span key={motif}>{motif}</span>)}
        </div>
        <button className="character-action-button" onClick={onAction} disabled={!onAction}>
          {resolvedAction} <ArrowRight size={15} />
        </button>
      </div>
    </section>
  );
}
