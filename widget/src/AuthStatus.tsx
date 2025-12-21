import { useEffect } from 'react';
import { useOpenAI } from './useOpenAI';
import type { AuthStatusOutput } from './types';
import { Button } from '@openai/apps-sdk-ui/components/Button';
import { Badge } from '@openai/apps-sdk-ui/components/Badge';
import { Calendar, Check } from '@openai/apps-sdk-ui/components/Icon';
import './main.css';

function Connected({ email, sendFollowUp }: { email?: string | null; sendFollowUp: (msg: string) => void }) {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-xl bg-success-soft flex items-center justify-center">
            <Check className="size-6 text-success" />
          </div>
          <div>
            <h2 className="heading-lg">Connected</h2>
            <p className="text-sm text-secondary">Google Calendar linked</p>
          </div>
        </div>
        <Badge color="success">Active</Badge>
      </div>

      {email && (
        <div className="mb-6 p-4 bg-surface-secondary rounded-xl border border-subtle">
          <p className="text-xs text-tertiary uppercase tracking-wide font-medium mb-1">Signed in as</p>
          <p className="text-sm font-medium">{email}</p>
        </div>
      )}

      <Button color="primary" block onClick={() => sendFollowUp('Show my pending calendar invitations')}>
        <Calendar />
        View Pending Invites
      </Button>
    </div>
  );
}

function NotConnected({ authUrl, openExternal }: { authUrl: string; openExternal: (url: string) => void }) {
  return (
    <div className="p-6 text-center">
      <div className="mb-6">
        <div className="size-16 mx-auto rounded-2xl bg-primary-soft flex items-center justify-center mb-4">
          <Calendar className="size-8 text-primary" />
        </div>
        <h2 className="heading-lg mb-2">Connect Google Calendar</h2>
        <p className="text-secondary text-sm max-w-xs mx-auto">
          Link your Google account to manage calendar invitations directly from ChatGPT
        </p>
      </div>

      <Button variant="outline" color="secondary" block onClick={() => openExternal(authUrl)}>
        <svg className="size-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continue with Google
      </Button>

      <p className="text-xs text-tertiary mt-4">We only access your calendar events.</p>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="size-10 rounded-full border-4 border-subtle border-t-primary animate-spin" />
      <p className="text-secondary mt-4 text-sm">Checking connection...</p>
    </div>
  );
}

export default function AuthStatus() {
  const { data, theme, isLoading, error, openExternal, sendFollowUp, notifyHeight } = useOpenAI<AuthStatusOutput>();

  useEffect(() => {
    if (!isLoading) notifyHeight();
  }, [isLoading, data]);

  if (isLoading) return <div className={theme === 'dark' ? 'dark' : ''}><div className="bg-surface rounded-xl"><Loading /></div></div>;
  if (error) return <div className={theme === 'dark' ? 'dark' : ''}><div className="bg-surface rounded-xl p-6 text-center"><p className="text-secondary">{error}</p></div></div>;
  if (!data) return <div className={theme === 'dark' ? 'dark' : ''}><div className="bg-surface rounded-xl p-6 text-center"><p className="text-secondary">No data</p></div></div>;

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className="bg-surface rounded-xl overflow-hidden">
        {data.authenticated ? <Connected email={data.email} sendFollowUp={sendFollowUp} /> : <NotConnected authUrl={data.authUrl || ''} openExternal={openExternal} />}
      </div>
    </div>
  );
}
