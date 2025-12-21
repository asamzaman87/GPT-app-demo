import { useEffect } from 'react';
import { useOpenAI } from './useOpenAI';
import type { RespondResultOutput } from './types';
import { Badge } from '@openai/apps-sdk-ui/components/Badge';
import { Check, X, Calendar } from '@openai/apps-sdk-ui/components/Icon';
import './main.css';

function Success({ response, eventSummary }: { response?: string; eventSummary?: string }) {
  const isAccepted = response === 'accepted';
  const isDeclined = response === 'declined';
  const action = isAccepted ? 'Accepted' : isDeclined ? 'Declined' : 'Marked as Maybe';
  const badgeColor = isAccepted ? 'success' : isDeclined ? 'danger' : 'warning';
  const bgClass = isAccepted ? 'bg-success-soft' : isDeclined ? 'bg-danger-soft' : 'bg-warning-soft';
  const iconClass = isAccepted ? 'text-success' : isDeclined ? 'text-danger' : 'text-warning';

  return (
    <div className="p-6 text-center">
      <div className={`size-16 mx-auto rounded-2xl ${bgClass} flex items-center justify-center mb-4`}>
        {isDeclined ? <X className={`size-8 ${iconClass}`} /> : <Check className={`size-8 ${iconClass}`} />}
      </div>
      <h2 className="heading-lg mb-2">Invitation {action}!</h2>
      {eventSummary && (
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-surface-secondary rounded-lg mb-4">
          <Calendar className="size-4 text-secondary" />
          <span className="text-sm font-medium">{eventSummary}</span>
        </div>
      )}
      <div><Badge color={badgeColor}>✓ Response Sent</Badge></div>
    </div>
  );
}

function ErrorState({ error }: { error?: string }) {
  return (
    <div className="p-6 text-center">
      <div className="size-16 mx-auto rounded-2xl bg-danger-soft flex items-center justify-center mb-4">
        <X className="size-8 text-danger" />
      </div>
      <h2 className="heading-lg mb-2">Something Went Wrong</h2>
      <Badge color="danger">Failed</Badge>
      <p className="text-danger text-sm mt-4">{error || 'Please try again.'}</p>
    </div>
  );
}

export default function RespondResult() {
  const { data, theme, isLoading, notifyHeight } = useOpenAI<RespondResultOutput>();

  useEffect(() => { if (!isLoading) notifyHeight(); }, [isLoading, data]);

  if (isLoading) return <div className={theme === 'dark' ? 'dark' : ''}><div className="bg-surface rounded-xl py-16 text-center"><div className="size-10 mx-auto rounded-full border-4 border-subtle border-t-primary animate-spin" /><p className="text-secondary mt-4 text-sm">Sending...</p></div></div>;
  if (!data) return <div className={theme === 'dark' ? 'dark' : ''}><div className="bg-surface rounded-xl p-6 text-center text-secondary">No data</div></div>;

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className="bg-surface rounded-xl overflow-hidden">
        {data.success ? <Success response={data.response} eventSummary={data.eventSummary} /> : <ErrorState error={data.error} />}
      </div>
    </div>
  );
}
