'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type QuestionType = 'fill' | 'multiple_choice' | 'open';
type DraftQuestion = { id?: string; question_type: QuestionType; prompt: string; hint_ru: string; options: string; correct_answer: string; explanation_ru: string; sample_answer: string };
type SavedQuestion = { id: string; question_type: QuestionType; prompt: string; hint_ru: string | null; options: string[] | null };
type AnswerKey = { question_id: string; correct_answer: string | null; explanation_ru: string | null; sample_answer: string | null };
const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const blankQuestion = (): DraftQuestion => ({ question_type: 'fill', prompt: '', hint_ru: '', options: '', correct_answer: '', explanation_ru: '', sample_answer: '' });

export default function QuizEditor({ quizId }: { quizId?: string }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState('B1');
  const [topic, setTopic] = useState('Vocabulary');
  const [isPublic, setIsPublic] = useState(false);
  const [questions, setQuestions] = useState<DraftQuestion[]>([blankQuestion()]);
  const [loading, setLoading] = useState(Boolean(quizId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!quizId) return;
    const supabase = createClient();
    async function load() {
      const [{ data: quiz, error: quizError }, { data: rows, error: questionsError }] = await Promise.all([
        supabase.from('quizzes').select('title,description,level,topic,is_public').eq('id', quizId).single(),
        supabase.from('questions').select('id,question_type,prompt,hint_ru,options').eq('quiz_id', quizId).order('position'),
      ]);
      if (quizError || questionsError || !quiz) { setError('Could not load this quiz. You may not have permission to edit it.'); setLoading(false); return; }
      setTitle(quiz.title); setDescription(quiz.description || ''); setLevel(quiz.level); setTopic(quiz.topic || 'General'); setIsPublic(quiz.is_public);
      const saved = (rows || []) as SavedQuestion[];
      const { data: keys, error: keyError } = await supabase.from('question_answer_keys').select('question_id,correct_answer,explanation_ru,sample_answer').in('question_id', saved.map(q => q.id));
      if (keyError) { setError('Could not load answer keys. Apply the quiz management migration in Supabase, then try again.'); setLoading(false); return; }
      const keysById = new Map(((keys || []) as AnswerKey[]).map(key => [key.question_id, key]));
      setQuestions(saved.length ? saved.map(q => {
        const key = keysById.get(q.id);
        return { id: q.id, question_type: q.question_type, prompt: q.prompt, hint_ru: q.hint_ru || '', options: (q.options || []).join('\n'), correct_answer: key?.correct_answer || '', explanation_ru: key?.explanation_ru || '', sample_answer: key?.sample_answer || '' };
      }) : [blankQuestion()]);
      setLoading(false);
    }
    void load();
  }, [quizId]);

  function updateQuestion(index: number, key: keyof DraftQuestion, value: string) {
    setQuestions(current => current.map((question, i) => i === index ? { ...question, [key]: value } : question));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setError('');
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    setSaving(true);
    const payload = questions.map(question => ({
      question_type: question.question_type,
      prompt: question.prompt.trim(),
      hint_ru: question.hint_ru.trim(),
      options: question.question_type === 'multiple_choice' ? question.options.split('\n').map(option => option.trim()).filter(Boolean) : [],
      correct_answer: question.question_type === 'open' ? '' : question.correct_answer.trim(),
      explanation_ru: question.explanation_ru.trim(),
      sample_answer: question.sample_answer.trim(),
    }));
    const { data: savedQuizId, error: saveError } = await supabase.rpc('save_quiz', {
      p_quiz_id: quizId || null, p_title: title.trim(), p_description: description.trim(), p_level: level,
      p_topic: topic.trim(), p_is_public: isPublic, p_questions: payload,
    });
    setSaving(false);
    if (saveError) { setError(saveError.message.includes('function') ? 'Quiz editor is not ready. Apply the latest Supabase migration first.' : saveError.message); return; }
    router.push(`/quizzes/${savedQuizId}`);
    router.refresh();
  }

  if (loading) return <div className="card stateCard">Loading quiz…</div>;
  return <>
    <Link className="backLink" href="/quizzes">← Back to quizzes</Link>
    <div className="eyebrow darkEyebrow">Quiz studio</div><h1 className="sectionTitle editorTitle">{quizId ? 'Edit quiz' : 'Create a quiz'}</h1>
    {error && <div className="noticeError" role="alert">{error}</div>}
    <form className="editorLayout" onSubmit={save}>
      <section className="editorMain">
        <div className="card editorSection"><div className="editorSectionTitle"><span className="editorNumber">01</span><div><h2>Quiz details</h2><p>Give your practice set a clear focus.</p></div></div>
          <label className="formLabel">Title<input className="field" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Everyday phrasal verbs" required maxLength={100} /></label>
          <label className="formLabel">Description<textarea className="field" value={description} onChange={e => setDescription(e.target.value)} placeholder="What will learners practice?" rows={3} maxLength={400} /></label>
          <div className="editorMetaGrid"><label className="formLabel">CEFR level<select className="field" value={level} onChange={e => setLevel(e.target.value)}>{levels.map(item => <option key={item}>{item}</option>)}</select></label><label className="formLabel">Topic<input className="field" value={topic} onChange={e => setTopic(e.target.value)} placeholder="Vocabulary, grammar…" required maxLength={80} /></label></div>
          <label className="toggleLabel"><input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} /><span><b>Make this quiz public</b><small>Anyone with an account can find and take it.</small></span></label>
        </div>
        <div className="editorSectionHead"><div><div className="eyebrow darkEyebrow">Build the practice</div><h2>Questions <span className="questionCount">{questions.length}</span></h2></div><button className="button secondary" type="button" onClick={() => setQuestions(current => [...current, blankQuestion()])}>＋ Add question</button></div>
        <div className="questionEditorList">{questions.map((question, index) => <article className="card questionEditor" key={question.id || index}><div className="questionEditorTop"><div className="editorSectionTitle"><span className="editorNumber">{String(index + 1).padStart(2, '0')}</span><div><h3>Question {index + 1}</h3><p>Choose a format and add the prompt.</p></div></div>{questions.length > 1 && <button className="removeQuestion" type="button" onClick={() => setQuestions(current => current.filter((_, i) => i !== index))} aria-label={`Remove question ${index + 1}`}>Remove</button>}</div>
            <label className="formLabel">Exercise type<select className="field" value={question.question_type} onChange={e => updateQuestion(index, 'question_type', e.target.value as QuestionType)}><option value="fill">Fill in the blank</option><option value="multiple_choice">Multiple choice</option><option value="open">Open answer</option></select></label>
            <label className="formLabel">Prompt<textarea className="field" value={question.prompt} onChange={e => updateQuestion(index, 'prompt', e.target.value)} placeholder="Write the question learners will see…" rows={2} required /></label>
            <label className="formLabel">Hint in Russian (optional)<input className="field" value={question.hint_ru} onChange={e => updateQuestion(index, 'hint_ru', e.target.value)} placeholder="A short hint" /></label>
            {question.question_type === 'multiple_choice' && <label className="formLabel">Answer options <small>Put one option on each line. Add at least two.</small><textarea className="field" value={question.options} onChange={e => updateQuestion(index, 'options', e.target.value)} placeholder={'Option one\nOption two\nOption three'} rows={4} required /></label>}
            {question.question_type !== 'open' ? <label className="formLabel">Correct answer<input className="field" value={question.correct_answer} onChange={e => updateQuestion(index, 'correct_answer', e.target.value)} placeholder="Exact answer" required /></label> : <label className="formLabel">Sample answer<input className="field" value={question.sample_answer} onChange={e => updateQuestion(index, 'sample_answer', e.target.value)} placeholder="An example response for learners" /></label>}
            <label className="formLabel">Explanation in Russian (optional)<textarea className="field" value={question.explanation_ru} onChange={e => updateQuestion(index, 'explanation_ru', e.target.value)} placeholder="Explain the answer" rows={2} /></label>
          </article>)}</div>
      </section>
      <aside className="editorAside"><div className="card editorSticky"><div className="eyebrow darkEyebrow">Ready when you are</div><h2>{quizId ? 'Save your changes' : 'Publish your quiz'}</h2><p>Your quiz and answer keys are saved securely in Supabase.</p><button className="button editorSave" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save quiz'}</button><Link className="editorCancel" href="/quizzes">Cancel</Link><div className="secureHint"><span>✓</span> Answer keys stay private to you.</div></div></aside>
    </form>
  </>;
}
