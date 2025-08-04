import { DomainVerificationStatus } from '@prisma/client';

interface WhoisResponse {
  domain: string;
  domain_id: string;
  status: string;
  create_date: string;
  update_date: string;
  expire_date: string;
  domain_age: number;
  whois_server: string;
  registrar: {
    iana_id: string;
    name: string;
    url: string;
  };
  registrant: {
    name: string;
    organization: string;
    street_address: string;
    city: string;
    region: string;
    zip_code: string;
    country: string;
    phone: string;
    fax: string;
    email: string;
  };
  admin: {
    name: string;
    organization: string;
    street_address: string;
    city: string;
    region: string;
    zip_code: string;
    country: string;
    phone: string;
    fax: string;
    email: string;
  };
  tech: {
    name: string;
    organization: string;
    street_address: string;
    city: string;
    region: string;
    zip_code: string;
    country: string;
    phone: string;
    fax: string;
    email: string;
  };
  billing: {
    name: string;
    organization: string;
    street_address: string;
    city: string;
    region: string;
    zip_code: string;
    country: string;
    phone: string;
    fax: string;
    email: string;
  };
  nameservers: string[];
}

interface WhoisError {
  error: {
    error_code: number;
    error_message: string;
  };
}

interface DomainVerificationResult {
  success: boolean;
  status: DomainVerificationStatus;
  data?: {
    registrantName?: string;
    registrantEmail?: string;
    registrantOrg?: string;
    registrar?: string;
    creationDate?: Date;
    expirationDate?: Date;
    lastUpdated?: Date;
    nameservers?: string[];
    dnssec?: boolean;
    whoisData: WhoisResponse;
  };
  error?: string;
  responseTime?: number;
}

export class WhoisService {
  private apiKey: string;
  private baseUrl = 'https://api.ip2whois.com/v2';

  constructor() {
    this.apiKey = process.env.IP2WHOIS_API_KEY || '';
    if (!this.apiKey) {
      console.warn('IP2WHOIS_API_KEY not found in environment variables');
    }
  }

  async verifyDomain(domain: string): Promise<DomainVerificationResult> {
    const startTime = Date.now();
    
    try {
      if (!this.apiKey) {
        return {
          success: false,
          status: DomainVerificationStatus.FAILED,
          error: 'WHOIS API key not configured'
        };
      }

      const params = new URLSearchParams({
        key: this.apiKey,
        domain: domain.toLowerCase().trim(),
        format: 'json'
      });

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(`${this.baseUrl}?${params}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'SHP-Management-Platform/1.0'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        return {
          success: false,
          status: DomainVerificationStatus.FAILED, 
          error: `HTTP ${response.status}: ${response.statusText}`,
          responseTime
        };
      }

      const data = await response.json();

      // Check for API error response
      if ('error' in data) {
        const errorData = data as WhoisError;
        return {
          success: false,
            status: DomainVerificationStatus.FAILED,
          error: `API Error ${errorData.error.error_code}: ${errorData.error.error_message}`,
          responseTime
        };
      }

      const whoisData = data as WhoisResponse;
      
      // Determine verification status based on WHOIS data
      const status = this.determineVerificationStatus(whoisData);
      
      return {
        success: true,
        status,
        data: {
          registrantName: whoisData.registrant?.name || undefined,
          registrantEmail: whoisData.registrant?.email || undefined,
          registrantOrg: whoisData.registrant?.organization || undefined,
          registrar: whoisData.registrar?.name || undefined,
          creationDate: whoisData.create_date ? new Date(whoisData.create_date) : undefined,
          expirationDate: whoisData.expire_date ? new Date(whoisData.expire_date) : undefined,
          lastUpdated: whoisData.update_date ? new Date(whoisData.update_date) : undefined,
          nameservers: whoisData.nameservers || [],
          dnssec: undefined, // IP2WHOIS doesn't provide DNSSEC info
          whoisData: whoisData
        },
        responseTime
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('WHOIS verification error:', error);
      
      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Request timeout after 30 seconds';
        } else {
          errorMessage = error.message;
        }
      }
      
      return {
        success: false,
        status: DomainVerificationStatus.FAILED,
        error: errorMessage,
        responseTime
      };
    }
  }

  private determineVerificationStatus(whoisData: WhoisResponse): DomainVerificationStatus {
    // Check if domain has expired
    if (whoisData.expire_date) {
      const expirationDate = new Date(whoisData.expire_date);
      if (expirationDate < new Date()) {
          return DomainVerificationStatus.EXPIRED;
      }
    }

    // Check for privacy protection (common indicators)
    const registrantName = whoisData.registrant?.name?.toLowerCase() || '';
    const registrantOrg = whoisData.registrant?.organization?.toLowerCase() || '';
    const registrantEmail = whoisData.registrant?.email?.toLowerCase() || '';
    
    const privacyIndicators = [
      'privacy', 'protected', 'redacted', 'whoisguard', 'domains by proxy',
      'contact privacy', 'private registration', 'data protected'
    ];
    
    const hasPrivacyProtection = privacyIndicators.some(indicator => 
      registrantName.includes(indicator) || 
      registrantOrg.includes(indicator) ||
      registrantEmail.includes(indicator)
    );
    
    if (hasPrivacyProtection) {
      return DomainVerificationStatus.PRIVACY_PROTECTED;
    }

    // Check if we have sufficient data for verification
    if (!whoisData.registrant?.name && !whoisData.registrant?.email && !whoisData.registrant?.organization) {
      return DomainVerificationStatus.FAILED;
    }

    return DomainVerificationStatus.VERIFIED;
  }

  /**
   * Compare two WHOIS data sets to detect changes
   */
  detectChanges(oldData: WhoisResponse, newData: WhoisResponse): string[] {
    const changes: string[] = [];
    
    // Compare key fields
    const fieldsToCompare = [
      { path: 'registrant.name', label: 'Registrant Name' },
      { path: 'registrant.email', label: 'Registrant Email' },
      { path: 'registrant.organization', label: 'Registrant Organization' },
      { path: 'registrar.name', label: 'Registrar' },
      { path: 'expire_date', label: 'Expiration Date' },
      { path: 'nameservers', label: 'Nameservers' }
    ];

    for (const field of fieldsToCompare) {
      const oldValue = this.getNestedValue(oldData, field.path);
      const newValue = this.getNestedValue(newData, field.path);
      
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push(`${field.label} changed from "${oldValue}" to "${newValue}"`);
      }
    }

    return changes;
  }

  private getNestedValue(obj: WhoisResponse, path: string): unknown {
    return path.split('.').reduce((current: unknown, key: string) => {
      if (current && typeof current === 'object' && current !== null) {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj as unknown);
  }

  /**
   * Calculate next verification date based on interval
   */
  calculateNextVerification(intervalDays: number): Date {
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + intervalDays);
    return nextDate;
  }

  /**
   * Validate domain name format
   */
  isValidDomain(domain: string): boolean {
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
    return domainRegex.test(domain.trim());
  }
}

export const whoisService = new WhoisService();