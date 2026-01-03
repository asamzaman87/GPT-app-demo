import { google, calendar_v3 } from 'googleapis';
import { getAuthorizedClient, getUserEmail } from './google-auth.js';
import {
  PendingInvite,
  PendingInvitesResponse,
  RespondToInviteResponse,
  CalendarEvent,
  CalendarAttendee,
} from './types.js';

/**
 * Get a Calendar API client for a user
 */
async function getCalendarClient(userId: string): Promise<calendar_v3.Calendar> {
  const auth = await getAuthorizedClient(userId);
  return google.calendar({ version: 'v3', auth });
}

/**
 * Exponential backoff helper for API calls
 * Retries on 403/429 rate limit errors with exponential delay
 */
async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 5,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a rate limit error
      const isRateLimit = error.code === 403 || error.code === 429 || 
                          error.response?.status === 403 || error.response?.status === 429;
      
      // If not a rate limit error or last attempt, throw immediately
      if (!isRateLimit || attempt === maxRetries) {
        throw error;
      }
      
      // Calculate exponential delay: 1s, 2s, 4s, 8s, 16s
      const delay = initialDelay * Math.pow(2, attempt);
      const jitter = Math.random() * 200; // Add 0-200ms random jitter
      const totalDelay = delay + jitter;
      
      console.log(`Rate limit hit (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${Math.round(totalDelay)}ms...`);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, totalDelay));
    }
  }
  
  // Should never reach here, but TypeScript needs it
  throw lastError;
}

/**
 * Format a date for display
 */
function formatDateTime(start: { dateTime?: string | null; date?: string | null }): {
  formatted: string;
  isAllDay: boolean;
} {
  if (start.date) {
    // All-day event
    return {
      formatted: start.date,
      isAllDay: true,
    };
  }
  
  if (start.dateTime) {
    return {
      formatted: start.dateTime,
      isAllDay: false,
    };
  }
  
  return { formatted: 'Unknown', isAllDay: false };
}

/**
 * Convert a Google Calendar event to our PendingInvite format
 */
function eventToPendingInvite(event: calendar_v3.Schema$Event, userEmail: string): PendingInvite | null {
  if (!event.id) {
    return null;
  }
  
  // Find the user in attendees
  const attendees = event.attendees || [];
  const userAttendee = attendees.find(
    (a) => a.email?.toLowerCase() === userEmail.toLowerCase()
  );
  
  // Skip if user is not an attendee or is the organizer
  if (!userAttendee || userAttendee.organizer) {
    return null;
  }
  
  // Skip if user has already responded
  if (userAttendee.responseStatus !== 'needsAction') {
    return null;
  }
  
  const startInfo = formatDateTime(event.start || {});
  const endInfo = formatDateTime(event.end || {});
  
  return {
    eventId: event.id,
    summary: event.summary || '(No title)',
    description: event.description || null,
    location: event.location || null,
    startTime: startInfo.formatted,
    endTime: endInfo.formatted,
    isAllDay: startInfo.isAllDay,
    organizerEmail: event.organizer?.email || 'Unknown',
    organizerName: event.organizer?.displayName || null,
    attendees: attendees.map((a) => ({
      email: a.email || 'Unknown',
      name: a.displayName || null,
      status: a.responseStatus || 'unknown',
      comment: a.comment || null,
      self: a.email?.toLowerCase() === userEmail.toLowerCase(),
      organizer: a.organizer || false,
    })),
    calendarLink: event.htmlLink || '',
    userComment: userAttendee.comment || null, // Include the user's own comment
  };
}

/**
 * Get pending calendar invites for a user
 */
export async function getPendingInvites(
  userId: string,
  startDate?: string,
  endDate?: string
): Promise<PendingInvitesResponse> {
  const calendar = await getCalendarClient(userId);
  const userEmail = getUserEmail(userId);
  
  if (!userEmail) {
    throw new Error('User email not found');
  }
  
  // Default date range: now to 14 days from now
  const now = new Date();
  const defaultEnd = new Date(now);
  defaultEnd.setDate(defaultEnd.getDate() + 14);
  
  const timeMin = startDate || now.toISOString();
  const timeMax = endDate || defaultEnd.toISOString();
  
  try {
    // Fetch events from primary calendar with exponential backoff
    const response = await withExponentialBackoff(() => 
      calendar.events.list({
        calendarId: 'primary',
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 250, // Get a good number of events
      })
    );
    
    const events = response.data.items || [];
    
    // Filter to pending invites only
    const pendingInvites: PendingInvite[] = [];
    
    for (const event of events) {
      const invite = eventToPendingInvite(event, userEmail);
      if (invite) {
        pendingInvites.push(invite);
      }
    }
    
    return {
      invites: pendingInvites,
      dateRange: {
        start: timeMin,
        end: timeMax,
      },
      totalCount: pendingInvites.length,
    };
  } catch (error: any) {
    console.error('Error fetching calendar events:', error);
    
    if (error.code === 401) {
      throw new Error('Authentication expired. Please re-authenticate.');
    }
    
    throw new Error(`Failed to fetch calendar events: ${error.message}`);
  }
}

