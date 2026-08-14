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
    currentBlockers: [
      'Supabase and Lovable Cloud runtime credentials and deployment health are not verified.'
    ],
    repository: {
      provider: 'github',
      url: 'https://github.com/caliendohomes-rgb/essence-map-desk',
      label: 'TalentQuest Repository',
      reachability: 'verified'
    },
    accent: 'cyan',
    tags: ['Talent Intelligence', 'People Analytics', 'Explainability', 'Enterprise SaaS'],
    connectors: [
      {
        id: 'talentquest-github',
        type: 'github',
        label: 'GitHub Source',
        url: 'https://github.com/caliendohomes-rgb/essence-map-desk',
        status: 'connected',
        environment: 'production',
        lastChecked: '2026-08-13',
        dataSource: 'GitHub default branch at 55e753ead434fee03feedb1b6b55a1ff230be7fa',
        description: 'Source repository is reachable and contains the documented application.'
      },
      {
        id: 'talentquest-supabase',
        type: 'supabase',
        label: 'Supabase Data and Auth',
        url: 'https://github.com/caliendohomes-rgb/essence-map-desk/tree/main/supabase',
        status: 'needs_setup',
        environment: 'production',
        dataSource: 'Supabase client integration, config, and migrations in source',
        description: 'Application data, authentication, and schema migrations represented in the source tree.',
        reason: 'Source integration is present; live credentials and endpoint health were not inspected.',
        nextStep: 'Verify the approved Supabase project and role-scoped runtime health without exposing credentials.'
      },
      {
        id: 'talentquest-lovable',
        type: 'custom',
        label: 'Lovable Cloud Auth',
        url: 'https://github.com/caliendohomes-rgb/essence-map-desk/tree/main/src/integrations/lovable',
        status: 'unknown',
        environment: 'production',
        dataSource: 'Lovable Cloud auth dependency and source integration',
        description: 'Lovable Cloud authentication adapter included by the application source.',
        reason: 'The source integration is present; active tenant and deployment linkage are unknown.',
        nextStep: 'Confirm the production tenant and authentication callback configuration.'
      }
    ],
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
      'agents',
      'launchActions',
      'deployment'
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
      'Repository content ingestion is intentionally disabled; navigation remains isolated.',
      'Portfolio QA checklist has not been added.'
    ],
    repository: {
      provider: 'github',
      url: 'https://github.com/caliendohomes-rgb/Job.SEARCH.AGENT',
      label: 'Halo Portfolio Agent',
      reachability: 'verified'
    },
    safetyNotes: [
      'Public content must stay consistent with verified source material.',
      'Do not ingest tracked data, logs, databases, or generated output from the repository into model context.'
    ],
    accent: 'violet',
    tags: ['Portfolio', 'UX', 'Readability', 'SEO'],
    connectors: [],
    launchActions: [],
    nextActions: [],
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
      'Supabase, Stripe, and SMTP credentials and live API health are not verified.',
      'The StandardCraft ops MCP exists in source but is not mounted in Agent FORCE.'
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
    tags: ['StandardCraft', 'NYS Standards', 'Billing', 'Data', 'Deployment'],
    connectors: [
      {
        id: 'standardcraft-github',
        type: 'github',
        label: 'GitHub Source',
        url: 'https://github.com/caliendohomes-rgb/standardcraft',
        status: 'connected',
        environment: 'production',
        lastChecked: '2026-08-13',
        dataSource: 'GitHub default branch at 509f4a61c59151181269402fa2a02fbe2ffda817',
        description: 'Source repository and infrastructure configuration are reachable.'
      },
      {
        id: 'standardcraft-netlify',
        type: 'netlify',
        label: 'Netlify Production',
        url: 'https://standardcraftny.com',
        status: 'connected',
        environment: 'production',
        lastChecked: '2026-08-13',
        dataSource: 'HTTP 200 with Netlify response headers plus netlify.toml and Astro adapter',
        description: 'Production site is served through Netlify with repository-defined headers and functions.'
      },
      {
        id: 'standardcraft-supabase',
        type: 'supabase',
        label: 'Supabase Data, Auth, and Storage',
        url: 'https://github.com/caliendohomes-rgb/standardcraft/tree/main/supabase',
        status: 'needs_setup',
        environment: 'production',
        dataSource: 'Supabase SSR/client modules, migrations, RLS, and storage workflows in source',
        description: 'Application data, authentication, row-level security, and protected file storage.',
        reason: 'Implementation is present; live project credentials and service health were not inspected.',
        nextStep: 'Run a scoped auth, RLS, storage, and migration health check.'
      },
      {
        id: 'standardcraft-stripe',
        type: 'stripe',
        label: 'Stripe Billing',
        url: 'https://standardcraftny.com/pricing',
        status: 'needs_setup',
        environment: 'production',
        dataSource: 'Stripe SDK, checkout, billing portal, webhook, and price configuration in source',
        description: 'Subscription checkout, billing portal access, signed webhooks, and credit synchronization.',
        reason: 'Billing paths exist; live keys, webhook delivery, and price IDs were not inspected.',
        nextStep: 'Verify webhook signatures, product-price mappings, and one sandbox checkout.'
      },
      {
        id: 'standardcraft-smtp',
        type: 'custom',
        label: 'SMTP Transactional Email',
        url: 'https://standardcraftny.com/contact',
        status: 'needs_setup',
        environment: 'production',
        dataSource: 'Nodemailer implementation, SMTP self-test, and ops MCP environment contract',
        description: 'Transactional delivery for contact and operational email workflows.',
        reason: 'Email integration exists; mailbox authentication and delivery health were not tested.',
        nextStep: 'Run the repository SMTP verification with approved secrets outside the renderer.'
      },
      {
        id: 'standardcraft-ci',
        type: 'github',
        label: 'GitHub Actions CI',
        url: 'https://github.com/caliendohomes-rgb/standardcraft/actions',
        status: 'unknown',
        environment: 'production',
        dataSource: 'CI workflow for typecheck, build, secret scan, and dependency audit',
        description: 'Main-branch quality gates for type safety, production build, secret scanning, and dependency audit.',
        reason: 'Workflow configuration is present; the latest run status was not asserted by this registry scan.',
        nextStep: 'Confirm the main-branch workflow is green before release.'
      },
      {
        id: 'standardcraft-ops-mcp',
        type: 'custom',
        label: 'StandardCraft Ops MCP',
        url: 'https://github.com/caliendohomes-rgb/standardcraft/tree/main/mcp/standardcraft-ops',
        status: 'needs_setup',
        environment: 'production',
        dataSource: 'Repository MCP server for GitHub, Netlify, Supabase, and SMTP operations',
        description: 'Scoped operational tools for branch protection, deployment, form inbox, and email verification.',
        reason: 'The MCP server exists in source but Agent FORCE has no mounted MCP transport.',
        nextStep: 'Approve and implement a scoped MCP bridge with confirmation and credential boundaries.'
      },
      {
        id: 'standardcraft-analytics',
        type: 'custom',
        label: 'Product Analytics',
        status: 'unknown',
        environment: 'production',
        dataSource: 'Provider-neutral analytics plan and CSP allowance in source',
        description: 'Planned product-event contract for privacy-aware usage and funnel measurement.',
        reason: 'The repository explicitly states that no analytics provider is wired.',
        nextStep: 'Select a privacy-appropriate provider and implement the documented event contract.'
      }
    ],
    launchActions: [
      {
        id: 'standardcraft-site',
        label: 'Open StandardCraft',
        type: 'url',
        target: 'https://standardcraftny.com',
        description: 'Open the StandardCraft website.'
      }
    ],
    nextActions: [],
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
      'Timeline and exhibit indexing workflows are still in planning.',
      'A GitHub repository association has not been established.'
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
    nextActions: [],
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
    ],
    unknownFields: ['repository']
  }
];
