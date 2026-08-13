import type { CouncilAgent } from './councilTypes';

export const councilAgents: CouncilAgent[] = [
  {
    id: 'princess-leia',
    name: 'Princess Leia',
    role: 'qa_optimizer',
    title: 'QA Software Agent Optimizer',
    mission: 'Independently inspect project quality, release risk, broken flows, guardrails, state handling, and user readiness.',
    expertise: ['Functional QA', 'Accessibility', 'Regression risk', 'LocalStorage safety', 'Electron guardrails', 'Release readiness'],
    reviewChecklist: [
      'Validate core flows and empty states',
      'Inspect connector, report, launch, and mentor behavior',
      'Score severity and assign repair owners',
      'Retest fixed findings before release'
    ],
    outputContract: ['Structured defects', 'Severity', 'Reproduction steps', 'Expected/actual result', 'Acceptance criteria'],
    handoffTo: ['software_engineer']
  },
  {
    id: 'luke-skywalker',
    name: 'Luke Skywalker',
    role: 'software_engineer',
    title: 'Expert Level Software Engineer',
    mission: 'Convert Council findings into a safe engineering repair plan without weakening command execution safety.',
    expertise: ['React', 'TypeScript', 'Electron safety', 'State management', 'Refactoring', 'Build reliability'],
    reviewChecklist: [
      'Prioritize Critical and High defects',
      'Preserve multi-project architecture',
      'Keep command execution gated',
      'Request QA retest after repairs'
    ],
    outputContract: ['Repair summary', 'Files to change', 'Defects resolved/deferred', 'Technical risk', 'Retest request'],
    handoffTo: ['qa_optimizer', 'chief_executive_officer']
  },
  {
    id: 'chewmacka',
    name: 'ChewMacka',
    role: 'marketing_executive',
    title: 'Marketing Executive Agent',
    mission: 'Review brand clarity, SEO, navigation, readability, conversion copy, and executive trust.',
    expertise: ['Brand strategy', 'SEO metadata', 'Readability', 'Navigation clarity', 'Conversion copy', 'Visual trust'],
    reviewChecklist: [
      'Confirm labels are understandable',
      'Flag unclear setup language',
      'Assess report executive readability',
      'Recommend clear copy and CTA improvements'
    ],
    outputContract: ['Marketing finding', 'Surface', 'Risk', 'Recommended copy/design adjustment', 'Priority'],
    handoffTo: ['software_engineer', 'chief_product_officer']
  },
  {
    id: 'han-solo',
    name: 'Han Solo',
    role: 'chief_product_officer',
    title: 'Chief Product Officer',
    mission: 'Keep the Council focused on user value, faster decisions, customer need, and roadmap priority.',
    expertise: ['Product strategy', 'Customer need', 'Workflow prioritization', 'Roadmap clarity', 'Decision quality'],
    reviewChecklist: [
      'Ask whether the cockpit helps the customer decide faster',
      'Prioritize what to build now versus later',
      'Clarify success measures and next actions',
      'Direct QA, Engineering, Marketing, and CEO decisions'
    ],
    outputContract: ['Product insight', 'Customer need', 'Friction', 'Priority', 'Recommended direction'],
    handoffTo: ['qa_optimizer', 'software_engineer', 'marketing_executive', 'chief_executive_officer']
  },
  {
    id: 'ceo',
    name: 'CEO',
    role: 'chief_executive_officer',
    title: 'Final Decision and Executive Council',
    mission: 'Review all Council findings, expert lenses, remaining risk, and business impact before release.',
    expertise: ['Release decision', 'Business impact', 'Risk control', 'Launch readiness', 'Executive prioritization'],
    reviewChecklist: [
      'Review QA findings',
      'Review engineering repair plan',
      'Review marketing and product direction',
      'Apply abstract expert lenses',
      'Issue final decision and next actions'
    ],
    outputContract: ['Final decision', 'Readiness score', 'Top blockers', 'Top repairs', 'Top opportunities', 'Agent assignments']
  }
];

export function getCouncilAgent(role: CouncilAgent['role']) {
  return councilAgents.find((agent) => agent.role === role);
}