/**
 * Respond to a calendar invite
 */
export async function respondToInvite(
  userId: string,
  eventId: string,
  response: 'accepted' | 'declined' | 'tentative'
): Promise<RespondToInviteResponse> {
  const calendar = await getCalendarClient(userId);
  const userEmail = getUserEmail(userId);
  
  if (!userEmail) {
    throw new Error('User email not found');
  }
  
  try {
    // First, get the event to find current attendees with exponential backoff
    const eventResponse = await withExponentialBackoff(() =>
      calendar.events.get({
        calendarId: 'primary',
        eventId,
      })
    );
    
    const event = eventResponse.data;
    
    if (!event.attendees) {
      throw new Error('Event has no attendees');
    }
    
    // Find and update the user's attendee status
    const updatedAttendees = event.attendees.map((attendee) => {
      if (attendee.email?.toLowerCase() === userEmail.toLowerCase()) {
        return {
          ...attendee,
          responseStatus: response,
        };
      }
      return attendee;
    });
    
    // Update the event with new attendee status with exponential backoff
    await withExponentialBackoff(() =>
      calendar.events.patch({
        calendarId: 'primary',
        eventId,
        requestBody: {
          attendees: updatedAttendees,
        },
        sendUpdates: 'all', // Notify organizer of the response
      })
    );
    
    // Generate a user-friendly message
    const statusMessages = {
      accepted: 'accepted',
      declined: 'declined',
      tentative: 'marked as tentative',
    };
    
    return {
      success: true,
      message: `You have ${statusMessages[response]} the invitation "${event.summary}"`,
      eventId,
      newStatus: response,
      eventSummary: event.summary || undefined,
    };
  } catch (error: any) {
    console.error('Error responding to invite:', error);
    
    if (error.code === 401) {
      throw new Error('Authentication expired. Please re-authenticate.');
    }
    
    if (error.code === 404) {
      throw new Error('Event not found. It may have been cancelled or deleted.');
    }
    
    throw new Error(`Failed to respond to invite: ${error.message}`);
  }
}

/**
 * Add a comment to a calendar invite
 */
export async function addCommentToInvite(
  userId: string,
  eventId: string,
  comment: string
): Promise<RespondToInviteResponse> {
  const calendar = await getCalendarClient(userId);
  const userEmail = getUserEmail(userId);
  
  if (!userEmail) {
    throw new Error('User email not found');
  }
  
  if (!comment || comment.trim() === '') {
    throw new Error('Comment cannot be empty');
  }
  
  try {
    // First, get the event to find current attendees with exponential backoff
    const eventResponse = await withExponentialBackoff(() =>
      calendar.events.get({
        calendarId: 'primary',
        eventId,
      })
    );
    
    const event = eventResponse.data;
    
    if (!event.attendees) {
      throw new Error('Event has no attendees');
    }
    
    // Find and update the user's attendee comment (replaces existing comment)
    const updatedAttendees = event.attendees.map((attendee) => {
      if (attendee.email?.toLowerCase() === userEmail.toLowerCase()) {
        return {
          ...attendee,
          comment: comment.trim(),
        };
      }
      return attendee;
    });
    
    // Update the event with the comment with exponential backoff
    await withExponentialBackoff(() =>
      calendar.events.patch({
        calendarId: 'primary',
        eventId,
        requestBody: {
          attendees: updatedAttendees,
        },
        sendUpdates: 'all', // Notify organizer of the comment
      })
    );
    
    return {
      success: true,
      message: `Comment added to "${event.summary}": "${comment}"`,
      eventId,
      newStatus: 'comment_added',
      eventSummary: event.summary || undefined,
    };
  } catch (error: any) {
    console.error('Error adding comment to invite:', error);
    
    if (error.code === 401) {
      throw new Error('Authentication expired. Please re-authenticate.');
    }
    
    if (error.code === 404) {
      throw new Error('Event not found. It may have been cancelled or deleted.');
    }
    
    throw new Error(`Failed to add comment: ${error.message}`);
  }
}

/**
 * Reschedule a calendar event (only if user is the organizer)
 */
