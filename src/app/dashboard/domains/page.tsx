import { Suspense } from 'react';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import DomainList from '@/components/domains/DomainList';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { CheckCircle, AlertCircle, Clock, Shield, TrendingUp, Users, LucideIcon, Plus, RefreshCw } from 'lucide-react';

interface DomainStats {
  total: number;
  verified: number;
  failed: number;
  pending: number;
  expired: number;
  ownershipChanged: number;
  privacyProtected: number;
  dueForVerification: number;
}

async function getDomainStats(): Promise<DomainStats> {
  const [total, verified, failed, pending, expired, ownershipChanged, privacyProtected, dueForVerification] = await Promise.all([
    prisma.domain.count({ where: { isActive: true } }),
    prisma.domain.count({ where: { isActive: true, verificationStatus: 'VERIFIED' } }),
    prisma.domain.count({ where: { isActive: true, verificationStatus: 'FAILED' } }),
    prisma.domain.count({ where: { isActive: true, verificationStatus: 'PENDING' } }),
    prisma.domain.count({ where: { isActive: true, verificationStatus: 'EXPIRED' } }),
    prisma.domain.count({ where: { isActive: true, ownershipChanged: true } }),
    prisma.domain.count({ where: { isActive: true, verificationStatus: 'PRIVACY_PROTECTED' } }),
    prisma.domain.count({ 
      where: { 
        isActive: true, 
        autoVerify: true,
        nextVerificationDue: { lte: new Date() }
      } 
    })
  ]);

  return {
    total,
    verified,
    failed,
    pending,
    expired,
    ownershipChanged,
    privacyProtected,
    dueForVerification
  };
}

async function getClients() {
  return await prisma.client.findMany({
    select: {
      id: true,
      domainName: true
    },
    orderBy: {
      domainName: 'asc'
    }
  });
}

function StatsCard({ title, value, icon: Icon, color, description }: {
  title: string;
  value: number;
  icon: LucideIcon;
  color: string;
  description?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function DomainStatsOverview({ stats }: { stats: DomainStats }) {
  const verificationRate = stats.total > 0 ? Math.round((stats.verified / stats.total) * 100) : 0;
  
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatsCard
        title="Total Domains"
        value={stats.total}
        icon={Users}
        color="text-blue-600"
        description="Active domains being monitored"
      />
      
      <StatsCard
        title="Verified"
        value={stats.verified}
        icon={CheckCircle}
        color="text-green-600"
        description={`${verificationRate}% verification rate`}
      />
      
      <StatsCard
        title="Need Attention"
        value={stats.failed + stats.expired + stats.ownershipChanged}
        icon={AlertCircle}
        color="text-red-600"
        description="Failed, expired, or ownership changed"
      />
      
      <StatsCard
        title="Due for Verification"
        value={stats.dueForVerification}
        icon={Clock}
        color="text-orange-600"
        description="Scheduled for automatic verification"
      />
    </div>
  );
}

function DetailedStats({ stats }: { stats: DomainStats }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Verification Status Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">Verified</span>
            </div>
            <Badge className="bg-green-100 text-green-800">{stats.verified}</Badge>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-medium">Pending</span>
            </div>
            <Badge className="bg-yellow-100 text-yellow-800">{stats.pending}</Badge>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium">Failed</span>
            </div>
            <Badge className="bg-red-100 text-red-800">{stats.failed}</Badge>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium">Expired</span>
            </div>
            <Badge className="bg-gray-100 text-gray-800">{stats.expired}</Badge>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-medium">Ownership Changed</span>
            </div>
            <Badge className="bg-orange-100 text-orange-800">{stats.ownershipChanged}</Badge>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">Privacy Protected</span>
            </div>
            <Badge className="bg-blue-100 text-blue-800">{stats.privacyProtected}</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function DomainsPage() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect('/auth/signin');
  }

  const [stats, clients] = await Promise.all([
    getDomainStats(),
    getClients()
  ]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Domain Management</h1>
          <p className="text-muted-foreground">
            Monitor and verify domain ownership across all clients
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh All
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Domain
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <DomainStatsOverview stats={stats} />
      
      {/* Detailed Stats */}
      <DetailedStats stats={stats} />
      
      {/* Domain List */}
      <Card>
        <CardHeader>
          <CardTitle>All Domains</CardTitle>
          <CardDescription>
            Manage domain verification status and monitor ownership changes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="flex items-center justify-center py-8">Loading domains...</div>}>
            <DomainList clients={clients} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}