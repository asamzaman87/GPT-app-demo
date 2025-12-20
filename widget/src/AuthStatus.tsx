import React, { useEffect } from 'react';
import { useOpenAI } from './useOpenAI';
import type { AuthStatusOutput } from './types';
import './main.css';

function Connected({ email, sendFollowUp }: { email?: string | null; sendFollowUp: (msg: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-6 text-center">
      <div className="text-6xl mb-4">✅</div>
      <h2 className="text-xl font-semibold text-text-primary mb-2">Connected!</h2>
      
      {email && (
        <div className="mb-4 px-4 py-2 bg-surface-secondary rounded-lg">
          <span className="text-sm text-text-secondary">Account: </span>
          <span className="text-sm font-medium text-text-primary">{email}</span>
        </div>
      )}

      <div className="w-full max-w-xs space-y-3 mt-4">
        <div className="flex items-center gap-3 p-3 bg-surface-secondary rounded-lg">
          <span className="text-2xl">📋</span>
          <span className="text-sm text-text-secondary">View pending invitations</span>
        </div>
        <div className="flex items-center gap-3 p-3 bg-surface-secondary rounded-lg">
          <span className="text-2xl">✓</span>
          <span className="text-sm text-text-secondary">Accept or decline invites</span>
        </div>
        <div className="flex items-center gap-3 p-3 bg-surface-secondary rounded-lg">
          <span className="text-2xl">❓</span>
          <span className="text-sm text-text-secondary">Mark invites as tentative</span>
        </div>
      </div>

      <button
        onClick={() => sendFollowUp('Show my pending calendar invitations')}
        className="mt-6 px-6 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-medium transition-colors"
      >
        View Pending Invites →
      </button>
    </div>
  );
}

function NotConnected({ authUrl, openExternal }: { authUrl: string; openExternal: (url: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-6 text-center">
      <div className="text-6xl mb-4">🔐</div>
      <h2 className="text-xl font-semibold text-text-primary mb-2">Connect Google Calendar</h2>
      <p className="text-text-secondary mb-6 max-w-sm">
        Link your Google account to manage calendar invitations directly from ChatGPT.
      </p>
      <button
        onClick={() => openExternal(authUrl)}
        className="px-6 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-medium transition-colors flex items-center gap-2"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Connect with Google
      </button>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="animate-spin h-8 w-8 border-3 border-primary border-t-transparent rounded-full mb-4" />
      <p className="text-text-secondary">Checking status...</p>
    </div>
  );
}

export default function AuthStatus() {
  const { data, theme, isLoading, openExternal, sendFollowUp, notifyHeight } = useOpenAI<AuthStatusOutput>();

  useEffect(() => {
    if (!isLoading) {
      notifyHeight();
    }
  }, [isLoading, data]);

  if (isLoading) {
    return (
      <div className={theme === 'dark' ? 'dark' : ''}>
        <div className="min-h-[300px] bg-surface-primary">
          <Loading />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={theme === 'dark' ? 'dark' : ''}>
        <div className="min-h-[300px] bg-surface-primary flex items-center justify-center">
          <p className="text-text-secondary">No data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className="min-h-[300px] bg-surface-primary">
        {data.authenticated ? (
          <Connected email={data.email} sendFollowUp={sendFollowUp} />
        ) : (
          <NotConnected authUrl={data.authUrl || ''} openExternal={openExternal} />
        )}
      </div>
    </div>
  );
}

