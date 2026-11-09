'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function SiteHeader() {
  const [signedIn, setSignedIn] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getSession().then(({ data }) => {
      setSignedIn(Boolean(data.session));
      setReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
      setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
  }

  return <header className="top">
    <Link className="brand" href="/">my english<span> hub.</span></Link>
    <nav className="nav">
      <Link href="/">Dashboard</Link><Link href="/courses">Courses</Link><Link href="/quizzes">Quizzes</Link><Link href="/vocabulary">Vocabulary</Link>
      {ready && (signedIn ? <button type="button" onClick={signOut}>Sign out</button> : <Link href="/login">Sign in</Link>)}
    </nav>
  </header>;
}
