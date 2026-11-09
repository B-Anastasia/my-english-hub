'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Course = {
  id: string;
  title: string;
  description: string | null;
  level: string;
  is_public: boolean;
};

export default function Courses() {
  const [items, setItems] = useState<Course[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [msg, setMsg] = useState('');
  const supabase = createClient();

  async function load() {
    const { data, error } = await supabase
      .from('courses')
      .select('id,title,description,level,is_public')
      .order('created_at', { ascending: false });
    if (error) setMsg(error.message);
    else setItems(data || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      setMsg('Please sign in first.');
      return;
    }
    const { error } = await supabase
      .from('courses')
      .insert({ title, description, owner_id: user.user.id });
    setMsg(error?.message || 'Course created.');
    if (!error) {
      setTitle('');
      setDescription('');
      load();
    }
  }

  return (
    <>
      <div className="eyebrow" style={{ color: '#6659d6' }}>
        Learning paths
      </div>
      <h1 className="sectionTitle" style={{ marginTop: 5 }}>
        Courses
      </h1>
      <p className="muted">Create structured courses and organize quizzes into lessons.</p>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 2fr' }}>
        <form className="card" onSubmit={add}>
          <h2>New course</h2>
          <input
            className="field"
            placeholder="Course title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <textarea
            className="field"
            placeholder="Short description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button className="button">Create course</button>
          {msg && <p style={{ marginTop: 10 }}>{msg}</p>}
        </form>
        <div className="card">
          <h2>Your courses</h2>
          {items.length ? (
            items.map((c) => (
              <div
                className="row"
                style={{ padding: '13px 0', borderBottom: '1px solid #eee' }}
                key={c.id}
              >
                <div>
                  <b>{c.title}</b>
                  <p className="muted">{c.description || 'No description yet'}</p>
                </div>
                <span className="pill">{c.level}</span>
              </div>
            ))
          ) : (
            <div className="empty">No courses yet. Sign in and create your first course.</div>
          )}
        </div>
      </div>
    </>
  );
}
