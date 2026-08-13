import { ArrowRight, Eye, GitBranch, ShieldAlert, Sparkles, UserCheck } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { characterRegistry } from '../characters/characterRegistry';
import {
  getCouncilCharacterState,
  getCouncilCharacterSummary
} from '../characters/characterEngine';
import type { AgentCharacter } from '../characters/characterTypes';
import type { CouncilRun } from '../council/councilTypes';
import { CharacterAvatar } from './CharacterAvatar';
import { CharacterStatusBadge } from './CharacterStatusBadge';

const councilCharacterIds = ['princess-leia', 'chewmacka', 'han-solo', 'luke-skywalker', 'ceo'];

const actionLabels: Record<string, string> = {
  'princess-leia': 'View QA Findings',
  'luke-skywalker': 'Generate Repair Prompt',
  chewmacka: 'Review Brand/SEO Findings',
  'han-solo': 'View Product Direction',
  ceo: 'View Final Decision'
};

const workflowIcons: Record<string, ReactNode> = {
  'princess-leia': <ShieldAlert size={15} />,
  chewmacka: <Sparkles size={15} />,
  'han-solo': <UserCheck size={15} />,
  'luke-skywalker': <GitBranch size={15} />,
  ceo: <Eye size={15} />
};

function getActiveWorkflowIndex(run?: CouncilRun | null) {
  if (!run) return 0;
  if (run.executiveDecision?.decision) return 4;
  if (run.engineeringRepairs.length) return 3;
  if (run.productDirection.length) return 2;
  if (run.marketingDirection.length) return 1;
  return 0;
}

export function CharacterCouncilChamber({
  run,
  onCharacterAction
}: {
  run?: CouncilRun | null;
  onCharacterAction?: (characterId: string) => void;
}) {
  const characters = useMemo(() => (
    councilCharacterIds
      .map((id) => characterRegistry.find((character) => character.id === id))
      .filter(Boolean) as AgentCharacter[]
  ), []);
  const [selectedId, setSelectedId] = useState(characters[0]?.id ?? '');
  const selectedCharacter = characters.find((character) => character.id === selectedId) ?? characters[0];
  const selectedState = selectedCharacter ? getCouncilCharacterState(selectedCharacter.id, run) : 'idle';
  const selectedSummary = selectedCharacter ? getCouncilCharacterSummary(selectedCharacter.id, run) : null;
  const activeWorkflowIndex = getActiveWorkflowIndex(run);

  return (
    <section className="character-council-chamber" aria-label="Council character chamber">
      <div className="character-council-header">
        <div>
          <div className="eyebrow"><UserCheck size={15} /> Council Chamber</div>
          <h3>Cinematic operator council</h3>
          <p>Original human command-center personas show who owns QA, brand, product, repair, and final approval for this review.</p>
        </div>
        <div className="character-council-flow" aria-label="Council workflow state">
          {characters.map((character, index) => (
            <span key={character.id} className={index <= activeWorkflowIndex ? 'active' : ''}>
              {workflowIcons[character.id]}
              {character.displayName}
            </span>
          ))}
        </div>
      </div>

      <div className="character-council-grid">
        {characters.map((character) => {
          const state = getCouncilCharacterState(character.id, run);
          const summary = getCouncilCharacterSummary(character.id, run);
          const selected = selectedId === character.id;

          return (
            <article
              key={character.id}
              className={`character-council-card ${selected ? 'selected' : ''}`}
              style={{ '--character-accent': character.accentColor } as CSSProperties}
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              aria-label={`${character.displayName}, ${character.archetype}. ${summary.findingCount} findings, ${summary.assignedRepairCount} repairs.`}
              onClick={() => setSelectedId(character.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setSelectedId(character.id);
                }
              }}
            >
              <CharacterAvatar character={character} state={state} showLabel className="council-character-avatar" />
              <div className="character-council-copy">
                <CharacterStatusBadge state={state} compact />
                <p>{character.description}</p>
                <div className="character-council-stats">
                  <span><strong>{summary.findingCount}</strong> findings</span>
                  <span><strong>{summary.assignedRepairCount}</strong> repairs</span>
                </div>
                <span className="character-output">{summary.output}</span>
                {selected && (
                  <div className="character-role-details">
                    {character.primarySurfaces.slice(0, 3).map((surface) => <span key={surface}>{surface}</span>)}
                  </div>
                )}
                <button
                  className="character-action-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onCharacterAction?.(character.id);
                  }}
                >
                  {actionLabels[character.id]} <ArrowRight size={15} />
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {selectedCharacter && selectedSummary && (
        <aside
          className="character-council-dossier"
          style={{ '--character-accent': selectedCharacter.accentColor } as CSSProperties}
          aria-label={`${selectedCharacter.displayName} role dossier`}
        >
          <div>
            <div className="eyebrow">Selected Operator</div>
            <h3>{selectedCharacter.displayName}</h3>
            <strong>{selectedCharacter.archetype}</strong>
            <p>{selectedSummary.output}</p>
          </div>
          <div className="character-dossier-grid">
            <span><strong>{selectedSummary.findingCount}</strong> Owned findings</span>
            <span><strong>{selectedSummary.assignedRepairCount}</strong> Assigned repairs</span>
            <span><strong>{selectedState.replace('_', ' ')}</strong> Current state</span>
          </div>
          <div className="character-role-details">
            {selectedCharacter.primarySurfaces.map((surface) => <span key={surface}>{surface}</span>)}
          </div>
          <button className="character-action-button" onClick={() => onCharacterAction?.(selectedCharacter.id)}>
            {actionLabels[selectedCharacter.id]} <ArrowRight size={15} />
          </button>
        </aside>
      )}
    </section>
  );
}
