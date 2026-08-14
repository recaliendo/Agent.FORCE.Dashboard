import type { AgentProject } from '../types';

export const seedProjects: AgentProject[] = [
  {
    id: 'talentquest',
    name: 'TalentQuest',
    subtitle: 'Talent intelligence and people analytics',
    callsign: 'TALENTQUEST',
    category: 'Talent Intelligence',
    status: 'Unknown',
    priority: 'Unknown',
    objective: 'Provide secure talent data ingestion, explainable talent mapping, and human-centered retention and coaching plans.',
    missionBrief: 'A documented enterprise talent-intelligence platform for managers, HR teams, and executives.',
    customerNeed: 'Organizations need explainable visibility into performance, impact, retention risk, development actions, and people cost.',
    successCriteria: [
      'Insights show key drivers, confidence, completeness, and contributing data sources.',
      'Role-based experiences protect sensitive data.',
      'Recommendations remain supportive decision support rather than automated judgment.'
    ],
    currentBlockers: [],
    repository: {
      provider: 'github',
      url: 'https://github.com/caliendohomes-rgb/essence-map-desk',
      label: 'TalentQuest Repository',
      reachability: 'verified'
    },
    accent: 'cyan',
    telemetry: {
      readiness: 0,
      automation: 0,
      risk: 0,
      coverage: 0
    },
    tags: ['Talent Intelligence', 'People Analytics', 'Explainability', 'Enterprise SaaS'],
    connectors: [],
    agents: [],
    launchActions: [],
    nextActions: [],
    safetyNotes: [
      'Treat recommendations as decision support, not automated judgment.',
      'Protect sensitive people data with role-based access and audit controls.'
    ],
    unknownFields: [
      'status',
      'priority',
      'connectors',
      'agents',
      'launchActions',
      'currentBlockers'
    ]
  },
  {
    id: 'portfolio-command-center',
    name: 'Halo Portfolio Agent',
    subtitle: 'Portfolio operations workspace',
    callsign: 'HALO-PORTFOLIO',
    category: 'Portfolio Operations',
    status: 'Ready',
    priority: 'High',
    objective: 'Operate portfolio QA, content hierarchy, readability, and presentation quality.',
    missionBrief: 'Dedicated project cockpit for portfolio operations.',
    customerNeed: 'Visitors need to understand the portfolio value and supporting evidence quickly.',
    successCriteria: [
      'The portfolio scan path is clear in under one minute.',
      'Public claims stay consistent with verified source material.',
      'SEO and readability issues are tracked before high-visibility publishing.'
    ],
    currentBlockers: [
      'Repository connector is not configured.',
      'Portfolio QA checklist has not been added.'
    ],
    repository: {
      provider: 'github',
      url: 'https://github.com/caliendohomes-rgb/Job.SEARCH.AGENT',
      label: 'Halo Portfolio Agent',
      reachability: 'verified'
    },
    safetyNotes: ['Public content must stay consistent with verified source material.'],
    accent: 'violet',
    telemetry: {
      readiness: 82,
      automation: 58,
      risk: 21,
      coverage: 76
    },
    tags: ['Portfolio', 'UX', 'Readability', 'SEO'],
    connectors: [],
    launchActions: [],
    nextActions: [
      'Add a portfolio QA checklist.',
      'Add a website readability and negative-space audit panel.',
      'Track before-and-after UX issues by route.'
    ],
    agents: [
      {
        id: 'ux-readability-sentinel',
        name: 'UX Readability Sentinel',
        callsign: 'READ-7',
        origin: 'Claude Code',
        role: 'Readability and layout QA',
        status: 'Ready',
        description: 'Audits spacing, font scale, visual hierarchy, mobile responsiveness, and scanability.',
        tags: ['UX', 'Typography', 'QA'],
        launchActions: []
      }
    ]
  },
  {
    id: 'standardcraft-build-swarm',
    name: 'StandardCraft',
    subtitle: 'NYS standards-aligned classroom resources',
    callsign: 'EDU-FORGE',
    category: 'SaaS Product Build',
    status: 'Building',
    priority: 'High',
    objective: 'Coordinate StandardCraft website, resource library, auth, credits, billing, QA, and launch readiness.',
    missionBrief: 'A project cockpit for education-resource SaaS development and launch operations.',
    customerNeed: 'Educators need fast, trustworthy access to standards-aligned resources with reliable account, credit, and download workflows.',
    successCriteria: [
      'Critical purchase, credit, preview, and download paths are testable.',
      'Connector posture is actionable without storing secrets.',
      'Launch readiness exposes the top release blocker.'
    ],
    currentBlockers: [
      'Data and billing connector setup needs review.',
      'Regression tests for credit and download flows are not represented in the cockpit.'
    ],
    repository: {
      provider: 'github',
      url: 'https://github.com/caliendohomes-rgb/standardcraft',
      label: 'caliendohomes-rgb/standardcraft',
      reachability: 'verified'
    },
    repoReferences: [
      {
        id: 'standardcraft-live-site',
        label: 'StandardCraft Live Site',
        url: 'https://standardcraftny.com',
        description: 'Production website reference.'
      }
    ],
    safetyNotes: ['Never store service-role keys, secret keys, or deploy tokens in connector metadata.'],
    accent: 'amber',
    telemetry: {
      readiness: 74,
      automation: 64,
      risk: 39,
      coverage: 71
    },
    tags: ['StandardCraft', 'NYS Standards', 'Billing', 'Data', 'Deployment'],
    connectors: [],
    launchActions: [
      {
        id: 'standardcraft-site',
        label: 'Open StandardCraft',
        type: 'url',
        target: 'https://standardcraftny.com',
        description: 'Open the StandardCraft website.'
      }
    ],
    nextActions: [
      'Add launch readiness scoring.',
      'Add credit and download flow regression tests.',
      'Add billing and data environment checklists.'
    ],
    agents: [
      {
        id: 'resource-library-architect',
        name: 'Resource Library Architect',
        callsign: 'LIB-90',
        origin: 'Codex',
        role: 'Resource library structure and QA',
        status: 'Building',
        description: 'Maintains resource counts, subject coverage, grade-band spread, and preview and download flows.',
        tags: ['Resources', 'QA', 'Credits'],
        launchActions: []
      }
    ]
  },
  {
    id: 'legal-ops-console',
    name: 'DivorceAgent',
    subtitle: 'Document and case operations',
    callsign: 'EVIDENCE-DECK',
    category: 'Document and Case Operations',
    status: 'Planning',
    priority: 'Medium',
    objective: 'Organize document review, evidence timelines, issue trackers, and message-drafting workflows.',
    missionBrief: 'Project cockpit for document operations, chronology building, and careful review workflows.',
    customerNeed: 'Sensitive workflows need organized references, timeline clarity, and careful data handling.',
    successCriteria: [
      'Document vault path is configured without credentials.',
      'Timeline and exhibit agents have clear operating roles.',
      'Sensitive-data reminders are visible before launch actions.'
    ],
    currentBlockers: [
      'Document vault connector is missing a safe reference.',
      'Timeline and exhibit indexing workflows are still in planning.'
    ],
    accent: 'emerald',
    localPaths: [
      {
        id: 'legal-documents-reference',
        label: 'Documents Reference',
        path: 'C:\\Users\\Richa\\OneDrive\\Documents',
        description: 'High-level local document reference. Sensitive documents must not be copied into app storage.'
      }
    ],
    safetyNotes: [
      'Do not store confidential documents, credentials, or privileged content in dashboard localStorage.',
      'Use connector references only; keep substantive analysis in approved files.'
    ],
    telemetry: {
      readiness: 51,
      automation: 38,
      risk: 57,
      coverage: 44
    },
    tags: ['Document Ops', 'Timeline', 'Evidence'],
    connectors: [
      {
        id: 'legal-doc-vault',
        type: 'custom',
        label: 'Document Vault',
        status: 'needs_setup',
        environment: 'development',
        description: 'Local or approved document reference. Do not store credentials or sensitive tokens.'
      }
    ],
    launchActions: [],
    nextActions: [
      'Add document vault path configuration.',
      'Add timeline and exhibit indexing agent definitions.',
      'Add privilege and sensitive-data safety reminders.'
    ],
    agents: [
      {
        id: 'timeline-builder',
        name: 'Timeline Builder',
        callsign: 'CHRONO-1',
        origin: 'Manual',
        role: 'Chronology and issue mapping',
        status: 'Planning',
        description: 'Structures events, evidence references, message history, and decision points into reviewable timelines.',
        tags: ['Timeline', 'Evidence', 'Review'],
        launchActions: []
      }
    ]
  }
];
