# FreeStudentKit

Free tools for Nigerian university students: CGPA (4.0 and 5.0 scales), PDF tools, CV builder,
SIWES logbook, citations, CBT practice, project topics, verified scholarships and a student-shared Library.
Static site built with Astro and Tailwind. No paid services.

## Run and build

```bash
npm install
npm run dev       # local development
npm test          # unit tests (vitest)
npx tsc --noEmit -p .
npm run build     # outputs dist/
```

Deploys on Netlify (`netlify.toml`): build command `npm run build`, publish directory `dist`.

## The Library (Supabase)

The Library lets students share past questions, notes and project materials. Every submission
starts as **pending** and is invisible to the public until you approve it.

Settings live in `src/data/config.ts` (project URL, publishable key, bucket name).
The publishable key is meant to be public; what it can do is limited by row-level security.

### Moderating

Open the Supabase dashboard, project **freestudentkit-library**.

1. **Table Editor → resources**: filter `status = pending`.
2. Check the title and open the link (or the file, see below). Check it is not copyrighted
   material the student has no right to share, and that nothing is unsafe or misleading.
3. Approve: change `status` to `approved`. Or in the SQL editor:
   ```sql
   update public.resources set status = 'approved' where id = '<id>';
   ```
4. Reject: delete the row (and its file, see below).

**Uploaded files**: Storage → `library-files` → `incoming/`. The row's `file_path` column
gives the exact file name. Files are public by URL, but a stranger can only guess a random UUID,
and the site only shows files of approved rows. Delete the file when you reject a row.

**Reports**: Table Editor → `reports`. Each has a reason and the resource id. To take something
down, set the resource's `status` to `rejected` (or delete it).

### Built-in limits

- Anyone can add at most 300 pending rows in total and 150 unapproved files; after that
  new submissions are refused until you approve or clear some. Reports are capped at 500.
- Files: PDF, JPG, PNG or WebP, up to 4 MB. Links must be `https://`.
- The form has a honeypot field, a one-minute wait and five submissions a day per device.

### Free plan notes

- A free Supabase project pauses after about a week without activity. Open the dashboard and
  click Restore, or visit `/library/` now and then. The rest of the site does not depend on it.
- Free accounts allow two active projects.

## Offline use

`public/sw.js` is the service worker. Pages visited once are kept, and the page `/offline/` lets a student
save every tool in one go (stored in the `fsk-offline-v1` cache, which survives updates). On a slow
connection (over 4 seconds) a saved page is shown instead of waiting. When you change `sw.js`,
bump `VERSION`. The Library always needs the internet.

## Study tools

Flashcards (Leitner boxes, 3/7/14/30 day gaps) and the revision timetable are client-side only.
Their data stays in the student's browser. No AI service is used, so there is no running cost.

## Content notes

- CBT sample questions in `src/data/cbt.json` are original practice questions, not real past questions.
- Scholarship data is in `src/data/scholarships.json`. Check each link before the application season.
- Departments are listed in `src/data/departments.ts`; project topics per department in `src/data/topics.json`.
