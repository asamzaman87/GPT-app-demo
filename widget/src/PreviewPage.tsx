import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Link } from 'react-router-dom';
import { WidgetContext, type WidgetContextType } from './WidgetContext';
import { AuthView, InvitesView, ConflictsView } from './components';
import type { AuthStatusOutput, PendingInvitesOutput } from './types';
import './main.css';

// Mock data
const mockAuthNotConnected: AuthStatusOutput = {
  authenticated: false,
  authUrl: 'https://accounts.google.com/oauth'
};

const mockAuthConnected: AuthStatusOutput = {
  authenticated: true,
  email: 'user@example.com'
};

const mockInvites: PendingInvitesOutput = {
  invites: [
    {
      eventId: '1',
      summary: 'Team Standup Meeting',
      description: 'Daily standup to discuss progress and blockers. Please come prepared with updates on your current tasks and any blockers you\'re facing.',
      organizerName: 'John Smith',
      organizerEmail: 'john@company.com',
      startTime: new Date(Date.now() + 86400000).toISOString(),
      endTime: new Date(Date.now() + 86400000 + 1800000).toISOString(), // 30 min later
      isAllDay: false,
      location: 'Conference Room A',
      calendarLink: 'https://calendar.google.com/event?eid=abc123',
      attendees: [
        { email: 'you@company.com', name: 'You', status: 'needsAction', comment: null, self: true },
        { email: 'john@company.com', name: 'John Smith', status: 'accepted', comment: 'Looking forward to it!', self: false },
        { email: 'alice@company.com', name: 'Alice Johnson', status: 'accepted', comment: null, self: false },
        { email: 'bob@company.com', name: 'Bob Williams', status: 'tentative', comment: 'I might be 5 minutes late', self: false },
        { email: 'carol@company.com', name: 'Carol Davis', status: 'declined', comment: 'Conflicting meeting, sorry!', self: false }
      ],
      userComment: null
    },
    {
      eventId: '2',
      summary: 'Q1 Product Review Session',
      description: 'Quarterly product review and planning session. We will cover:\n\n1. Q4 achievements and metrics\n2. Q1 goals and roadmap\n3. Customer feedback review\n4. Resource allocation for upcoming features\n\nPlease review the Q4 summary doc before the meeting.',
      organizerName: 'Sarah Johnson',
      organizerEmail: 'sarah@company.com',
      startTime: new Date(Date.now() + 172800000).toISOString(),
      endTime: new Date(Date.now() + 172800000 + 3600000).toISOString(), // 1 hour later
      isAllDay: false,
      location: 'Zoom Meeting: https://zoom.us/j/123456789',
      calendarLink: 'https://calendar.google.com/event?eid=def456',
      attendees: [
        { email: 'you@company.com', name: 'You', status: 'needsAction', comment: 'I need to review the doc first', self: true },
        { email: 'sarah@company.com', name: 'Sarah Johnson', status: 'accepted', comment: null, self: false },
        { email: 'mike@company.com', name: 'Mike Chen', status: 'accepted', comment: 'Will have Q1 data ready', self: false },
        { email: 'emma@company.com', name: null, status: 'accepted', comment: null, self: false },
      ],
      userComment: 'I need to review the doc first'
    },
    {
      eventId: '3',
      summary: 'Client Presentation - Acme Corp',
      description: null,
      organizerName: null,
      organizerEmail: 'client@external.com',
      startTime: new Date(Date.now() + 259200000).toISOString(),
      endTime: new Date(Date.now() + 259200000 + 5400000).toISOString(), // 1.5 hours later
      isAllDay: false,
      location: null,
      calendarLink: 'https://calendar.google.com/event?eid=ghi789',
      attendees: [
        { email: 'you@company.com', name: 'You', status: 'needsAction', comment: null, self: true },
        { email: 'client@external.com', name: 'External Client', status: 'accepted', comment: null, self: false },
      ],
      userComment: null
    }
  ],
  dateRange: {
    start: new Date().toISOString(),
    end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() // 2 weeks from now
  }
};

const mockEmptyInvites: PendingInvitesOutput = {
  invites: [],
  dateRange: {
    start: new Date().toISOString(),
    end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() // 2 weeks from now
  }
};

