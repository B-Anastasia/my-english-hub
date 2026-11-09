'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Quiz = { id: string; title: string; description: string | null; level: string; topic: string; is_public: boolean; owner_id: string; created_at: string };

export default function Quizzes() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      const { data, error: queryError } = await supabase.from('quizzes')
        .select('id,title,description,level,topic,is_public,owner_id,created_at')
        .order('created_at', { ascending: false });
      if (queryError) setError('Could not load quizzes. Check that the quiz management migration has been applied in Supabase.');
      else setQuizzes((data || []) as Quiz[]);
      setLoading(false);
    }
    void load();
  }, []);

  return <>
    <div className="sectionHeading quizPageHeading"><div><div className="eyebrow darkEyebrow">Practice zone</div><h1 className="sectionTitle">Quizzes</h1><p className="muted">Practice what you know or create a quiz for your next study session.</p></div><Link className="button" href="/quizzes/new">Create quiz <span aria-hidden="true">＋</span></Link></div>
    {error ? <div className="card stateCard"><b>There was a problem loading quizzes</b><p>{error}</p></div> : loading ? <div className="card stateCard">Loading quizzes…</div> : quizzes.length === 0 ? <div className="card stateCard"><div className="emptyIcon">✳</div><h2>No quizzes yet</h2><p>Create your first quiz, or check back when public quizzes become available.</p><Link className="button" href="/quizzes/new">Create your first quiz</Link></div> : <div className="quizCatalog">{quizzes.map(quiz => <article className="quizCard" key={quiz.id}><div className="quizCardTop"><span className="tileIcon">✳</span><span className="pill">{quiz.level}</span></div><div className="quizTopic">{quiz.topic || 'General'}{quiz.is_public && <span className="publicDot"> · Public</span>}</div><h2>{quiz.title}</h2><p>{quiz.description || 'A short practice set to build your English skills.'}</p><div className="quizCardActions"><Link className="button" href={`/quizzes/${quiz.id}`}>Start quiz <span aria-hidden="true">→</span></Link>{userId === quiz.owner_id && <Link className="subtleLink" href={`/quizzes/${quiz.id}/edit`}>Edit</Link>}</div></article>)}</div>}
  </>;
}
