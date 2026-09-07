# Quickstart — 008 Family Notifications

Setting the phase up locally, the operator's steps on the hosted project, how to see each guarantee
for yourself, and what to do when something does not arrive.

---

## 1. Secrets, first, and none of them go in the repository

Three values this phase needs. **None is ever written to a file that git tracks.** The gates run on
every commit and the run record's review checks for key-shaped strings, as `007` did.

```bash
# A VAPID key pair identifies this application to the push services. Generate once, keep forever:
npx web-push generate-vapid-keys

# A shared secret so only the scheduler can trigger a send:
openssl rand -base64 32
```

Put them in `.env.local` (gitignored) for local work:

```
NEXT_PUBLIC_FAMILY_VAPID_PUBLIC_KEY=…    # the public half; the browser needs it to subscribe
FAMILY_VAPID_PRIVATE_KEY=…               # server only
FAMILY_VAPID_SUBJECT=mailto:…            # a contact address the push services can reach
FAMILY_REMINDERS_SECRET=…                # the scan's shared secret
```

Regenerating the VAPID pair invalidates **every** existing subscription — every device has to turn its
switch off and on again. Generate once.

## 2. Local setup

```bash
supabase start                      # this repository's stack, on 553xx
supabase db reset                   # applies 034–037 with everything before them
npm run family:seed -- --local
npm run dev:local
```

Sign in as `dev@family.local` with `family-dev-password`, then **set the PINs in Settings** — Ana
`1234`, Cleo `2468`. The seed never sets a PIN, and every write in this phase needs a punch-in.

There is **no `pg_cron` in the local stack**, so nothing scans on its own. Trigger it by hand:

```bash
npm run family:reminders -- --local        # one scan, right now
```

Run it twice in a row on purpose. The second run should claim nothing — that is the exactly-once
constraint doing its job, and it is the cheapest way to see it work.

## 3. The operator's steps on the hosted project

In this order. Step 1 comes first because everything else assumes it.

**1 — Confirm the two extensions exist.** They are standard on hosted Supabase, but this was not
verifiable during planning, so check before depending on it. In the SQL editor:

```sql
select name, installed_version from pg_available_extensions where name in ('pg_cron', 'pg_net');
create extension if not exists pg_cron;
create extension if not exists pg_net;
```

If either is unavailable, **stop and say so** — banners will still work, but nothing will reach a
phone, and the plan's fallback needs deciding rather than improvising.

**2 — Push the migrations.** Before the branch is merged or deployed (R818):

```bash
supabase db push          # 034–037
```

`push_devices` joins the realtime publication that every `/family` page subscribes to. A deployment
whose client binds a table the database does not have fails the whole shared channel — the calendar
and the boards with it. This ordering has been the rule since Phase 2.

**3 — Set the environment variables in Vercel**: the four from step 1, on the production environment.
Redeploy so the running functions can see them.

**4 — Teach the database the secret and schedule the scan.** In the SQL editor, with your own values:

```sql
-- the secret, so pg_net can present it; stored as a database setting, never in the repository
alter database postgres set app.reminders_secret = 'THE-SECRET-FROM-STEP-1';

select cron.schedule('family-reminders', '* * * * *', $$
  select net.http_post(
    url     := 'https://willsmith.dev/api/family/reminders/run',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.reminders_secret')
    )
  );
$$);
```

Check it is running:

```sql
select jobid, jobname, schedule, active from cron.job;
select status, return_message, start_time from cron.job_run_details
 where jobid = (select jobid from cron.job where jobname = 'family-reminders')
 order by start_time desc limit 5;
```

**5 — On each iPhone, add `/family` to the Home Screen before turning the switch on.** Safari on iOS
delivers Web Push only to an installed web app; in a browser tab the permission prompt never appears
(R820). Share → Add to Home Screen, open it from there, then Settings → Notifications → send reminders
to this device. Android and desktop need no such step.

