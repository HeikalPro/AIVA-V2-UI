# AIVA Control: components

## Tokens (src/index.css, exposed in tailwind.config.js)
Colors are HSL channels, so opacity modifiers work (`bg-primary/10`). Light = `:root`/`.theme-light`,
dark = `.dark`/`.theme-dark` (wrap a subtree in `.theme-light` to force light, e.g. the widget preview).

- Surfaces: `background`, `foreground`, `surface` (`-muted`, `-raised`), `card(-foreground)`, `popover(-foreground)`, `overlay` (scrims)
- Brand: `primary` + `-hover`, `-active`, `-foreground`, `-muted` (selected tint), `-muted-foreground`; raw scale `brand-50…950` (reference only)
- Text: `foreground` (primary), `muted-foreground` (secondary), `subtle-foreground` (placeholders/disabled/tertiary meta only; lower contrast)
- Neutral fills: `secondary(-foreground)`, `muted` (hover rows, chips), `accent(-foreground)` (menu/ghost hover)
- Status: `success | warning | danger | info | neutral`, each with `-foreground` (text on solid) and `-muted` (tint). `X` = dots, icons, text on `X-muted`. `destructive` = danger alias.
- Lines: `border`, `input` (control border, 3:1), `ring`
- Charts: `chart-1…5`, `chart-grid`, `chart-axis`, `chart-tooltip(-foreground)`; in Recharts use the resolved colours from `useChartTheme()` (`@/components/data/chart`), never hex
- Sidebar: `sidebar`, `sidebar-foreground`, `-muted`, `-active`, `-active-foreground`, `-border`, `-hover`
- Type: `text-xs` 12/16 meta (minimum size), `text-ui` 13/20 tables + labels, `text-sm` 14/20 body, `text-base` 16/24 section, `text-2xl` 24/32 page title
- Radius: `rounded-md` 6 controls, `rounded-lg` 8 cards/popovers, `rounded-xl` 10 dialogs. Shadows: `shadow-xs|sm|md|lg` (tokenized; borders first)

## Which primitive for what (`@/components/ui/*` unless noted)
| Need | Use |
| --- | --- |
| Action | `Button` (`primary` default, `secondary`, `outline`, `ghost`, `destructive`, `link`; `sm/md/lg`; `loading`; `asChild` for `<Link>`) |
| Icon-only action | `IconButton` (`label` required: aria-label + tooltip) |
| Row actions | `RowActionsMenu` (`dropdown-menu`) |
| Status of anything | `Status` from `@/components/data/status` (`<Status value={row.status} />`) |
| Tags / roles / counts | `Badge` |
| Form layout | `Field`, `FieldGroup`, `FormSection` (`field`) |
| Text fields | `Input`, `SearchInput`, `Textarea` (`mono` for prompts), `Select` (native), `ColorInput` |
| Choices | `Checkbox`, `Switch`, `RadioGroup` |
| Modal task | `Dialog` (`sm/md/lg/xl/full`); side panel: `Sheet` |
| Destructive confirm | `ConfirmDialog` (`@/components/shared/ConfirmDialog`) |
| Section switching | `Tabs` (`underline` default, `segmented` for small filters) |
| Transient success / failure | `toast.success(…)` / `toast.error(…)` (`toast`) |
| Persistent inline message | `Alert`; form/page errors: `ErrorAlert` |
| Loading | `Skeleton` / `SkeletonText` (layout), `Spinner` (inline), `Progress` (known progress / long jobs) |
| Nothing to show | `EmptyState` from `@/components/data/empty-state` |
| Lists | `Table` primitives + `Pagination` (one pagination for the app) |
| Formatting | `@/lib/format` (`formatNumber`, `formatPercent(ratio)`, `formatDurationMs`, `formatMoney`, `formatDateTime`, `formatRelativeTime`) |

## Data layer (`@/components/data/*`)
| Need | Use |
| --- | --- |
| Any table of records | `DataTable` + `actionsColumn` (`data-table`): sorting, client or server pagination, selection + bulk actions, column visibility, skeleton rows, empty states, sticky header, row click |
| Search + filters above a table | `FilterBar` (`filter-bar`) in the DataTable `toolbar` slot |
| KPIs / metric strips | `Stat`, `StatGroup` (`stat`) — `emphasis="primary"` for headline KPIs only |
| Charts | `useChartTheme`, `chartAxisProps`, `chartGridProps`, `ChartTooltip`, `ChartLegend`, `ChartCard` (`chart`) |
| Status / empty | `Status`, `EmptyState` |
There are no other table, filter, KPI or status implementations — extend these instead of adding local ones.

## Shell (`@/components/shell/*`, `@/contexts/WorkspaceContext`)
- Every page: `<Page width="narrow|default|wide|full"><PageHeading title description actions meta />…</Page>` (`shell/page`). No header cards, no icon tiles.
- Account-scoped pages read the sidebar workspace with `useWorkspace()` instead of keeping their own account select.
- Navigation, groups, labels and page access come from `NAV_ITEMS` / `NAV_GROUPS` in `@/lib/roles` (single source for sidebar, breadcrumb, command palette and the page-access editors).
- Command palette deep links: `?action=create` opens a page's create flow; `?q=` pre-fills a page's search.

## Rules
1. No hard-coded colors in pages: no hex, no `slate-*`/`red-*`/… classes, no `dark:` overrides. Use tokens.
2. Statuses use `Status` (dot + text). Never color-only.
3. Icon-only buttons use `IconButton`. Every icon gets `aria-hidden`; the button gets the name.
4. Destructive actions confirm with `ConfirmDialog` (never `window.confirm`).
5. Transient success goes in a toast, not a permanent "saved" line.
6. Loading uses `Skeleton` (tables: skeleton rows), not "Loading…" text.
7. `text-xs` (12px) is the smallest text. No `text-[10px]`/`text-[11px]`.
8. User / KB content gets `dir="auto"` on an inline element (`<span dir="auto">` or `<bdi>`), not on a table cell
   (a cell with `dir="auto"` right-aligns Arabic rows and breaks column alignment).
9. Compose classes with `cn()` from `@/lib/utils` (tailwind-merge aware of `text-ui`); a caller's class wins.
10. `Select`/`SearchInput`/`ColorInput` wrap the native control: layout classes in `className`
    (`mt-*`, `w-*`, `min-w-*`, `flex-1`, `col-span-*`, `hidden`…) go to the wrapper, the rest to the control.
11. Dialogs: include `DialogTitle`; add `DialogDescription` when there is one. Use `DialogBody` for
    scrolling content: it switches the dialog to fixed header/footer bands with a scrolling body.
