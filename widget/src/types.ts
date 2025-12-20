// OpenAI Apps SDK Types
export interface OpenAIWidget {
  theme: 'light' | 'dark';
  toolOutput: Record<string, unknown>;
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  openExternal: (url: string) => void;
  sendFollowUpMessage: (message: string) => void;
  notifyIntrinsicHeight: (height: number) => void;
}

declare global {
  interface Window {
    openai?: OpenAIWidget;
  }
}

// Invite type from our API
export interface PendingInvite {
  eventId: string;
  summary: string;
  description: string | null;
  location: string | null;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  organizerEmail: string;
  organizerName: string | null;
  calendarLink: string;
}

// Tool output types
export interface PendingInvitesOutput {
  invites?: PendingInvite[];
  dateRange?: {
    start: string;
    end: string;
  };
  authRequired?: boolean;
  authUrl?: string;
  error?: string;
}

export interface AuthStatusOutput {
  authenticated: boolean;
  email?: string | null;
  authUrl?: string;
}

export interface RespondResultOutput {
  success: boolean;
  response?: string;
  message?: string;
  eventSummary?: string;
  error?: string;
}

