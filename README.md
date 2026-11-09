# My English Hub

A responsive English learning MVP built with Next.js, TypeScript, and Supabase. The current app includes Supabase sign-in, a personal dashboard, course and vocabulary forms, and an interactive sample quiz.

## Local setup

1. Create a Supabase project.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL Editor.
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

## Current scope

This is an incremental MVP, not the complete multi-user platform. Course modules, lessons, vocabulary collections, lesson progress, and answer records are represented in the database; management screens, bulk JSON import/export, public sharing, and role-aware creator tools are future work. The sample quiz still uses demo content and is not yet backed by the quiz tables.
