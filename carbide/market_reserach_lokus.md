# Lokus Assessment for Carbide/Otterly

## Scope

This document compares `/Users/abir/src/lokus` and `/Users/abir/src/otterly` with emphasis on the Lokus areas that are most attractive for Carbide:

- graph view
- bases
- extensions
- kanban/tasks
- calendar
- highly customizable UI/editor settings

The goal is not to identify raw code we can copy. The goal is to identify what is worth porting, what should only inform design, and where Otterly already has enough infrastructure that Carbide should build natively on top of it.

## Executive Summary

The main conclusion is simple:

- port the ideas
- do not port most of the code

Lokus is structurally broad and horizontally organized. Otterly is much cleaner and more explicit, with feature slices, ports/adapters, services, stores, reactors, and an action registry. That makes Otterly the better implementation base for Carbide, but it also means most Lokus subsystems are a poor direct transplant.

The best borrow targets are:

1. deeper UI/editor customization
2. graph view concepts and data-flow shape
3. bases architecture and query concepts

The highest-risk direct ports are:

1. plugin/runtime code
2. kanban/task implementation
3. calendar integration and sync stack

## Important Architectural Difference

### Lokus

Lokus concentrates major capabilities into broad horizontal subsystems:

- `src/core/graph/*`
- `src/bases/*`
- `src/plugins/*`
- `src/editor/*`
- `src/stores/editorGroups.js`
- large React screens in `src/views/*`

This gives it feature breadth, but also creates strong coupling between UI, runtime state, and feature implementation.

### Otterly

Otterly follows a stricter vertical-slice model:

- ports + adapters for IO
- sync stores for state
- services for async workflows
- reactors for persistent observation side effects
- action registry as the single dispatch surface

Important composition seams already exist:

- `docs/architecture.md`
- `src/lib/app/di/create_app_context.ts`
- `src/lib/app/orchestration/ui_store.svelte.ts`
- `src/lib/app/bootstrap/ui/workspace_layout.svelte`

This means Carbide should build new capabilities as first-class Otterly feature slices, not as imported Lokus islands.

## What Otterly Already Has

Otterly already overlaps more with Lokus than expected:

- rich Milkdown/ProseMirror editor with internal plugins
- outline panel
- backlinks/outlinks/context rail
- two-pane split editor
- embedded terminal panel
- document viewer for PDF/image/CSV/code/text
- typed settings catalog
- custom theme editing with live theme controls

Relevant Otterly files:

- `src/lib/features/editor/adapters/milkdown_adapter.ts`
- `src/lib/features/editor/application/editor_service.ts`
- `src/lib/features/outline/*`
- `src/lib/features/links/*`
- `src/lib/features/split_view/*`
- `src/lib/features/document/*`
- `src/lib/features/terminal/*`
- `src/lib/features/settings/domain/settings_catalog.ts`
- `src/lib/shared/types/editor_settings.ts`
- `src/lib/features/settings/ui/theme_settings.svelte`

So the real gaps are narrower:

- graph
- bases
- extension runtime
- task domain
- kanban/calendar views
- deeper live editor customization

## Area-by-Area Assessment

### 1. Graph View

#### Lokus

Graph is a serious subsystem, not just a screen:

- data + processing: `src/core/graph/GraphData.js`
- graph engine hook: `src/features/graph/hooks/useGraphEngine.js`
- large React UI: `src/views/ProfessionalGraphView.jsx`

`GraphData` handles:

- wikilink extraction
- tag extraction
- node/link maintenance
- realtime document updates
- graph metrics
- optional persistence/indexing behavior

#### Otterly

Otterly has the primitives for a graph MVP, but not the feature:

- links/outlinks/backlinks already exist
- search/index ports already exist
- there is no graph store, graph service, graph panel, or graph action surface

Best existing seams:

- `src/lib/features/links/application/links_service.ts`
- `src/lib/features/links/state/links_store.svelte.ts`
- `src/lib/features/outline/state/outline_store.svelte.ts`
- `src/lib/app/di/create_app_context.ts`

#### Recommendation

- **Portability:** adapt, not direct port
- **What to borrow:** data-flow shape, graph feature boundaries, derived metrics ideas
- **What to rewrite:** all UI and state integration

#### Verdict

Graph is a good near-term Carbide feature. It can be built natively on top of Otterly’s existing link/index model.

### 2. Bases

#### Lokus

