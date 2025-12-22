import { useEffect, useState, useCallback, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useOpenAI } from './useOpenAI';
import type { AuthStatusOutput, PendingInvitesOutput, PendingInvite, RespondResultOutput } from './types';
import { Button } from '@openai/apps-sdk-ui/components/Button';
import { Badge } from '@openai/apps-sdk-ui/components/Badge';
import { Calendar, Check, X } from '@openai/apps-sdk-ui/components/Icon';
import './main.css';

// ============================================
// Context for sharing data between views
// ============================================
interface WidgetContextType {
  theme: 'light' | 'dark';
  isDark: boolean;
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  openExternal: (options: { href: string }) => void;
  notifyHeight: () => void;
  setWidgetState: (state: Record<string, unknown>) => void;
  invitesData: PendingInvitesOutput | null;
  setInvitesData: (data: PendingInvitesOutput | null) => void;
  respondData: RespondResultOutput | null;
  setRespondData: (data: RespondResultOutput | null) => void;
}

const WidgetContext = createContext<WidgetContextType | null>(null);

function useWidget() {
  const ctx = useContext(WidgetContext);
  if (!ctx) throw new Error('useWidget must be used within WidgetProvider');
  return ctx;
}

// ============================================
// Auth View (/ route)
// ============================================
function AuthView({ authData }: { authData: AuthStatusOutput | null }) {
  const { isDark, callTool, openExternal, setWidgetState, setInvitesData, notifyHeight } = useWidget();
  const navigate = useNavigate();
  const [isPolling, setIsPolling] = useState(false);
  const [isLoadingInvites, setIsLoadingInvites] = useState(false);
  const [localAuthData, setLocalAuthData] = useState<AuthStatusOutput | null>(authData);

  // Use localAuthData if we've updated it via polling, otherwise use initial authData
  const currentAuth = localAuthData || authData;
  const isAuthenticated = currentAuth?.authenticated ?? false;

  useEffect(() => { notifyHeight(); }, [isAuthenticated, isPolling, notifyHeight]);

  // Polling for auth status
  useEffect(() => {
    if (!isPolling) return;
    
    const pollInterval = setInterval(async () => {
      try {
        const result = await callTool('check_auth_status', {}) as { structuredContent?: AuthStatusOutput };
        if (result?.structuredContent?.authenticated) {
          setLocalAuthData(result.structuredContent);
          setWidgetState({ authenticated: true, email: result.structuredContent.email });
          setIsPolling(false);
        }
      } catch (err) {
        console.error('[Widget] Poll error:', err);
      }
    }, 3000);

    // Stop after 5 minutes
    const timeout = setTimeout(() => setIsPolling(false), 5 * 60 * 1000);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
    };
  }, [isPolling, callTool, setWidgetState]);

  const handleConnect = () => {
    if (currentAuth?.authUrl) {
      openExternal({ href: currentAuth.authUrl });
      setIsPolling(true);
    }
  };

  const handleViewInvites = async () => {
    try {
      setIsLoadingInvites(true);
      const result = await callTool('get_pending_reservations', {}) as { structuredContent?: PendingInvitesOutput };
      if (result?.structuredContent) {
        setInvitesData(result.structuredContent);
        setWidgetState({ view: 'invites', invites: result.structuredContent });
        navigate('/invites');
      }
    } catch (err) {
      console.error('[Widget] Failed to get invites:', err);
    } finally {
      setIsLoadingInvites(false);
    }
  };

  // Connected State
  if (isAuthenticated) {
    return (
      <div className={`p-6 rounded-xl border shadow-sm ${isDark ? 'bg-white border-gray-200' : 'bg-zinc-900 border-zinc-700'}`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`size-12 rounded-xl flex items-center justify-center ${isDark ? 'bg-green-50' : 'bg-green-900/30'}`}>
              <Check className="size-6 text-green-500" />
            </div>
            <div>
              <h2 className={`text-lg font-semibold ${isDark ? 'text-gray-900' : 'text-white'}`}>Connected</h2>
              <p className={`text-sm ${isDark ? 'text-black' : 'text-zinc-400'}`}>Google Calendar linked</p>
            </div>
          </div>
          <Badge color="success">Active</Badge>
        </div>

        {currentAuth?.email && (
          <div className={`mb-6 p-4 rounded-xl border ${isDark ? 'bg-gray-50 border-gray-200' : 'bg-zinc-800 border-zinc-700'}`}>
            <p className={`text-xs uppercase tracking-wide font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-zinc-500'}`}>Signed in as</p>
            <p className={`text-sm font-medium ${isDark ? 'text-gray-900' : 'text-white'}`}>{currentAuth.email}</p>
          </div>
        )}

        <Button color="primary" block onClick={handleViewInvites} disabled={isLoadingInvites}>
          {isLoadingInvites ? (
            <>
              <div className="size-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <Calendar />
              View Pending Invites
            </>
          )}
        </Button>
      </div>
    );
  }

  // Not Connected State
  return (
    <div className={`p-6 rounded-xl border shadow-sm ${isDark ? 'bg-white border-gray-200' : 'bg-zinc-900 border-zinc-700'}`}>
      <div className="flex flex-col items-center text-center">
        <div className={`size-14 rounded-xl flex items-center justify-center mb-4 ${isDark ? 'bg-gray-100' : 'bg-zinc-800'}`}>
          <Calendar className="size-7 text-primary" />
        </div>
        
        <h2 className={`text-lg font-semibold mb-2 ${isDark ? 'text-black' : 'text-white'}`}>
          {isPolling ? 'Waiting for Sign In...' : 'Connect Google Calendar'}
        </h2>
        
        <p className={`text-sm mb-6 max-w-[280px] ${isDark ? 'text-black' : 'text-zinc-400'}`}>
          {isPolling 
            ? 'Complete the sign-in in the new tab. This will update automatically.'
            : 'Link your Google account to manage calendar invitations directly from ChatGPT'
          }
        </p>

        {isPolling ? (
          <div className="flex flex-col items-center gap-3 py-2">
            <div className={`size-6 rounded-full border-2 border-t-primary animate-spin ${isDark ? 'border-gray-300' : 'border-zinc-600'}`} />
            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-zinc-500'}`}>
              Checking every few seconds...
            </p>
          </div>
        ) : currentAuth?.authUrl ? (
          <Button variant="outline" className='text-black' color="primary" block onClick={handleConnect}>
            <svg className="size-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </Button>
        ) : (
          <div className="flex items-center justify-center gap-2 py-3">
            <div className={`size-4 rounded-full border-2 border-t-primary animate-spin ${isDark ? 'border-gray-300' : 'border-zinc-600'}`} />
            <p className={`text-sm ${isDark ? 'text-black' : 'text-zinc-400'}`}>Loading...</p>
          </div>
        )}

        <p className={`text-xs mt-4 ${isDark ? 'text-gray-400' : 'text-zinc-500'}`}>
          We only access your calendar events.
        </p>
      </div>
    </div>
  );
}

