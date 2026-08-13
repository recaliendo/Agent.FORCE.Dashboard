export type CharacterRole =
  | 'qa_commander'
  | 'engineering_repair'
  | 'marketing_signal'
  | 'product_navigator'
  | 'executive_command'
  | 'mentor_guide';

export type CharacterState =
  | 'idle'
  | 'scanning'
  | 'repairing'
  | 'reviewing'
  | 'warning'
  | 'blocked'
  | 'approved'
  | 'completed';

export interface AgentCharacter {
  id: string;
  displayName: string;
  role: CharacterRole;
  archetype: string;
  description: string;
  accentColor: string;
  state: CharacterState;
  visualMotifs: string[];
  primarySurfaces: string[];
  safeDesignNotes: string[];
}
