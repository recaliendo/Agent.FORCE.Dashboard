import type { CSSProperties } from 'react';
import type { AgentCharacter, CharacterState } from '../characters/characterTypes';
import { CharacterStatusBadge, getCharacterStateLabel } from './CharacterStatusBadge';

interface CharacterAvatarProps {
  character: AgentCharacter;
  state?: CharacterState;
  compact?: boolean;
  showLabel?: boolean;
  className?: string;
}

function characterStyle(character: AgentCharacter): CSSProperties {
  return {
    '--character-accent': character.accentColor
  } as CSSProperties;
}

function getMouthPath(state: CharacterState) {
  if (state === 'warning') return 'M84 91c8-4 17-4 25 0';
  if (state === 'blocked') return 'M84 91h24';
  if (state === 'approved' || state === 'completed') return 'M83 88c8 8 18 8 27 0';
  if (state === 'repairing' || state === 'scanning') return 'M85 90c7 3 14 3 22 0';
  return 'M85 89c7 5 15 5 23 0';
}

function getBrowPaths(state: CharacterState) {
  if (state === 'warning' || state === 'blocked') {
    return {
      left: 'M80 59c5-4 10-5 15-3',
      right: 'M100 56c5-2 10-1 15 3'
    };
  }
  if (state === 'approved' || state === 'completed') {
    return {
      left: 'M80 60c5-2 10-2 15 0',
      right: 'M100 60c5-2 10-2 15 0'
    };
  }
  return {
    left: 'M80 59c5-3 10-3 15 0',
    right: 'M100 59c5-3 10-3 15 0'
  };
}

function CharacterHair({ characterId }: { characterId: string }) {
  if (characterId === 'princess-leia') {
    return (
      <>
        <path className="human-hair human-hair-back" d="M63 67c0-25 17-42 37-42 18 0 33 13 36 34-10-11-22-17-36-17-15 0-27 8-37 25Z" />
        <path className="human-hair human-hair-front" d="M62 70c6-22 19-34 39-34 15 0 26 7 34 20-17-7-34-7-51 1-8 4-15 8-22 13Z" />
        <path className="human-hair human-hair-strand" d="M67 72c11-8 22-12 35-12 10 0 20 2 30 7" />
        <path className="human-hair human-hair-strand" d="M71 56c9-7 19-11 31-11 11 0 20 3 28 8" />
      </>
    );
  }

  if (characterId === 'luke-skywalker') {
    return (
      <>
        <path className="human-hair human-hair-back" d="M63 60c6-22 22-33 39-31 19 2 30 17 31 37-12-10-25-16-40-16-12 0-22 3-30 10Z" />
        <path className="human-hair human-hair-front" d="M63 62c8-17 22-26 38-25 13 1 24 8 31 19-12-5-24-5-37-1-12 3-22 5-32 7Z" />
        <path className="human-hair human-hair-strand" d="M71 55c9-9 20-13 32-12 9 1 17 4 24 10" />
      </>
    );
  }

  if (characterId === 'chewmacka') {
    return (
      <>
        <path className="human-hair human-hair-back" d="M57 71c2-26 16-43 40-45 25-2 40 16 43 44-12-16-27-24-44-23-16 1-29 9-39 24Z" />
        <path className="human-hair human-hair-front" d="M59 68c8-21 22-32 42-32 16 0 28 7 37 21-14-6-29-6-44-1-13 4-25 8-35 12Z" />
        <path className="human-beard" d="M74 77c8 12 17 18 27 18 10 0 18-6 25-18-3 25-12 39-26 39-14 0-23-14-26-39Z" />
      </>
    );
  }

  if (characterId === 'han-solo') {
    return (
      <>
        <path className="human-hair human-hair-back" d="M62 62c5-21 20-33 39-33 19 0 32 13 34 36-11-11-23-16-37-16-13 0-25 5-36 13Z" />
        <path className="human-hair human-hair-front" d="M62 63c8-15 21-23 38-23 14 0 25 6 33 18-11-5-22-6-34-3-14 4-26 6-37 8Z" />
        <path className="human-hair human-hair-strand" d="M74 54c8-5 17-7 28-7 10 0 18 3 25 8" />
      </>
    );
  }

  if (characterId === 'ceo') {
    return (
      <>
        <path className="human-hair human-hair-back" d="M64 62c7-22 20-32 38-31 17 1 29 12 33 33-10-8-21-12-34-12-14 0-26 3-37 10Z" />
        <path className="human-hair human-hair-front" d="M65 60c10-14 23-21 39-20 12 1 22 6 29 15-10-3-21-4-33-2-12 2-24 4-35 7Z" />
      </>
    );
  }

  return (
    <>
      <path className="human-hair human-hair-back" d="M58 72c2-28 16-47 40-48 25-1 41 17 44 47-12-15-27-22-45-21-16 1-29 8-39 22Z" />
      <path className="human-hair human-hair-front" d="M58 72c8-22 23-34 43-34 16 0 29 8 39 22-12-5-25-6-40-2-16 4-30 8-42 14Z" />
      <path className="human-hologram-cowl" d="M56 68c-14 31-12 65 7 104l74 1c19-43 19-78 1-105-15 21-28 31-40 31-13 0-27-10-42-31Z" />
    </>
  );
}

