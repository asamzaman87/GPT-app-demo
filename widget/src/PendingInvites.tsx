import { useState, useEffect } from 'react';
import { useOpenAI } from './useOpenAI';
import type { PendingInvitesOutput, PendingInvite } from './types';
import { Button } from '@openai/apps-sdk-ui/components/Button';
import { Badge } from '@openai/apps-sdk-ui/components/Badge';
import { Calendar, Check, X } from '@openai/apps-sdk-ui/components/Icon';
import './main.css';

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

export default function PendingInvites() {
  const { data, theme, isLoading, callTool, notifyHeight } = useOpenAI<PendingInvitesOutput>();

  useEffect(() => { if (!isLoading) notifyHeight(); }, [isLoading, data]);

  const handleRespond = async (eventId: string, response: string) => {
    await callTool('respond_to_invite', { event_id: eventId, response });
  };

  if (isLoading) return <div className={theme === 'dark' ? 'dark' : ''}><div className="bg-surface rounded-xl py-16 text-center"><div className="size-10 mx-auto rounded-full border-4 border-subtle border-t-primary animate-spin" /><p className="text-secondary mt-4 text-sm">Loading...</p></div></div>;
  if (!data) return <div className={theme === 'dark' ? 'dark' : ''}><div className="bg-surface rounded-xl p-6 text-center text-secondary">No data</div></div>;

  const invites = data.invites || [];

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className="bg-surface rounded-xl">
        {invites.length === 0 ? (
          <div className="py-16 text-center">
            <div className="size-16 mx-auto rounded-2xl bg-success-soft flex items-center justify-center mb-4"><Check className="size-8 text-success" /></div>
            <h2 className="heading-lg mb-2">All Caught Up!</h2>
            <p className="text-secondary text-sm">No pending invitations.</p>
          </div>
        ) : (
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-primary-soft flex items-center justify-center"><Calendar className="size-5 text-primary" /></div>
                <h1 className="heading-md">Pending Invites</h1>
              </div>
              <Badge color="primary">{invites.length}</Badge>
            </div>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {invites.map((invite) => <InviteCard key={invite.eventId} invite={invite} onRespond={handleRespond} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
