# Agent FORCE Architecture Diagram Set

Prepared for executive and CTO review on 2026-08-13.

1. `01-ai-infrastructure` shows the production inference path and security boundary.
2. `02-agentforce-agent-infrastructure` shows fleet, agents, evidence, and connected tools.
3. `03-user-operations` shows the user journey aligned with platform and delivery operations.

Connector language is evidence-qualified:

- **live**: a repository or non-secret endpoint was directly reachable;
- **setup**: implementation exists, but credentials or runtime health are not verified;
- **unknown**: no authoritative operational evidence exists;
- **navigation only**: outbound access exists, but ingestion is intentionally blocked.

The Mermaid source files are canonical. SVG exports are generated from those sources for demos.
