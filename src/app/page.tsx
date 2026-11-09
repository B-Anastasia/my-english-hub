'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Activity = {
  id: string;
  score: number | null;
  completed_at: string;
  quizzes: { title: string } | null;
};

export default function Home() {
  const [name, setName] = useState('Learner');
  const [signedIn, setSignedIn] = useState(false);
  const [stats, setStats] = useState({ courses: 0, words: 0, attempts: 0 });
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setSignedIn(true);
      setName(user.user_metadata?.display_name || user.email?.split('@')[0] || 'Learner');
      const [courses, words, attempts, recent] = await Promise.all([
        supabase.from('enrollments').select('*', { count: 'exact', head: true }),
        supabase.from('vocabulary').select('*', { count: 'exact', head: true }),
        supabase.from('attempts').select('*', { count: 'exact', head: true }),
        supabase
          .from('attempts')
          .select('id,score,completed_at,quizzes(title)')
          .order('completed_at', { ascending: false })
          .limit(4),
      ]);
      setStats({
        courses: courses.count || 0,
        words: words.count || 0,
        attempts: attempts.count || 0,
      });
      if (!recent.error) setActivity((recent.data || []) as unknown as Activity[]);
      else setNotice('Learning activity will appear here after the database schema is updated.');
      setLoading(false);
    }
    void load();
  }, []);

  return (
    <>
      <section className="dashboardHero">
        <div className="heroCopy">
          <div className="eyebrow">Your learning space</div>
          <h1>
            Good to see you,
            <br />
            {name}.
          </h1>
          <p>Small steps add up. Pick up where you left off or choose something new to explore.</p>
          <Link className="button heroButton" href="/quizzes">
            Continue learning <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="heroArt" aria-hidden="true">
          <div className="orbit orbitOne" />
          <div className="orbit orbitTwo" />
          <div className="bookMark">Aa</div>
          <span className="sparkle sparkleOne">✦</span>
          <span className="sparkle sparkleTwo">✧</span>
          <span className="heroLevel">B1 — C1</span>
        </div>
      </section>

      <section className="statsGrid" aria-label="Learning overview">
        <article className="statCard">
          <span className="statIcon lavender">▤</span>
          <div>
            <div className="statLabel">Courses joined</div>
            <strong>{loading ? '—' : stats.courses}</strong>
          </div>
        </article>
        <article className="statCard">
          <span className="statIcon peach">✎</span>
          <div>
            <div className="statLabel">Words saved</div>
            <strong>{loading ? '—' : stats.words}</strong>
          </div>
        </article>
        <article className="statCard">
          <span className="statIcon mint">✓</span>
          <div>
            <div className="statLabel">Quiz attempts</div>
            <strong>{loading ? '—' : stats.attempts}</strong>
          </div>
        </article>
        <article className="streakCard">
          <span className="streakIcon">✦</span>
          <div>
            <div className="statLabel">Your daily reminder</div>
            <strong>Keep your streak alive</strong>
            <small>Every little bit counts.</small>
          </div>
        </article>
      </section>

      <div className="dashboardColumns">
        <section>
          <div className="sectionHeading">
            <div>
              <div className="eyebrow darkEyebrow">Choose your next step</div>
              <h2 className="sectionTitle">Your workspace</h2>
            </div>
            <Link className="subtleLink" href="/courses">
              View all →
            </Link>
          </div>
          <div className="workspaceGrid">
            <Link className="workspaceCard courseTile" href="/courses">
              <span className="tileIcon">▤</span>
              <span className="tileArrow">↗</span>
              <h3>Courses</h3>
              <p>Follow a learning path, one lesson at a time.</p>
              <span className="tileMeta">
                Explore courses <b>→</b>
              </span>
            </Link>
            <Link className="workspaceCard quizTile" href="/quizzes">
              <span className="tileIcon">✳</span>
              <span className="tileArrow">↗</span>
              <h3>Quizzes</h3>
              <p>Practice what you know and build confidence.</p>
              <span className="tileMeta">
                Start practicing <b>→</b>
              </span>
            </Link>
            <Link className="workspaceCard vocabTile" href="/vocabulary">
              <span className="tileIcon">Aa</span>
              <span className="tileArrow">↗</span>
              <h3>Vocabulary</h3>
              <p>Collect useful words and expressions.</p>
              <span className="tileMeta">
                Open your word bank <b>→</b>
              </span>
            </Link>
          </div>
        </section>
        <aside className="activityCard">
          <div className="sectionHeading">
            <div>
              <div className="eyebrow darkEyebrow">A little progress, often</div>
              <h2 className="sectionTitle">Recent activity</h2>
            </div>
          </div>
          {!signedIn ? (
            <div className="activityEmpty">
              <div className="emptyIcon">↗</div>
              <p>Sign in to save your progress and see it here.</p>
              <Link className="subtleLink" href="/login">
                Sign in →
              </Link>
            </div>
          ) : loading ? (
            <div className="activityEmpty">Loading your activity…</div>
          ) : activity.length ? (
            <div className="activityList">
              {activity.map((item) => (
                <div className="activityItem" key={item.id}>
                  <span className="activityCheck">✓</span>
                  <div>
                    <b>{item.quizzes?.title || 'Quiz completed'}</b>
                    <small>
                      {new Date(item.completed_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </small>
                  </div>
                  <span className="activityScore">
                    {item.score === null ? 'Done' : `${Math.round(item.score)}%`}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="activityEmpty">
              <div className="emptyIcon">✦</div>
              <p>Your completed quizzes will show up here.</p>
              <Link className="subtleLink" href="/quizzes">
                Try a quiz →
              </Link>
            </div>
          )}
          {notice && <p className="inlineNotice">{notice}</p>}
        </aside>
      </div>
      {!signedIn && (
        <section className="welcomeStrip">
          <div>
            <b>Your learning space is ready when you are.</b>
            <p>Create a free account to save courses, words, and quiz scores across devices.</p>
          </div>
          <Link className="button" href="/login">
            Get started
          </Link>
        </section>
      )}
    </>
  );
}
