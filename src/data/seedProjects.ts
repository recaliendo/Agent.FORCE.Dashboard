import type { AgentProject } from '../types';

export const seedProjects: AgentProject[] = [
  {
    id: 'richard-job-search',
    name: 'Richard Job Search Agent',
    callsign: 'CAREER ORBIT OPS',
    category: 'Career Automation',
    status: 'Building',
    priority: 'Critical',
    objective:
      'Coordinate job-search intelligence, portfolio-based matching, application preparation, and outreach workflows for Richard.',
    missionBrief:
      'This is one project agent inside the broader Agent FORCE launch station. It should never define the app architecture by itself; it is a sample cockpit for career-focused agents and future job-application workflows.',
    customerNeed: 'Richard needs a credible, source-of-truth-driven job search operating system that finds strong-fit senior roles without fabricating application content.',
    successCriteria: [
      'Every role is scored against verified portfolio facts and hard filters.',
      'Manual review is queued when compensation, location, legal, or unsupported answers are unclear.',
      'Application materials stay aligned to Richard’s portfolio and resume only.'
    ],
    currentBlockers: [
      'Application queue schema is not yet connected to this dashboard.',
      'Human-review gates need to be visible before any external submission flow.'
    ],
    repoUrl: 'https://github.com/caliendohomes-rgb/Agent.FORCE.Dashboard',
    localPath: '',
    repoReferences: [
      {
        id: 'agent-force-dashboard-repo',
        label: 'Agent FORCE Dashboard Repository',
        url: 'https://github.com/caliendohomes-rgb/Agent.FORCE.Dashboard',
        description: 'Canonical desktop hub repository.'
      },
      {
        id: 'job-search-agent-repo',
        label: 'Job Search Agent Repository',
        url: 'https://github.com/caliendohomes-rgb/Job.SEARCH.AGENT',
        description: 'Project-specific job-search agent source repository.'
      }
    ],
    localPaths: [
      {
        id: 'job-search-workspace',
        label: 'Job Search Workspace',
        path: 'C:\\Users\\Richa\\OneDrive\\Documents\\Job Search Agent',
        description: 'Local workspace for job-search agent files and reports.'
      }
    ],
    safetyNotes: [
      'APPLY_MODE must remain false unless Ricky explicitly enables external submissions.',
      'Use portfolio/resume source-of-truth only; never fabricate experience or credentials.'
    ],
    accent: 'cyan',
    telemetry: {
      readiness: 68,
      automation: 62,
      risk: 34,
      coverage: 72
    },
    tags: ['Job Search', 'Portfolio', 'Resume', 'Remote Roles', 'Codex', 'Claude Code'],
    connectors: [
      {
        id: 'job-search-github',
        type: 'github',
        label: 'Job Search Agent Repo',
        url: 'https://github.com/caliendohomes-rgb/Job.SEARCH.AGENT',
        status: 'connected',
        environment: 'production',
        description: 'Source repository for the local job-search agent and QA workflow.'
      },
      {
        id: 'job-search-portfolio',
        type: 'custom',
        label: 'Portfolio Source of Truth',
        url: 'https://richardecaliendo.com/',
        status: 'connected',
        environment: 'production',
        description: 'Public portfolio and resume source used for verified candidate facts.'
      },
      {
        id: 'job-search-deploy',
        type: 'netlify',
        label: 'Deployment Target',
        status: 'needs_setup',
        environment: 'staging',
        description: 'Optional future deployment connector for hosted reports or dashboards.'
      }
    ],
    launchActions: [
      {
        id: 'portfolio',
        label: 'Open Portfolio',
        type: 'url',
        target: 'https://richardecaliendo.com/',
        description: 'Launch the portfolio used as the source of truth for career positioning.'
      },
      {
        id: 'repo',
        label: 'Open Dashboard Repo',
        type: 'url',
        target: 'https://github.com/caliendohomes-rgb/Agent.FORCE.Dashboard',
        description: 'Open the Agent FORCE Dashboard repository.'
      }
    ],
    nextActions: [
      'Add project-specific application queue schema.',
      'Add resume and portfolio source-of-truth validation panel.',
      'Add guardrails for compensation, remote status, location radius, and company exclusions.',
      'Add human-review checkpoint before any external job application submission.'
    ],
    agents: [
      {
        id: 'career-intel-scout',
        name: 'Career Intel Scout',
        callsign: 'SCOUT-180',
        origin: 'Hybrid',
        role: 'Role discovery, filtering, and fit scoring',
        status: 'Planning',
        description:
          'Identifies opportunities that appear aligned with portfolio, resume, compensation, location, and experience constraints.',
        tags: ['Discovery', 'Fit Score', 'Remote', '$180K+'],
        launchActions: [],
        safetyNotes: ['Queue manual review for unclear compensation, work authorization, legal terms, or possible Kaseya affiliation.']
      },
      {
        id: 'application-builder',
        name: 'Application Builder',
        callsign: 'APPLY-1',
        origin: 'Claude Code',
        role: 'Application packet preparation',
        status: 'Planning',
        description:
          'Prepares tailored summaries, role notes, outreach drafts, and application materials from approved source content.',
        tags: ['Resume', 'Portfolio', 'Cover Notes'],
        launchActions: [],
        safetyNotes: ['Use verified source facts only.']
      },
      {
        id: 'outreach-navigator',
        name: 'Outreach Navigator',
        callsign: 'LINK-OPS',
        origin: 'Codex',
        role: 'Networking and contact workflow support',
        status: 'Planning',
        description:
          'Maintains outreach prompts, contact notes, and follow-up workflows connected to target companies and roles.',
        tags: ['LinkedIn', 'Networking', 'Follow-up'],
        launchActions: [],
        safetyNotes: ['Do not send external outreach without Ricky review.']
      }
    ]
  },
  {
    id: 'portfolio-command-center',
    name: 'Portfolio Command Center',
    callsign: 'HOLO-PORTFOLIO',
    category: 'Personal Brand',
    status: 'Ready',
    priority: 'High',
    objective:
      'Operate portfolio website QA, content hierarchy, readability, resume alignment, and conversion optimization.',
    missionBrief:
      'Dedicated project cockpit for the portfolio website and resume experience, separate from the job-search application agents.',
    customerNeed: 'Recruiters and hiring leaders need to understand Richard’s technical program, AI adoption, and SaaS execution value quickly.',
    successCriteria: [
      'Portfolio scan path is clear in under one minute.',
      'Resume and website claims stay consistent.',
      'SEO/readability issues are tracked before high-visibility outreach.'
    ],
    currentBlockers: [
      'Portfolio repository connector is not configured.',
      'Resume QA checklist has not been added.'
    ],
    repoUrl: 'https://richardecaliendo.com/',
    repoReferences: [
      {
        id: 'portfolio-live-reference',
        label: 'Live Portfolio',
        url: 'https://richardecaliendo.com/',
        description: 'Public portfolio and resume source.'
      }
    ],
    safetyNotes: ['Public portfolio content must stay consistent with verified resume/source material.'],
    accent: 'violet',
    telemetry: {
      readiness: 82,
      automation: 58,
      risk: 21,
      coverage: 76
    },
    tags: ['Portfolio', 'Resume', 'UX', 'Readability', 'SEO'],
    connectors: [
      {
        id: 'portfolio-site',
        type: 'custom',
        label: 'Live Portfolio',
        url: 'https://richardecaliendo.com/',
        status: 'connected',
        environment: 'production',
        description: 'Live portfolio site reviewed by portfolio QA agents.'
      },
      {
        id: 'portfolio-repo',
        type: 'github',
        label: 'Portfolio Repository',
        status: 'needs_setup',
        environment: 'development',
        description: 'Add the source repository URL when portfolio code is managed here.'
      }
    ],
    launchActions: [
      {
        id: 'site',
        label: 'Open Portfolio Site',
        type: 'url',
        target: 'https://richardecaliendo.com/',
        description: 'Open the live portfolio website.'
      }
    ],
    nextActions: [
      'Add resume two-page QA checklist.',
      'Add website readability and negative-space audit panel.',
      'Track before/after UX issues by route.'
    ],
    agents: [
      {
        id: 'ux-readability-sentinel',
        name: 'UX Readability Sentinel',
        callsign: 'READ-7',
        origin: 'Claude Code',
        role: 'Readability and layout QA',
        status: 'Ready',
        description:
          'Audits spacing, font scale, visual hierarchy, mobile responsiveness, and recruiter scanability.',
        tags: ['UX', 'Typography', 'QA'],
        launchActions: []
      }
    ]
  },
  {
    id: 'standardcraft-build-swarm',
    name: 'StandardCraft Build Swarm',
    callsign: 'EDU-FORGE',
    category: 'SaaS Product Build',
    status: 'Building',
    priority: 'High',
    objective:
      'Coordinate StandardCraft website, resource library, auth, credits, Stripe, QA, and launch-readiness agents.',
    missionBrief:
      'A scalable project cockpit for education-resource SaaS development and launch operations.',
    customerNeed: 'Educators need fast, trustworthy access to standards-aligned resources with reliable account, credit, and download workflows.',
    successCriteria: [
      'Critical purchase, credit, preview, and download paths are testable.',
      'Supabase and Stripe connector posture is actionable without storing secrets.',
      'Launch readiness exposes the top release blocker.'
    ],
    currentBlockers: [
      'Supabase and Stripe connector setup needs review.',
      'Regression tests for credit/download flows are not represented in the cockpit.'
    ],
    repoUrl: 'https://standardcraftny.com',
    repoReferences: [
      {
        id: 'standardcraft-live-site',
        label: 'StandardCraft Live Site',
        url: 'https://standardcraftny.com',
        description: 'Production website reference.'
      }
    ],
    safetyNotes: ['Never store Supabase service-role keys, Stripe secret keys, or Netlify tokens in connector metadata.'],
    accent: 'amber',
    telemetry: {
      readiness: 74,
      automation: 64,
      risk: 39,
      coverage: 71
    },
    tags: ['StandardCraft', 'NYS Standards', 'Stripe', 'Supabase', 'Netlify'],
    connectors: [
      {
        id: 'standardcraft-site',
        type: 'netlify',
        label: 'StandardCraft Site',
        url: 'https://standardcraftny.com',
        status: 'connected',
        environment: 'production',
        description: 'Production web presence and deploy surface.'
      },
      {
        id: 'standardcraft-supabase',
        type: 'supabase',
        label: 'Supabase Project',
        status: 'attention',
        environment: 'production',
        description: 'Database and auth connector reference. Store dashboard links only, never service-role keys.'
      },
      {
        id: 'standardcraft-stripe',
        type: 'stripe',
        label: 'Stripe Billing',
        status: 'needs_setup',
        environment: 'test',
        description: 'Payment workflow connector reference. Store dashboard links only, never secret keys.'
      },
      {
        id: 'standardcraft-repo',
        type: 'github',
        label: 'Build Repository',
        status: 'unknown',
        environment: 'development',
        description: 'Add the GitHub repository URL when connected.'
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
    nextActions: [
      'Add launch readiness scoring.',
      'Add credit/download flow regression tests.',
      'Add Stripe and Supabase environment checklist.'
    ],
    agents: [
      {
        id: 'resource-library-architect',
        name: 'Resource Library Architect',
        callsign: 'LIB-90',
        origin: 'Codex',
        role: 'Resource library structure and QA',
        status: 'Building',
        description:
          'Maintains resource counts, subject coverage, grade-band spread, and functional preview/download flows.',
        tags: ['Resources', 'QA', 'Credits'],
        launchActions: []
      }
    ]
  },
  {
    id: 'legal-ops-console',
    name: 'Legal Ops Console',
    callsign: 'EVIDENCE-DECK',
    category: 'Document & Case Ops',
    status: 'Planning',
    priority: 'Medium',
    objective:
      'Organize legal document review, evidence timelines, issue trackers, and message-drafting workflows.',
    missionBrief:
      'Project cockpit for legal operations, document analysis, chronology building, and message positioning workflows.',
    customerNeed: 'Legal workflows need organized document references, timeline clarity, and careful sensitive-data handling.',
    successCriteria: [
      'Document vault path is configured without credentials.',
      'Timeline and exhibit agents have clear operating roles.',
      'Sensitive-data reminders are visible before launch actions.'
    ],
    currentBlockers: [
      'Document vault connector is missing a safe reference.',
      'Timeline and exhibit indexing workflows are still planning-stage.'
    ],
    accent: 'emerald',
    localPaths: [
      {
        id: 'legal-documents-reference',
        label: 'Legal Documents Reference',
        path: 'C:\\Users\\Richa\\OneDrive\\Documents',
        description: 'High-level local document area reference. Sensitive documents should not be copied into app storage.'
      }
    ],
    safetyNotes: [
      'Do not store confidential documents, credentials, or privileged legal content in dashboard localStorage.',
      'Use connector references only; keep substantive legal analysis in approved files.'
    ],
    telemetry: {
      readiness: 51,
      automation: 38,
      risk: 57,
      coverage: 44
    },
    tags: ['Legal Ops', 'Documents', 'Timeline', 'Evidence'],
    connectors: [
      {
        id: 'legal-doc-vault',
        type: 'custom',
        label: 'Document Vault',
        status: 'needs_setup',
        environment: 'development',
        description: 'Local or approved document location reference. Do not store credentials or sensitive tokens.'
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
        description:
          'Structures events, evidence references, message history, and decision points into reviewable timelines.',
        tags: ['Timeline', 'Evidence', 'Review'],
        launchActions: []
      }
    ]
  }
];
