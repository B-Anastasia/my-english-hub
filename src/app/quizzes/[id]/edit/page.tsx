import QuizEditor from '../../quiz-editor';

export default async function EditQuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuizEditor quizId={id} />;
}
