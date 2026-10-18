# soberSem3 ♠

A responsive poker tracker with a Graduation-inspired purple, pink, orange, and sky-blue palette, original cosmic SVG illustrations, player profiles, session records, and winnings.

## Share with friends

See [DEPLOYMENT.md](DEPLOYMENT.md) for GitHub Pages and Supabase setup. Hosted mode requires sign-in and approved membership; players, photos, sessions, and videos are shared across phones. The Pages workflow deploys on pushes to `main` after you enable it and add the public Supabase configuration.

## Run locally

Requires Node.js 20.19+ (Node.js 24 is verified) and npm.

```sh
npm ci
npm run dev
```

The development server listens on port 5173 and all interfaces. For a production build:

```sh
npm run build
npm run preview
```

Deploy the `dist` directory to any static hosting service. Navigation uses URL hashes and needs no server-side route rewrites.

## What’s included

- Overview with net-winnings leaderboard, game statistics, cumulative winnings chart, and recent nights.
- Two player cards per row on desktop, with rounded cartoon typography, outlined photo panels, bold total winnings, an editable tagline, worst enemy, recent profits, and total sessions. Mobile uses one readable card per row.
- A dedicated leaderboard with a top-three podium and a complete ranking list, sortable by net winnings, sessions played, or average net winnings per session.
- Full-width game-night cards with dates, players, pots, winners, individual buy-ins/cash-outs, optional table notes, balance warnings, editing, and confirmed deletion.
- Session video highlights: upload recorded rounds from **Edit session**, watch clips in the session detail or expandable row, and download originals. New-session logging stays focused on the game results.
- Date filters for month, year, last 30 calendar days, all time, and exact session date.
- Player and session search, player sorting, and game-night sorting.
- Hall of fame with five lighthearted awards calculated from real records.
- Currency display in INR, USD, EUR, or GBP. Changing currency does not convert amounts.
- JSON backup export and restore, plus confirmed clearing of demo data.
- Responsive mobile navigation, keyboard-accessible dialogs, and reduced-motion support.

Six demo players and eight balanced sample games are included. Dates are relative to the first visit. Use **Settings → Clear demo data** to start your own table. Clearing removes all current players and games, including any you added; export a backup first if needed.

## Storage and privacy

In local mode (without Supabase configuration), records and resized player photos are stored in this browser’s `localStorage`. Video files are stored separately in IndexedDB. No account, database, external API, or credentials are needed. Records do not automatically sync between browsers or devices. Export backups regularly and before clearing browser data. Restoring a backup replaces current records. JSON backups include player traits and session results, but **do not include videos**. Download videos individually from the highlight reel. Restoring a backup keeps existing clips only for matching session IDs; clips for sessions removed by the restore are discarded.

Player photos are cropped to a 240 × 240 square and compressed before saving. JPG, PNG, WebP, and GIF uploads up to 8 MB are supported; animated images become a still image. Bundled fonts and sample avatars work without third-party requests. Sample-avatar attribution is in `public/players/README.md`.

### Player statistics

Card ranks, total winnings, total sessions, and average winnings use lifetime results. **Recent profits** shows net profit from the latest session that player attended, with its date. It is independent of the date filters on other pages. Players without sessions show a dash, rather than a fabricated result. For multiple games on the same date, the later-added session is considered the most recent. Total winnings means net profit (cash-outs minus buy-ins), including losses. The leaderboard applies its own selected metric and date range; searching does not change a player’s rank. Players without sessions appear as unranked and cannot take a podium seat. **Worst enemy** is optional and editable through **Edit**. Existing Weaknesses values are used as a fallback for old records; existing Strengths data is preserved in storage and backups but is no longer shown in the interface.

### Video highlights

Open a saved game night and choose **Edit session**, or click **Add highlights** on its session row. Select or drop video files, then **Save changes**. Uploads and removals are staged until save; Cancel leaves existing clips unchanged. Removing a saved clip has a confirmation and an Undo option before saving. Deleting a session also deletes its stored clips. Clearing all records also clears videos.

Files may be up to 100 MB each. MP4, WebM, MOV, M4V, and Ogg extensions are accepted; MP4 and WebM are recommended because playback depends on browser codec support. The original file can be downloaded even if the browser cannot play its codec. Browser storage capacity varies; storage failures leave existing videos unchanged. Local-mode videos do not sync across devices. In shared mode they use private Supabase storage and are limited to 50 MB each.

This app records game results; it does not process bets, payments, or currency conversions.

## Verification

```sh
npm test
npm run test:database
npm run test:e2e
npm run test:shared
npm run build
```

The ten Node tests cover financial totals, partial attendance, cumulative histories, date ranges, recent-session results, averages, ranking metrics, session validation, currency formatting, and video-file validation. Four Playwright browser tests cover two-column cards, legacy profile compatibility, persistent worst-enemy fields, recent profits, podium sorting, the full video upload/playback/download/removal workflow, and mobile layouts/navigation. Browser tests use isolated storage and a synthetic sample clip.

The Playwright configuration reuses an existing development server or starts one. It uses `/usr/bin/chromium` when available. On another machine, run `npx playwright install chromium` once, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to an installed Chromium executable.

## Project layout

- `src/cloud.js`, `src/useTableRecords.js`, and `src/SharedAccess.jsx` — shared storage, conflict checking, polling, and sign-in.
- `supabase/setup.sql` — repeatable database and private-video policies.
- `.github/workflows/pages.yml` — GitHub Pages publishing.
- `src/main.jsx` — application shell, forms, dialogs, and browser record storage.
- `src/ClubPages.jsx` — collectible cards, podium leaderboard, and session archive.
- `src/SessionMedia.jsx` — staged video uploads, playback, and downloads.
- `src/media.js` — transactional IndexedDB storage for video metadata and original files.
- `src/ui.jsx` — shared avatars and date-range selector.
- `src/data.js` — demo records, financial calculations, date filters, and validation.
- `src/styles.css`, `src/club.css`, `src/player-cards.css`, and `src/graduation.css` — responsive layouts, cartoon cards, and the cosmic color theme.
- `public/art/` — original space illustrations, bundled locally and included in the standalone HTML export.
- `tests/data.test.js` and `tests/media.test.js` — calculation, ranking, and upload validation tests.
- `tests/browser/club.spec.js` — desktop/mobile browser regression tests.
