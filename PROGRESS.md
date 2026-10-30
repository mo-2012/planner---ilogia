# iLogia Planner — PROGRESS

## Status: MVP complete (local mode), awaiting Supabase schema approval

### Done
- [x] Project scaffold (plain HTML/CSS/JS — matches iLogia ecosystem, GitHub Pages friendly, no build step)
- [x] Design system: reuses `ilogia-ds.css` (Academic Prestige v3) from the main iLogia site + planner-specific stylesheet
- [x] App shell: professional sidebar, sticky top bar, hash router, RTL Arabic default + English toggle, dark theme
- [x] Dashboard: today's plan, pending tasks, study time, goals rate, nearest exams, mini calendar
- [x] Weekly Timetable: interactive 30-min grid, click-to-add, edit/delete, subject colors, overlap/conflict warnings, study-day awareness
- [x] Tasks: full CRUD, subject link, due date, priority, status cycle, search + filters, overdue flags
- [x] Study Planner: plans with subjects/hours + progress; **rule-based smart distribution** (priority × deadline urgency, 90-min blocks, daily capacity, respects study days) with manual accept/remove per suggestion, overdue re-plan prompt
- [x] Study Timer: Pomodoro (customizable), **timestamp-based timing** (accurate in background tabs / after reload), pause/resume, per-session logging, post-session summary
- [x] Exams: countdown cards, month calendar with markers, plan linking
- [x] Goals: daily/weekly, hours/lessons metrics, live progress rings, completed-goals history, auto-close
- [x] Statistics: total hours, top subjects (donut), weekly bars, 8-week trend line, schedule adherence
- [x] Settings: study days, day window, pomodoro, browser notifications (real permission flow), theme, language, subjects & lessons management, JSON backup export/import
- [x] Auth: optional sign-in via the **existing iLogia Supabase project** (email + Google) using the shared `supabase-client.js`; lazy import so the app never breaks if the CDN/Supabase is unreachable
- [x] SQL migration prepared for review: `migrations/001_planner_schema.sql` (planner_* tables, RLS owner-only policies)

### Architecture notes
- Data layer (`js/store.js`) is localStorage-based, namespaced per user id when signed in. It is intentionally a single seam: swapping to Supabase = implementing the same interface against the tables in the migration.
- No fake integrations. iLogia Exams/Cards/Library touch-points documented below — none implemented because no public endpoints exist yet.
- No AI claims: smart planning is documented transparent heuristics (`js/smart.js`).

### Integration points (documented, not built — need approval + endpoints)
1. **iLogia Exams** → pull exam dates/results into `planner_exams` (needs read endpoint or shared table).
2. **iLogia Cards** → due-card review sessions inserted into `planner_sessions`.
3. **iLogia Library** → link a session to a `library_items` id (table exists in the main app; add nullable `library_item_id` to `planner_sessions` on approval).
4. **iLogia App** → deep link to `planner.ilogia-eg.com/#/<page>`; hash routes are stable.

### Pending (require owner action — NOT done per work rules)
- [ ] Review & apply `migrations/001_planner_schema.sql` on the Supabase project
- [ ] Flip store adapter from localStorage → Supabase after migration
- [ ] Push to `mo-2012/planner---ilogia` and enable GitHub Pages + CNAME `planner.ilogia-eg.com`
- [ ] DNS record for the subdomain (owner-side)

### Tests performed
- Browser smoke test: all 9 routes render without console errors; add/edit/delete flows for tasks, sessions, exams, goals; timer start/pause/finish logs minutes; conflict detection flags overlaps. (Chromium headless — see session log.)
