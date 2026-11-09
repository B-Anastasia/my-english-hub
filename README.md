# My English Hub

A responsive English learning MVP built with Next.js, TypeScript, and Supabase. The current app includes Supabase sign-in, a personal dashboard, course and vocabulary forms, and a database-backed quiz library with authoring and saved attempts.

## Local setup

1. Create a Supabase project.
2. Install the Supabase CLI (`brew install supabase/tap/supabase@2` on macOS) and initialize the local project. The CLI is already initialized in this repository.
3. For a new database, run the migrations with the CLI as described below. `supabase/schema.sql` is retained as a legacy baseline reference; don't run it in addition to the baseline migration.
4. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from the Supabase project API settings.
5. Install dependencies and start the app:

   ```sh
   npm install
   npm run dev
   ```

6. Open `http://localhost:3000` and create an account.

## Code formatting

Run `npm run format` to format the app and SQL files, or `npm run format:check` to check them. The shared rules live in `.prettierrc.json`, `.sql-formatter.json`, and `.editorconfig`.

## Database migrations

The Supabase CLI records applied migration versions remotely, so each migration is applied once. Authenticate and link this checkout to the project:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

The project ref is the subdomain in `NEXT_PUBLIC_SUPABASE_URL`. The CLI asks for the database password; enter it in the terminal and don't put it in `.env.local` or commit it.

This project already has its initial schema installed manually. On the first CLI setup for that existing database, record the baseline migration as already applied, then preview and apply the pending quiz migration:

```sh
supabase migration repair --status applied 20261108210000
npm run db:dry-run
npm run db:push
```

Only do the baseline repair once, and only when the initial schema from this repository is already present in the linked database. For a brand-new empty project, skip `migration repair`; `db:push` applies the baseline and later migrations. Don't use `supabase db reset` on the linked production project.

For future changes, create a migration with `npm run db:new -- descriptive_name`, put the SQL change in that new file, inspect the pending migration with `npm run db:dry-run`, and apply it with `npm run db:push`. `npm run db:status` shows which versions have been applied. For local development, `npm run db:start` and `npm run db:reset` use the local Supabase stack; `db:reset` requires Docker and rebuilds only the local database.

The schema includes row-level security policies. Keep the Supabase service role key out of the browser and out of all `NEXT_PUBLIC_*` variables. Roles are managed by a trusted administrator; authenticated users can update their display name but cannot change their own role.

## Deploying to Vercel

Import this repository in Vercel, add the two public Supabase environment variables in the project settings, then deploy. Configure the production URL in Supabase Auth's allowed redirect URLs. Enable email confirmation and configure the email provider before opening account creation to other users.

## Quiz management

The quiz catalog reads public quizzes and the signed-in user's own quizzes from Supabase. Signed-in users can create and edit quizzes with fill-in, multiple-choice, and open-answer questions, a CEFR level, and a topic. Attempts and individual responses are saved through a database function.

Question prompts and options are readable for public quizzes, while correct answers and explanations live in a separate owner-protected table. The submission function checks answers and records scores. Do not expose the Supabase service role key in the browser.

## Current scope

This is an incremental MVP, not the complete multi-user platform. Course modules, lessons, vocabulary collections, lesson progress, public quiz sharing workflows, bulk JSON import/export, and role-aware creator tools remain future work.
