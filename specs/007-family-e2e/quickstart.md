# Quickstart — 007 Family End-to-End Pass

How to run the browser pass over `/family`, what it does, and what to do when it fails.

---

## 1. Once, on a new machine

```bash
npm install                 # brings in the runner and the accessibility engine
npx playwright install      # fetches the browsers (Chromium and WebKit)
supabase start              # this repository's stack, on 553xx
```

The stack must be this repository's, not another project's. `supabase status` shows the ports; the
API belongs on `55321`. Nothing else needs preparing: the suite resets and seeds the database itself,
and starts the app itself.

## 2. Every run

```bash
npm run test:e2e            # the whole pass
npm run test:e2e -- --project=wall            # one screen size
npm run test:e2e -- e2e/specs/meals.spec.ts   # one tab
npm run test:e2e:ui         # watch it run, step through a failure
npm run test:e2e:headed     # watch it run in a real window
npm run test:e2e:report     # open the last run's report
```

The first command does everything: resets the database, seeds it, starts the development server if it
is not already running, signs in, sets Ana's and Cleo's PINs, warms every route, then walks the
journeys.

## 3. What a run does, in order

1. **Checks the stack is up.** If it is not, the run stops with one line saying so, rather than
   failing every journey with a connection error.
2. **Resets and seeds** — the same two commands the hand walks have always used.
3. **Starts the app** with `dev:local`, or reuses one already running on port 3000.
4. **Signs in** through the sign-in form and saves the session, so no journey pays for it again.
5. **Sets the PINs** through Settings, because the seed never sets any.
6. **Warms every route**, so the first journey on each tab does not pay for its compile.
7. **Walks the journeys**: the door, punch-in, the calendar, tasks, rewards, lists, meals, the two
   browsers, and the shell's accessibility and manifest checks.

## 4. Verifying the guarantees

Each success criterion in the spec, and how to see it for yourself.

| Criterion | How to check it |
|---|---|
| **SC-701** one command | On a clean checkout with the stack up, `npm run test:e2e` and nothing else |
| **SC-702** under ten minutes | The report's total; the door and punch-in files alone under a minute |
| **SC-703** repeatable | Run it twice with no reset between; run one file alone. Same results |
| **SC-704** every phase writes and re-reads | Each tab's spec has at least one journey that reloads before asserting |
| **SC-705** the three scopes | The calendar's and the meals' scope journeys assert the occurrences before and after the changed one, not only the one edited |
| **SC-706** real gestures | The two press-and-hold journeys and the calendar drag use pointer steps, and assert after a reload |
| **SC-707** live updates | `live.spec.ts` either passes on all five tabs or is skipped with its reason printed. Read the report, not the exit code |
| **SC-708** accessibility | `shell.spec.ts` fails on any serious or critical violation and prints the rule and the element |
| **SC-709** names, not styles | Search the suite for a class or style selector: there should be none |
| **SC-710** no sleeps | Search the suite for a fixed delay: there should be none |
| **SC-711** local only | Search the suite for any address or key: only the local stack's, and only through the shared script |
| **SC-712** the gates unchanged | `npm run fallow:audit`, `npm test`, `npm run typecheck`, `npm run lint` |
| **SC-713** it can fail | The fault-injection pass, recorded in `checklists/quickstart-run.md` |

## 5. When it fails

**Read the report first**: `npm run test:e2e:report`. A failed journey carries a trace you can step
through, a screenshot at the moment it failed, and the browser's console.

| Symptom | Likely cause |
|---|---|
| "The local stack is not running" | `supabase start`, then run again |
| Everything fails at sign-in | The stack is up but on another project's ports, or `.env.local` is missing |
| A journey cannot find a control by name | Often a real defect: the control has no accessible name. Fix the application, with a unit test |
| The live journeys are skipped | This environment does not deliver live updates to a browser. Known on the local stack since Phase 5; verify on the hosted project by hand |
| A drag journey is flaky | Look at the trace: if the grid had not settled before the press, the wait is wrong, not the drag |
| The first journey on a tab times out | The warm-up did not cover a route; add it there rather than raising the timeout |

## 6. Where this fits

The suite is a **phase gate**: run it before merging a phase, alongside the four gates that already
run on every commit (`fallow:audit`, `test`, `typecheck`, `lint`). It is deliberately not in the
pre-commit hook — it is minutes, and a gate that slow gets disabled.

It never touches the hosted project. The operator's hardware pass — real tablets and phones, a real
screen reader, airplane mode — stays a human check.
