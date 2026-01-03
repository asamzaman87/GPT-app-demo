import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@openai/apps-sdk-ui/components/Button';
import { Badge } from '@openai/apps-sdk-ui/components/Badge';
import { Check, ArrowRotateCcw } from '@openai/apps-sdk-ui/components/Icon';
import { useWidget } from '../WidgetContext';
import { theme } from '../theme';
import { DateRangeSelector } from './DateRangeSelector';
import type { PendingInvite, PendingInvitesOutput } from '../types';

interface ConflictGroup {
  events: PendingInvite[];
  timeRange: {
    start: string;
    end: string;
  };
}

interface EventState {
  status: 'idle' | 'loading' | 'accepted' | 'declined' | 'tentative' | 'error' | 'rescheduled';
  showCommentInput: boolean;
  comment: string;
  isAddingComment: boolean;
  commentAdded: boolean;
  wasEditing: boolean;
  showRescheduleInput: boolean;
  newStartTime: string;
  newEndTime: string;
  isRescheduling: boolean;
  rescheduled: boolean;
}

function ConflictCard({ group, isDark, onRespond, onCommentAdded, onRescheduled }: { 
  group: ConflictGroup; 
  isDark: boolean;
  onRespond: (eventId: string, eventTitle: string, response: string) => Promise<void>;
  onCommentAdded: (eventId: string, comment: string) => void;
  onRescheduled: () => Promise<void>;
}) {
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [eventStates, setEventStates] = useState<Record<string, EventState>>({});
  const { callTool } = useWidget();

  const getEventState = (eventId: string): EventState => {
    return eventStates[eventId] || {
      status: 'idle',
      showCommentInput: false,
      comment: '',
      isAddingComment: false,
      commentAdded: false,
      wasEditing: false,
      showRescheduleInput: false,
      newStartTime: '',
      newEndTime: '',
      isRescheduling: false,
      rescheduled: false,
    };
  };

  const updateEventState = (eventId: string, updates: Partial<EventState>) => {
    setEventStates(prev => ({
      ...prev,
      [eventId]: { ...getEventState(eventId), ...updates }
    }));
  };

  const handleRespond = async (eventId: string, eventTitle: string, response: 'accepted' | 'declined' | 'tentative') => {
    updateEventState(eventId, { status: 'loading' });
    try {
      await onRespond(eventId, eventTitle, response);
      updateEventState(eventId, { status: response });
    } catch {
      updateEventState(eventId, { status: 'error' });
    }
  };

  const handleAddComment = async (event: PendingInvite) => {
    const state = getEventState(event.eventId);
    if (!state.comment.trim()) return;
    
    const trimmedComment = state.comment.trim();
    const hasExistingComment = !!(event.userComment && event.userComment.trim() !== '');
    
    updateEventState(event.eventId, { isAddingComment: true, wasEditing: hasExistingComment });
    try {
      await callTool('add_comment_to_invite', {
        event_id: event.eventId,
        event_title: event.summary || 'this meeting',
        comment: trimmedComment,
      });
      onCommentAdded(event.eventId, trimmedComment);
      updateEventState(event.eventId, { 
        commentAdded: true,
        showCommentInput: false,
        comment: '',
        isAddingComment: false
      });
      // Auto-hide success message after 3 seconds
      setTimeout(() => {
        updateEventState(event.eventId, { commentAdded: false });
      }, 3000);
    } catch (error) {
      console.error('Failed to add note:', error);
      updateEventState(event.eventId, { status: 'error', isAddingComment: false });
    }
  };

  const handleReschedule = async (event: PendingInvite, startISO: string, endISO: string) => {
    updateEventState(event.eventId, { isRescheduling: true });
    try {
      await callTool('reschedule_event', {
        event_id: event.eventId,
        event_title: event.summary || 'this event',
        calendar_id: event.calendarId || 'primary',
        new_start_time: startISO,
        new_end_time: endISO,
      });
      updateEventState(event.eventId, { 
        rescheduled: true,
        showRescheduleInput: false,
        isRescheduling: false,
        status: 'idle' // Reset to idle so reschedule button shows again
      });
      
      // Refresh the conflicting events list to see if conflicts still exist
      await onRescheduled();
      
      // Auto-hide success message after 3 seconds
      setTimeout(() => {
        updateEventState(event.eventId, { rescheduled: false });
      }, 3000);
    } catch (error) {
      console.error('Failed to reschedule event:', error);
      updateEventState(event.eventId, { status: 'error', isRescheduling: false });
    }
  };
  
  const formatTime = (time: string) => {
    try {
      return new Date(time).toLocaleString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric', 
        hour: 'numeric', 
        minute: '2-digit' 
      });
    } catch { return time; }
  };

  const formatTimeShort = (time: string) => {
    try {
      return new Date(time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } catch { return time; }
  };

  const getAttendeeStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted': return <Badge className="px-2" size="sm" color="success">Accepted</Badge>;
      case 'declined': return <Badge className="px-2.5" size="sm" color="danger">Declined</Badge>;
      case 'tentative': return <Badge className="px-4" size="sm" color="warning">Maybe</Badge>;
      case 'needsAction': return <Badge size="sm" className="bg-gray-500 px-3 text-white">Pending</Badge>;
      default: return <Badge size="sm" className="bg-gray-400 px-2 text-white">{status}</Badge>;
    }
  };

  const handleStartTimeChange = (eventId: string, newStartTime: string, event: PendingInvite) => {
    const state = getEventState(eventId);
    const currentStartTime = state.newStartTime;
    const currentEndTime = state.newEndTime;
    
    if (newStartTime && currentStartTime && currentEndTime) {
      // Calculate the current duration between start and end
      const currentStartDate = new Date(currentStartTime);
      const currentEndDate = new Date(currentEndTime);
      const duration = currentEndDate.getTime() - currentStartDate.getTime();
      
      // Apply the same duration to the new start time
      const newStartDate = new Date(newStartTime);
      const newEndDate = new Date(newStartDate.getTime() + duration);
      
      // Format for datetime-local input (YYYY-MM-DDTHH:mm) in local time
      const year = newEndDate.getFullYear();
      const month = String(newEndDate.getMonth() + 1).padStart(2, '0');
      const day = String(newEndDate.getDate()).padStart(2, '0');
      const hours = String(newEndDate.getHours()).padStart(2, '0');
      const minutes = String(newEndDate.getMinutes()).padStart(2, '0');
      const newEndTimeStr = `${year}-${month}-${day}T${hours}:${minutes}`;
      
      updateEventState(eventId, { 
        newStartTime: newStartTime,
        newEndTime: newEndTimeStr
      });
      return;
    }
    
    updateEventState(eventId, { newStartTime: newStartTime });
  };

  const handleEndTimeChange = (eventId: string, newEndTime: string) => {
    const state = getEventState(eventId);
    const currentStartTime = state.newStartTime;
    
    // Prevent setting end time before start time
    if (newEndTime && currentStartTime) {
      const startDate = new Date(currentStartTime);
      const endDate = new Date(newEndTime);
      
      if (endDate <= startDate) {
        // Don't update if end time would be before or equal to start time
        return;
      }
    }
    
    updateEventState(eventId, { newEndTime: newEndTime });
  };

  const handleDateTimeClick = (e: React.MouseEvent<HTMLInputElement>) => {
    try {
      (e.target as HTMLInputElement).showPicker?.();
    } catch (err) {
      // Fallback for browsers that don't support showPicker()
      console.log('showPicker not supported');
    }
  };

  const handleRescheduleClick = (eventId: string, event: PendingInvite) => {
    const state = getEventState(eventId);
    
    // Validate that start time is before end time
    const startDate = new Date(state.newStartTime);
    const endDate = new Date(state.newEndTime);
    
    if (startDate >= endDate) {
      console.error('Start time must be before end time');
      return;
    }
    
    // Convert datetime-local to ISO format with seconds
    const startISO = startDate.toISOString();
    const endISO = endDate.toISOString();
    handleReschedule(event, startISO, endISO);
  };

  return (
    <div className={`rounded-xl border-2 border-red-500 p-4 ${theme.card(isDark)}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">⚠️</span>
            <h3 className={`font-semibold ${theme.textPrimary(isDark)}`}>
              {group.events.length} Conflicting Events
            </h3>
          </div>
          <p className={`text-sm ${theme.textPrimary(isDark)} opacity-75`}>
            {formatTime(group.timeRange.start)} - {formatTimeShort(group.timeRange.end)}
          </p>
        </div>
        <Badge color="danger" className="shrink-0">Conflict</Badge>
      </div>

      {/* Conflicting Events List */}
      <div className="space-y-3">
        {group.events.map((event, idx) => {
          const isExpanded = expandedEventId === event.eventId;
          
          return (
            <div key={event.eventId} className={`p-3 rounded-lg border ${theme.card(isDark)}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${theme.textPrimary(isDark)}`}>
                      #{idx + 1}
                    </span>
                    <h4 className={`font-semibold ${theme.textPrimary(isDark)}`}>
                      {event.summary}
                    </h4>
                  </div>
                </div>
              </div>

              {/* Compact view */}
              {!isExpanded && (
                <>
                  <div className={`text-xs space-y-1 ${theme.textPrimary(isDark)} opacity-75`}>
                    <div className="flex items-center gap-2">
                      <span>🕐</span>
                      <span>{formatTimeShort(event.startTime)} - {formatTimeShort(event.endTime)}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span>👤</span>
                      <span>
                        {event.organizerName || event.organizerEmail}
                        {event.organizerEmail === event.attendees?.find(a => a.self)?.email && ' (You)'}
                      </span>
                    </div>

                    {event.location && (
                      <div className="flex items-center gap-2">
                        <span>📍</span>
                        <span className="truncate">{event.location}</span>
                      </div>
                    )}

                    {/* Attendees count */}
                    {event.attendees && event.attendees.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span>👥</span>
                        <span>{event.attendees.length} attendee{event.attendees.length !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={() => setExpandedEventId(event.eventId)}
                    className={`w-full mt-2 text-xs py-2 px-3 rounded-lg ${theme.textPrimary(isDark)} ${theme.buttonBorder(isDark)} ${theme.buttonShadow()} hover:bg-opacity-80 transition-colors ${theme.card(isDark)}`}
                  >
                    Show Details
                  </button>
                </>
              )}

              {/* Expanded detailed view */}
              {isExpanded && (
                <>
                  {/* Organizer */}
                  <div className={`mb-2 p-2 rounded-lg border ${theme.card(isDark)}`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold uppercase tracking-wide ${theme.textPrimary(isDark)}`}>Organizer</span>
                    </div>
                    <p className={`text-sm font-medium mt-1 ${theme.textPrimary(isDark)}`}>
                      {event.organizerName || event.organizerEmail}
                    </p>
                    {event.organizerName && !event.organizerEmail?.includes('@group.calendar.google.com') && (
                      <p className={`text-xs mt-0.5 ${theme.textPrimary(isDark)}`}>{event.organizerEmail}</p>
                    )}
                  </div>

                  {/* Time and Location */}
                  <div className={`text-sm space-y-2 mb-2 ${theme.textPrimary(isDark)}`}>
                    <div className="flex items-start gap-2">
                      <span className="shrink-0">📅</span>
                      <div>
                        <p>{formatTime(event.startTime)}</p>
                        {event.endTime && (
                          <p className={`text-xs mt-0.5 ${theme.textPrimary(isDark)}`}>
                            Until {formatTimeShort(event.endTime)}
                          </p>
                        )}
                      </div>
                    </div>
                    {event.location && (
                      <div className="flex items-start gap-2">
                        <span className="shrink-0">📍</span>
                        <p>{event.location}</p>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  {event.description && (
                    <div className={`mb-2 p-2 rounded-lg ${isDark ? 'bg-slate-800/30' : 'bg-slate-50'}`}>
                      <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${theme.textPrimary(isDark)}`}>Description</p>
                      <p className={`text-sm whitespace-pre-wrap ${theme.textPrimary(isDark)}`}>
                        {event.description}
                      </p>
                    </div>
                  )}

                  {/* Attendees List */}
                  {event.attendees && event.attendees.length > 0 && (
                    <div className={`mb-2 p-2 rounded-lg border ${theme.card(isDark)}`}>
                      <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${theme.textPrimary(isDark)}`}>
                        Attendees ({event.attendees.length})
                      </p>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {event.attendees.map((attendee, attendeeIdx) => (
                          <div key={attendeeIdx} className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm truncate ${theme.textPrimary(isDark)}`}>
                                {attendee.name || attendee.email}
                              </p>
                              {attendee.name && (
                                <p className={`text-xs truncate ${theme.textPrimary(isDark)}`}>{attendee.email}</p>
                              )}
                              {attendee.comment && (
                                <p className={`text-xs mt-1 italic ${theme.textPrimary(isDark)} opacity-75`}>
                                  {attendee.comment}
                                </p>
                              )}
                            </div>
                            <div className="shrink-0">
                              {getAttendeeStatusBadge(attendee.status)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className={`pt-2 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    {(() => {
                      const state = getEventState(event.eventId);
                      const hasExistingComment = !!(event.userComment && event.userComment.trim() !== '');
                      
                      // Find user's current response status from attendees list
                      const userAttendee = event.attendees?.find(a => a.self);
                      const userResponseStatus = userAttendee?.status || 'needsAction';
                      const hasResponded = userResponseStatus !== 'needsAction';

                      return (
                        <>
                          {/* Show success message when note is added/updated */}
                          {state.commentAdded && (
                            <div className="mb-2">
                              <Badge className='w-full justify-center p-2' color="success">
                                Note {state.wasEditing ? 'updated' : 'sent'} successfully
                              </Badge>
                            </div>
                          )}

                          {/* Show action buttons only if user hasn't responded yet */}
                          {!hasResponded && state.status === 'idle' && (
                            <div className="grid grid-cols-3 gap-2 mb-2">
                              <Button className={`rounded-xl py-3 text-white ${theme.buttonBorder(isDark)} ${theme.buttonShadow()}`} color="success" size="sm" block onClick={() => handleRespond(event.eventId, event.summary, 'accepted')}>Accept</Button>
                              <Button className={`rounded-xl py-3 text-white ${theme.buttonBorder(isDark)} ${theme.buttonShadow()}`} color="warning" size="sm" block onClick={() => handleRespond(event.eventId, event.summary, 'tentative')}>Maybe</Button>
                              <Button className={`rounded-xl py-3 text-white ${theme.buttonBorder(isDark)} ${theme.buttonShadow()}`} color="danger" size="sm" block onClick={() => handleRespond(event.eventId, event.summary, 'declined')}>Decline</Button>
                            </div>
                          )}

                          {/* Show current response status if already responded */}
                          {hasResponded && state.status === 'idle' && (
                            <div className="mb-2 text-center">
                              <Badge className='p-3' color={userResponseStatus === 'accepted' ? 'success' : userResponseStatus === 'declined' ? 'danger' : 'warning'}>
                                {userResponseStatus === 'accepted' ? '✓ You Accepted' : userResponseStatus === 'declined' ? '✗ You Declined' : '? You Responded Maybe'}
                              </Badge>
                            </div>
                          )}

                          {/* Note Section - Always shown */}
                          {state.status === 'idle' && (
                            <>
                              {!state.showCommentInput ? (
                                <button 
                                  onClick={() => {
                                    updateEventState(event.eventId, { 
                                      showCommentInput: true,
                                      comment: hasExistingComment ? (event.userComment || '') : ''
                                    });
                                  }}
                                  className={`w-full text-sm py-2 px-3 rounded-lg ${theme.textPrimary(isDark)} ${theme.buttonBorder(isDark)} ${theme.buttonShadow()} hover:bg-opacity-80 transition-colors ${theme.card(isDark)}`}
                                >
                                  {hasExistingComment ? 'Edit note' : 'Add a note'}
                                </button>
                              ) : (
                                <div className={`mt-2 p-3 rounded-lg ${theme.card(isDark)}`}>
                                  <textarea
                                    value={state.comment}
                                    onChange={(e) => updateEventState(event.eventId, { comment: e.target.value })}
                                    placeholder={hasExistingComment 
                                      ? "Edit your note..." 
                                      : "Add a note (e.g., I might be 5 minutes late)"
                                    }
                                    className={`w-full p-2 text-sm rounded-lg border resize-none ${theme.textPrimary(isDark)} ${theme.card(isDark)} ${theme.buttonBorder(isDark)} ${theme.buttonShadow()}`}
                                    rows={3}
                                    disabled={state.isAddingComment}
                                  />
                                  <div className="flex gap-2 mt-2">
                                    <button 
                                      className={`flex-1 rounded-lg py-1 ${theme.buttonShadow()} ${theme.textPrimary(isDark)} ${theme.buttonBorder(isDark)}`}
                                      onClick={() => handleAddComment(event)}
                                      disabled={!state.comment.trim() || state.isAddingComment}
                                    >
                                      {state.isAddingComment ? 'Sending...' : 'Send'}
                                    </button>
                                    <button 
                                      className={`rounded-lg py-1 px-2 ${theme.textPrimary(isDark)} ${theme.buttonBorder(isDark)} ${theme.buttonShadow()}`}
                                      onClick={() => updateEventState(event.eventId, { showCommentInput: false, comment: '' })}
                                      disabled={state.isAddingComment}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}
                            </>
                          )}

                          {/* Reschedule Section - Only for organizers or creators */}
                          {(() => {
                            const userAttendee = event.attendees?.find(a => a.self);
                            const isOrganizer = userAttendee?.organizer === true;
                            const isCreator = event.isCreator === true;
                            const canReschedule = isOrganizer || isCreator;
                            
                            return canReschedule && (
                              <>
                                {!state.showRescheduleInput ? (
                                  <button 
                                    onClick={() => {
                                      // Pre-fill with current event times in datetime-local format
                                      const startDateTime = new Date(event.startTime);
                                      const endDateTime = new Date(event.endTime);
                                      
                                      // Format as YYYY-MM-DDTHH:mm for datetime-local input
                                      const formatForInput = (date: Date) => {
                                        const year = date.getFullYear();
                                        const month = String(date.getMonth() + 1).padStart(2, '0');
                                        const day = String(date.getDate()).padStart(2, '0');
                                        const hours = String(date.getHours()).padStart(2, '0');
                                        const minutes = String(date.getMinutes()).padStart(2, '0');
                                        return `${year}-${month}-${day}T${hours}:${minutes}`;
                                      };
                                      
                                      updateEventState(event.eventId, { 
                                        showRescheduleInput: true,
                                        newStartTime: formatForInput(startDateTime),
                                        newEndTime: formatForInput(endDateTime)
                                      });
                                    }}
                                    className={`w-full text-sm py-2 px-3 rounded-lg mt-2 ${theme.textPrimary(isDark)} ${theme.buttonBorder(isDark)} ${theme.buttonShadow()} hover:bg-opacity-80 transition-colors`}
                                  >
                                    Reschedule Event
                                  </button>
                                ) : (
                                  <div className={`mt-2 p-3 rounded-lg border ${theme.card(isDark)}`}>
                                    <p className={`text-xs font-semibold mb-2 ${theme.textPrimary(isDark)}`}>Reschedule Event</p>
                                    <div className="space-y-2">
                                      <div>
                                        <label className={`text-xs ${theme.textPrimary(isDark)} opacity-75`}>Start Time</label>
                                        <input
                                          type="datetime-local"
                                          value={state.newStartTime}
                                          onChange={(e) => handleStartTimeChange(event.eventId, e.target.value, event)}
                                          onClick={handleDateTimeClick}
                                          className={`w-full p-2 text-sm rounded-lg border ${theme.textPrimary(isDark)} ${theme.card(isDark)} ${theme.buttonBorder(isDark)} cursor-pointer ${isDark ? 'datetime-dark-mode' : ''}`}
                                          style={isDark ? { colorScheme: 'dark' } : undefined}
                                          disabled={state.isRescheduling}
                                        />
                                      </div>
                                      <div>
                                        <label className={`text-xs ${theme.textPrimary(isDark)} opacity-75`}>End Time</label>
                                        <input
                                          type="datetime-local"
                                          value={state.newEndTime}
                                          onChange={(e) => handleEndTimeChange(event.eventId, e.target.value)}
                                          onClick={handleDateTimeClick}
                                          className={`w-full p-2 text-sm rounded-lg border ${theme.textPrimary(isDark)} ${theme.card(isDark)} ${theme.buttonBorder(isDark)} cursor-pointer ${isDark ? 'datetime-dark-mode' : ''}`}
                                          style={isDark ? { colorScheme: 'dark' } : undefined}
                                          disabled={state.isRescheduling}
                                        />
                                      </div>
                                    </div>
                                    <div className="flex gap-2 mt-3">
                                      <button 
                                        className={`flex-1 rounded-lg py-1.5 text-sm ${theme.buttonShadow()} ${theme.textPrimary(isDark)} ${theme.buttonBorder(isDark)}`}
                                        onClick={() => handleRescheduleClick(event.eventId, event)}
                                        disabled={!state.newStartTime || !state.newEndTime || state.isRescheduling}
                                      >
                                        {state.isRescheduling ? 'Rescheduling...' : 'Reschedule'}
                                      </button>
                                      <button 
                                        className={`rounded-lg py-1.5 px-3 text-sm ${theme.textPrimary(isDark)} ${theme.buttonBorder(isDark)} ${theme.buttonShadow()}`}
                                        onClick={() => updateEventState(event.eventId, { showRescheduleInput: false })}
                                        disabled={state.isRescheduling}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </>
                            );
                          })()}

                          {/* Show rescheduled success message */}
                          {state.rescheduled && (
                            <div className="mt-2">
                              <Badge className='w-full justify-center p-2' color="success">
                                Event rescheduled successfully
                              </Badge>
                            </div>
                          )}

                          {state.status === 'loading' && <div className={`text-center py-2 text-sm ${theme.textPrimary(isDark)}`}>Sending...</div>}
                          {(state.status === 'accepted' || state.status === 'declined' || state.status === 'tentative') && (
                            <div className="text-center"><Badge className='p-3' color={state.status === 'accepted' ? 'success' : state.status === 'declined' ? 'danger' : 'warning'}>{state.status === 'accepted' ? '✓ Accepted' : state.status === 'declined' ? '✗ Declined' : '? Maybe'}</Badge></div>
                          )}
                          {state.status === 'error' && <div className="text-center"><Badge color="danger">Failed</Badge></div>}
                        </>
                      );
                    })()}
                  </div>

                  <button 
                    onClick={() => setExpandedEventId(null)}
                    className={`w-full mt-2 text-xs py-2 px-3 rounded-lg ${theme.textPrimary(isDark)} ${theme.buttonBorder(isDark)} ${theme.buttonShadow()} hover:bg-opacity-80 transition-colors ${theme.card(isDark)}`}
                  >
                    Hide Details
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ConflictsView() {
  const { isDark, invitesData, setInvitesData, callTool, setWidgetState, notifyHeight } = useWidget();
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => { notifyHeight(); }, [invitesData, isRefreshing, notifyHeight]);

  const handleRespond = async (eventId: string, eventTitle: string, response: string) => {
    try {
      await callTool('respond_to_invite', { event_id: eventId, event_title: eventTitle, response });
      // Response is shown inline in the ConflictCard
    } catch (err) {
      console.error('[Widget] Failed to respond:', err);
      throw err;
    }
  };

  const handleCommentAdded = (eventId: string, comment: string) => {
    // Update the invitesData to reflect the new comment
    if (invitesData && invitesData.invites) {
      const updatedInvites = invitesData.invites.map(invite => {
        if (invite.eventId === eventId) {
          // Also update the current user's attendee comment in the attendees list
          const updatedAttendees = invite.attendees?.map(attendee => 
            attendee.self ? { ...attendee, comment } : attendee
          );
          return { 
            ...invite, 
            userComment: comment,
            attendees: updatedAttendees || invite.attendees
          };
        }
        return invite;
      });
      setInvitesData({ ...invitesData, invites: updatedInvites });
    }
  };

  const handleRefresh = async (customStartDate?: string, customEndDate?: string) => {
    try {
      setIsRefreshing(true);
      const args: { start_date?: string; end_date?: string } = {};
      
      if (customStartDate) args.start_date = customStartDate;
      if (customEndDate) args.end_date = customEndDate;
      
      const result = await callTool('get_conflicting_events', args) as { structuredContent?: PendingInvitesOutput };
      if (result?.structuredContent) {
        setInvitesData(result.structuredContent);
        setWidgetState({ view: 'conflicts', conflicts: result.structuredContent });
      }
    } catch (err) {
      console.error('[Widget] Failed to refresh conflicts:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRescheduled = async () => {
    // Refetch conflicting events after rescheduling
    // This ensures we only show events that still have conflicts
    await handleRefresh();
  };

  const handleBack = () => {
    navigate('/');
  };

  if (!invitesData) {
    return (
      <div className={`p-6 rounded-xl border shadow-sm ${theme.card(isDark)}`}>
        <p className={`text-center ${theme.textPrimary(isDark)}`}>No conflicts data</p>
        <div className="flex justify-center mt-4">
          <Button variant="outline" color="secondary" size="sm" onClick={handleBack}>
            ← Back
          </Button>
        </div>
      </div>
    );
  }

  // Group events by their overlaps
  const conflictGroups: ConflictGroup[] = [];
  const processedEvents = new Set<string>();
  const events = invitesData.invites || [];

  const eventsOverlap = (event1: PendingInvite, event2: PendingInvite): boolean => {
    const start1 = new Date(event1.startTime).getTime();
    const end1 = new Date(event1.endTime).getTime();
    const start2 = new Date(event2.startTime).getTime();
    const end2 = new Date(event2.endTime).getTime();
    return start1 < end2 && start2 < end1;
  };

  // Build conflict groups using union-find approach
  for (let i = 0; i < events.length; i++) {
    if (processedEvents.has(events[i].eventId)) continue;
    
    const group: PendingInvite[] = [events[i]];
    processedEvents.add(events[i].eventId);
    
    // Find all events that conflict with any event in the current group
    let foundNew = true;
    while (foundNew) {
      foundNew = false;
      for (let j = 0; j < events.length; j++) {
        if (processedEvents.has(events[j].eventId)) continue;
        
        // Check if this event conflicts with any event in the group
        for (const groupEvent of group) {
          if (eventsOverlap(events[j], groupEvent)) {
            group.push(events[j]);
            processedEvents.add(events[j].eventId);
            foundNew = true;
            break;
          }
        }
      }
    }
    
    // Calculate the overall time range for this conflict group
    const startTimes = group.map(e => new Date(e.startTime).getTime());
    const endTimes = group.map(e => new Date(e.endTime).getTime());
    
    conflictGroups.push({
      events: group.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
      timeRange: {
        start: new Date(Math.min(...startTimes)).toISOString(),
        end: new Date(Math.max(...endTimes)).toISOString(),
      },
    });
  }

  return (
    <div className={`rounded-xl border shadow-sm ${theme.card(isDark)}`}>
      {conflictGroups.length === 0 ? (
        <div className="p-6">
          <div className="mb-4">
            <DateRangeSelector
              isDark={isDark}
              isRefreshing={isRefreshing}
              onRangeChange={handleRefresh}
            />
          </div>

          {isRefreshing && (
            <div className={`flex items-center justify-center gap-2 py-2 mb-4 rounded-lg ${theme.surface(isDark)}`}>
              <div className={`size-4 rounded-full border-2 border-t-blue-500 animate-spin ${theme.spinner(isDark)}`} />
              <span className={`text-sm ${theme.textPrimary(isDark)}`}>Refreshing...</span>
            </div>
          )}

          <div className="py-8 text-center">
            <div className={`size-16 mx-auto rounded-2xl flex items-center justify-center mb-4 bg-green-600`}>
              <Check className="size-8 text-white" />
            </div>
            <h2 className={`text-xl font-semibold mb-2 ${theme.textPrimary(isDark)}`}>No Conflicts!</h2>
            <p className={`text-sm mb-6 ${theme.textPrimary(isDark)}`}>Your calendar is conflict-free in this date range.</p>
            <button 
              className={`${theme.textPrimary(isDark)} m-auto flex items-center justify-center p-4 rounded-xl ${theme.buttonBorder(isDark)} ${theme.buttonShadow()}`} 
              onClick={() => handleRefresh()} 
              disabled={isRefreshing}
            >
              <ArrowRotateCcw className="size-4 mr-2" />
              Refresh
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`size-10 rounded-xl flex items-center justify-center bg-red-100 dark:bg-red-900/30`}>
                <span className="text-2xl">⚠️</span>
              </div>
              <h1 className={`text-lg font-semibold ${theme.textPrimary(isDark)}`}>
                {conflictGroups.length} Conflict{conflictGroups.length !== 1 ? 's' : ''}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Button className={`${theme.textPrimary(isDark)} p-2 rounded-xl ${theme.buttonBorder(isDark)} ${theme.buttonShadow()}`} variant="ghost" color="secondary" size="sm" onClick={() => handleRefresh()} disabled={isRefreshing}>
                <ArrowRotateCcw className="size-5" />
              </Button>
            </div>
          </div>

          <div className="mb-4">
            <DateRangeSelector
              isDark={isDark}
              isRefreshing={isRefreshing}
              onRangeChange={handleRefresh}
            />
          </div>

          {isRefreshing && (
            <div className={`flex items-center justify-center gap-2 py-2 mb-3 rounded-lg ${theme.surface(isDark)}`}>
              <div className={`size-4 rounded-full border-2 border-t-blue-500 animate-spin ${theme.spinner(isDark)}`} />
              <span className={`text-sm ${theme.textPrimary(isDark)}`}>Refreshing...</span>
            </div>
          )}

          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {conflictGroups.map((group, idx) => (
              <ConflictCard 
                key={idx} 
                group={group} 
                isDark={isDark} 
                onRespond={handleRespond}
                onCommentAdded={handleCommentAdded}
                onRescheduled={handleRescheduled}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

