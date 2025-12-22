import { useEffect, useState, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useOpenAI } from './useOpenAI';
import type { AuthStatusOutput, PendingInvitesOutput, PendingInvite, RespondResultOutput } from './types';
import { Button } from '@openai/apps-sdk-ui/components/Button';
import { Badge } from '@openai/apps-sdk-ui/components/Badge';
import { Calendar, Check, X } from '@openai/apps-sdk-ui/components/Icon';
import './main.css';

// ============================================
// Theme-aware class helpers
// ============================================
const theme = {
  // Containers
  card: (isDark: boolean) =>
    isDark
      ? "bg-slate-900/80 border-slate-800 shadow-sm"
      : "bg-white border-slate-200 shadow-sm",

  cardInner: (isDark: boolean) =>
    isDark
      ? "bg-slate-950/40 border-slate-800/80"
      : "bg-slate-50 border-slate-200",

  surface: (isDark: boolean) =>
    isDark ? "bg-slate-950/60" : "bg-slate-100",

  // Text
  textPrimary: (isDark: boolean) =>
    isDark ? "text-white" : "text-slate-900",

  textSecondary: (isDark: boolean) =>
    isDark ? "text-black" : "text-slate-600",

  textMuted: (isDark: boolean) =>
    isDark ? "text-slate-400/80" : "text-slate-500",

  // Icon chips
  iconBg: (isDark: boolean) =>
    isDark ? "bg-sky-500/12" : "bg-sky-100/70",

  iconBgSuccess: (isDark: boolean) =>
    isDark ? "bg-emerald-500/12" : "bg-emerald-100/70",

  // Spinners (your spinner sets border-t-blue-500 separately)
  spinner: (isDark: boolean) =>
    isDark ? "border-slate-700" : "border-slate-300",
};

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
  authData: AuthStatusOutput | null;
  setAuthData: (data: AuthStatusOutput | null) => void;
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
function AuthView({ initialAuthData }: { initialAuthData: AuthStatusOutput | null }) {
  const { isDark, callTool, openExternal, setWidgetState, setInvitesData, notifyHeight, authData, setAuthData } = useWidget();
  const navigate = useNavigate();
  const [isPolling, setIsPolling] = useState(false);
  const [isLoadingInvites, setIsLoadingInvites] = useState(false);

  const currentAuth = authData || initialAuthData;
  const isAuthenticated = currentAuth?.authenticated ?? false;

  useEffect(() => { notifyHeight(); }, [isAuthenticated, isPolling, notifyHeight]);

  // Polling for auth status
  useEffect(() => {
    if (!isPolling) return;
    
    const pollInterval = setInterval(async () => {
      try {
        const result = await callTool('check_auth_status', {}) as { structuredContent?: AuthStatusOutput };
        if (result?.structuredContent?.authenticated) {
          setAuthData(result.structuredContent);
          setWidgetState({ authenticated: true, email: result.structuredContent.email });
          setIsPolling(false);
        }
      } catch (err) {
        console.error('[Widget] Poll error:', err);
      }
    }, 3000);

    const timeout = setTimeout(() => setIsPolling(false), 5 * 60 * 1000);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
    };
  }, [isPolling, callTool, setWidgetState, setAuthData]);

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
      <div className={`p-6 rounded-xl border shadow-sm ${theme.card(isDark)}`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`size-12 rounded-xl flex items-center justify-center ${theme.iconBgSuccess(isDark)}`}>
              <Check className="size-6 text-emerald-500" />
            </div>
            <div>
              <h2 className={`text-lg font-semibold ${theme.textPrimary(isDark)}`}>Connected</h2>
              <p className={`text-sm ${theme.textSecondary(isDark)}`}>Google Calendar linked</p>
            </div>
          </div>
          <Badge color="success">Active</Badge>
        </div>

        {currentAuth?.email && (
          <div className={`mb-6 p-4 rounded-xl border ${theme.cardInner(isDark)}`}>
            <p className={`text-xs uppercase tracking-wide font-medium mb-1 ${theme.textMuted(isDark)}`}>Signed in as</p>
            <p className={`text-sm font-medium ${theme.textPrimary(isDark)}`}>{currentAuth.email}</p>
          </div>
        )}

        <Button color="primary" block onClick={handleViewInvites} disabled={isLoadingInvites}>
          {isLoadingInvites ? (
            <>
              <div className="size-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              Loading...
            </>
          ) : (
            <div className='text-secondary'>
              <Calendar />
              View Pending Invites
            </div>
          )}
        </Button>
      </div>
    );
  }

  // Not Connected State
  return (
    <div className={`p-6 rounded-xl border shadow-sm ${theme.card(isDark)}`}>
      <div className="flex flex-col items-center text-center">
        <div className={`size-14 rounded-xl flex items-center justify-center mb-4 ${theme.iconBg(isDark)}`}>
          <Calendar className="size-7 text-blue-500" />
        </div>
        
        <h2 className={`text-lg font-semibold mb-2 ${theme.textPrimary(isDark)}`}>
          {isPolling ? 'Waiting for Sign In...' : 'Connect Google Calendar'}
        </h2>
        
        <p className={`text-sm mb-6 max-w-[280px] ${theme.textPrimary(isDark)}`}>
          {isPolling 
            ? 'Complete the sign-in in the new tab. This will update automatically.'
            : 'Link your Google account to manage calendar invitations directly from ChatGPT'
          }
        </p>

        {isPolling ? (
          <div className="flex flex-col items-center gap-3 py-2">
            <div className={`size-6 rounded-full border-2 border-t-blue-500 animate-spin ${theme.spinner(isDark)}`} />
            <p className={`text-xs ${theme.textMuted(isDark)}`}>
              Checking every few seconds...
            </p>
          </div>
        ) : currentAuth?.authUrl ? (
          <Button variant="outline" color="secondary" block onClick={handleConnect}>
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
            <div className={`size-4 rounded-full border-2 border-t-blue-500 animate-spin ${theme.spinner(isDark)}`} />
            <p className={`text-sm ${theme.textPrimary(isDark)}`}>Loading...</p>
          </div>
        )}

        <p className={`text-xs mt-4 ${theme.textMuted(isDark)}`}>
          We only access your calendar events.
        </p>
      </div>
    </div>
  );
}

