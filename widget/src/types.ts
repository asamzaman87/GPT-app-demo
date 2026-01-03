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
  attendees?: {
    email: string;
    name: string | null;
    status: string;
    comment?: string | null;
    self?: boolean | null;
    organizer?: boolean | null;
  }[];
  calendarLink: string;
  userComment?: string | null;
  isCreator?: boolean; // True if the user is the creator of the event (for group calendar events)
  calendarId?: string; // The calendar ID where this event is stored
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
  view?: 'invites' | 'conflicts'; // Indicates which view to show
}

export interface AuthStatusOutput {
  authenticated: boolean;
  email?: string | null;
  authUrl?: string;
  requestedView?: 'invites' | 'conflicts';
}