// ============================================
// Invites View (/invites route)
// ============================================
function InviteCard({ invite, onRespond }: { invite: PendingInvite; onRespond: (eventId: string, response: string) => Promise<void> }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'accepted' | 'declined' | 'tentative' | 'error'>('idle');

  const handleRespond = async (response: 'accepted' | 'declined' | 'tentative') => {
    setStatus('loading');
    try {
      await onRespond(invite.eventId, response);
      setStatus(response);
    } catch {
      setStatus('error');
    }
  };

  const formatTime = (time: string) => {
    try {
      return new Date(time).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch { return time; }
  };

  return (
    <div className="rounded-2xl border border-default bg-surface shadow-sm p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="heading-md truncate">{invite.summary}</h3>
          <p className="text-sm text-secondary mt-1">{invite.organizerName || invite.organizerEmail}</p>
        </div>
        <Badge color="warning">Pending</Badge>
      </div>
      
      <div className="text-sm text-secondary mb-3">
        <p>📅 {formatTime(invite.startTime)}</p>
        {invite.location && <p>📍 {invite.location}</p>}
      </div>

      <div className="pt-3 border-t border-subtle">
        {status === 'idle' && (
          <div className="grid grid-cols-3 gap-2">
            <Button variant="soft" color="success" size="sm" block onClick={() => handleRespond('accepted')}>Accept</Button>
            <Button variant="soft" color="warning" size="sm" block onClick={() => handleRespond('tentative')}>Maybe</Button>
            <Button variant="soft" color="danger" size="sm" block onClick={() => handleRespond('declined')}>Decline</Button>
          </div>
        )}
        {status === 'loading' && <div className="text-center py-2 text-secondary text-sm">Sending...</div>}
        {(status === 'accepted' || status === 'declined' || status === 'tentative') && (
          <div className="text-center"><Badge color={status === 'accepted' ? 'success' : status === 'declined' ? 'danger' : 'warning'}>{status === 'accepted' ? '✓ Accepted' : status === 'declined' ? '✗ Declined' : '? Maybe'}</Badge></div>
        )}
        {status === 'error' && <div className="text-center"><Badge color="danger">Failed</Badge></div>}
      </div>
    </div>
  );
}

function InvitesView() {
  const { isDark, invitesData, callTool, setRespondData, setWidgetState, notifyHeight } = useWidget();
  const navigate = useNavigate();

  useEffect(() => { notifyHeight(); }, [invitesData, notifyHeight]);

  const handleRespond = async (eventId: string, response: string) => {
    try {
      const result = await callTool('respond_to_invite', { event_id: eventId, response }) as { structuredContent?: RespondResultOutput };
      if (result?.structuredContent) {
        setRespondData(result.structuredContent);
        setWidgetState({ view: 'result', result: result.structuredContent });
        navigate('/result');
      }
    } catch (err) {
      console.error('[Widget] Failed to respond:', err);
      throw err;
    }
  };

  const handleBack = () => {
    navigate('/');
  };

  if (!invitesData) {
    return (
      <div className={isDark ? 'dark' : ''}>
        <div className="bg-surface rounded-xl p-6 text-center">
          <p className="text-secondary">No invites data</p>
          <Button variant="outline" color="secondary" size="sm" onClick={handleBack} className="mt-4">
            ← Back
          </Button>
        </div>
      </div>
    );
  }

  const invites = invitesData.invites || [];

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="bg-surface rounded-xl">
        {invites.length === 0 ? (
          <div className="py-16 text-center">
            <div className="size-16 mx-auto rounded-2xl bg-success-soft flex items-center justify-center mb-4">
              <Check className="size-8 text-success" />
            </div>
            <h2 className="heading-lg mb-2">All Caught Up!</h2>
            <p className="text-secondary text-sm mb-4">No pending invitations.</p>
            <Button variant="outline" color="secondary" size="sm" onClick={handleBack}>
              ← Back to Status
            </Button>
          </div>
        ) : (
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Button variant="ghost" color="secondary" size="sm" onClick={handleBack}>
                  ←
                </Button>
                <div className="size-10 rounded-xl bg-primary-soft flex items-center justify-center">
                  <Calendar className="size-5 text-primary" />
                </div>
                <h1 className="heading-md">Pending Invites</h1>
              </div>
              <Badge color="primary">{invites.length}</Badge>
            </div>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {invites.map((invite) => (
                <InviteCard key={invite.eventId} invite={invite} onRespond={handleRespond} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Result View (/result route)
// ============================================
function ResultView() {
  const { isDark, respondData, notifyHeight } = useWidget();
  const navigate = useNavigate();

  useEffect(() => { notifyHeight(); }, [respondData, notifyHeight]);

  const handleBack = () => {
    navigate('/invites');
  };

  if (!respondData) {
    return (
      <div className={isDark ? 'dark' : ''}>
        <div className="bg-surface rounded-xl p-6 text-center">
          <p className="text-secondary">No result data</p>
          <Button variant="outline" color="secondary" size="sm" onClick={handleBack} className="mt-4">
            ← Back
          </Button>
        </div>
      </div>
    );
  }

  const isAccepted = respondData.response === 'accepted';
  const isDeclined = respondData.response === 'declined';
  const action = isAccepted ? 'Accepted' : isDeclined ? 'Declined' : 'Marked as Maybe';
  const badgeColor = isAccepted ? 'success' : isDeclined ? 'danger' : 'warning';
  const bgClass = isAccepted ? 'bg-success-soft' : isDeclined ? 'bg-danger-soft' : 'bg-warning-soft';
  const iconClass = isAccepted ? 'text-success' : isDeclined ? 'text-danger' : 'text-warning';

  if (!respondData.success) {
    return (
      <div className={isDark ? 'dark' : ''}>
        <div className="bg-surface rounded-xl overflow-hidden p-6 text-center">
          <div className="size-16 mx-auto rounded-2xl bg-danger-soft flex items-center justify-center mb-4">
            <X className="size-8 text-danger" />
          </div>
          <h2 className="heading-lg mb-2">Something Went Wrong</h2>
          <Badge color="danger">Failed</Badge>
          <p className="text-danger text-sm mt-4">{respondData.error || 'Please try again.'}</p>
          <Button variant="outline" color="secondary" size="sm" onClick={handleBack} className="mt-4">
            ← Back to Invites
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="bg-surface rounded-xl overflow-hidden p-6 text-center">
        <div className={`size-16 mx-auto rounded-2xl ${bgClass} flex items-center justify-center mb-4`}>
          {isDeclined ? <X className={`size-8 ${iconClass}`} /> : <Check className={`size-8 ${iconClass}`} />}
        </div>
        <h2 className="heading-lg mb-2">Invitation {action}!</h2>
        {respondData.eventSummary && (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-surface-secondary rounded-lg mb-4">
            <Calendar className="size-4 text-secondary" />
            <span className="text-sm font-medium">{respondData.eventSummary}</span>
          </div>
        )}
        <div className="mb-4"><Badge color={badgeColor}>✓ Response Sent</Badge></div>
        <Button variant="outline" color="secondary" size="sm" onClick={handleBack}>
          ← Back to Invites
        </Button>
      </div>
    </div>
  );
}

// ============================================
// Main Widget with Router
// ============================================
function WidgetRouter({ authData }: { authData: AuthStatusOutput | null }) {
  const location = useLocation();
  
  // Log navigation for debugging
  useEffect(() => {
    console.log('[Widget] Route changed to:', location.pathname);
  }, [location.pathname]);

  return (
    <Routes>
      <Route path="/" element={<AuthView authData={authData} />} />
      <Route path="/invites" element={<InvitesView />} />
      <Route path="/result" element={<ResultView />} />
    </Routes>
  );
}

export default function CalendarWidget() {
  const { data, theme, isLoading, error, callTool, openExternal, notifyHeight, setWidgetState, openai } = useOpenAI<AuthStatusOutput>();
  const isDark = theme === 'dark';
  
  // Shared state for views
  const [invitesData, setInvitesData] = useState<PendingInvitesOutput | null>(null);
  const [respondData, setRespondData] = useState<RespondResultOutput | null>(null);

  // Restore state from widgetState on mount
  useEffect(() => {
    const state = openai?.widgetState as { 
      view?: string;
      invites?: PendingInvitesOutput;
      result?: RespondResultOutput;
    } | null;
    
    if (state?.invites) setInvitesData(state.invites);
    if (state?.result) setRespondData(state.result);
  }, [openai?.widgetState]);

  const contextValue: WidgetContextType = {
    theme,
    isDark,
    callTool,
    openExternal,
    notifyHeight,
    setWidgetState,
    invitesData,
    setInvitesData,
    respondData,
    setRespondData,
  };

  if (isLoading) {
    return (
      <div className={`p-4 rounded-xl border shadow-sm ${isDark ? 'bg-white border-gray-200' : 'bg-zinc-900 border-zinc-700'}`}>
        <div className="flex items-center justify-center gap-3 py-8">
          <div className={`size-5 rounded-full border-2 border-t-primary animate-spin ${isDark ? 'border-gray-300' : 'border-zinc-600'}`} />
          <p className={`text-sm ${isDark ? 'text-black' : 'text-zinc-400'}`}>Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 rounded-xl border text-center shadow-sm ${isDark ? 'bg-white border-gray-200' : 'bg-zinc-900 border-zinc-700'}`}>
        <p className={isDark ? 'text-black' : 'text-zinc-400'}>{error}</p>
      </div>
    );
  }

  return (
    <WidgetContext.Provider value={contextValue}>
      <BrowserRouter>
        <WidgetRouter authData={data} />
      </BrowserRouter>
    </WidgetContext.Provider>
  );
}

