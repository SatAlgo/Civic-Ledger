# Civic Ledger — Demo Data & Presentation Script

Everything you need to run a 10-minute presentation of the platform.
Twelve issues across six Pune neighborhoods, ten users across three roles,
five departments — chosen so the routing engine, status flow, notifications,
and analytics hotspots all have something meaningful to show.

> **Loading this data:** Run `npm run seed:demo` from the backend folder. It's
> idempotent — safe to run multiple times; existing records are upserted by
> email or code. See the end of this doc for the seed script source.

---

## 1. User accounts

All passwords are intentionally simple for demo purposes. **Rotate them before
any real deployment.**

### Super-admin

| Name | Email | Password | Role |
|---|---|---|---|
| Priya Deshmukh | `priya@civic.demo` | `demo1234` | super_admin |

### Department admins

| Name | Email | Password | Department |
|---|---|---|---|
| Rajesh Kulkarni | `rajesh@pwd.demo` | `demo1234` | Public Works (PWD) |
| Anita Joshi | `anita@water.demo` | `demo1234` | Water Supply (PMC-W) |
| Vikram Patil | `vikram@elec.demo` | `demo1234` | Electrical (ELEC) |
| Sneha Gokhale | `sneha@sani.demo` | `demo1234` | Sanitation (SAN) |
| Aditya Bhonsle | `aditya@drain.demo` | `demo1234` | Drainage (DRN) |

### Citizens

| Name | Email | Password | Phone |
|---|---|---|---|
| Arjun Sharma | `arjun@demo.com` | `demo1234` | +91 98765 43210 |
| Meera Iyer | `meera@demo.com` | `demo1234` | +91 98234 56789 |
| Karthik Rao | `karthik@demo.com` | `demo1234` | +91 99876 54321 |
| Pooja Naik | `pooja@demo.com` | `demo1234` | +91 97123 45678 |

---

## 2. Departments

All five are pre-approved by the seed (status: `approved`). Categories listed
are what the routing engine will match against.

| Code | Name | Categories handled | Description |
|---|---|---|---|
| PWD | Public Works Department | `pothole`, `other` | Road repair, footpaths, public infrastructure |
| PMC-W | Water Supply Division | `water` | Pipeline leaks, supply disruption |
| ELEC | Electrical Maintenance | `streetlight`, `electrical` | Street lighting, exposed wires, transformers |
| SAN | Sanitation Department | `garbage` | Waste collection, bin overflow, dumping |
| DRN | Drainage & Sewage | `drainage` | Storm drains, sewage backflow, manhole issues |

Note that `pothole` and `other` both route to PWD — the routing engine picks
the first approved department whose `categories` includes the issue's category.

---

## 3. Demo issues

Twelve issues, geographically clustered to produce meaningful analytics
hotspots. Coordinates are real Pune locations.

### Kothrud — Water Supply cluster (Anita's queue)

| # | Title | Reporter | Status | Lat, Lng | Photos |
|---|---|---|---|---|---|
| 1 | Major water leak near Mhatre Bridge | Arjun | `in_progress` | 18.5018, 73.8087 | 2 |
| 2 | No water supply since morning, Karve Road | Meera | `assigned` | 18.5021, 73.8125 | 1 |
| 3 | Pipeline burst on Paud Road | Karthik | `reported` | 18.4974, 73.8068 | 0 |

### FC Road / Deccan — Public Works cluster (Rajesh's queue)

| # | Title | Reporter | Status | Lat, Lng | Photos |
|---|---|---|---|---|---|
| 4 | Large pothole near Goodluck Cafe | Pooja | `resolved` | 18.5189, 73.8418 | 2 |
| 5 | Broken road tiles, Deccan Gymkhana | Arjun | `in_progress` | 18.5151, 73.8438 | 1 |
| 6 | Pothole causing traffic, FC Road junction | Meera | `assigned` | 18.5202, 73.8410 | 1 |

### Hadapsar — Sanitation cluster (Sneha's queue)

| # | Title | Reporter | Status | Lat, Lng | Photos |
|---|---|---|---|---|---|
| 7 | Overflowing bin near Magarpatta gate | Karthik | `assigned` | 18.5089, 73.9260 | 2 |
| 8 | Garbage dumped in empty plot, Amanora | Pooja | `reported` | 18.5145, 73.9395 | 1 |

### Aundh — Electrical cluster (Vikram's queue)

| # | Title | Reporter | Status | Lat, Lng | Photos |
|---|---|---|---|---|---|
| 9 | Streetlight out for a week, ITI Road | Arjun | `in_progress` | 18.5610, 73.8073 | 0 |
| 10 | Exposed wires hanging dangerously low | Meera | `assigned` | 18.5598, 73.8112 | 2 |

### Camp — Drainage (Aditya's queue)

| # | Title | Reporter | Status | Lat, Lng | Photos |
|---|---|---|---|---|---|
| 11 | Sewage backflow on East Street | Karthik | `assigned` | 18.5158, 73.8794 | 1 |

### Reroute queue — for super-admin to manually assign

| # | Title | Reporter | Status | Lat, Lng | Notes |
|---|---|---|---|---|---|
| 12 | Stray dog problem near school, Kondhwa | Pooja | `needs_reroute` | 18.4646, 73.8966 | Originally flagged by Sanitation as "not our issue" |

