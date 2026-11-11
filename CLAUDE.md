# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Website for the World of Warcraft guild **Vanguarda da Luz**: Angular 22 (standalone, zoneless, strict TypeScript, signals), Firebase Auth + Cloud Firestore + Firebase Hosting on the **Spark plan — no Cloud Functions, no Storage**. Everything (including multi-step flows like account deletion) runs in the browser and is enforced by `firestore.rules`.

The whole product is in Brazilian Portuguese: UI text, route paths (`/entrar`, `/minha-conta`, `/admin/candidaturas`), code comments, commit messages (Conventional Commits, e.g. `feat(eventos): ...`, `fix(home): ...`). Keep that convention.

Sources of truth for requirements: `docs/criterios-de-aceite.md` (30 user stories with acceptance criteria) and `docs/prototipo.pdf`.

## Commands

Requires Node 22+ and Java 21+ (Firestore emulator).

```bash
npm run emulators      # dev emulators: Auth :9099, Firestore :8080, Hosting :5050, UI :4000
npm start              # http://localhost:4200 — dev build always talks to the emulators (project demo-vanguarda-da-luz)
npm run dev:seed       # seed emulators (admin maren@vanguarda.test, password segredo123)
npm run dev:reset-link -- email@exemplo.com   # print the app's password-reset link for an emulator user

npm run lint           # ESLint for TS + templates (includes template accessibility rules)
npm run test:ci        # unit tests (Angular unit-test builder, Vitest, jsdom), src/**/*.spec.ts
npm run typecheck:tests
npm run test:emulators # tests/rules + tests/integration against separate test emulators (firebase.test.json: Auth 9199, Firestore 8180)
npm run build
npm run check          # everything above in sequence — this is what CI runs
npm run e2e:serve      # e2e build served against the test emulators at http://127.0.0.1:5150
```

Single tests:

```bash
npx ng test --watch=false --include src/app/core/auth/guards.spec.ts
npx firebase emulators:exec --config firebase.test.json --only auth,firestore --project demo-vanguarda-da-luz \
  "vitest run --config vitest.emulators.config.mts tests/rules/events.rules.spec.ts"
```

Test emulators use different ports from the dev emulators, so they can run while `npm run emulators` is up without wiping dev data. Emulator tests run serially (`fileParallelism: false`) and clear Auth/Firestore before each test.

## Architecture

- `src/app/app.routes.ts` — every page is lazy-loaded (`loadComponent`) and protected by a guard from `core/auth/guards.ts` (`guestGuard`, `pendingGuard`, `authGuard`, `adminGuard`). Admin pages are children of `features/admin/admin-shell`. Route path constants live in `core/routing/paths.ts`.
- **Access model** (`core/auth/access.ts`): `resolveAccess(user, account)` turns the Firebase user + `users/{uid}` doc into an access level (`visitor`, `pending`, `member`, `admin`, `blocked`, `deleting`, …). `SessionService` (`core/auth/session.service.ts`) holds user/account/access as signals and listens to `users/{uid}` live; guards await `resolvedAccess()`.
- **Firebase wiring** (`core/firebase/firebase.providers.ts`): `FIREBASE_APP`/`FIREBASE_AUTH` injection tokens; Firestore is obtained via `FirestoreClient.get()`, which **dynamically imports** `firebase/firestore` so public pages don't ship the Firestore SDK. Don't import Firestore eagerly in code reachable from public routes. Emulator connection is driven by `src/environments/` (`environment.ts` dev → emulators, `environment.e2e.ts` → test emulators, `environment.prod.ts` → real project `vanguarda-da-luz`), swapped via `fileReplacements` in `angular.json`.
- **Data layer pattern** (`core/data/`, also `core/auth/sign-up.ts`, `account-deletion.ts`, etc.): each domain has a framework-free module (`events.ts`, `applications.ts`, `attendance.ts`, `guest-attendance.ts`, `review.ts`, `members-admin.ts`, …) whose functions take a `Firestore` instance and return typed results — these are tested directly against the emulators in `tests/integration/`. A thin `@Injectable` `*.service.ts` wraps them, injecting `FirestoreClient` and `SessionService`. Components depend only on the services, and unit tests replace them with hand-written stubs (e.g. `session.stub.ts`, `site-content.stub.ts`, `dialog.stub.ts`, or local `class XStub` in specs).
- **Security Rules** (`firestore.rules`) deny everything by default; each feature opens only what it needs and must come with tests in `tests/rules/` (helpers in `tests/rules/env.ts`: `asUser`, `asVisitor`, `seed`, …). Since there are no Cloud Functions, invariants (e.g. at least one active admin via `config/admins.activeAdminUids`, attendee limits, username uniqueness via `usernames/{key}`, account deletion steps) are enforced in rules + batched writes/transactions on the client. Any data-model change usually touches the data module, the rules, the rules tests and the integration tests together.
- **Main collections**: `users/{uid}` (status/role), `usernames/{key}`, `applications/{uid}` (one per user), `members/{uid}` (with `mainCharacter`), `config/admins`, `site/guild` and `site/social` (admin-editable content), events with attendance and guest attendance subcollections.
- **Content**: static guild text in `core/content/guild-content.ts` (pending placeholders are in `[BRACKETS]`); defaults for admin-editable content in `core/content/site-content.ts`, overridden by `site/*` docs once saved.
- **Domain**: two games — WoW Retail (character name + server, 13 classes) and WoW Forever/Classic (name + surname + ruleset Normal/JxJ, 9 classes); definitions in `core/models/wow.ts`. Times are handled in Brasília time (`core/time/brasilia.ts`); locale is `pt-BR`.
- **Styles**: global design tokens and partials in `src/styles/` (`_tokens.scss`, etc.); component styles are SCSS with a production budget of 8 kB warning / 12 kB error per component.
- Component/directive selectors must use the `app` prefix (ESLint). Prettier: single quotes, width 100.

## CI / deploy

`.github/workflows/ci.yml` runs `npm run check` on PRs and pushes to `main`. PRs get a Firebase Hosting preview channel URL; pushes to `main` deploy Firestore rules/indexes and Hosting to production.

## Angular guidance

The `angular-developer` skill (`.claude/skills/angular-developer`) contains Angular 22 reference material (signals, resource, signal forms, routing, testing, etc.) — consult it for framework-level questions.
