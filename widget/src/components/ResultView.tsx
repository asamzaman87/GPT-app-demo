import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@openai/apps-sdk-ui/components/Button';
import { Badge } from '@openai/apps-sdk-ui/components/Badge';
import { Calendar, Check, X } from '@openai/apps-sdk-ui/components/Icon';
import { useWidget } from '../WidgetContext';
import { theme } from '../theme';

export function ResultView() {
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