export async function rescheduleEvent(
  userId: string,
  eventId: string,
  newStartTime: string,
  newEndTime: string
): Promise<RespondToInviteResponse> {
  const calendar = await getCalendarClient(userId);
  const userEmail = getUserEmail(userId);
  
  if (!userEmail) {
    throw new Error('User email not found');
  }
  
  // Validate the new times
  const startDate = new Date(newStartTime);
  const endDate = new Date(newEndTime);
  
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new Error('Invalid date/time format');
  }
  
  if (endDate <= startDate) {
    throw new Error('End time must be after start time');
  }
  
  try {
    // First, get the event to check if user is the organizer
    const eventResponse = await withExponentialBackoff(() =>
      calendar.events.get({
        calendarId: 'primary',
        eventId,
      })
    );
    
    const event = eventResponse.data;
    
    // Check if user is the organizer
    const isOrganizer = event.organizer?.email?.toLowerCase() === userEmail.toLowerCase();
    
    if (!isOrganizer) {
      throw new Error('Only the organizer can reschedule this event');
    }
    
    // Update the event times
    await withExponentialBackoff(() =>
      calendar.events.patch({
        calendarId: 'primary',
        eventId,
        requestBody: {
          start: {
            dateTime: newStartTime,
            timeZone: event.start?.timeZone || 'UTC',
          },
          end: {
            dateTime: newEndTime,
            timeZone: event.end?.timeZone || 'UTC',
          },
        },
        sendUpdates: 'all', // Notify all attendees of the change
      })
    );
    
    return {
      success: true,
      message: `Event "${event.summary}" rescheduled to ${startDate.toLocaleString()}`,
      eventId,
      newStatus: 'rescheduled',
      eventSummary: event.summary || undefined,
    };
  } catch (error: any) {
    console.error('Error rescheduling event:', error);
    
    if (error.code === 401) {
      throw new Error('Authentication expired. Please re-authenticate.');
    }
    
    if (error.code === 404) {
      throw new Error('Event not found. It may have been cancelled or deleted.');
    }
    
    throw new Error(`Failed to reschedule event: ${error.message}`);
  }
}

/**
 * Get a single event by ID
 */
