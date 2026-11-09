-- Legacy one-time schema source. The canonical CLI baseline is migrations/20261108210000_initial_schema.sql.
-- New or existing projects should follow the Supabase CLI migration steps in README.md.
create extension if not exists pgcrypto;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text,
 role text not null default 'learner' check (role in ('learner','creator','admin')),
 created_at timestamptz not null default now()
);
create table if not exists public.courses (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 title text not null,
 description text,
 level text not null default 'B2',
 is_public boolean not null default false,
 created_at timestamptz not null default now()
);
create table if not exists public.quizzes (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 course_id uuid references public.courses(id) on delete set null,
 title text not null,
 description text,
 level text not null default 'B2',
 is_public boolean not null default false,
 share_slug text unique default encode(gen_random_bytes(8),'hex'),
 created_at timestamptz not null default now()
);
create table if not exists public.questions (
 id uuid primary key default gen_random_uuid(),
 quiz_id uuid not null references public.quizzes(id) on delete cascade,
 position int not null default 0,
 question_type text not null check (question_type in ('fill','multiple_choice','open')),
 prompt text not null,
 hint_ru text,
 correct_answer text,
 options jsonb not null default '[]'::jsonb,
 explanation_ru text,
 sample_answer text
);
create table if not exists public.vocabulary (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 term text not null,
 translation text not null,
 definition text,
 example text,
 level text not null default 'B2',
 created_at timestamptz not null default now()
);
create table if not exists public.enrollments (
 user_id uuid not null references auth.users(id) on delete cascade,
 course_id uuid not null references public.courses(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(user_id,course_id)
);
create table if not exists public.attempts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 quiz_id uuid not null references public.quizzes(id) on delete cascade,
 score numeric,
 answers jsonb not null default '{}'::jsonb,
 completed_at timestamptz not null default now()
);
create table if not exists public.saved_words (
 user_id uuid not null references auth.users(id) on delete cascade,
 vocabulary_id uuid not null references public.vocabulary(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(user_id,vocabulary_id)
);
create table if not exists public.course_modules (
 id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade,
 title text not null, description text, position integer not null default 0, created_at timestamptz not null default now(), unique(course_id,position)
);
create table if not exists public.lessons (
 id uuid primary key default gen_random_uuid(), module_id uuid not null references public.course_modules(id) on delete cascade,
 title text not null, content jsonb not null default '{}'::jsonb, position integer not null default 0,
 created_at timestamptz not null default now(), unique(module_id,position)
);
create table if not exists public.vocabulary_collections (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 title text not null, description text, created_at timestamptz not null default now()
);
create table if not exists public.collection_words (
 collection_id uuid not null references public.vocabulary_collections(id) on delete cascade,
 vocabulary_id uuid not null references public.vocabulary(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(collection_id,vocabulary_id)
);
create table if not exists public.learning_progress (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 lesson_id uuid not null references public.lessons(id) on delete cascade,
 status text not null default 'in_progress' check (status in ('in_progress','completed')),
 completed_at timestamptz, updated_at timestamptz not null default now(), unique(user_id,lesson_id)
);
create table if not exists public.user_answers (
 id uuid primary key default gen_random_uuid(), attempt_id uuid not null references public.attempts(id) on delete cascade,
 question_id uuid not null references public.questions(id) on delete cascade,
 answer jsonb not null default 'null'::jsonb, is_correct boolean,
 created_at timestamptz not null default now(), unique(attempt_id,question_id)
);
create index if not exists courses_owner_idx on public.courses(owner_id);
create index if not exists quizzes_course_idx on public.quizzes(course_id);
create index if not exists questions_quiz_position_idx on public.questions(quiz_id,position);
create index if not exists vocabulary_owner_term_idx on public.vocabulary(owner_id,term);
create index if not exists attempts_user_completed_idx on public.attempts(user_id,completed_at desc);
create index if not exists modules_course_position_idx on public.course_modules(course_id,position);
create index if not exists lessons_module_position_idx on public.lessons(module_id,position);
create index if not exists progress_user_status_idx on public.learning_progress(user_id,status);
-- Create a profile automatically when a user signs up.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'display_name','')); return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
-- Enable row-level security.
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.quizzes enable row level security;
alter table public.questions enable row level security;
alter table public.vocabulary enable row level security;
alter table public.enrollments enable row level security;
alter table public.attempts enable row level security;
alter table public.saved_words enable row level security;
alter table public.course_modules enable row level security;
alter table public.lessons enable row level security;
alter table public.vocabulary_collections enable row level security;
alter table public.collection_words enable row level security;
alter table public.learning_progress enable row level security;
alter table public.user_answers enable row level security;
-- Profiles
create policy "profiles read own" on public.profiles for select using (auth.uid()=id);
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update using (auth.uid()=id) with check (auth.uid()=id);
revoke update on public.profiles from authenticated;
grant update(display_name) on public.profiles to authenticated;
-- Courses: owners manage; everyone can view public courses.
create policy "courses view public or own" on public.courses for select using (is_public or auth.uid()=owner_id);
create policy "courses insert own" on public.courses for insert with check (auth.uid()=owner_id);
create policy "courses update own" on public.courses for update using (auth.uid()=owner_id) with check (auth.uid()=owner_id);
create policy "courses delete own" on public.courses for delete using (auth.uid()=owner_id);
-- Quizzes
create policy "quizzes view public or own" on public.quizzes for select using (is_public or auth.uid()=owner_id);
create policy "quizzes insert own" on public.quizzes for insert with check (auth.uid()=owner_id);
create policy "quizzes update own" on public.quizzes for update using (auth.uid()=owner_id) with check (auth.uid()=owner_id);
create policy "quizzes delete own" on public.quizzes for delete using (auth.uid()=owner_id);
-- Questions visible when quiz is public or owned by current user.
create policy "questions view public or own" on public.questions for select using (exists(select 1 from public.quizzes q where q.id=quiz_id and (q.is_public or q.owner_id=auth.uid())));
create policy "questions insert into own quiz" on public.questions for insert with check (exists(select 1 from public.quizzes q where q.id=quiz_id and q.owner_id=auth.uid()));
create policy "questions update own quiz" on public.questions for update using (exists(select 1 from public.quizzes q where q.id=quiz_id and q.owner_id=auth.uid()));
create policy "questions delete own quiz" on public.questions for delete using (exists(select 1 from public.quizzes q where q.id=quiz_id and q.owner_id=auth.uid()));
-- Personal vocabulary
create policy "vocabulary own only" on public.vocabulary for all using (auth.uid()=owner_id) with check (auth.uid()=owner_id);
create policy "enrollments view own" on public.enrollments for select using (auth.uid()=user_id);
create policy "enrollments insert own" on public.enrollments for insert with check (auth.uid()=user_id);
create policy "attempts own only" on public.attempts for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "saved words own only" on public.saved_words for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "modules view course" on public.course_modules for select using (exists(select 1 from public.courses c where c.id=course_id and (c.is_public or c.owner_id=auth.uid())));
create policy "modules manage own course" on public.course_modules for all using (exists(select 1 from public.courses c where c.id=course_id and c.owner_id=auth.uid())) with check (exists(select 1 from public.courses c where c.id=course_id and c.owner_id=auth.uid()));
create policy "lessons view course" on public.lessons for select using (exists(select 1 from public.course_modules m join public.courses c on c.id=m.course_id where m.id=module_id and (c.is_public or c.owner_id=auth.uid())));
create policy "lessons manage own course" on public.lessons for all using (exists(select 1 from public.course_modules m join public.courses c on c.id=m.course_id where m.id=module_id and c.owner_id=auth.uid())) with check (exists(select 1 from public.course_modules m join public.courses c on c.id=m.course_id where m.id=module_id and c.owner_id=auth.uid()));
create policy "collections own only" on public.vocabulary_collections for all using (auth.uid()=owner_id) with check (auth.uid()=owner_id);
create policy "collection words own collection" on public.collection_words for all using (exists(select 1 from public.vocabulary_collections c where c.id=collection_id and c.owner_id=auth.uid())) with check (exists(select 1 from public.vocabulary_collections c where c.id=collection_id and c.owner_id=auth.uid()));
create policy "progress own only" on public.learning_progress for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "answers own attempt" on public.user_answers for all using (exists(select 1 from public.attempts a where a.id=attempt_id and a.user_id=auth.uid())) with check (exists(select 1 from public.attempts a where a.id=attempt_id and a.user_id=auth.uid()));