Bases is the strongest long-term subsystem in Lokus.

Key files:

- `src/bases/core/BaseSchema.js`
- `src/bases/core/BaseManager.js`
- `src/bases/data/FrontmatterParser.js`
- `src/bases/data/index.js`
- `src/bases/query/QueryExecutor.js`
- `src/bases/BasesContext.jsx`
- `src/bases/BasesView.jsx`

Important properties:

- `.base` definitions
- frontmatter-driven metadata extraction
- property types
- filter/query engine
- grouping, sorting, pagination
- multiple view types in the schema, including table, list, gallery, kanban, calendar, timeline, chart

#### Otterly

Otterly does not yet have the foundations bases needs:

- no structured frontmatter metadata layer
- no property/query model
- no schema system
- no table/gallery/kanban/calendar view infrastructure

#### Recommendation

- **Portability:** adapt heavily
- **What to borrow:** schema concepts, query vocabulary, property model, view-model direction
- **What to rewrite:** storage, parsing, UI, and integration into Otterly architecture

#### Verdict

Bases is probably the highest-value subsystem to borrow architecturally, but it is not the first UI feature to ship. It needs metadata and query foundations first.

### 3. Extensions / Plugin System

#### Lokus

Lokus has a broad plugin/extension surface:

- loader/runtime: `src/plugins/PluginManager.js`, `src/plugins/runtime/PluginRuntime.js`
- manifests/schemas: `src/plugins/manifest/*`, `src/plugins/schemas/*`
- security: `src/plugins/security/*`
- registry/install/publishing: `src/plugins/registry/*`
- editor/plugin APIs: `src/plugins/api/*`

Important files:

- `src/plugins/PluginManager.js`
- `src/plugins/api/EditorAPI.js`
- `src/plugins/api/ExtensionManager.js`
- `src/views/PluginSettings.jsx`
- `src/views/Extensions.jsx`

Useful takeaways:

- contribution model
- manifest shape
- permission vocabulary
- editor contribution points
- enable/disable/install mental model

Important caution:

- parts of the marketplace UI still appear semi-productized rather than fully production-hardened
- the implementation is strongly tied to React, Lokus runtime assumptions, and its editor model

#### Otterly

Otterly currently has no user-installable extension runtime:

- no manifest layer
- no registry
- no sandbox/runtime boundary
- no plugin host

Otterly’s current “plugins” are internal editor adapters, not a product extension system.

#### Recommendation

- **Portability:** adapt concepts only
- **What to borrow:** manifest shape, contribution slots, permission ideas, settings/consent UX
- **What to rewrite:** everything runtime-related

#### Verdict

The Lokus plugin architecture is useful as research input for `carbide/plugin_system.md`, but it should not be ported directly.

### 4. Kanban / Tasks

#### Lokus

Lokus tasks are not just Markdown checkboxes. They form an app-level domain.

Key files:

- `src/components/KanbanBoard.jsx`
- `src/components/TaskCreationModal.jsx`
- `src/editor/extensions/TaskCreationTrigger.js`
- `src/editor/extensions/TaskSyntaxHighlight.js`
- `src/components/Calendar/TaskScheduleSidebar.jsx`

Important observations:

- kanban is persisted through Tauri commands
- editor trigger `!task` opens task-creation flow
- task UI links into scheduling/calendar behavior

This is deeper than a visual board over markdown task list items.

#### Otterly

Otterly has:

- task-list syntax support in the editor
- slash command insertion for todo/checklist items

Otterly does not have:

- task entities
- task store/service
- kanban board model
- scheduling metadata
- task extraction/indexing layer

#### Recommendation

- **Portability:** mostly reimplement
- **What to borrow:** UX patterns, task-creation gestures, syntax highlight ideas
- **What to rewrite:** the entire domain model and persistence strategy

#### Verdict

Do not port kanban first. Define a real Carbide task model first, ideally one that can later feed bases and calendar views.

### 5. Calendar

#### Lokus

Calendar is a full subsystem, not just a calendar component.

Key files:

- `src/components/Calendar/CalendarView.jsx`
- `src/components/Calendar/TaskScheduleSidebar.jsx`
- `src/services/calendar.js`

It includes:

- month/week/day views
- event CRUD
- drag/drop
- task scheduling
- CalDAV
- iCal subscriptions
- auth and sync flows

#### Otterly

Otterly has no calendar slice yet.