const mockEmptyConflicts: PendingInvitesOutput = {
  invites: [],
  dateRange: {
    start: new Date().toISOString(),
    end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() // 2 weeks from now
  }
};

const mockConflictingEvents: PendingInvitesOutput = {
  invites: [
    {
      eventId: 'conf1',
      summary: 'Marketing Strategy Meeting',
      description: 'Q1 marketing planning and budget allocation',
      organizerName: 'Sarah Chen',
      organizerEmail: 'sarah@company.com',
      startTime: new Date(Date.now() + 86400000).toISOString(), // Tomorrow 10:00 AM
      endTime: new Date(Date.now() + 86400000 + 3600000).toISOString(), // Tomorrow 11:00 AM
      isAllDay: false,
      location: 'Conference Room B',
      calendarLink: 'https://calendar.google.com/event?eid=conf1',
      attendees: [
        { email: 'you@company.com', name: 'You', status: 'accepted', comment: null, self: true, organizer: false },
        { email: 'sarah@company.com', name: 'Sarah Chen', status: 'accepted', comment: null, self: false, organizer: true },
        { email: 'mike@company.com', name: 'Mike Wilson', status: 'accepted', comment: null, self: false, organizer: false },
      ],
      userComment: null
    },
    {
      eventId: 'conf2',
      summary: 'Engineering Sync',
      description: 'Weekly engineering team sync - sprint planning',
      organizerName: null,
      organizerEmail: 'you@company.com',
      startTime: new Date(Date.now() + 86400000 + 1800000).toISOString(), // Tomorrow 10:30 AM (overlaps!)
      endTime: new Date(Date.now() + 86400000 + 5400000).toISOString(), // Tomorrow 11:30 AM
      isAllDay: false,
      location: 'Zoom: https://zoom.us/j/123456',
      calendarLink: 'https://calendar.google.com/event?eid=conf2',
      attendees: [
        { email: 'you@company.com', name: 'You', status: 'accepted', comment: 'I have a conflict with marketing meeting', self: true, organizer: true },
        { email: 'alex@company.com', name: 'Alex Rodriguez', status: 'accepted', comment: null, self: false, organizer: false },
        { email: 'jamie@company.com', name: 'Jamie Lee', status: 'tentative', comment: 'Might join late', self: false, organizer: false },
      ],
      userComment: 'I have a conflict with marketing meeting'
    },
    {
      eventId: 'conf3',
      summary: 'Client Demo - TechCorp',
      description: null,
      organizerName: 'Linda Johnson',
      organizerEmail: 'linda@company.com',
      startTime: new Date(Date.now() + 86400000 + 2700000).toISOString(), // Tomorrow 10:45 AM (overlaps with both!)
      endTime: new Date(Date.now() + 86400000 + 6300000).toISOString(), // Tomorrow 11:45 AM
      isAllDay: false,
      location: 'Meet: https://meet.google.com/abc-defg-hij',
      calendarLink: 'https://calendar.google.com/event?eid=conf3',
      attendees: [
        { email: 'you@company.com', name: 'You', status: 'needsAction', comment: null, self: true, organizer: false },
        { email: 'linda@company.com', name: 'Linda Johnson', status: 'accepted', comment: null, self: false, organizer: true },
        { email: 'client@techcorp.com', name: 'John Smith', status: 'accepted', comment: null, self: false, organizer: false },
      ],
      userComment: null
    }
  ],
  dateRange: {
    start: new Date().toISOString(),
    end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() // 2 weeks from now
  }
};