export async function getEvent(
  userId: string,
  eventId: string
): Promise<CalendarEvent | null> {
  const calendar = await getCalendarClient(userId);
  
  try {
    const response = await withExponentialBackoff(() =>
      calendar.events.get({
        calendarId: 'primary',
        eventId,
      })
    );
    
    const event = response.data;
    
    return {
      id: event.id || '',
      summary: event.summary || 'No title',
      description: event.description,
      location: event.location,
      start: event.start || {},
      end: event.end || {},
      organizer: {
        email: event.organizer?.email || 'Unknown',
        displayName: event.organizer?.displayName,
      },
      attendees: (event.attendees || []).map((a) => ({
        email: a.email || '',
        displayName: a.displayName,
        responseStatus: (a.responseStatus as CalendarAttendee['responseStatus']) || 'needsAction',
        self: a.self,
        organizer: a.organizer,
      })),
      htmlLink: event.htmlLink || '',
      status: event.status || 'confirmed',
    };
  } catch (error: any) {
    if (error.code === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Get all conflicting events from all accessible calendars
 */
export async function getConflictingEvents(
  userId: string,
  startDate?: string,
  endDate?: string
): Promise<PendingInvitesResponse> {
  const calendar = await getCalendarClient(userId);
  const userEmail = getUserEmail(userId);
  
  if (!userEmail) {
    throw new Error('User email not found');
  }
  
  // Default date range: now to 30 days from now
  const now = new Date();
  const defaultEnd = new Date(now);
  defaultEnd.setDate(defaultEnd.getDate() + 30);
  
  const timeMin = startDate || now.toISOString();
  const timeMax = endDate || defaultEnd.toISOString();
  
  try {
    // First, get list of all accessible calendars
    const calendarListResponse = await withExponentialBackoff(() =>
      calendar.calendarList.list()
    );
    
    const calendars = calendarListResponse.data.items || [];
    const allEvents: calendar_v3.Schema$Event[] = [];
    
    // Fetch events from all calendars
    for (const cal of calendars) {
      if (!cal.id) continue;
      
      try {
        const eventsResponse = await withExponentialBackoff(() =>
          calendar.events.list({
            calendarId: cal.id!,
            timeMin,
            timeMax,
            singleEvents: true,
            orderBy: 'startTime',
            maxResults: 250,
          })
        );
        
        const events = eventsResponse.data.items || [];
        // Add calendar info to each event
        events.forEach(event => {
          (event as any).calendarId = cal.id;
          (event as any).calendarName = cal.summary;
        });
        allEvents.push(...events);
      } catch (error: any) {
        console.error(`Error fetching events from calendar ${cal.summary}:`, error);
        // Continue with other calendars even if one fails
      }
    }
    
    // Find conflicting events
    const conflicts: PendingInvite[] = [];
    const processedPairs = new Set<string>();
    
    for (let i = 0; i < allEvents.length; i++) {
      for (let j = i + 1; j < allEvents.length; j++) {
        const event1 = allEvents[i];
        const event2 = allEvents[j];
        
        if (!event1.id || !event2.id) continue;
        
        // Create a unique pair identifier
        const pairId = [event1.id, event2.id].sort().join('|');
        if (processedPairs.has(pairId)) continue;
        
        // Check if events overlap
        if (eventsOverlap(event1, event2)) {
          processedPairs.add(pairId);
          
          // Convert both events to PendingInvite format
          const conflict1 = eventToConflictFormat(event1, userEmail);
          const conflict2 = eventToConflictFormat(event2, userEmail);
          
          if (conflict1 && !conflicts.find(c => c.eventId === conflict1.eventId)) {
            conflicts.push(conflict1);
          }
          if (conflict2 && !conflicts.find(c => c.eventId === conflict2.eventId)) {
            conflicts.push(conflict2);
          }
        }
      }
    }
    
    // Sort by start time
    conflicts.sort((a, b) => 
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
    
    return {
      invites: conflicts,
      dateRange: {
        start: timeMin,
        end: timeMax,
      },
      totalCount: conflicts.length,
    };
  } catch (error: any) {
    console.error('Error fetching conflicting events:', error);
    
    if (error.code === 401) {
      throw new Error('Authentication expired. Please re-authenticate.');
    }
    
    throw new Error(`Failed to fetch conflicting events: ${error.message}`);
  }
}

/**
 * Check if two events overlap in time
 */
function eventsOverlap(event1: calendar_v3.Schema$Event, event2: calendar_v3.Schema$Event): boolean {
  const start1 = event1.start?.dateTime || event1.start?.date;
  const end1 = event1.end?.dateTime || event1.end?.date;
  const start2 = event2.start?.dateTime || event2.start?.date;
  const end2 = event2.end?.dateTime || event2.end?.date;
  
  if (!start1 || !end1 || !start2 || !end2) return false;
  
  const start1Time = new Date(start1).getTime();
  const end1Time = new Date(end1).getTime();
  const start2Time = new Date(start2).getTime();
  const end2Time = new Date(end2).getTime();
  
  // Events overlap if one starts before the other ends
  return start1Time < end2Time && start2Time < end1Time;
}

/**
 * Convert a calendar event to conflict format (similar to PendingInvite)
 */
function eventToConflictFormat(event: calendar_v3.Schema$Event, userEmail: string): PendingInvite | null {
  if (!event.id) return null;
  
  const attendees = event.attendees || [];
  const userAttendee = attendees.find(
    (a) => a.email?.toLowerCase() === userEmail.toLowerCase()
  );
  
  const startInfo = formatDateTime(event.start || {});
  const endInfo = formatDateTime(event.end || {});
  
  return {
    eventId: event.id,
    summary: event.summary || '(No title)',
    description: event.description || null,
    location: event.location || null,
    startTime: startInfo.formatted,
    endTime: endInfo.formatted,
    isAllDay: startInfo.isAllDay,
    organizerEmail: event.organizer?.email || userEmail,
    organizerName: event.organizer?.displayName || null,
    attendees: attendees.map((a) => ({
      email: a.email || 'Unknown',
      name: a.displayName || null,
      status: a.responseStatus || 'unknown',
      comment: a.comment || null,
      self: a.email?.toLowerCase() === userEmail.toLowerCase(),
      organizer: a.organizer || false,
    })),
    calendarLink: event.htmlLink || '',
    userComment: userAttendee?.comment || null,
  };
}

/**
 * Format pending invites as a text summary for MCP responses
 */
export function formatInvitesAsText(invites: PendingInvite[]): string {
  if (invites.length === 0) {
    return 'You have no pending calendar invitations that need a response.';
  }
  
  let text = `You have ${invites.length} pending calendar invitation${invites.length > 1 ? 's' : ''}:\n\n`;
  
  invites.forEach((invite, index) => {
    const startDate = new Date(invite.startTime);
    const dateStr = startDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeStr = invite.isAllDay
      ? 'All day'
      : startDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        });
    
    text += `${index + 1}. **${invite.summary}**\n`;
    text += `   - When: ${dateStr} at ${timeStr}\n`;
    text += `   - Organizer: ${invite.organizerName || invite.organizerEmail}\n`;
    if (invite.location) {
      text += `   - Location: ${invite.location}\n`;
    }
    text += `   - Event ID: ${invite.eventId}\n\n`;
  });
  
  text += '\nYou can accept, decline, or mark as tentative any of these invitations.';
  
  return text;
}

