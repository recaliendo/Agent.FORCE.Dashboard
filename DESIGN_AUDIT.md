# Agent FORCE Design Audit

Baseline: current cockpit at 1440x1000 and 1024x900 before the Phase 4 refactor. Evidence screenshots are under `artifacts/screenshots/before-*.png`.

## Token Inventory

- Colors: 43 distinct hex values across 90 uses and 241 distinct `rgb/rgba` values across 453 uses. The declared token layer itself duplicates surface, text, and accent concepts (`src/styles.css:1-41`).
- Typography: 37 distinct `font-size` values across 70 declarations. The cockpit headline uses a viewport-scaled range up to 4rem while compact labels fall to 0.68rem (`src/styles.css:987-992`, `src/styles.css:1084-1097`).
- Radius: 30 distinct radius expressions across 125 declarations. The root declares four radii before one-off values add many more (`src/styles.css:30-33`, `src/styles.css:1007-1015`).
- Elevation: 58 `box-shadow` declarations, including two global glow shadows (`src/styles.css:27-29`).
- Decorative effects: 122 gradient uses and 70 `color-mix()` uses. The global surface primitive places a gradient and glow on every panel (`src/styles.css:201-211`).

## Effects Audit

- State-communicating: runtime dot colors, severity colors, active navigation, disabled controls.
- Decorative: star layers, nebula fields, horizon grid, scanlines, panel glows, card gradients, character-era CSS, and repeated accent rails (`src/styles.css:70-169`, `src/styles.css:201-220`). These effects compete with state indicators and account for most of the one-note teal appearance.
- Dead visual assets: generic character illustration CSS remains after its React components were removed (`src/styles.css:1876-3196`). It must be removed with the stylesheet replacement.

## Duplicate Information And Actions

- Next Best Action is rendered in the main overview and again in the right rail (`src/App.tsx:902`, `src/App.tsx:1161-1170`).
- The project header also repeats the same primary action, producing three equivalent calls to action (`src/App.tsx:1061-1063`).
- Connector status appears in the header, cockpit badges, HUD, overview attention list, and right rail, without clear ownership of the decision (`src/App.tsx:1055-1059`, `src/App.tsx:986-1018`, `src/App.tsx:1574-1590`).

## Confirmed Defects

- Assistant content is inserted as plain paragraph text, so Markdown markers render literally (`src/components/QwenChatPanel.tsx:335-344`).
- The tab bar is an eight-column grid with no no-wrap or horizontal overflow strategy (`src/styles.css:1046-1072`). At 1024px the measured tab height is 214px.
- The runtime/model row is styled as generic accent text rather than a semantic status badge (`src/components/QwenChatPanel.tsx:326-330`, `src/styles.css:1174-1198`).
- Transcript height and `overflow:auto` create a nested scroll owner inside the page (`src/styles.css:1205-1219`).
- Status strings share the same tile primitive as numeric readiness (`src/App.tsx:1055-1059`, `src/styles.css:1001-1026`).
- Uniform borders, gradients, and glows flatten hierarchy (`src/styles.css:201-211`).
- The three-column cockpit fixes the right rail at 330px and leaves it with repeated content and dead space (`src/styles.css:871-880`, `src/App.tsx:902-916`).

## Contrast

Opaque token pairs against `#091422` calculate as follows: primary text 17.41:1, secondary text 10.47:1, muted text 5.76:1, info 11.40:1, success 13.14:1, and danger 6.73:1. Dark text on amber is 12.11:1. These pass WCAG 2.1 AA.

Many actual surfaces use translucent foregrounds over translucent gradients (`src/styles.css:9-29`, `src/styles.css:201-211`), so their final contrast depends on compositing and cannot be certified from token pairs alone. Browser inspection found no console errors, but the refactor must replace translucent text colors and borders with opaque semantic tokens before final AA verification.

## Missing States

- Keyboard focus is defined for buttons and inputs, but not textareas, selects, links, or tab descendants (`src/styles.css:55-68`).
- Loading relies on changing copy; there are no layout-matched skeletons (`src/components/QwenChatPanel.tsx:99-105`).
- Empty states use inconsistent paragraph/card markup rather than one primitive (`src/App.tsx:1493-1501`, `src/App.tsx:1713-1715`).
- Disabled controls receive browser/default treatment in several workflows.
- Error copy exists for inference, but its status hierarchy is not shared across other workflows (`src/components/QwenChatPanel.tsx:50-80`).

## Naming Audit

- "Launch Bay" and "Project Fleet" are understandable in context but less direct than "Projects" (`src/App.tsx:781-792`).
- "Command Gate Safe" does not state that shell commands are disabled by default (`src/App.tsx:278-282`).
- "Mission Console" is an activity log, and "Council" is a deterministic review workflow; both require descriptive supporting labels (`src/App.tsx:907-915`, `src/components/CouncilCenter.tsx:122-131`).
- "Mentor Guidance" is acceptable only when paired with the deterministic/advisory distinction (`src/App.tsx:375-398`).
