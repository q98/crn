import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import dynamic from 'next/dynamic';

const TaskRequestForm = dynamic(() => import('./TaskRequestForm'), {
  loading: () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="bg-white shadow-xl rounded-2xl p-8 text-center max-w-md">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
        <p className="mt-6 text-gray-600 text-lg">Loading request form...</p>
      </div>
    </div>
  ),
});

export default async function RequestTaskPage() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect('/login');
  }

  return <TaskRequestForm session={session} />;
}

export const metadata = {
  title: 'Request New Work - SHP Management',
  description: 'Submit a new work request for Sweet Home Productions',
};