function PreviewNav() {
  const location = useLocation();
  const isDark = location.pathname.includes('dark');
  
  const navLinks = [
    { path: '/auth-not-connected', label: 'Auth (Not Connected)' },
    { path: '/auth-connected', label: 'Auth (Connected)' },
    { path: '/invites', label: 'Invites List' },
    { path: '/invites-empty', label: 'Invites (Empty)' },
    { path: '/conflicts', label: 'Conflicting Events' },
    { path: '/conflicts-empty', label: 'Conflicts (Empty)' },
  ];

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 border-b ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Component Preview
          </h1>
          <div className="flex gap-2">
            <Link 
              to={location.pathname.replace('/dark', '')} 
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                !isDark 
                  ? 'bg-amber-100 text-amber-900' 
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              ☀️ Light
            </Link>
            <Link 
              to={`${location.pathname.replace('/dark', '')}/dark`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isDark 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              🌙 Dark
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {navLinks.map(link => {
            const linkPath = isDark ? `${link.path}/dark` : link.path;
            const isActive = location.pathname === linkPath;
            return (
              <Link
                key={link.path}
                to={linkPath}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? isDark 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-indigo-600 text-white'
                    : isDark
                      ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PreviewRoutes() {
  const location = useLocation();
  const navigate = useNavigate();
  const isDark = location.pathname.includes('/dark');
  const theme = isDark ? 'dark' : 'light';
  
  const [authData, setAuthData] = useState<AuthStatusOutput | null>(null);
  const [invitesData, setInvitesData] = useState<PendingInvitesOutput | null>(null);
  
  // Set data based on current route
  useEffect(() => {
    const path = location.pathname.replace('/dark', '');
    
    if (path.includes('/invites-empty')) {
      setInvitesData(mockEmptyInvites);
    } else if (path.includes('/conflicts-empty')) {
      setInvitesData(mockEmptyConflicts);
    } else if (path.includes('/conflicts')) {
      setInvitesData(mockConflictingEvents);
    } else if (path.includes('/invites')) {
      setInvitesData(mockInvites);
    }
  }, [location.pathname]);
  
  // Redirect from root to default view
  useEffect(() => {
    if (location.pathname === '/' || location.pathname === '/preview.html') {
      navigate('/auth-not-connected', { replace: true });
    }
  }, [location.pathname, navigate]);

  const mockContext: WidgetContextType = {
    theme,
    isDark,
    callTool: async (name: string, args: Record<string, unknown>) => {
      console.log('Mock callTool:', name, args);
      await new Promise(resolve => setTimeout(resolve, 500));
      return { structuredContent: {} };
    },
    openExternal: (options: { href: string }) => {
      console.log('Mock openExternal:', options.href);
      alert('Would open: ' + options.href);
    },
    notifyHeight: () => {},
    setWidgetState: () => {},
    authData,
    setAuthData,
    invitesData,
    setInvitesData,
    widgetStateView: location.pathname.includes('conflicts') ? 'conflicts' : location.pathname.includes('invites') ? 'invites' : undefined,
  };

  return (
    <div className={isDark ? 'dark' : ''}>
      <PreviewNav />
      <div className={`pt-32 pb-8 px-4 min-h-screen transition-colors ${isDark ? 'bg-black' : 'bg-slate-100'}`}>
        <div className="max-w-lg mx-auto">
          <WidgetContext.Provider value={mockContext}>
            <Routes>
              <Route path="/auth-not-connected" element={<AuthView initialAuthData={mockAuthNotConnected} />} />
              <Route path="/auth-not-connected/dark" element={<AuthView initialAuthData={mockAuthNotConnected} />} />
              
              <Route path="/auth-connected" element={<AuthView initialAuthData={mockAuthConnected} />} />
              <Route path="/auth-connected/dark" element={<AuthView initialAuthData={mockAuthConnected} />} />
              
              <Route path="/invites" element={<InvitesView />} />
              <Route path="/invites/dark" element={<InvitesView />} />
              
              <Route path="/invites-empty" element={<InvitesView />} />
              <Route path="/invites-empty/dark" element={<InvitesView />} />
              
              <Route path="/conflicts" element={<ConflictsView />} />
              <Route path="/conflicts/dark" element={<ConflictsView />} />
              
              <Route path="/conflicts-empty" element={<ConflictsView />} />
              <Route path="/conflicts-empty/dark" element={<ConflictsView />} />
              
              <Route path="/" element={<AuthView initialAuthData={mockAuthNotConnected} />} />
            </Routes>
          </WidgetContext.Provider>
        </div>
      </div>
    </div>
  );
}

export default function PreviewPage() {
  return (
    <BrowserRouter basename="/">
      <PreviewRoutes />
    </BrowserRouter>
  );
}

