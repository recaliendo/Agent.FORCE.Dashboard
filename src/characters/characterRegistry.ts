import type { AgentCharacter } from './characterTypes';

export const characterRegistry: AgentCharacter[] = [
  {
    id: 'princess-leia',
    displayName: 'Princess Leia',
    role: 'qa_commander',
    archetype: 'QA Signal Commander',
    description: 'Runs diagnostic sweeps, severity triage, release-readiness checks, and retest guidance.',
    accentColor: '#49f5a8',
    state: 'idle',
    visualMotifs: ['Diagnostic tablet', 'Signal grid halo', 'Severity markers'],
    primarySurfaces: ['Council Center', 'QA Findings', 'Retest Flow', 'Readiness Warnings'],
    safeDesignNotes: ['Original holographic QA operator only', 'No official costume, likeness, logo, weapon, quote, or franchise asset']
  },
  {
    id: 'luke-skywalker',
    displayName: 'Luke Skywalker',
    role: 'engineering_repair',
    archetype: 'Systems Repair Engineer',
    description: 'Turns defects, product direction, and executive decisions into safe engineering repair plans.',
    accentColor: '#66d9ff',
    state: 'idle',
    visualMotifs: ['Abstract repair beam', 'Code-grid arm display', 'Floating repair modules'],
    primarySurfaces: ['Engineering Repair Plan', 'Build/Test Results', 'Codex Repair Prompt'],
    safeDesignNotes: ['Original systems-builder silhouette only', 'No official weapon, costume, likeness, logo, quote, or franchise asset']
  },
  {
    id: 'chewmacka',
    displayName: 'ChewMacka',
    role: 'marketing_signal',
    archetype: 'Brand Signal Amplifier',
    description: 'Reviews SEO, brand clarity, readability, navigation, conversion copy, and color-system integrity.',
    accentColor: '#f6c760',
    state: 'idle',
    visualMotifs: ['Signal amplifier device', 'SEO orbit rings', 'Palette hologram'],
    primarySurfaces: ['Marketing Findings', 'SEO Review', 'Readability Review', 'Navigation Clarity'],
    safeDesignNotes: ['Original marketing strategist persona only', 'No creature likeness, official costume, logo, quote, or franchise asset']
  },
  {
    id: 'han-solo',
    displayName: 'Han Solo',
    role: 'product_navigator',
    archetype: 'Product Navigator',
    description: 'Keeps customer need, next best action, prioritization, and roadmap direction visible.',
    accentColor: '#35d7c6',
    state: 'idle',
    visualMotifs: ['Navigation compass', 'Customer journey map', 'Mission route lines'],
    primarySurfaces: ['Product Direction', 'Customer Need Panel', 'Next Best Action', 'Roadmap Priority'],
    safeDesignNotes: ['Original product strategist only', 'No official outfit, likeness, ship, quote, logo, or franchise asset']
  },
  {
    id: 'ceo',
    displayName: 'CEO',
    role: 'executive_command',
    archetype: 'Executive Command Authority',
    description: 'Applies release authority, readiness scoring, executive lenses, and final approval decisions.',
    accentColor: '#7be6ff',
    state: 'idle',
    visualMotifs: ['Command seal', 'Council lens panels', 'Readiness score ring'],
    primarySurfaces: ['CEO Decision', 'Release Readiness Score', 'Executive Council Lenses'],
    safeDesignNotes: ['Original executive command figure only', 'No public-figure likeness or protected character reference']
  },
  {
    id: 'master-verdant',
    displayName: 'Master Verdant',
    role: 'mentor_guide',
    archetype: 'Strategic Mentor Hologram',
    description: 'Offers contextual guidance, top-risk callouts, and next-step recommendations across the hub.',
    accentColor: '#60f2a6',
    state: 'idle',
    visualMotifs: ['Wisdom-map panels', 'Green/teal aura', 'Next-step beam'],
    primarySurfaces: ['Mentor Guidance', 'Overview Tab', 'Launch Bay Guidance'],
    safeDesignNotes: ['Original mentor hologram only', 'No protected likeness, dialogue style, costume, logo, or franchise asset']
  }
];

export function getCharacterById(id: string) {
  return characterRegistry.find((character) => character.id === id);
}

export function getCharacterByRole(role: AgentCharacter['role']) {
  return characterRegistry.find((character) => character.role === role);
}
