'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Quiz = { id: string; title: string; description: string | null; level: string; topic: string };
type Question = { id: string; position: number; question_type: 'fill' | 'multiple_choice' | 'open'; prompt: string; hint_ru: string | null; options: string[] };
type Result = { question_id: string; is_correct: boolean | null; correct_answer: string | null; explanation_ru: string | null; sample_answer: string | null };
type Submission = { attempt_id: string; score: number | null; results: Result[] };

export default function QuizAttemptPage() {
  const params = useParams<{ id: string }>();
  const quizId = params.id;
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      const [{ data: quizRow, error: quizError }, { data: questionRows, error: questionError }] = await Promise.all([
        supabase.from('quizzes').select('id,title,description,level,topic').eq('id', quizId).single(),
        supabase.from('questions').select('id,position,question_type,prompt,hint_ru,options').eq('quiz_id', quizId).order('position'),
      ]);
      if (quizError || questionError || !quizRow) setError('This quiz is unavailable. It may be private or no longer published.');
      else { setQuiz(quizRow as Quiz); setQuestions((questionRows || []) as Question[]); }
      setLoading(false);
    }
    if (quizId) void load();
  }, [quizId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError('');
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('Sign in to save your quiz attempt.'); return; }
    setSubmitting(true);
    const payload = questions.map(question => ({ question_id: question.id, answer: answers[question.id] || '' }));
    const { data, error: submitError } = await supabase.rpc('submit_quiz_attempt', { p_quiz_id: quizId, p_answers: payload });
    setSubmitting(false);
    if (submitError) { setError(submitError.message); return; }
    setSubmission(data as Submission);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (loading) return <div className="card stateCard">Loading quiz…</div>;
  if (!quiz) return <div className="card stateCard"><h1>Quiz unavailable</h1><p>{error}</p><Link className="button" href="/quizzes">Back to quizzes</Link></div>;

  return <>
    <Link className="backLink" href="/quizzes">← All quizzes</Link>
    <section className="attemptIntro"><div><div className="eyebrow darkEyebrow">{quiz.topic} · {quiz.level}</div><h1>{quiz.title}</h1><p>{quiz.description || 'Take your time and answer each question.'}</p></div>{submission && <div className="scoreBadge"><span>Your score</span><b>{submission.score === null ? 'Reviewed' : `${Math.round(submission.score)}%`}</b></div>}</section>
    {questions.length === 0 ? <div className="card stateCard">This quiz has no questions yet.</div> : <form onSubmit={submit} className="attemptForm">
      {questions.map((question, index) => {
        const result = submission?.results.find(item => item.question_id === question.id);
        return <article className="card attemptQuestion" key={question.id}><div className="questionMeta"><span className="pill">Question {index + 1} of {questions.length}</span><span className="muted">{question.question_type === 'fill' ? 'Fill in the blank' : question.question_type === 'multiple_choice' ? 'Multiple choice' : 'Open answer'}</span></div><h2>{question.prompt}</h2>{question.hint_ru && <p className="hintText">Подсказка: {question.hint_ru}</p>}
          {question.question_type === 'multiple_choice' ? <div className="choiceList">{(question.options || []).map(option => <label className={`choiceOption${answers[question.id] === option ? ' selected' : ''}`} key={option}><input type="radio" name={question.id} value={option} checked={answers[question.id] === option} onChange={() => setAnswers(current => ({ ...current, [question.id]: option }))} disabled={Boolean(submission)} required /><span>{option}</span></label>)}</div> : <textarea className="field answerField" value={answers[question.id] || ''} onChange={e => setAnswers(current => ({ ...current, [question.id]: e.target.value }))} placeholder={question.question_type === 'open' ? 'Write your answer in English…' : 'Type your answer…'} rows={question.question_type === 'open' ? 4 : 2} disabled={Boolean(submission)} required />}
          {result && <div className={`answerFeedback ${result.is_correct === null ? 'feedbackOpen' : result.is_correct ? 'feedbackCorrect' : 'feedbackWrong'}`}><b>{result.is_correct === null ? 'Answer saved for your review' : result.is_correct ? 'Correct!' : `Answer: ${result.correct_answer || 'Review the example'}`}</b>{result.explanation_ru && <p>{result.explanation_ru}</p>}{result.sample_answer && <small>Example: {result.sample_answer}</small>}</div>}
        </article>;
      })}
      {error && <div className="noticeError" role="alert">{error} {error.includes('Sign in') && <Link href="/login">Go to sign in →</Link>}</div>}
      {!submission ? <button className="button submitQuizButton" type="submit" disabled={submitting}>{submitting ? 'Checking answers…' : 'Check and save attempt'}</button> : <div className="card resultNote"><b>Your attempt is saved.</b><p>You can take this quiz again from the quiz library.</p><Link className="button secondary" href="/quizzes">Back to quizzes</Link></div>}
    </form>}
  </>;
}
