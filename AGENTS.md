# Repository Guidelines

## Project Structure & Module Organization
- Entry files live at the root: `index.html`, `index.tsx`, `App.tsx`.
- Feature code is organized under `components/`, `pages/`, and `data/`; shared types are in `types.ts`.
- A secondary `src/` mirrors some folders for legacy/experimental code. Prefer root-level folders for new work.
- Path alias `@` points to the project root (see `tsconfig.json` and `vite.config.ts`). Example: `import Sidebar from '@/components/Sidebar'`.

## Build, Test, and Development Commands
- `npm install` — install dependencies.
- `npm run dev` — start the Vite dev server.
- `npm run build` — create a production build in `dist/`.
- `npm run preview` — serve the built app locally.
- Config: create `.env.local` and set `GEMINI_API_KEY=...` (Vite injects this; see `vite.config.ts`).

## Coding Style & Naming Conventions
- TypeScript + React functional components; use 2‑space indentation.
- File names: PascalCase for components/pages (e.g., `CustomerTable.tsx`), camelCase for utilities.
- Exports: default export for React components; use named exports for helpers/types.
- Keep types in `types.ts` or colocate if component‑specific. Prefer the `@` alias for absolute imports.

## Testing Guidelines
- No test runner is configured. Aim for small, testable components.
- If introducing tests, prefer Vitest + React Testing Library. Name tests `ComponentName.test.tsx` next to the component.
- Manual QA: run `npm run dev`, exercise changed pages, ensure no console errors, and that `npm run build` passes.

## Commit & Pull Request Guidelines
- Follow Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`. Scope when useful (e.g., `feat(pages): add ReportsPage filters`).
- PRs: include a clear summary, link related issues, and add screenshots/GIFs for UI changes. Keep PRs focused and small.

## Security & Configuration Tips
- Never commit secrets. `.env.local` is git‑ignored (`*.local`). Rotate `GEMINI_API_KEY` if exposed.
- This app is a SPA using mock data; avoid coupling to server‑only code in the client.

## Agent‑Specific Instructions
- Prefer root‑level modules over `src/`. Do not relocate files unless part of a planned refactor.
- Respect the `@` alias and existing import patterns; keep changes minimal and scoped.

