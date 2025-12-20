import React, { useState, useEffect } from 'react';
import { useOpenAI } from './useOpenAI';
import type { PendingInvitesOutput, PendingInvite } from './types';
import './main.css';

function InviteCard({ invite, onRespond }: { 
  invite: PendingInvite; 
  onRespond: (eventId: string, response: string) => Promise<void>;
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'accepted' | 'declined' | 'tentative' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleRespond = async (response: 'accepted' | 'declined' | 'tentative') => {
    setStatus('loading');
    setError(null);
    try {
      await onRespond(invite.eventId, response);
      setStatus(response);
    } catch (err: any) {
      setError(err.message || 'Failed to respond');
      setStatus('error');
    }
  };

  const organizer = invite.organizerName || invite.organizerEmail;

  return (
    <div className="bg-surface-primary rounded-xl border border-border-default p-4 mb-3 shadow-sm">
      <h3 className="text-lg font-semibold text-text-primary mb-2">{invite.summary}</h3>
      
      <div className="space-y-1 text-sm text-text-secondary">
        <div className="flex items-center gap-2">
          <span>📆</span>
          <span>{invite.startTime} - {invite.endTime}</span>
        </div>
        
        {invite.location && (
          <div className="flex items-center gap-2">
            <span>📍</span>
            <span>{invite.location}</span>
          </div>
        )}
        
        <div className="flex items-center gap-2">
          <span>👤</span>
          <span>{organizer}</span>
        </div>
      </div>

      {invite.description && (
        <p className="mt-3 pt-3 border-t border-border-default text-sm text-text-tertiary line-clamp-2">
          {invite.description}
        </p>
      )}

      <div className="mt-4">
        {status === 'idle' && (
          <div className="flex gap-2">
            <button
              onClick={() => handleRespond('accepted')}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
            >
              ✓ Accept
            </button>
            <button
              onClick={() => handleRespond('tentative')}
              className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors"
            >
              ? Maybe
            </button>
            <button
              onClick={() => handleRespond('declined')}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
            >
              ✗ Decline
            </button>
          </div>
        )}

        {status === 'loading' && (
          <div className="flex items-center justify-center py-2">
            <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
            <span className="ml-2 text-text-secondary">Responding...</span>
          </div>
        )}

        {(status === 'accepted' || status === 'declined' || status === 'tentative') && (
          <div className={`text-center py-2 px-4 rounded-lg font-medium ${
            status === 'accepted' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
            status === 'declined' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
            'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
          }`}>
            {status === 'accepted' ? '✓ Accepted' : status === 'declined' ? '✗ Declined' : '? Tentative'}
          </div>
        )}

        {status === 'error' && (
          <div className="text-center py-2 px-4 rounded-lg bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
            ❌ {error}
          </div>
        )}
      </div>
    </div>
  );
}

function AuthRequired({ authUrl, openExternal }: { authUrl: string; openExternal: (url: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="text-6xl mb-4">🔐</div>
      <h2 className="text-xl font-semibold text-text-primary mb-2">Connect Google Calendar</h2>
      <p className="text-text-secondary mb-6">
        To view and manage your calendar invitations, connect your Google account.
      </p>
      <button
        onClick={() => openExternal(authUrl)}
        className="px-6 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-medium transition-colors"
      >
        Connect Google Calendar →
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="text-6xl mb-4">✅</div>
      <h2 className="text-xl font-semibold text-text-primary mb-2">All Caught Up!</h2>
      <p className="text-text-secondary">
        You have no pending calendar invitations.
      </p>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="animate-spin h-8 w-8 border-3 border-primary border-t-transparent rounded-full mb-4" />
      <p className="text-text-secondary">Loading invitations...</p>
    </div>
  );
}

export default function PendingInvites() {
  const { data, theme, isLoading, callTool, openExternal, notifyHeight } = useOpenAI<PendingInvitesOutput>();

  useEffect(() => {
    if (!isLoading) {
      notifyHeight();
    }
  }, [isLoading, data]);

  const handleRespond = async (eventId: string, response: string) => {
    await callTool('respond_to_invite', { event_id: eventId, response });
  };

  if (isLoading) {
    return (
      <div className={theme === 'dark' ? 'dark' : ''}>
        <div className="min-h-screen bg-surface-primary">
          <Loading />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={theme === 'dark' ? 'dark' : ''}>
        <div className="min-h-screen bg-surface-primary p-4">
          <div className="text-center py-12 text-text-secondary">
            No data available
          </div>
        </div>
      </div>
    );
  }

  if (data.authRequired && data.authUrl) {
    return (
      <div className={theme === 'dark' ? 'dark' : ''}>
        <div className="min-h-screen bg-surface-primary">
          <AuthRequired authUrl={data.authUrl} openExternal={openExternal} />
        </div>
      </div>
    );
  }

  const invites = data.invites || [];

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className="min-h-screen bg-surface-primary p-4">
        {invites.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold text-text-primary">📅 Pending Invitations</h1>
              <span className="px-3 py-1 bg-primary text-white rounded-full text-sm font-medium">
                {invites.length}
              </span>
            </div>
            
            {data.dateRange && (
              <p className="text-sm text-text-tertiary mb-4">
                {data.dateRange.start} — {data.dateRange.end}
              </p>
            )}

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {invites.map((invite) => (
                <InviteCard 
                  key={invite.eventId} 
                  invite={invite} 
                  onRespond={handleRespond}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

