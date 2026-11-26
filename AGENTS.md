# Repository Guidelines

## Project Structure

Modeldoe is a client-only React, TypeScript, and Vite app. `index.html` loads `src/main.tsx`, which contains the UI and browser storage handling. `src/model.ts` contains the domain types, sample data, prompt generation, reply validation, and Bayesian estimates. Styles live in `src/style.css`, static assets in `public/`, and model tests in `test/model.test.ts`. The GitHub Pages workflow lives in `.github/workflows/pages.yml`.

## Build, Test, and Development

Use Node.js 22 to match CI. Run these commands from the repository root.

- `npm ci` installs dependencies from `package-lock.json`.
- `npm run dev` starts the Vite development server.
- `npm test` runs the Node.js test suite.
- `npm run typecheck` checks the TypeScript source and tests.
- `npm run build` checks types and produces the static site in `dist/`.
- `npm run preview` serves the production build locally.

Pushes to `main` run the tests and build with `npm run build -- --base=./` so assets resolve under the GitHub Pages project path.

## Coding Style

Match the existing two-space indentation, double-quoted strings, and statement semicolons. Use PascalCase for React components and types, and camelCase for functions and variables. Keep model logic in `src/model.ts` so it can be tested independently of the UI. Follow the surrounding formatting. The repository has no configured linter or formatter.

## Testing Guidelines

Use `*.test.ts` files in `test/` with `node:test` and `node:assert/strict`. Name tests for the behavior they verify. Cover invalid or stale replies when changing validation and legacy records when changing persisted data. Run `npm test` before submitting. CI has no numerical coverage threshold.

## Commits and Pull Requests

Use short, imperative commit subjects, following examples such as “Show Bayesian uncertainty and improve evidence review.” In pull requests, summarize the change and how you verified it. Link related issues when available and include screenshots for visible UI changes. Use fictional profiles in fixtures and screenshots.
