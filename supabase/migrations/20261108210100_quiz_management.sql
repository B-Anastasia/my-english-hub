-- Quiz authoring, answer privacy, and learner submissions.
alter table public.quizzes
add column if not exists topic text not null default 'General';


alter table public.quizzes
drop constraint if exists quizzes_level_check;


alter table public.quizzes
add constraint quizzes_level_check check (level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')) not valid;


alter table public.quizzes validate constraint quizzes_level_check;


create table if not exists public.question_answer_keys (
  question_id uuid primary key references public.questions (id) on delete cascade,
  correct_answer text,
  explanation_ru text,
  sample_answer text
);


insert into
  public.question_answer_keys (
    question_id,
    correct_answer,
    explanation_ru,
    sample_answer
  )
select
  id,
  correct_answer,
  explanation_ru,
  sample_answer
from
  public.questions
on conflict (question_id) do update
set
  correct_answer = excluded.correct_answer,
  explanation_ru = excluded.explanation_ru,
  sample_answer = excluded.sample_answer;


alter table public.questions
drop column if exists correct_answer;


alter table public.questions
drop column if exists explanation_ru;


alter table public.questions
drop column if exists sample_answer;


alter table public.question_answer_keys enable row level security;


drop policy if exists "answer keys owner manage" on public.question_answer_keys;


create policy "answer keys owner manage" on public.question_answer_keys for all using (
  exists (
    select
      1
    from
      public.questions q
      join public.quizzes z on z.id = q.quiz_id
    where
      q.id = question_id
      and z.owner_id = auth.uid ()
  )
)
with
  check (
    exists (
      select
        1
      from
        public.questions q
        join public.quizzes z on z.id = q.quiz_id
      where
        q.id = question_id
        and z.owner_id = auth.uid ()
    )
  );


revoke all on public.question_answer_keys
from
  anon,
  authenticated;


grant
select
,
  insert,
update,
delete on public.question_answer_keys to authenticated;


-- Attempts can be read by their owner but can only be written through the validated RPC.
drop policy if exists "attempts own only" on public.attempts;


drop policy if exists "attempts read own" on public.attempts;


create policy "attempts read own" on public.attempts for
select
  using (auth.uid () = user_id);


revoke insert,
update,
delete on public.attempts
from
  anon,
  authenticated;


grant
select
  on public.attempts to authenticated;


drop policy if exists "answers own attempt" on public.user_answers;


create policy "answers read own attempt" on public.user_answers for
select
  using (
    exists (
      select
        1
      from
        public.attempts a
      where
        a.id = attempt_id
        and a.user_id = auth.uid ()
    )
  );


revoke insert,
update,
delete on public.user_answers
from
  anon,
  authenticated;


grant
select
  on public.user_answers to authenticated;


create or replace function public.save_quiz (
  p_quiz_id uuid,
  p_title text,
  p_description text,
  p_level text,
  p_topic text,
  p_is_public boolean,
  p_questions jsonb
) returns uuid language plpgsql security definer
set
  search_path = public,
  pg_temp as $$
declare
  v_user_id uuid := auth.uid();
  v_quiz_id uuid;
  v_question jsonb;
  v_question_id uuid;
  v_position integer := 0;
  v_options jsonb;
  v_answer text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if length(trim(coalesce(p_title,''))) = 0 then raise exception 'Quiz title is required'; end if;
  if p_level not in ('A1','A2','B1','B2','C1','C2') then raise exception 'Invalid CEFR level'; end if;
  if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) = 0 then raise exception 'Add at least one question'; end if;

  if p_quiz_id is null then
    insert into public.quizzes(owner_id,title,description,level,topic,is_public)
    values(v_user_id,trim(p_title),nullif(trim(coalesce(p_description,'')),''),p_level,coalesce(nullif(trim(p_topic),''),'General'),coalesce(p_is_public,false))
    returning id into v_quiz_id;
  else
    update public.quizzes set title=trim(p_title), description=nullif(trim(coalesce(p_description,'')),''),
      level=p_level, topic=coalesce(nullif(trim(p_topic),''),'General'), is_public=coalesce(p_is_public,false)
    where id=p_quiz_id and owner_id=v_user_id returning id into v_quiz_id;
    if v_quiz_id is null then raise exception 'Quiz not found or access denied'; end if;
    delete from public.questions where quiz_id=v_quiz_id;
  end if;

  for v_question in select value from jsonb_array_elements(p_questions)
  loop
    if length(trim(coalesce(v_question->>'prompt',''))) = 0 then raise exception 'Every question needs a prompt'; end if;
    if coalesce(v_question->>'question_type','') not in ('fill','multiple_choice','open') then raise exception 'Invalid question type'; end if;
    v_options := coalesce(v_question->'options','[]'::jsonb);
    v_answer := nullif(trim(coalesce(v_question->>'correct_answer','')),'');
    if v_question->>'question_type' <> 'open' and v_answer is null then raise exception 'Add a correct answer for each auto-graded question'; end if;
    if v_question->>'question_type' = 'multiple_choice' and (jsonb_typeof(v_options) <> 'array' or jsonb_array_length(v_options) < 2 or not (v_options @> jsonb_build_array(v_answer))) then
      raise exception 'Multiple choice questions need at least two options and the correct answer among them';
    end if;
    insert into public.questions(quiz_id,position,question_type,prompt,hint_ru,options)
    values(v_quiz_id,v_position,v_question->>'question_type',trim(v_question->>'prompt'),nullif(trim(coalesce(v_question->>'hint_ru','')),''),v_options)
    returning id into v_question_id;
    insert into public.question_answer_keys(question_id,correct_answer,explanation_ru,sample_answer)
    values(v_question_id,v_answer,nullif(trim(coalesce(v_question->>'explanation_ru','')),''),nullif(trim(coalesce(v_question->>'sample_answer','')),''));
    v_position := v_position + 1;
  end loop;
  return v_quiz_id;