function CharacterUniformDetails({ characterId }: { characterId: string }) {
  if (characterId === 'princess-leia') {
    return (
      <>
        <path className="uniform-sash" d="M66 107c19 20 40 45 59 83" />
        <rect className="uniform-rank-grid" x="66" y="116" width="20" height="16" rx="3" />
        <path className="uniform-panel-lines" d="M73 128h47M78 145h38M82 162h28" />
      </>
    );
  }

  if (characterId === 'luke-skywalker') {
    return (
      <>
        <path className="uniform-panel-lines" d="M72 113h49M71 130h50M76 147h40M80 164h30" />
        <rect className="forearm-display" x="121" y="139" width="22" height="33" rx="6" />
      </>
    );
  }

  if (characterId === 'chewmacka') {
    return (
      <>
        <path className="uniform-sash" d="M60 108c28 23 47 52 59 88" />
        <path className="uniform-panel-lines" d="M78 120h32M72 139h46M77 158h34" />
        <g className="palette-chips">
          <rect x="119" y="112" width="10" height="10" rx="2" />
          <rect x="132" y="112" width="10" height="10" rx="2" />
          <rect x="145" y="112" width="10" height="10" rx="2" />
        </g>
      </>
    );
  }

  if (characterId === 'han-solo') {
    return (
      <>
        <path className="uniform-panel-lines" d="M69 122h52M74 140h42M78 158h32" />
        <circle className="compass-core" cx="101" cy="137" r="14" />
        <path className="compass-needle" d="M101 123l6 16-16 9 10-25Z" />
      </>
    );
  }

  if (characterId === 'ceo') {
    return (
      <>
        <path className="executive-lapel" d="M72 107l21 29-22 59M112 107l-18 29 25 59" />
        <circle className="command-seal" cx="94" cy="139" r="18" />
        <path className="command-seal-lines" d="M82 139h24M94 127v24M86 131l16 16M102 131l-16 16" />
      </>
    );
  }

  return (
    <>
      <path className="mentor-robe-line" d="M67 105c10 21 19 45 27 73 9-29 19-53 30-73" />
      <path className="uniform-panel-lines" d="M75 128h38M78 148h33M82 168h24" />
      <circle className="command-seal" cx="95" cy="142" r="14" />
    </>
  );
}

function CharacterProp({ characterId }: { characterId: string }) {
  if (characterId === 'princess-leia') {
    return (
      <g className="role-prop prop-tablet">
        <rect x="25" y="108" width="34" height="48" rx="7" />
        <path d="M32 121h20M32 132h14M32 143h22" />
        <circle cx="51" cy="150" r="4" />
      </g>
    );
  }

  if (characterId === 'luke-skywalker') {
    return (
      <g className="role-prop prop-repair">
        <rect x="122" y="118" width="32" height="19" rx="8" />
        <path className="repair-beam" d="M151 128c12-4 21-9 29-18" />
        <path className="repair-beam repair-beam-alt" d="M149 132c15 2 26 1 35-5" />
        <rect x="36" y="182" width="15" height="15" rx="3" />
        <rect x="141" y="79" width="13" height="13" rx="3" />
      </g>
    );
  }

  if (characterId === 'chewmacka') {
    return (
      <g className="role-prop prop-signal">
        <path d="M140 95v78" />
        <circle cx="140" cy="88" r="14" />
        <path className="signal-wave" d="M151 75c10 8 15 18 15 30M158 68c15 12 23 27 23 45" />
        <path className="signal-wave signal-wave-left" d="M129 75c-9 8-14 17-14 28" />
      </g>
    );
  }

  if (characterId === 'han-solo') {
    return (
      <g className="role-prop prop-route">
        <circle cx="141" cy="91" r="18" />
        <path d="M128 91h26M141 78v26" />
        <path className="route-line" d="M28 180c30-38 60-13 86-42 20-22 31-29 54-20" />
        <circle cx="28" cy="180" r="4" />
        <circle cx="114" cy="138" r="4" />
        <circle cx="168" cy="118" r="4" />
      </g>
    );
  }

  if (characterId === 'ceo') {
    return (
      <g className="role-prop prop-exec">
        <circle cx="95" cy="139" r="48" />
        <path d="M47 139h96M95 91v96" />
        <rect x="27" y="76" width="30" height="42" rx="7" />
        <rect x="134" y="78" width="30" height="42" rx="7" />
      </g>
    );
  }

  return (
    <g className="role-prop prop-mentor">
      <rect x="28" y="92" width="37" height="54" rx="8" />
      <rect x="129" y="104" width="35" height="48" rx="8" />
      <path d="M36 108h20M36 122h14M137 119h18M137 133h12" />
      <path className="mentor-beam" d="M50 174c22-20 47-26 78-10" />
    </g>
  );
}

