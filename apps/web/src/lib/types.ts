export interface Folder {
  id: string;
  mailboxId: string;
  folderName: string;
  folderType: 'inbox' | 'sent' | 'draft' | 'trash' | 'custom';
}

export interface EmailMessage {
  id: string;
  mailboxId: string;
  folderId: string;
  threadId: string;
  parentEmailId: string | null;
  fromAddr: string;
  toAddr: string;
  subject: string;
  body: string;
  isHtml: boolean;
  isRead: boolean;
  isImportant: boolean;
  isSpam: boolean;
  sendStatus: 'draft' | 'queued' | 'sent' | 'cancelled' | 'failed';
  recallDeadlineAt: string | null;
  recalled: boolean;
  sentAt: string | null;
  createdAt: string;
}

export interface EmailTemplate {
  id: string;
  mailboxId: string;
  logoFilename: string | null;
  logoPosition: 'left' | 'center' | 'right';
  title: string | null;
  subtitle: string | null;
  primaryColor: string;
  accentColor: string;
  footerText: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  location: string | null;
  recurrenceRule: string | null;
}

export interface Task {
  id: string;
  title: string;
  dueDate: string | null;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'done';
  linkedEmailId: string | null;
}

export interface AutomationRule {
  id: string;
  name: string;
  conditionField: 'sender' | 'subject' | 'body';
  conditionOperator: 'contains' | 'equals';
  conditionValue: string;
  actionType: 'move_folder' | 'forward' | 'auto_reply' | 'delete' | 'ai_agent';
  actionValue: string | null;
  aiProvider: 'openai' | 'anthropic' | null;
  aiModel: string | null;
  aiApiKeyMasked: string | null;
  isActive: boolean;
}

export interface Tenant {
  id: string;
  tenantName: string;
  planType: string;
  billingStatus: 'active' | 'suspended' | 'cancelled';
  deactivatedAt: string | null;
  createdAt: string;
}

export interface Domain {
  id: string;
  tenantId: string;
  domainName: string;
  verificationStatus: 'pending' | 'verified' | 'failed';
  verificationToken: string;
  mxRecord: string | null;
  spfRecord: string | null;
  dkimSelector: string | null;
  dkimPublicKey: string | null;
  dmarcRecord: string | null;
  verifiedAt: string | null;
  createdAt: string;
}

export interface DnsRecords {
  mx: string | null;
  spf: string | null;
  dmarc: string | null;
  dkim: { host: string; value: string } | null;
}

export interface ApiCredential {
  id: string;
  name: string;
  environment: 'sandbox' | 'production';
  memberId: string;
  dailyEmailLimit: number;
  emailsSentToday: number;
  createdAt: string;
  revokedAt: string | null;
}

export interface ApiCredentialWithSecret extends ApiCredential {
  secret: string;
}

export interface ManagedUser {
  id: string;
  email: string;
  role: 'super_admin' | 'tenant_admin' | 'end_user';
  tenantId: string | null;
  mailboxId: string | null;
  createdAt: string;
}

export interface EmailAttachment {
  id: string;
  emailId: string;
  filename: string;
  sizeKb: number;
  storagePath: string;
  createdAt: string;
}

