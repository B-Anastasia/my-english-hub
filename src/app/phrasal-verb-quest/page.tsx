import { redirect } from 'next/navigation';

export default function LegacyQuizPage() {
  redirect('/quizzes');
}
