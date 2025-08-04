// Extend Prisma types to fix TypeScript errors
declare global {
  namespace Prisma {
    interface DomainWhereInput {
      isActive?: boolean;
    }
  }
}

// Type definitions for JSON data structures
export interface NotificationChannelData {
  userId: string;
  name: string;
  type: string;
  enabled: boolean;
  config: Record<string, unknown>;
  filters: Record<string, unknown>;
  lastUsed?: string;
  totalNotifications?: number;
}

export interface NotificationTemplateData {
  userId: string;
  name: string;
  type: string;
  subject?: string;
  body: string;
  variables: string[];
  isDefault: boolean;
}

export interface NotificationHistoryData {
  userId: string;
  channelId: string;
  channelName: string;
  type: string;
  recipient: string;
  subject?: string;
  message: string;
  status: string;
  deliveredAt?: string;
  errorMessage?: string;
  alertId?: string;
  metadata?: Record<string, unknown>;
}

export interface ReportTemplate {
  name: string;
  description: string;
  type: string;
  category: string;
  fields: string[];
  filters: Record<string, unknown>;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  groupBy?: string;
  chartType?: string;
  refreshInterval?: number;
  isDefault: boolean;
  createdBy: string;
  updatedAt: string;
}

export interface ReportBuilder {
  name: string;
  description: string;
  dataSource: string;
  fields: string[];
  filters: Record<string, unknown>;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  groupBy?: string;
  chartType?: string;
  refreshInterval?: number;
  isDefault: boolean;
  createdBy: string;
  updatedAt: string;
}

export interface ReportDistribution {
  reportId: string;
  name: string;
  enabled: boolean;
  schedule: string;
  recipients: string[];
  format: 'pdf' | 'excel' | 'csv' | 'html';
  deliveryMethod: 'email' | 'webhook' | 'slack';
  lastSent?: string;
  nextSend?: string;
  createdBy: string;
  updatedAt: string;
}

export interface BusinessIntelligence {
  name: string;
  description: string;
  type: string;
  widgets: Record<string, unknown>[];
  layout: Record<string, unknown>;
  refreshInterval: number;
  filters: Record<string, unknown>;
  isDefault: boolean;
  createdBy: string;
  updatedAt: string;
}

export interface SSLCertificate {
  clientId: string;
  domain: string;
  issuer: string;
  subject: string;
  validFrom: Date;
  validTo: Date;
  fingerprint: string;
  serialNumber: string;
  signatureAlgorithm: string;
  keySize: number;
  dnsNames: string[];
  ipAddresses: string[];
  lastChecked: Date;
  autoRenewal: boolean;
  renewalProvider?: string;
  renewalConfig?: Record<string, unknown>;
}

export interface SSLAlert {
  certificateId: string;
  clientId: string;
  domain: string;
  alertType: 'EXPIRING_WARNING' | 'EXPIRING_CRITICAL' | 'EXPIRED' | 'INVALID' | 'RENEWAL_FAILED';
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  isResolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export interface AutomatedTask {
  name: string;
  description: string;
  type: string;
  schedule: string;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  retryCount: number;
  maxRetries: number;
  timeout: number;
  createdBy: string;
  updatedAt: string;
  config: Record<string, unknown>;
}

export interface TaskExecution {
  taskId: string;
  status: string;
  startedAt: Date;
  completedAt?: Date;
  executionTime?: number;
  output?: string;
  error?: string;
  retryCount: number;
  triggeredBy: 'SCHEDULE' | 'MANUAL' | 'DEPENDENCY' | 'EVENT';
  metadata?: Record<string, unknown>;
}

export interface SystemMaintenance {
  type: string;
  description: string;
  schedule: string;
  configuration: Record<string, unknown>;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  createdBy: string;
  updatedAt: string;
}

export interface AutomationRule {
  name: string;
  description: string;
  trigger: string;
  conditions: Record<string, unknown>[];
  actions: Record<string, unknown>[];
  enabled: boolean;
  priority: number;
  createdBy: string;
  updatedAt: string;
}

export interface SystemHealth {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  uptime: number;
  lastCheck: Date;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
}

export interface MetricsData {
  type: string;
  metrics: Record<string, unknown>;
  recordedBy: string;
}

export interface AlertData {
  type: string;
  severity: string;
  message: string;
  threshold: number;
  currentValue: number;
  triggeredAt: Date;
  resolvedAt?: Date;
}

export interface SystemMetrics {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  uptime: number;
  activeConnections: number;
  requestsPerSecond: number;
  errorRate: number;
}

// Type guard functions
export function isNotificationChannelData(data: unknown): data is NotificationChannelData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'userId' in data &&
    'name' in data &&
    'type' in data &&
    'enabled' in data
  );
}

export function isNotificationTemplateData(data: unknown): data is NotificationTemplateData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'userId' in data &&
    'name' in data &&
    'type' in data &&
    'body' in data
  );
}

export function isNotificationHistoryData(data: unknown): data is NotificationHistoryData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'userId' in data &&
    'channelId' in data &&
    'channelName' in data &&
    'type' in data &&
    'recipient' in data &&
    'message' in data &&
    'status' in data
  );
}

export function isReportTemplate(data: unknown): data is ReportTemplate {
  return (
    typeof data === 'object' &&
    data !== null &&
    'name' in data &&
    'description' in data &&
    'type' in data &&
    'category' in data
  );
}

export function isReportBuilder(data: unknown): data is ReportBuilder {
  return (
    typeof data === 'object' &&
    data !== null &&
    'name' in data &&
    'description' in data &&
    'dataSource' in data &&
    'fields' in data
  );
}

export function isReportDistribution(data: unknown): data is ReportDistribution {
  return (
    typeof data === 'object' &&
    data !== null &&
    'reportId' in data &&
    'name' in data &&
    'enabled' in data &&
    'schedule' in data
  );
}

export function isBusinessIntelligence(data: unknown): data is BusinessIntelligence {
  return (
    typeof data === 'object' &&
    data !== null &&
    'name' in data &&
    'description' in data &&
    'type' in data &&
    'widgets' in data
  );
}

export function isSSLCertificate(data: unknown): data is SSLCertificate {
  return (
    typeof data === 'object' &&
    data !== null &&
    'clientId' in data &&
    'domain' in data &&
    'issuer' in data &&
    'subject' in data
  );
}

export function isSSLAlert(data: unknown): data is SSLAlert {
  return (
    typeof data === 'object' &&
    data !== null &&
    'certificateId' in data &&
    'clientId' in data &&
    'domain' in data &&
    'alertType' in data
  );
}

export function isAutomatedTask(data: unknown): data is AutomatedTask {
  return (
    typeof data === 'object' &&
    data !== null &&
    'name' in data &&
    'description' in data &&
    'type' in data &&
    'schedule' in data
  );
}

export function isTaskExecution(data: unknown): data is TaskExecution {
  return (
    typeof data === 'object' &&
    data !== null &&
    'taskId' in data &&
    'status' in data &&
    'startedAt' in data
  );
}

export function isSystemMaintenance(data: unknown): data is SystemMaintenance {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    'description' in data &&
    'schedule' in data
  );
}

export function isAutomationRule(data: unknown): data is AutomationRule {
  return (
    typeof data === 'object' &&
    data !== null &&
    'name' in data &&
    'description' in data &&
    'trigger' in data
  );
}

export function isMetricsData(data: unknown): data is MetricsData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    'metrics' in data &&
    'recordedBy' in data
  );
}

export function isAlertData(data: unknown): data is AlertData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    'severity' in data &&
    'message' in data &&
    'threshold' in data &&
    'currentValue' in data
  );
} 