import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dynamic from 'next/dynamic';

const DashboardContent = dynamic(() => import('./DashboardContent'), {
  loading: () => (
    <div className="bg-white shadow rounded-lg p-8 text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      <p className="mt-4 text-gray-600">Loading dashboard...</p>
    </div>
  ),
});

export default async function Dashboard() {
  const session = await getServerSession(authOptions);
  
  return <DashboardContent session={session} />;
}