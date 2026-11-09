# My English Hub

A responsive English learning MVP built with Next.js, TypeScript, and Supabase. The current app includes Supabase sign-in, a personal dashboard, course and vocabulary forms, and a database-backed quiz library with authoring and saved attempts.

## Local setup

1. Create a Supabase project.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL Editor, then run every SQL file in `supabase/migrations` in filename order. If the base schema is already installed, run only migrations that have not yet been applied; do not rerun the base schema on a live database.
3. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from the Supabase project API settings.
4. Install dependencies and start the app:

   ```sh
   npm install
   npm run dev
   ```

5. Open `http://localhost:3000` and create an account.

The schema includes row-level security policies. Keep the Supabase service role key out of the browser and out of all `NEXT_PUBLIC_*` variables. Roles are managed by a trusted administrator; authenticated users can update their display name but cannot change their own role.

## Deploying to Vercel

Import this repository in Vercel, add the two public Supabase environment variables in the project settings, then deploy. Configure the production URL in Supabase Auth's allowed redirect URLs. Enable email confirmation and configure the email provider before opening account creation to other users.

## Quiz management

The quiz catalog reads public quizzes and the signed-in user's own quizzes from Supabase. Signed-in users can create and edit quizzes with fill-in, multiple-choice, and open-answer questions, a CEFR level, and a topic. Attempts and individual responses are saved through a database function.

Question prompts and options are readable for public quizzes, while correct answers and explanations live in a separate owner-protected table. The submission function checks answers and records scores. Do not expose the Supabase service role key in the browser.

## Current scope

This is an incremental MVP, not the complete multi-user platform. Course modules, lessons, vocabulary collections, lesson progress, public quiz sharing workflows, bulk JSON import/export, and role-aware creator tools remain future work.
