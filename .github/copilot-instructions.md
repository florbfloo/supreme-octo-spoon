# AI Copilot Instructions for supreme-octo-spoon

## Project Overview
**supreme-octo-spoon** is a TTRPG (tabletop RPG) wiki application—a client-side wiki builder where users create interconnected wiki pages with automatic link detection. No backend or database required; all data persists to browser localStorage.

## Architecture

### Tech Stack
- **Frontend**: SvelteKit 5 + Svelte 5 (TypeScript)
- **Build**: Vite 7 with SvelteKit adapter
- **Linting/Format**: ESLint 9 + Prettier + svelte-check

### Core Data Flow
1. **Data Layer** (`app/src/lib/stores/pages.ts`): Svelte writable store holding `Record<string, WikiPage>` (title → {title, content})
   - Auto-persists to `localStorage` on every change
   - Maintains backups (last 20) in separate localStorage key
   - Migration function handles old `[[link]]` syntax → new `[link]` syntax

2. **Wiki Link Processing** (`app/src/lib/wiki.ts`): Simple regex parser for `[title]` syntax
   - `parseWikiLinks()` replaces `[text]` patterns with rendered HTML links
   - Main page detects "source links" (explicit `[...]`) and "proxy links" (bare page names on pages that link to them)

3. **UI Layer** (`app/src/routes/+page.svelte`): 901-line SSR-disabled component
   - Page tree navigation (`TreeNode.svelte` recursively renders tree)
   - Markdown-free plain text editor with context menu for quick-linking
   - Backup/restore and import/export (JSON)
   - History navigation (forward/back)

### Key Files
- `app/src/lib/stores/pages.ts` — Source of truth for all pages
- `app/src/routes/+page.svelte` — Main editor UI, tree building, link handling
- `app/src/lib/TreeNode.svelte` — Recursive tree node component
- `app/src/lib/wiki.ts` — Link regex parser (minimal)

## Developer Workflows

### Setup & Run
```bash
./run                    # Top-level installer + dev server starter
cd app && npm run dev    # Direct dev server (Vite)
npm run build           # Production build (outputs to app/build/)
npm run check           # Type & template validation
npm run lint            # ESLint + Prettier checks
npm run format          # Auto-format with Prettier
```

### Critical Patterns

**Data Persistence**: All mutations must go through the `pages` store. Use `pages.set()` or Svelte reactivity; localStorage auto-syncs via subscribe handler. Backups fire on every store change—no explicit backup calls needed.

**Link Rendering**: Wiki links use regex; be careful with special chars (chars in page titles need escaping in the proxy-link regex on line ~218). Test with apostrophes, brackets, etc.

**Context Menu for Linking**: Right-click in textarea → optional quick-link creation. Only fires if word isn't already linked. Selection-aware: if text selected, links that; else, selects word under cursor.

**No SSR**: Both layout and main page set `export const ssr = false`. App is client-only; `browser` checks prevent server-side hydration errors.

**State Management**: Minimal—just the pages store. Expanded tree nodes, history, and UI flags use local component state (`let`/writable).

## Project-Specific Conventions

1. **WikiPage Type** (2 fields: `title`, `content`). Keep content as plain text; no HTML stored.
2. **Page Navigation**: Use `loadPage(title)` function; updates `currentTitle`, loads content, manages history.
3. **Link Syntax**: `[Page Title]` for explicit links. Page names are case-sensitive for keys but rendering is case-preserving.
4. **Tree Building**: Built on-demand from pages structure using `buildPageTree()`. Home is root; child pages detected from links on Home.
5. **Tests**: Playwright in root `package.json` suggests e2e tests exist (check if implemented).

## Common Tasks

- **Add a new store**: Use writable/derived in `app/src/lib/stores/` and subscribe in main page if persistence needed
- **Change link syntax**: Modify regex in `parseWikiLinks()` + tree building link detection + migration function
- **New UI feature**: Add to +page.svelte; use Svelte 5 syntax (`$props()`, `$state()`, etc.)
- **Debug localStorage**: Browser DevTools > Application > Local Storage > check keys `wiki-pages`, `wiki-pages-backups`

## Gotchas
- **localStorage is synchronous**—large datasets may pause the UI
- **Tree is built every render**—may be slow with hundreds of pages (optimization: memoize or lazy-build)
- **Backup fires on every change**—confirm this is intentional for UX
- **Context menu title case-sensitivity**—exact title match required; "Home" ≠ "home"
