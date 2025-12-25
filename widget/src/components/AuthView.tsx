import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@openai/apps-sdk-ui/components/Badge';
import { Calendar, Check } from '@openai/apps-sdk-ui/components/Icon';
import { useWidget } from '../WidgetContext';
import { theme } from '../theme';
import type { AuthStatusOutput, PendingInvitesOutput } from '../types';

interface AuthViewProps {
  initialAuthData: AuthStatusOutput | null;
}

export function AuthView({ initialAuthData }: AuthViewProps) {
  const { isDark, callTool, openExternal, setWidgetState, setInvitesData, notifyHeight, authData, setAuthData } = useWidget();
  const navigate = useNavigate();
  const [isPolling, setIsPolling] = useState(false);
  const [isLoadingInvites, setIsLoadingInvites] = useState(false);
  const [showDemoLogin, setShowDemoLogin] = useState(false);
  const [demoUsername, setDemoUsername] = useState('');
  const [demoPassword, setDemoPassword] = useState('');
  const [demoError, setDemoError] = useState('');
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [demoModeEnabled, setDemoModeEnabled] = useState(false);
  const [demoUsernamePlaceholder, setDemoUsernamePlaceholder] = useState('');

  const currentAuth = authData || initialAuthData;
  const isAuthenticated = currentAuth?.authenticated ?? false;

  // Check if demo mode is enabled on mount
  useEffect(() => {
    const checkDemoMode = async () => {
      try {
        const response = await fetch('/auth/demo-config');
        const config = await response.json();
        setDemoModeEnabled(config.enabled);
        if (config.username) {
          setDemoUsernamePlaceholder(config.username);
        }
      } catch (err) {
        console.error('Failed to check demo mode:', err);
      }
    };
    checkDemoMode();
  }, []);

  useEffect(() => { notifyHeight(); }, [isAuthenticated, isPolling, showDemoLogin, notifyHeight]);

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

  const handleDemoLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setDemoError('');
    setIsDemoLoading(true);

    try {
      const response = await fetch('/auth/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: demoUsername, password: demoPassword }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Mark as authenticated with demo user
        setAuthData({
          authenticated: true,
          email: result.email,
        });
        setWidgetState({ authenticated: true, email: result.email });
        // Optionally store session ID
        localStorage.setItem('demoSessionId', result.sessionId);
      } else {
        setDemoError(result.error || 'Invalid credentials');
      }
    } catch (err) {
      setDemoError('Failed to connect to server');
      console.error('[Widget] Demo login error:', err);
    } finally {
      setIsDemoLoading(false);
    }
  };

  // Connected State
  if (isAuthenticated) {
    return (
      <div className={`rounded-2xl shadow-lg border p-8 relative overflow-hidden ${theme.card(isDark)}`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 dark:from-green-600 dark:to-green-700 flex items-center justify-center shadow-lg shadow-green-500/25 dark:shadow-green-500/20">
            <Check className={`size-6 text-white`} />
            </div>
            <div>
              <h2 className={`text-lg font-semibold ${theme.textPrimary(isDark)}`}>Connected</h2>
              <p className={`text-sm ${theme.textPrimary(isDark)}`}>Google Calendar linked</p>
            </div>
          </div>
          <Badge className='p-6 rounded-full' color="success">Active</Badge>
        </div>

        {currentAuth?.email && (
          <div className={`mb-6 p-4 rounded-xl border ${theme.card(isDark)}`}>
            <p className={`text-xs uppercase tracking-wide font-medium mb-1 ${theme.textPrimary(isDark)}`}>Signed in as</p>
            <p className={`text-sm font-medium ${theme.textPrimary(isDark)}`}>{currentAuth.email}</p>
          </div>
        )}

          {isLoadingInvites ? (
            <>
              <div className={`size-8 m-auto rounded-full border-2 border-t-transparent animate-spin ${theme.spinner(isDark)}`} />
            </>
          ) : (
            <button className={`w-full bg-white h-12 flex items-center justify-center gap-3 font-medium rounded-xl text-black ${theme.buttonShadow()} ${theme.buttonBorder(isDark)}`}
            onClick={handleViewInvites}
            disabled={isLoadingInvites}
            >
              <Calendar />
              View Pending Invites
            </button>
          )}
      </div>
    );
  }

  // Not Connected State
  return (
    <div className={`rounded-2xl shadow-lg border p-8 relative overflow-hidden ${theme.card(isDark)}`}>
      {/* Subtle gradient accent */}
      
      <div className="relative">
        {/* Demo Mode Badge (shown when demo mode is enabled) */}
        {demoModeEnabled && (
          <div className="flex justify-center mb-4">
            <Badge className="px-3 py-1.5" color="warning">🧪 DEMO MODE ENABLED</Badge>
          </div>
        )}

        {/* Icon Container */}
        <div className="flex justify-center mb-6">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg ${isDark ? 'bg-linear-to-br from-blue-600 to-blue-700 shadow-blue-600/25' : 'bg-linear-to-br from-blue-500 to-blue-600 shadow-blue-500/25'}`}>
            <Calendar className="w-8 h-8 text-white" strokeWidth={2} />
          </div>
        </div>

        {/* Title */}
        <h1 className={`text-2xl font-semibold text-center mb-3 ${theme.textPrimary(isDark)}`}>
          {isPolling 
            ? 'Waiting for Sign In...' 
            : currentAuth?.authUrl 
              ? (demoModeEnabled ? 'Demo Mode Testing' : 'Connect Google Calendar')
              : 'Setting Up Calendar Access'
          }
        </h1>

        {/* Description */}
        <p className={`text-center leading-relaxed mb-8 ${theme.textPrimary(isDark)}`}>
          {isPolling 
            ? 'Complete the sign-in in the new tab. This will update automatically.'
            : currentAuth?.authUrl
              ? (demoModeEnabled 
                  ? 'Test the app with mock calendar data. No Google account required.'
                  : 'Link your Google account to manage calendar invitations directly from ChatGPT')
              : 'Preparing your calendar connection and checking authentication...'
          }
        </p>

        {isPolling ? (
          <div className="flex flex-col items-center gap-3 py-2 mb-6">
            <div className={`size-6 rounded-full border-2 border-t-blue-500 animate-spin ${theme.spinner(isDark)}`} />
            <p className={`text-xs ${theme.textPrimary(isDark)}`}>
              Checking every few seconds...
            </p>
          </div>
        ) : currentAuth?.authUrl ? (
          <>
            {/* Only show Google Sign In if demo mode is NOT enabled */}
            {!demoModeEnabled && (
              <>
                {/* Google Sign In Button */}
                <button 
                  onClick={handleConnect}
                  className={`w-full h-12 flex items-center justify-center gap-3 font-medium rounded-xl ${theme.textPrimary(isDark)} ${theme.buttonShadow()} ${theme.buttonBorder(isDark)}`}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>

                {/* Privacy Notice */}
                <div className={`mt-6 flex items-start ${theme.textPrimary(isDark)} gap-2 p-3 rounded-lg border ${theme.buttonBorder(isDark)}`}>
                  <svg className={`w-4 h-4 mt-0.5 shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                  </svg>
                  <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    We only access your calendar events. Your data is encrypted and never shared with third parties.
                  </p>
                </div>
              </>
            )}

            {/* Demo Mode Section */}
            {demoModeEnabled && (
              <div className={!demoModeEnabled ? 'mt-6' : ''}>
                {/* Only show divider if Google button is visible */}
                {!demoModeEnabled && (
                  <div className="relative mb-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className={`w-full border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className={`px-2 ${theme.card(isDark)} ${theme.textPrimary(isDark)}`}>or</span>
                    </div>
                  </div>
                )}

                {!showDemoLogin ? (
                  <button
                    onClick={() => setShowDemoLogin(true)}
                    className={`w-full h-12 flex items-center justify-center gap-2 font-medium rounded-xl ${theme.buttonShadow()} ${theme.buttonBorder(isDark)} ${theme.textPrimary(isDark)} hover:bg-opacity-50 transition-colors`}
                    type="button"
                  >
                    <Badge className="px-2 py-1 text-xs" color="warning">DEMO</Badge>
                    Use Test Account
                  </button>
                ) : (
                  <div className="mt-4 space-y-3">
                    <div className={`flex items-center gap-2 p-2 rounded-lg ${isDark ? 'bg-yellow-900/20' : 'bg-yellow-50'}`}>
                      <Badge className="px-2 py-1 text-xs shrink-0" color="warning">DEMO MODE</Badge>
                      <p className={`text-xs ${theme.textPrimary(isDark)}`}>
                        For reviewers: Test with demo credentials
                      </p>
                    </div>
                    
                    <form onSubmit={handleDemoLogin} className="space-y-3">
                      <input
                        type="text"
                        placeholder={demoUsernamePlaceholder || "Username"}
                        value={demoUsername}
                        onChange={(e) => setDemoUsername(e.target.value)}
                        className={`w-full px-4 py-2 rounded-lg border ${theme.card(isDark)} ${theme.textPrimary(isDark)} ${theme.buttonBorder(isDark)}`}
                        required
                      />
                      <input
                        type="password"
                        placeholder="Password"
                        value={demoPassword}
                        onChange={(e) => setDemoPassword(e.target.value)}
                        className={`w-full px-4 py-2 rounded-lg border ${theme.card(isDark)} ${theme.textPrimary(isDark)} ${theme.buttonBorder(isDark)}`}
                        required
                      />
                      {demoError && (
                        <p className="text-sm text-red-500">{demoError}</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={isDemoLoading}
                          className={`flex-1 h-10 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors`}
                        >
                          {isDemoLoading ? 'Signing in...' : 'Demo Login'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowDemoLogin(false);
                            setDemoError('');
                            setDemoUsername('');
                            setDemoPassword('');
                          }}
                          className={`px-4 h-10 border ${theme.buttonBorder(isDark)} ${theme.textPrimary(isDark)} rounded-lg hover:bg-opacity-50 transition-colors`}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center gap-2 py-3">
            <div className={`size-4 rounded-full border-2 border-t-blue-500 animate-spin ${theme.spinner(isDark)}`} />
            <p className={`text-sm ${theme.textPrimary(isDark)}`}>Loading...</p>
          </div>
        )}
      </div>
    </div>
  );
}