#### Recommendation

- **Portability:** adapt UI concepts, reimplement actual system
- **What to borrow:** scheduling UX, sidebars, view modes
- **What to defer:** external calendar sync until there is a clear user need

#### Verdict

Full Lokus-style calendar parity is too expensive to port early. Carbide should only consider calendar after tasks or bases provide a strong internal data model.

### 6. UI and Editor Customization

#### Lokus

This is the best short-term source of product inspiration.

Key files:

- `src/views/Preferences.jsx`
- `src/core/editor/live-settings.js`
- `src/core/config/store.js`

Important behavior:

- large multi-section preferences screen
- many live editor controls
- global CSS-variable mutation at runtime
- typography, spacing, list markers, links, highlights, code blocks, blockquotes, tables, selection styling

This is highly visible and product-differentiating.

#### Otterly

Otterly already has a good foundation:

- typed editor settings
- settings catalog
- theme editor
- global vs vault-scoped persistence split

Important Otterly files:

- `src/lib/shared/types/editor_settings.ts`
- `src/lib/features/settings/domain/settings_catalog.ts`
- `src/lib/features/settings/application/settings_service.ts`
- `src/lib/features/settings/ui/theme_settings.svelte`
- `src/lib/features/theme/application/theme_service.ts`

#### Recommendation

- **Portability:** high-value adapt
- **What to borrow:** control depth, live preview philosophy, editor appearance scope
- **What to avoid:** Lokus’s global config model and singleton-style runtime approach

#### Verdict

This is the best near-term Carbide port target. It fits Otterly’s current architecture and yields immediate product value.

## Portability Matrix

| Area | Recommendation | Notes |
| --- | --- | --- |
| Graph | Adapt | Reuse link/index concepts, rewrite as Otterly `graph` slice |
| Bases | Adapt heavily | Strong strategic value, needs metadata/query foundation first |
| Extensions | Adapt concepts only | Borrow manifest/API ideas, reimplement runtime |
| Kanban | Reimplement | Needs task domain first |
| Tasks | Reimplement | Borrow gestures and UX, not internals |
| Calendar | Adapt UI, reimplement system | External sync is expensive and coupled |
| UI/editor customization | Adapt aggressively | Best short-term win |

## Recommended Build Order for Carbide

### Phase 1

- deeper editor/UI customization
- graph MVP

### Phase 2

- metadata/frontmatter foundation
- bases table/list foundation

### Phase 3

- task domain
- kanban view over task/base data
- simple internal calendar/scheduling view

### Phase 4

- plugin host foundation
- manifest, contribution slots, permissions

### Phase 5

- marketplace/distribution
- external calendar sync if still justified

## Product Recommendation

If Carbide wants the most leverage from Lokus without dragging in its coupling, the right strategy is:

- use Lokus as a product/design reference
- use Otterly as the implementation architecture

The order should be:

1. ship visible customization wins
2. ship a graph MVP
3. build bases foundations carefully
4. treat tasks/kanban/calendar as views over a stronger underlying model
5. build the plugin host natively rather than trying to inherit Lokus runtime code

## Key Reference Files

### Lokus

- `src/core/graph/GraphData.js`
- `src/features/graph/hooks/useGraphEngine.js`
- `src/views/ProfessionalGraphView.jsx`
- `src/bases/core/BaseManager.js`
- `src/bases/core/BaseSchema.js`
- `src/bases/data/index.js`
- `src/bases/query/QueryExecutor.js`
- `src/plugins/PluginManager.js`
- `src/plugins/api/EditorAPI.js`
- `src/views/Preferences.jsx`
- `src/core/editor/live-settings.js`
- `src/components/KanbanBoard.jsx`
- `src/components/Calendar/CalendarView.jsx`
- `src/services/calendar.js`

### Otterly

- `docs/architecture.md`
- `src/lib/app/di/create_app_context.ts`
- `src/lib/app/orchestration/ui_store.svelte.ts`
- `src/lib/app/bootstrap/ui/workspace_layout.svelte`
- `src/lib/features/editor/adapters/milkdown_adapter.ts`
- `src/lib/features/editor/application/editor_service.ts`
- `src/lib/features/settings/domain/settings_catalog.ts`
- `src/lib/shared/types/editor_settings.ts`
- `src/lib/features/settings/ui/theme_settings.svelte`
- `src/lib/features/links/application/links_service.ts`