end;
$$;


create or replace function public.submit_quiz_attempt (p_quiz_id uuid, p_answers jsonb) returns jsonb language plpgsql security definer
set
  search_path = public,
  pg_temp as $$
declare
  v_user_id uuid := auth.uid();
  v_question record;
  v_answer jsonb;
  v_answer_text text;
  v_correct boolean;
  v_total integer := 0;
  v_right integer := 0;
  v_attempt_id uuid;
  v_results jsonb := '[]'::jsonb;
  v_score numeric;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_answers) <> 'array' then raise exception 'Answers must be a JSON array'; end if;
  if not exists(select 1 from public.quizzes z where z.id=p_quiz_id and (z.is_public or z.owner_id=v_user_id)) then raise exception 'Quiz not found or access denied'; end if;
  if (select count(*) from public.questions q where q.quiz_id=p_quiz_id) = 0 then raise exception 'This quiz has no questions'; end if;

  insert into public.attempts(user_id,quiz_id,score,answers) values(v_user_id,p_quiz_id,null,p_answers) returning id into v_attempt_id;
  for v_question in
    select q.id,q.question_type,k.correct_answer,k.explanation_ru,k.sample_answer
    from public.questions q left join public.question_answer_keys k on k.question_id=q.id
    where q.quiz_id=p_quiz_id order by q.position
  loop
    select value into v_answer from jsonb_array_elements(p_answers)
      where value->>'question_id'=v_question.id::text limit 1;
    if v_answer is null then raise exception 'Submit an answer for every question'; end if;
    v_answer_text := coalesce(v_answer->>'answer','');
    if v_question.question_type='open' then
      v_correct := null;
    else
      v_correct := lower(trim(v_answer_text))=lower(trim(coalesce(v_question.correct_answer,'')));
      v_total := v_total + 1;
      if v_correct then v_right := v_right + 1; end if;
    end if;
    insert into public.user_answers(attempt_id,question_id,answer,is_correct)
    values(v_attempt_id,v_question.id,to_jsonb(v_answer_text),v_correct);
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'question_id',v_question.id,'is_correct',v_correct,'correct_answer',v_question.correct_answer,
      'explanation_ru',v_question.explanation_ru,'sample_answer',v_question.sample_answer
    ));
  end loop;
  if v_total > 0 then
    v_score := round((v_right::numeric/v_total)*100,1);
    update public.attempts set score=v_score where id=v_attempt_id;
  end if;
  return jsonb_build_object('attempt_id',v_attempt_id,'score',v_score,'results',v_results);
end;
$$;


revoke all on function public.save_quiz (uuid, text, text, text, text, boolean, jsonb)
from
  public,
  anon;


revoke all on function public.submit_quiz_attempt (uuid, jsonb)
from
  public,
  anon;


grant
execute on function public.save_quiz (uuid, text, text, text, text, boolean, jsonb) to authenticated;


grant
execute on function public.submit_quiz_attempt (uuid, jsonb) to authenticated;
