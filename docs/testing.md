# Testing strategy

The project uses Node's built-in test runner through `tsx` for backend unit tests. Playwright provides a small browser smoke suite for the React application.

## Backend

Run `npm test` from `backend`.

- `gameEngine/othello.test.ts`: opening rules, immutability, invalid input, scoring, and randomized full-game invariants.
- `utils/elo.test.ts`: provisional ratings, draws, minimum ratings, and rank thresholds.
The backend suite does not require MongoDB or external services. Socket.IO integration coverage remains a recommended next addition.

## Frontend

Run `npm run test:e2e` from `frontend`. Install Chromium once with `npx playwright install chromium` if it is not already installed.

The smoke suite verifies desktop landing-page rendering, navigation, and mobile menu behavior. Future browser tests should cover auth errors and two-player gameplay against an isolated test database.

## CI

GitHub Actions installs from lockfiles, audits production dependencies, type-checks and builds both applications, runs backend tests, and executes Playwright in Chromium.
