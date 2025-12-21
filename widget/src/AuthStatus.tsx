import { useEffect } from 'react';
import { useOpenAI } from './useOpenAI';
import type { AuthStatusOutput } from './types';
import { Button } from '@openai/apps-sdk-ui/components/Button';
import { Badge } from '@openai/apps-sdk-ui/components/Badge';
import { Calendar, Check } from '@openai/apps-sdk-ui/components/Icon';
import './main.css';

function Connected({ email, sendFollowUp, isDark }: { email?: string | null; sendFollowUp: (msg: string) => void; isDark: boolean }) {
  // If dark mode, show white widget. If light mode, show dark widget.
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

      {email && (
        <div className={`mb-6 p-4 rounded-xl border ${isDark ? 'bg-gray-50 border-gray-200' : 'bg-zinc-800 border-zinc-700'}`}>
          <p className={`text-xs uppercase tracking-wide font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-zinc-500'}`}>Signed in as</p>
          <p className={`text-sm font-medium ${isDark ? 'text-gray-900' : 'text-white'}`}>{email}</p>
        </div>
      )}

      <Button color="primary" block onClick={() => sendFollowUp('Show my pending calendar invitations')}>
        <Calendar />
        View Pending Invites
      </Button>
    </div>
  );
}

function NotConnected({ authUrl, openExternal, isDark }: { authUrl: string; openExternal: (options: { href: string }) => void; isDark: boolean }) {
  const handleConnect = () => {
    console.log('[Widget] Connect clicked, authUrl:', authUrl);
    if (authUrl && authUrl.length > 0) {
      // ChatGPT's openExternal expects { href: url } object
      openExternal({ href: authUrl });
    } else {
      console.error('[Widget] No auth URL available');
    }
  };

  // If dark mode, show white widget. If light mode, show dark widget.
  return (
    <div className={`p-6 rounded-xl border shadow-sm ${isDark ? 'bg-white border-gray-200' : 'bg-zinc-900 border-zinc-700'}`}>
      <div className="flex flex-col items-center text-center">
        <div className={`size-14 rounded-xl flex items-center justify-center mb-4 ${isDark ? 'bg-gray-100' : 'bg-zinc-800'}`}>
          <Calendar className="size-7 text-primary" />
        </div>
        
        <h2 className={`text-lg font-semibold mb-2 ${isDark ? 'text-black' : 'text-white'}`}>
          Connect Google Calendar
        </h2>
        
        <p className={`text-sm mb-6 max-w-[280px] ${isDark ? 'text-black' : 'text-zinc-400'}`}>
          Link your Google account to manage calendar invitations directly from ChatGPT
        </p>

        {authUrl && authUrl.length > 0 ? (
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

function Loading({ isDark }: { isDark: boolean }) {
  return (
    <div className="flex items-center justify-center gap-3 py-8">
      <div className={`size-5 rounded-full border-2 border-t-primary animate-spin ${isDark ? 'border-gray-300' : 'border-zinc-600'}`} />
      <p className={`text-sm ${isDark ? 'text-black' : 'text-zinc-400'}`}>Checking connection...</p>
    </div>
  );
}

export default function AuthStatus() {
  const { data, theme, isLoading, error, openExternal, sendFollowUp, notifyHeight } = useOpenAI<AuthStatusOutput>();
  const isDark = theme === 'dark';

  useEffect(() => {
    if (!isLoading) notifyHeight();
  }, [isLoading, data]);

  // If dark mode, show white widget. If light mode, show dark widget.
  if (isLoading) {
    return (
      <div className={`p-4 rounded-xl border shadow-sm ${isDark ? 'bg-white border-gray-200' : 'bg-zinc-900 border-zinc-700'}`}>
        <Loading isDark={isDark} />
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

  if (!data) {
    return (
      <div className={`p-6 rounded-xl border text-center shadow-sm ${isDark ? 'bg-white border-gray-200' : 'bg-zinc-900 border-zinc-700'}`}>
        <p className={isDark ? 'text-black' : 'text-zinc-400'}>No data</p>
      </div>
    );
  }

  return data.authenticated 
    ? <Connected email={data.email} sendFollowUp={sendFollowUp} isDark={isDark} /> 
    : <NotConnected authUrl={data.authUrl || ''} openExternal={openExternal} isDark={isDark} />;
}
