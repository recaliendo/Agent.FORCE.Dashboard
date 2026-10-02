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
    recordsWorkspace: 'ofw',
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
  },
  {
    id: 'oneonta-fantasy-rankings',
    recordsWorkspace: 'oneonta-rankings',
    name: 'Oneonta Fantasy',
    subtitle: 'Oneonta Weekly Fantasy Rankings: public league-wide rankings site',
    callsign: 'ONEONTA-RANK',
    category: 'Fantasy Sports Automation',
    status: 'Building',
    priority: 'High',
    objective: 'Publish league-wide weekly fantasy football rankings tuned to the Oneonta league’s custom scoring at oneontafantasy.live.',
    missionBrief: 'A Lovable-built TanStack Start site that renders every ranking from one data module (src/data/rankings.ts), so a weekly refresh only swaps ranking data and metadata, never layout. The cockpit Rankings tab shows the current week.',
    customerNeed: 'League managers want one trusted, mobile-friendly weekly ranking that reflects 6-point passing TDs and the league’s other scoring rules, without logging in.',
    successCriteria: [
      'oneontafantasy.live serves the current week’s rankings with no login.',
      'Each weekly refresh changes only src/data/rankings.ts (week, updatedAt, ranking arrays).',
      'Rankings data is refreshed by Tuesday 8:00 AM ET every week of the season.',
      'No injury status or consensus trend is shown unless verified in that week’s data.'
    ],
    currentBlockers: [
      'The scheduled refresh cannot read ranking sources yet: the cloud environment\u2019s network policy blocks fantasypros.com, si.com, and draftsharks.com, so each run stops without pushing.'
    ],
    repository: {
      provider: 'github',
      url: 'https://github.com/recaliendo/oneonta-analytics-hub',
      label: 'oneonta-analytics-hub',
      reachability: 'verified'
    },
    safetyNotes: [
      'The repository is connected to Lovable: never force-push or rewrite pushed history on main, or the Lovable project history is lost.',
      'Keep weekly data changes inside src/data/rankings.ts so a refresh cannot break the published layout.',
      'Cite sources (FantasyPros, Sports Illustrated) without copying long source text.'
    ],
    accent: 'blue',
    tags: ['Fantasy Football', 'Rankings', 'Lovable', 'TanStack Start', 'Public site'],
    connectors: [
      {
        id: 'oneonta-github',
        type: 'github',
        label: 'GitHub Source',
        url: 'https://github.com/recaliendo/oneonta-analytics-hub',
        status: 'connected',
        environment: 'production',
        lastChecked: '2026-10-02',
        dataSource: 'Private repository recaliendo/oneonta-analytics-hub (main)',
        description: 'Source repository verified: TanStack Start + React 19 + Tailwind, with all rankings in src/data/rankings.ts.'
      },
      {
        id: 'oneonta-live-site',
        type: 'website',
        label: 'Live Site',
        url: 'https://oneontafantasy.live/',
        status: 'unknown',
        environment: 'live',
        dataSource: 'Public custom domain',
        description: 'Public rankings site for league managers.',
        reason: 'The domain is registered here as the production site, but no uptime or deploy check has run from this dashboard.',
        nextStep: 'Open the live site and confirm it shows the same week as the Rankings tab.'
      },
      {
        id: 'oneonta-lovable',
        type: 'custom',
        label: 'Lovable Project',
        url: 'https://lovable.dev/projects/0d9d7f52-9d10-4c86-af5b-8cf1900980c3',
        status: 'unknown',
        environment: 'production',
        dataSource: 'Lovable project linked from the repository README',
        description: 'Lovable editor that syncs two-way with the main branch.',
        reason: 'The link is in the repository; whether Lovable publishes the custom domain is not verified.',
        nextStep: 'Confirm in Lovable that oneontafantasy.live is the published domain for this project.'
      }
    ],
    launchActions: [
      {
        id: 'oneonta-live-site',
        label: 'Open Live Site',
        type: 'url',
        target: 'https://oneontafantasy.live/',
        description: 'Open the public Oneonta Weekly Fantasy Rankings site.'
      },
      {
        id: 'oneonta-repo',
        label: 'Open Repo',
        type: 'url',
        target: 'https://github.com/recaliendo/oneonta-analytics-hub',
        description: 'Open the oneonta-analytics-hub source repository.'
      },
      {
        id: 'oneonta-rankings-data',
        label: 'Open Rankings Data',
        type: 'url',
        target: 'https://github.com/recaliendo/oneonta-analytics-hub/blob/main/src/data/rankings.ts',
        description: 'Open the single data module the weekly refresh replaces.'
      },
      {
        id: 'oneonta-lovable-editor',
        label: 'Open Lovable Editor',
        type: 'url',
        target: 'https://lovable.dev/projects/0d9d7f52-9d10-4c86-af5b-8cf1900980c3',
        description: 'Open the Lovable project that publishes the site.'
      }
    ],
    nextActions: [
      'Confirm oneontafantasy.live is published from this repository’s Lovable project.',
      'Allow fantasypros.com and si.com in the cloud environment\u2019s Network access so the Tuesday refresh can read sources.',
      'Merge the rankings data guardrail test (oneonta-analytics-hub PR #1) so the refresh gate lives on main.',
      'Add the league’s exact rushing, receiving, long-play, and D/ST scoring rules to the scoring lens.',
      'Refresh this dashboard’s Rankings snapshot (src/data/oneontaRankings.ts) after each weekly update.'
    ],
    agents: [
      {
        id: 'oneonta-weekly-refresh',
        name: 'Weekly Rankings Refresh',
        callsign: 'REFRESH-ONE',
        origin: 'Claude Code',
        role: 'Weekly rankings data update',
        status: 'Needs Configuration',
        description: 'Claude Code routine, Tuesdays 7:23 AM ET (Sept\u2013Jan): rewrites only src/data/rankings.ts (week, updatedAt, and the QB, RB, WR, TE, K, D/ST, and FLEX lists, with QBs reordered for 6-point passing TDs), passes the data guardrail and build, then pushes to main. It stops without pushing if it cannot read current sources.',
        tags: ['Weekly', 'Data module', 'Tuesday 8 AM ET'],
        repoUrl: 'https://github.com/recaliendo/oneonta-analytics-hub',
        launchActions: []
      },
      {
        id: 'oneonta-site-qa',
        name: 'Site QA',
        callsign: 'QA-ONE',
        origin: 'Hybrid',
        role: 'Build, test, and publish checks',
        status: 'Draft',
        description: 'Runs the site’s lint, vitest routing test, and build before a refresh is pushed to main, then checks the live site shows the new week.',
        tags: ['QA', 'vitest', 'Publish'],
        repoUrl: 'https://github.com/recaliendo/oneonta-analytics-hub',
        launchActions: []
      }
    ],
    unknownFields: ['localPath']
  },
  {
    id: 'yahoo-fantasy-manager',
    name: 'Yahoo Fantasy Manager',
    subtitle: 'Fantasy football league intelligence and reviewed roster moves',
    callsign: 'GRIDIRON-OPS',
    category: 'Fantasy Sports Automation',
    status: 'Needs QA',
    priority: 'High',
    objective: 'Give an agent read/write access to my Yahoo Fantasy Football league via MCP, for league intel and reviewed roster moves.',
    missionBrief: 'Wraps the mcp-yahoo-fantasy MCP server: an agent can pull league standings, rosters, matchups, and player data, and -- with my review at each step -- set lineups, work waivers, and respond to trades.',
    customerNeed: 'I want league data and roster-management suggestions surfaced automatically, without giving up review before anything actually changes on my team.',
    successCriteria: [
      'list_leagues and other read tools return live data instead of an authorization error.',
      'Every write action (lineup, add/drop, waiver, trade) is shown for my approval before it reaches Yahoo.',
      'YAHOO_LEAGUE_KEY is set from a real league so tools stop requiring it on every call.'
    ],
    currentBlockers: [
      'Yahoo Fantasy Sports API access application submitted 2026-09-19 for read/write scope -- pending manual review, no stated SLA. OAuth login succeeds but live calls currently return "This application is not authorized to perform this action."'
    ],
    repository: {
      provider: 'github',
      url: 'https://github.com/caliendohomes-rgb/mcp-yahoo-fantasy',
      label: 'mcp-yahoo-fantasy',
      reachability: 'verified'
    },
    localPaths: [
      {
        id: 'yahoo-workspace',
        label: 'Local Workspace',
        path: 'C:\\Users\\Richa\\OneDrive\\Documents\\mcp-yahoo-fantasy',
        description: 'Local clone with .env holding OAuth tokens (gitignored, never committed).'
      }
    ],
    safetyNotes: [
      'Never store the Yahoo Client Secret, access token, or refresh token anywhere but the local .env file.',
      'Require explicit human review before any write action (lineup, add/drop, waiver claim, trade response) reaches Yahoo.'
    ],
    accent: 'amber',
    tags: ['Yahoo Fantasy', 'NFL', 'MCP', 'Claude Code', 'OAuth'],
    connectors: [
      {
        id: 'yahoo-fantasy-oauth',
        type: 'custom',
        label: 'Yahoo Fantasy OAuth',
        status: 'attention',
        environment: 'production',
        dataSource: 'yahoo_oauth-bridged tokens in yahoo/.env',
        description: 'OAuth2 login completed and tokens saved, but Yahoo has not yet approved this app for live Fantasy Sports API access.',
        reason: 'Yahoo discontinued self-serve provisioning of the Fantasy Sports API in 2026; new apps need manual review.',
        nextStep: 'Wait for approval on the submitted access application, then re-run Verify Yahoo Connection below.',
        lastChecked: '2026-09-19'
      },
      {
        id: 'yahoo-fantasy-github',
        type: 'github',
        label: 'GitHub Source',
        url: 'https://github.com/caliendohomes-rgb/mcp-yahoo-fantasy',
        status: 'connected',
        environment: 'production',
        lastChecked: '2026-09-19',
        dataSource: 'Fork of michaelfromorg/mcp-yahoo-fantasy',
        description: 'Source repository verified: builds, tool registration (29 tools), and packaging all pass.'
      }
    ],
    launchActions: [
      {
        id: 'yahoo-repo',
        label: 'Open Repo',
        type: 'url',
        target: 'https://github.com/caliendohomes-rgb/mcp-yahoo-fantasy',
        description: 'Open the mcp-yahoo-fantasy source repository.'
      },
      {
        id: 'yahoo-workspace-open',
        label: 'Open Local Workspace',
        type: 'path',
        target: 'C:\\Users\\Richa\\OneDrive\\Documents\\mcp-yahoo-fantasy',
        description: 'Reveal the local clone in File Explorer.'
      },
      {
        id: 'yahoo-verify',
        label: 'Verify Yahoo Connection',
        type: 'command',
        target: 'cd /d "C:\\Users\\Richa\\OneDrive\\Documents\\mcp-yahoo-fantasy\\yahoo" && python -m uv run python -c "from yahoo.client import client; g = client.game(\'nfl\'); print(\'OK game_id=\', g.game_id())"',
        description: 'One-shot check that the OAuth tokens work and Yahoo has approved API access.',
        safetyNote: 'Runs a real API call against your Yahoo account. Requires AGENT_FORCE_ALLOW_COMMANDS=true.'
      },
      {
        id: 'yahoo-access-application',
        label: 'Open Yahoo API Access Application',
        type: 'url',
        target: 'https://sports.yahoo.com/developer/access/',
        description: 'Yahoo\u2019s manual review form for Fantasy Sports API access (submitted 2026-09-19, pending).'
      }
    ],
    nextActions: [
      'Once approved, run the list_leagues tool to find the league key and set YAHOO_LEAGUE_KEY in yahoo/.env.',
      'Add point-of-execution confirmation in this dashboard before any write action (lineup, add/drop, waiver, trade) reaches Yahoo.',
      'Point an MCP client (e.g. Claude Desktop config) at the server once live data is confirmed working.'
    ],
    agents: [
      {
        id: 'league-intel-reader',
        name: 'League Intel Reader',
        callsign: 'SCOUT-FF',
        origin: 'Claude Code',
        role: 'League, team, and player data retrieval (read-only tools)',
        status: 'Needs Configuration',
        description: 'Covers the 21 read tools: standings, rosters, matchups, free agents/waivers, player stats and ownership, draft results, and transaction history. Blocked on Yahoo API access approval -- OAuth succeeds but calls currently return "application not authorized."',
        tags: ['Standings', 'Rosters', 'Players', 'Matchups', 'Read-only'],
        launchActions: []
      },
      {
        id: 'roster-ops-commander',
        name: 'Roster Ops Commander',
        callsign: 'APPLY-FF',
        origin: 'Claude Code',
        role: 'Lineup, waiver, and trade execution (write tools)',
        status: 'Draft',
        description: 'Covers the 8 write tools: set_lineup, add/drop, waiver claims, and trade accept/reject -- all scoped to my own team. Requires explicit human review before each write action, and Yahoo\u2019s read/write scope approval (not yet granted).',
        tags: ['Lineup', 'Waivers', 'Trades', 'Human-review'],
        launchActions: []
      }
    ],
    unknownFields: []
  }
];