function CharacterHumanFigure({ characterId, state }: { characterId: string; state: CharacterState }) {
  const safeId = characterId.replace(/[^a-z0-9-]/gi, '');
  const skinGradientId = `skin-gradient-${safeId}`;
  const suitGradientId = `suit-gradient-${safeId}`;
  const faceLightId = `face-light-${safeId}`;
  const rimGlowId = `rim-glow-${safeId}`;
  const brows = getBrowPaths(state);
  const skinFill = { fill: `url(#${skinGradientId})` } as CSSProperties;
  const faceFill = { fill: `url(#${faceLightId})` } as CSSProperties;
  const suitFill = { fill: `url(#${suitGradientId})` } as CSSProperties;

  return (
    <svg className="character-human-svg" viewBox="0 0 190 290" focusable="false">
      <defs>
        <linearGradient id={skinGradientId} x1="67" x2="118" y1="35" y2="102" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fff2df" stopOpacity="0.94" />
          <stop offset="46%" stopColor="var(--human-skin)" />
          <stop offset="100%" stopColor="#8b5f4c" stopOpacity="0.86" />
        </linearGradient>
        <radialGradient id={faceLightId} cx="42%" cy="32%" r="72%">
          <stop offset="0%" stopColor="#fff4e3" stopOpacity="0.96" />
          <stop offset="50%" stopColor="var(--human-skin)" />
          <stop offset="100%" stopColor="#8c6251" stopOpacity="0.9" />
        </radialGradient>
        <linearGradient id={suitGradientId} x1="58" x2="130" y1="88" y2="204" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f3fbff" stopOpacity="0.24" />
          <stop offset="36%" stopColor="var(--human-suit)" />
          <stop offset="100%" stopColor="var(--human-suit-2)" />
        </linearGradient>
        <filter id={rimGlowId} x="-35%" y="-35%" width="170%" height="170%">
          <feGaussianBlur stdDeviation="2.4" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="0 0 0 0 0.35 0 0 0 0 0.9 0 0 0 0 1 0 0 0 .72 0"
            result="glow"
          />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g className="human-holo-backdrop">
        <path className="human-back-arc" d="M40 216c10-88 24-154 57-184 34 30 49 95 58 184" />
        <path className="human-back-grid" d="M55 88h83M48 122h98M45 158h103M50 194h91" />
        <path className="human-star-map" d="M42 84l24 18 31-34 43 41M54 204l32-22 26 18 33-36" />
        <circle className="human-star-dot" cx="42" cy="84" r="2.2" />
        <circle className="human-star-dot" cx="97" cy="68" r="2.2" />
        <circle className="human-star-dot" cx="140" cy="109" r="2.2" />
        <circle className="human-star-dot" cx="145" cy="164" r="2.2" />
      </g>

      <CharacterProp characterId={characterId} />

      <g className="human-operator" filter={`url(#${rimGlowId})`}>
        <ellipse className="human-shadow" cx="95" cy="262" rx="54" ry="12" />
        <path className="human-rim-light human-rim-left" d="M61 104c-14 43-18 92-12 148" />
        <path className="human-rim-light human-rim-right" d="M128 104c16 43 20 92 14 148" />
        <path className="human-coat" d="M61 102c-14 45-17 98-8 155h29l13-75 14 75h30c9-59 5-112-12-155-16-8-49-8-66 0Z" style={suitFill} />
        <path className="human-leg human-leg-left" d="M79 177c-7 24-10 50-9 79h22l8-76Z" style={suitFill} />
        <path className="human-leg human-leg-right" d="M109 177l8 79h23c0-29-4-55-12-79Z" style={suitFill} />
        <path className="human-boot human-boot-left" d="M66 253h31l-3 17H58c0-7 3-13 8-17Z" />
        <path className="human-boot human-boot-right" d="M113 253h31c7 4 10 10 10 17h-38Z" />
        <path className="human-arm human-arm-left" d="M65 111c-19 20-27 45-25 74" />
        <path className="human-arm human-arm-right" d="M124 111c17 19 25 45 24 76" />
        <circle className="human-hand human-hand-left" cx="42" cy="186" r="9" style={skinFill} />
        <circle className="human-hand human-hand-right" cx="148" cy="187" r="9" style={skinFill} />
        <path className="human-torso" d="M62 100c8-14 19-21 33-21 14 0 25 7 33 21l-9 90H72Z" style={suitFill} />
        <path className="human-chest" d="M75 106h39l9 78H67Z" style={suitFill} />
        <rect className="human-belt" x="67" y="171" width="56" height="10" rx="4" />
        <rect className="human-buckle" x="88" y="168" width="16" height="16" rx="4" />
        <circle className="human-rank-dot human-rank-dot-a" cx="75" cy="113" r="2.4" />
        <circle className="human-rank-dot human-rank-dot-b" cx="84" cy="113" r="2.4" />
        <circle className="human-rank-dot human-rank-dot-c" cx="93" cy="113" r="2.4" />
        <CharacterUniformDetails characterId={characterId} />
        <ellipse className="human-neck" cx="95" cy="85" rx="12" ry="13" style={skinFill} />
        <CharacterHair characterId={characterId} />
        <ellipse className="human-face" cx="95" cy="64" rx="25" ry="30" style={faceFill} />
        <path className="human-ear human-ear-left" d="M71 64c-8 2-9 14-1 18" style={skinFill} />
        <path className="human-ear human-ear-right" d="M119 64c8 2 9 14 1 18" style={skinFill} />
        <path className="human-face-highlight" d="M83 49c6-8 17-11 27-6" />
        <ellipse className="human-cheek human-cheek-left" cx="82" cy="80" rx="5" ry="3" />
        <ellipse className="human-cheek human-cheek-right" cx="110" cy="80" rx="5" ry="3" />
        <g className="human-face-lines">
          <path className="human-brow-left" d={brows.left} />
          <path className="human-brow-right" d={brows.right} />
          <circle className="human-eye human-eye-left" cx="87" cy="67" r="2.3" />
          <circle className="human-eye human-eye-right" cx="106" cy="67" r="2.3" />
          <circle className="human-eye-glint human-eye-glint-left" cx="87.8" cy="66.2" r="0.7" />
          <circle className="human-eye-glint human-eye-glint-right" cx="106.8" cy="66.2" r="0.7" />
          <path className="human-nose" d="M96 68l-3 14 7 1" />
          <path className="human-mouth" d={getMouthPath(state)} />
        </g>
        <path className="human-collar" d="M73 101c12 8 27 9 44 0" />
      </g>
    </svg>
  );
}

export function CharacterAvatar({
  character,
  state = character.state,
  compact = false,
  showLabel = false,
  className = ''
}: CharacterAvatarProps) {
  return (
    <div
      className={`character-avatar character-animated character-${character.id} character-role-${character.role} character-state-${state} ${compact ? 'character-avatar-compact' : ''} ${className}`}
      style={characterStyle(character)}
      aria-label={`${character.displayName}, ${character.archetype}, state ${getCharacterStateLabel(state)}`}
    >
      <div className="character-scene" aria-hidden="true">
        <span className="character-floor" />
        <span className="character-aura" />
        <span className="character-scan character-scan-primary" />
        <span className="character-scan character-scan-secondary" />
        <span className="character-orbit character-orbit-one" />
        <span className="character-orbit character-orbit-two" />
        <span className="character-motif character-motif-a" />
        <span className="character-motif character-motif-b" />
        <span className="character-motif character-motif-c" />
        <CharacterHumanFigure characterId={character.id} state={state} />
      </div>

      {showLabel && (
        <div className="character-caption">
          <strong>{character.displayName}</strong>
          <span>{character.archetype}</span>
          <CharacterStatusBadge state={state} compact />
        </div>
      )}
    </div>
  );
}