## 4. Verifying the guarantees

Each success criterion, and how to see it.

| Criterion | How to check it |
|---|---|
| **SC-801** four choices, two groups, the stated defaults | A fresh `supabase db reset`, then open Settings → Notifications and read it |
| **SC-802** a banner within a minute of its moment | Create an event twelve minutes out, leave a page open, watch it arrive at the ten-minute mark |
| **SC-803** one banner, not several | Two events at the same time. One banner naming both |
| **SC-804** exactly once | `npm run family:reminders -- --local` twice. The second claims nothing |
| **SC-805** nothing older than fifteen minutes | Do not scan for an hour, then scan. Only what is current goes |
| **SC-806** an override survives a default change | One event set to two hours, one left inheriting; change the household to 30 minutes; reload; check both |
| **SC-807** the three scopes | A weekly event; change its reminder at each scope; check the occurrence before and after the changed one, across two weeks |
| **SC-808** timed chores only, and once | Practice piano (timed), an anytime chore, a routine, and a chore left to carry forward overnight |
| **SC-809** a completion within a minute | Tick a task with **When Completed** on; then turn it off and tick another |
| **SC-810** silence about stars | Award, redeem, break a streak, finish a week. Nothing is sent |
| **SC-811** a closed browser still hears | Turn the switch on, close every tab, trigger a scan, act on the notification and land on the right day |
| **SC-812** turning it off stops it | Toggle off, scan, nothing arrives; then revoke the permission in the browser and confirm the row is pruned |
| **SC-813** deleted, skipped, moved | Each of the three, arranged to have a reminder pending, then scan |
| **SC-814** the decisions are unit-tested | `npm run test:coverage`, then read `lib/family/notifications/**` — including a DST boundary and midnight in the household's zone |
| **SC-815** anonymous gets a refusal | `npm run test:policies` |
| **SC-816** nothing else broke | The four gates, then `npm run test:e2e` |

## 5. What only a person can check

Unchanged in spirit from Phase 6, with two additions this phase makes unavoidable. No local harness
produces a real push from Apple or Google, so these stay a hardware pass:

- A **real push to a real iPhone** with every tab closed and the phone locked, after installing
  `/family` to the Home Screen. Then the same on Android.
- The **chime** at the volume a kitchen actually is, from across the room.
- A **notification tapped from the lock screen** landing on the right day.
- The **two-device realtime check** on the live site, still outstanding since Phase 5.
- The wall tablet **left overnight** and looked at in the morning: no pile of banners.

## 6. When something does not arrive

| Symptom | Likely cause |
|---|---|
| The banner never appears | The page has no data for that period yet, or this device's banner switch is off. The banner reads the client's own cache — check the event is visible on screen first |
| The banner appears twice on one device | Two tabs. Each is its own device for dismissal purposes, by design |
| Nothing is sent, ever, on the hosted project | Check `cron.job_run_details` first. A `pg_net` call that never fired looks identical to a scan that found nothing |
| Every scan returns 401 | The database setting and the Vercel variable have drifted. Set both again; they are two copies of one secret |
| The switch does nothing on an iPhone | `/family` is not installed to the Home Screen (R820). The control should say so — if it does not, that is a defect |
| A device stopped receiving with no action | Its subscription expired and was pruned on a `410`. Turn the switch on again |
| A push arrives saying only "you have a reminder" | The worker's fetch failed — an expired session or no connectivity. Correct behaviour (R814), but check the session if it repeats |
| Reminders arrive an hour out | The household's timezone, not the device's, is what everything is judged in. Check Settings, then check the server's view of it |

## 7. Where this fits

The four gates run before every commit. `npm run test:e2e` is the phase gate and gains this phase's
journeys. The hosted `db push` precedes the merge; the scheduler steps follow the deploy and are safe
to do afterwards, because until they run nothing is sent — a quiet failure rather than a broken app.
