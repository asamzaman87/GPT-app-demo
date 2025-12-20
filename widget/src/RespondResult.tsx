import React, { useEffect } from 'react';
import { useOpenAI } from './useOpenAI';
import type { RespondResultOutput } from './types';
import './main.css';

function Success({ response, message, eventSummary }: { 
  response?: string; 
  message?: string; 
  eventSummary?: string;
}) {
  const emoji = response === 'accepted' ? '✅' : response === 'declined' ? '❌' : '❓';
  const action = response === 'accepted' ? 'Accepted' : response === 'declined' ? 'Declined' : 'Marked as Tentative';
  const bgColor = response === 'accepted' 
    ? 'bg-green-50 dark:bg-green-950' 
    : response === 'declined' 
    ? 'bg-red-50 dark:bg-red-950' 
    : 'bg-amber-50 dark:bg-amber-950';

  return (
    <div className={`flex flex-col items-center justify-center py-8 px-6 text-center ${bgColor} rounded-xl`}>
      <div className="text-5xl mb-3">{emoji}</div>
      <h2 className="text-lg font-semibold text-text-primary mb-1">Invitation {action}</h2>
      {eventSummary && (
        <p className="text-text-primary font-medium">{eventSummary}</p>
      )}
      {message && (
        <p className="text-text-secondary text-sm mt-2">{message}</p>
      )}
    </div>
  );
}

function Error({ error }: { error?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-6 text-center bg-red-50 dark:bg-red-950 rounded-xl">
      <div className="text-5xl mb-3">❌</div>
      <h2 className="text-lg font-semibold text-text-primary mb-1">Error</h2>
      <p className="text-red-600 dark:text-red-400 text-sm">{error || 'Failed to respond to invitation'}</p>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="animate-spin h-8 w-8 border-3 border-primary border-t-transparent rounded-full mb-4" />
      <p className="text-text-secondary">Processing...</p>
    </div>
  );
}

export default function RespondResult() {
  const { data, theme, isLoading, notifyHeight } = useOpenAI<RespondResultOutput>();

  useEffect(() => {
    if (!isLoading) {
      notifyHeight();
    }
  }, [isLoading, data]);

  if (isLoading) {
    return (
      <div className={theme === 'dark' ? 'dark' : ''}>
        <div className="min-h-[200px] bg-surface-primary p-4">
          <Loading />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={theme === 'dark' ? 'dark' : ''}>
        <div className="min-h-[200px] bg-surface-primary p-4 flex items-center justify-center">
          <p className="text-text-secondary">No data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className="min-h-[200px] bg-surface-primary p-4">
        {data.success ? (
          <Success 
            response={data.response} 
            message={data.message} 
            eventSummary={data.eventSummary} 
          />
        ) : (
          <Error error={data.error} />
        )}
      </div>
    </div>
  );
}

