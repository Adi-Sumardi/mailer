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
  isRead: boolean;
  isImportant: boolean;
  isSpam: boolean;
  sendStatus: 'draft' | 'queued' | 'sent' | 'cancelled';
  recallDeadlineAt: string | null;
  recalled: boolean;
  sentAt: string | null;
  createdAt: string;
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
  actionType: 'move_folder' | 'forward' | 'auto_reply' | 'delete';
  actionValue: string | null;
  isActive: boolean;
}
