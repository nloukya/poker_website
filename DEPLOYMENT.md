# Put soberSem3 online for your friends

The source is in [nloukya/poker_website](https://github.com/nloukya/poker_website).
GitHub Pages hosts the website; your Supabase project stores the shared table, photos, and private videos. Every approved friend sees the same records. Updates refresh within 15 seconds or when returning to the tab. Everyone on the membership list can edit the table.

## 1. Create the shared table

1. Create a project at [Supabase](https://supabase.com/dashboard). Keep the database password private; the website does not need it.
2. Open **SQL Editor**, paste [supabase/setup.sql](supabase/setup.sql), and run it. This creates an empty table, membership rules, and a private video bucket. You can run it again without deleting existing records.
3. Open **Authentication → Providers → Email** and disable public sign-ups. Use **Authentication → Users → Add user → Create new user** to create an email/password account for yourself and each friend. Enable **Auto Confirm User** for these manually created accounts. Give each friend their own password privately.
4. In **SQL Editor**, add those email addresses to the membership list:

   ```sql
   insert into public.club_members(email) values
     ('your-email@example.com'),
     ('friend@example.com')
   on conflict do nothing;
   ```

   Replace the examples and use lowercase addresses. Accounts that are not on this list cannot read or edit the shared records or videos. To revoke access:

   ```sql
   delete from public.club_members where email = 'friend@example.com';
   ```

5. From the project's **Connect** dialog or **Project Settings → API Keys**, copy the **Project URL** and **publishable key**. A legacy **anon** key also works. **Never use a secret key, `service_role` key, or database password in the website or GitHub variables.**

## 2. Connect GitHub Pages

1. Open [repository variables](https://github.com/nloukya/poker_website/settings/variables/actions). Add these two repository variables:

   | Name | Value |
   | --- | --- |
   | `VITE_SUPABASE_URL` | The project's `https://…supabase.co` URL |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | The project's publishable or legacy anon key |

   These are public browser configuration, not admin credentials. Database and storage access is enforced by the SQL membership policies.
2. Open [Pages settings](https://github.com/nloukya/poker_website/settings/pages). Under **Build and deployment → Source**, select **GitHub Actions**. If the repository is private and your GitHub plan does not offer Pages, choose a hosting plan that supports private source or make the source repository public yourself. The shared database remains restricted to approved accounts.
3. Open [Actions](https://github.com/nloukya/poker_website/actions/workflows/pages.yml), choose **Publish soberSem3 → Run workflow → main → Run workflow**. New pushes to `main` deploy automatically afterward. The action runs calculation and database-policy tests, builds the site, and publishes it.
4. After the action succeeds, open:

   **https://nloukya.github.io/poker_website/**

   This is the expected address; it is only live after GitHub confirms deployment. The exact published link is shown in the workflow's `github-pages` environment. Without the Supabase variables, the published site displays a setup message and does not create separate phone records. Add the variables and rerun the workflow to connect it.
5. Send the link to your friends. They can sign in on iPhone or Android using their own account. They can add it to their home screen from their browser's share/menu options. Internet access is required for shared records.

## Bring over existing records

The downloaded HTML version keeps records on your original device. In that version, use **Settings → Export backup**. Sign in on the website and use **Settings → Restore backup** once to put those players, photos, and sessions in the shared table. Restore replaces the shared table for everyone, so do it before others start adding records.

Videos are not included in JSON backups. Download them from the old session, then upload them in **Edit session** on the shared website. Shared clips are limited to **50 MB each**, matching the setup's bucket limit. Watch your project's storage, bandwidth, and database quotas; hosting providers may pause free projects or change their limits.

## Development and verification

```sh
npm ci
npm run dev
npm test
npm run test:database
npm run test:e2e
npm run test:shared
npm run build
```

Without environment variables, local development preserves the original browser-only mode. To work against your shared project, copy `.env.example` to `.env.local`, replace the public configuration values, and restart Vite. `.env.local` is ignored by Git.

`test:database` exercises the SQL in an isolated PostgreSQL-compatible PGlite instance with modeled Supabase auth/storage schemas: membership checks, denied writes, stale revisions, atomic saves, private media policies, repeatable setup, and clip pruning. `test:shared` uses a mocked Supabase HTTP API to check two browser contexts, sign-in/sign-out, failed saves, stale edits, and shared video playback. These tests do not provision or validate a hosted Supabase project. After deployment, sign in on two actual devices, save a player or session, and verify the second device refreshes.

Concurrent edits are checked by revision. If another friend saves while your form is open, the save is rejected and your form stays open. Close and reopen it to edit the latest records. Videos upload before the database commit; a rejected save removes the newly staged files where possible. File cleanup failures can leave unused storage objects, but do not replace an existing video.