// ============================================
// Invites View (/invites route)
// ============================================
function InviteCard({ invite, onRespond, isDark }: { invite: PendingInvite; onRespond: (eventId: string, response: string) => Promise<void>; isDark: boolean }) {
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
    <div className={`rounded-xl border p-4 ${theme.cardInner(isDark)}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold truncate ${theme.textPrimary(isDark)}`}>{invite.summary}</h3>
          <p className={`text-sm mt-1 ${theme.textSecondary(isDark)}`}>{invite.organizerName || invite.organizerEmail}</p>
        </div>
        <Badge color="warning">Pending</Badge>
      </div>
      
      <div className={`text-sm mb-3 ${theme.textSecondary(isDark)}`}>
        <p>📅 {formatTime(invite.startTime)}</p>
        {invite.location && <p>📍 {invite.location}</p>}
      </div>

      <div className={`pt-3 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        {status === 'idle' && (
          <div className="grid grid-cols-3 gap-2">
            <Button variant="soft" color="success" size="sm" block onClick={() => handleRespond('accepted')}>Accept</Button>
            <Button variant="soft" color="warning" size="sm" block onClick={() => handleRespond('tentative')}>Maybe</Button>
            <Button variant="soft" color="danger" size="sm" block onClick={() => handleRespond('declined')}>Decline</Button>
          </div>
        )}
        {status === 'loading' && <div className={`text-center py-2 text-sm ${theme.textSecondary(isDark)}`}>Sending...</div>}
        {(status === 'accepted' || status === 'declined' || status === 'tentative') && (
          <div className="text-center"><Badge color={status === 'accepted' ? 'success' : status === 'declined' ? 'danger' : 'warning'}>{status === 'accepted' ? '✓ Accepted' : status === 'declined' ? '✗ Declined' : '? Maybe'}</Badge></div>
        )}
        {status === 'error' && <div className="text-center"><Badge color="danger">Failed</Badge></div>}
      </div>
    </div>
  );
}

function InvitesView() {
  const { isDark, invitesData, setInvitesData, callTool, setRespondData, setWidgetState, notifyHeight } = useWidget();
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => { notifyHeight(); }, [invitesData, isRefreshing, notifyHeight]);

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

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      const result = await callTool('get_pending_reservations', {}) as { structuredContent?: PendingInvitesOutput };
      if (result?.structuredContent) {
        setInvitesData(result.structuredContent);
        setWidgetState({ view: 'invites', invites: result.structuredContent });
      }
    } catch (err) {
      console.error('[Widget] Failed to refresh:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleBack = () => {
    navigate('/');
  };

  if (!invitesData) {
    return (
      <div className={`p-6 rounded-xl border shadow-sm ${theme.card(isDark)}`}>
        <p className={`text-center ${theme.textSecondary(isDark)}`}>No invites data</p>
        <div className="flex justify-center mt-4">
          <Button variant="outline" color="secondary" size="sm" onClick={handleBack}>
            ← Back
          </Button>
        </div>
      </div>
    );
  }

  const invites = invitesData.invites || [];

  return (
    <div className={`rounded-xl border shadow-sm ${theme.card(isDark)}`}>
      {invites.length === 0 ? (
        <div className="py-12 text-center px-6">
          <div className={`size-16 mx-auto rounded-2xl flex items-center justify-center mb-4 ${theme.iconBgSuccess(isDark)}`}>
            <Check className="size-8 text-emerald-500" />
          </div>
          <h2 className={`text-xl font-semibold mb-2 ${theme.textPrimary(isDark)}`}>All Caught Up!</h2>
          <p className={`text-sm mb-6 ${theme.textSecondary(isDark)}`}>No pending invitations.</p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" color="secondary" size="sm" onClick={handleBack}>
              ← Back
            </Button>
            <Button variant="outline" color="primary" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              {isRefreshing ? '↻ Refreshing...' : '↻ Refresh'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`size-10 rounded-xl flex items-center justify-center ${theme.iconBg(isDark)}`}>
                <Calendar className="size-5 text-blue-500" />
              </div>
              <h1 className={`text-lg font-semibold ${theme.textPrimary(isDark)}`}>Pending Invites</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" color="secondary" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
                ↻
              </Button>
              <Badge color="success">{invites.length}</Badge>
            </div>
          </div>
          {isRefreshing && (
            <div className={`flex items-center justify-center gap-2 py-2 mb-3 rounded-lg ${theme.surface(isDark)}`}>
              <div className={`size-4 rounded-full border-2 border-t-blue-500 animate-spin ${theme.spinner(isDark)}`} />
              <span className={`text-sm ${theme.textSecondary(isDark)}`}>Refreshing...</span>
            </div>
          )}
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {invites.map((invite) => (
              <InviteCard key={invite.eventId} invite={invite} onRespond={handleRespond} isDark={isDark} />
            ))}
          </div>
        </div>
      )}
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
      <div className={`p-6 rounded-xl border shadow-sm ${theme.card(isDark)}`}>
        <p className={`text-center ${theme.textSecondary(isDark)}`}>No result data</p>
        <div className="flex justify-center mt-4">
          <Button variant="outline" color="secondary" size="sm" onClick={handleBack}>
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
  
  const iconBgClass = isAccepted 
    ? (isDark ? 'bg-emerald-900/40' : 'bg-emerald-50')
    : isDeclined 
    ? (isDark ? 'bg-red-900/40' : 'bg-red-50')
    : (isDark ? 'bg-amber-900/40' : 'bg-amber-50');
  
  const iconClass = isAccepted ? 'text-emerald-500' : isDeclined ? 'text-red-500' : 'text-amber-500';

  if (!respondData.success) {
    return (
      <div className={`p-6 rounded-xl border shadow-sm ${theme.card(isDark)}`}>
        <div className="text-center">
          <div className={`size-16 mx-auto rounded-2xl flex items-center justify-center mb-4 ${isDark ? 'bg-red-900/40' : 'bg-red-50'}`}>
            <X className="size-8 text-red-500" />
          </div>
          <h2 className={`text-xl font-semibold mb-2 ${theme.textPrimary(isDark)}`}>Something Went Wrong</h2>
          <Badge color="danger">Failed</Badge>
          <p className="text-red-500 text-sm mt-4">{respondData.error || 'Please try again.'}</p>
          <div className="flex justify-center mt-4">
            <Button variant="outline" color="secondary" size="sm" onClick={handleBack}>
              ← Back to Invites
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 rounded-xl border shadow-sm ${theme.card(isDark)}`}>
      <div className="text-center">
        <div className={`size-16 mx-auto rounded-2xl flex items-center justify-center mb-4 ${iconBgClass}`}>
          {isDeclined ? <X className={`size-8 ${iconClass}`} /> : <Check className={`size-8 ${iconClass}`} />}
        </div>
        <h2 className={`text-xl font-semibold mb-2 ${theme.textPrimary(isDark)}`}>Invitation {action}!</h2>
        {respondData.eventSummary && (
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg mb-4 ${theme.surface(isDark)}`}>
            <Calendar className={`size-4 ${theme.textSecondary(isDark)}`} />
            <span className={`text-sm font-medium ${theme.textPrimary(isDark)}`}>{respondData.eventSummary}</span>
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
function WidgetRouter({ initialData }: { initialData: unknown }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { setAuthData, setInvitesData, setRespondData, authData, invitesData } = useWidget();
  const [initialRouteSet, setInitialRouteSet] = useState(false);
  
  useEffect(() => {
    console.log('[Widget] Route changed to:', location.pathname);
  }, [location.pathname]);

  // Auto-detect data type and route accordingly on initial load
  useEffect(() => {
    if (initialRouteSet || !initialData) return;
    
    const data = initialData as Record<string, unknown>;
    console.log('[Widget] Auto-detecting data type:', Object.keys(data));
    
    // Check if it's invites data (has 'invites' array)
    if ('invites' in data && Array.isArray(data.invites)) {
      console.log('[Widget] Detected invites data, navigating to /invites');
      setInvitesData(data as unknown as PendingInvitesOutput);
      // Also mark as authenticated since we could fetch invites
      setAuthData({ authenticated: true });
      navigate('/invites', { replace: true });
      setInitialRouteSet(true);
      return;
    }
    
    // Check if it's respond result data (has 'success' and 'response')
    if ('success' in data && 'response' in data) {
      console.log('[Widget] Detected respond result data, navigating to /result');
      setRespondData(data as unknown as RespondResultOutput);
      navigate('/result', { replace: true });
      setInitialRouteSet(true);
      return;
    }
    
    // Check if auth is required (from get_pending_reservations when not authenticated)
    if ('authRequired' in data && data.authRequired === true) {
      console.log('[Widget] Detected authRequired, showing auth view');
      setAuthData({ 
        authenticated: false, 
        authUrl: data.authUrl as string | undefined 
      });
      setInitialRouteSet(true);
      return;
    }
    
    // Check if it's auth data (has 'authenticated')
    if ('authenticated' in data) {
      console.log('[Widget] Detected auth data, staying on /');
      setAuthData(data as unknown as AuthStatusOutput);
      setInitialRouteSet(true);
      return;
    }
    
    // Unknown data type, stay on current route
    console.log('[Widget] Unknown data type, staying on current route');
    setInitialRouteSet(true);
  }, [initialData, initialRouteSet, navigate, setAuthData, setInvitesData, setRespondData]);

  // Derive initial auth data for AuthView
  const initialAuthData: AuthStatusOutput | null = (() => {
    if (!initialData) return authData;
    const data = initialData as Record<string, unknown>;
    
    // Handle authRequired from get_pending_reservations
    if ('authRequired' in data && data.authRequired === true) {
      return { authenticated: false, authUrl: data.authUrl as string | undefined };
    }
    
    // Handle regular auth data
    if ('authenticated' in data) {
      return initialData as AuthStatusOutput;
    }
    
    return authData;
  })();

  return (
    <Routes>
      <Route path="/" element={<AuthView initialAuthData={initialAuthData} />} />
      <Route path="/invites" element={<InvitesView />} />
      <Route path="/result" element={<ResultView />} />
    </Routes>
  );
}

export default function CalendarWidget() {
  const { data, theme: appTheme, isLoading, error, callTool, openExternal, notifyHeight, setWidgetState, openai } = useOpenAI<AuthStatusOutput>();
  const isDark = appTheme === 'dark';
  
  const [authData, setAuthData] = useState<AuthStatusOutput | null>(null);
  const [invitesData, setInvitesData] = useState<PendingInvitesOutput | null>(null);
  const [respondData, setRespondData] = useState<RespondResultOutput | null>(null);

  useEffect(() => {
    const state = openai?.widgetState as { 
      authenticated?: boolean;
      email?: string;
      view?: string;
      invites?: PendingInvitesOutput;
      result?: RespondResultOutput;
    } | null;
    
    if (state?.authenticated) {
      setAuthData({ authenticated: true, email: state.email || undefined });
    }
    if (state?.invites) setInvitesData(state.invites);
    if (state?.result) setRespondData(state.result);
  }, [openai?.widgetState]);

  const contextValue: WidgetContextType = {
    theme: appTheme,
    isDark,
    callTool,
    openExternal,
    notifyHeight,
    setWidgetState,
    authData,
    setAuthData,
    invitesData,
    setInvitesData,
    respondData,
    setRespondData,
  };

  if (isLoading) {
    return (
      <div className={`p-4 rounded-xl border shadow-sm ${theme.card(isDark)}`}>
        <div className="flex items-center justify-center gap-3 py-8">
          <div className={`size-5 rounded-full border-2 border-t-blue-500 animate-spin ${theme.spinner(isDark)}`} />
          <p className={`text-sm ${theme.textSecondary(isDark)}`}>Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 rounded-xl border text-center shadow-sm ${theme.card(isDark)}`}>
        <p className={theme.textSecondary(isDark)}>{error}</p>
      </div>
    );
  }

  return (
    <WidgetContext.Provider value={contextValue}>
      <BrowserRouter>
        <WidgetRouter initialData={data} />
      </BrowserRouter>
    </WidgetContext.Provider>
  );
}