This issue's `category` is `other` — the seed deliberately sends it back to
the reroute queue so you can demonstrate the manual-assign flow.

---

## 4. What the data shows on the Analytics map

When you log in as super-admin and open `/analytics`:

- **Six color-coded clusters** visible across Pune
- The **Hotspots** sidebar surfaces, in order:
  1. Kothrud water cluster (3 reports)
  2. FC Road potholes (3 reports)
  3. Hadapsar garbage (2 reports)
  4. Aundh electrical (2 reports)
- **By department** breakdown shows PWD and Water tied at the top
- **By status** shows a healthy mix — 1 resolved, 4 in_progress, 5 assigned,
  1 reported, 1 needs_reroute

When you log in as a department admin (say Anita @ Water), `/analytics`
shows **only the three Kothrud water issues** — no other clusters appear.
That's the data-isolation guarantee in action.

---

## 5. Suggested demo script

**Total time: ~10 minutes**

### Act 1 — The citizen story (3 min)

1. Open in private window, click **"Report an issue"** → sign in as `arjun@demo.com`
2. Click **"Report"** in the navbar
3. Pick category **Pothole** → title "Pothole on JM Road" → describe → grab
   geolocation → upload one photo from your laptop → submit
4. Watch the success toast. Navigate to `/citizen` — your new report appears
   at the top with status `assigned` (the routing engine fired)
5. Click into the report — show the timeline (`reported` → `assigned`)

> **Talking point:** "Notice the citizen never picked a department. The system
> read the category, found that PWD handles potholes, and routed it
> automatically."

### Act 2 — The department story (3 min)

6. Open a second private window → sign in as `rajesh@pwd.demo`
7. The new pothole report is at the top of the queue. Notice the navbar
   notification badge (Socket.IO fired in real time)
8. Click into it → in the action panel, click **"In Progress"** with the note
   "Crew dispatched, ETA 2 hours"
9. Switch back to the citizen window — the status badge has updated live,
   and there's a new notification

> **Talking point:** "Real-time updates over Socket.IO. The citizen didn't
> refresh. The status changed because the department changed it."

### Act 3 — The analytics story (3 min)

10. Open a third window → sign in as `priya@civic.demo` (super-admin)
11. Click **Analytics** in the navbar
12. Point out the six colored clusters across the map
13. Look at the **Hotspots** sidebar — read out the top 3: Kothrud water,
    FC Road potholes, Hadapsar garbage
14. Use the **department filter** to isolate Water Supply — only the Kothrud
    cluster remains. Switch to Public Works — only the FC Road cluster.
15. Switch the time window to **Last 7 days** to show the same data through
    a different lens

> **Talking point:** "This is what the city looks like from the command
> center. Anita at Water Supply doesn't see this view — she sees only her
> three Kothrud issues. That data isolation is enforced at the API layer."

### Act 4 — The reroute story (1 min)

16. Still as super-admin, go to **Admin → Reroute queue**
17. Show the stray-dog issue sitting there
18. Pick **Sanitation** from the assign dropdown
19. Switch to the Sneha (Sanitation) window — the issue has appeared in her
    queue

> **Talking point:** "When the auto-router doesn't know where to send
> something, or a department flags 'this isn't ours', it bounces to the
> super-admin instead of vanishing into a black hole."

---

## 6. Profile pages — bonus demo

If you have time, log in as any citizen and visit `/profile` to show:

- The account info form (name, phone — editable; email read-only)
- The password change form with live validation
- The contributions stats tiles (total, open, resolved, in progress)

---

## 7. Resetting between demos

```bash
# In the backend folder
npm run seed:demo
```

The script upserts by email/code. Existing demo records are updated in place;
your seed-time super-admin is untouched. **Issues and notifications are not
deleted** unless you pass `--reset`:

```bash
npm run seed:demo -- --reset
```

This will delete every Issue and Notification in the database before
re-seeding. Use only on the demo cluster.

---

## 8. Seed script source

The script is shipped at `backend/src/scripts/seedDemo.ts`. It assumes a
running MongoDB connection (uses the same `MONGODB_URI` as the rest of the
backend) and Cloudinary is configured if you want photos (otherwise photos
are skipped silently).

Run with:

```bash
cd backend
npm run seed:demo
# or, to also wipe existing issues/notifications first:
npm run seed:demo -- --reset
```

---

## 9. Quick reference card

Print this and keep it next to your laptop during the demo:

```
SUPER-ADMIN     priya@civic.demo       / demo1234   → /admin, /analytics
PWD ADMIN       rajesh@pwd.demo        / demo1234   → /dept (potholes)
WATER ADMIN     anita@water.demo       / demo1234   → /dept (Kothrud cluster)
ELECTRICAL      vikram@elec.demo       / demo1234   → /dept (Aundh cluster)
SANITATION      sneha@sani.demo        / demo1234   → /dept (Hadapsar cluster)
DRAINAGE        aditya@drain.demo      / demo1234   → /dept (Camp)
CITIZEN 1       arjun@demo.com         / demo1234   → /citizen
CITIZEN 2       meera@demo.com         / demo1234   → /citizen
CITIZEN 3       karthik@demo.com       / demo1234   → /citizen
CITIZEN 4       pooja@demo.com         / demo1234   → /citizen
```

That's the whole deck. Good luck.
