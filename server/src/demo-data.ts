import { PendingInvite } from './types.js';

/**
 * Mock calendar invites for demo/test mode
 * These are used when TEST_MODE_ENABLED is true
 */
export function getDemoInvites(): PendingInvite[] {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const in2Days = new Date(now);
  in2Days.setDate(in2Days.getDate() + 2);
  
  const in3Days = new Date(now);
  in3Days.setDate(in3Days.getDate() + 3);
  
  const in5Days = new Date(now);
  in5Days.setDate(in5Days.getDate() + 5);
  
  const in7Days = new Date(now);
  in7Days.setDate(in7Days.getDate() + 7);

  const in10Days = new Date(now);
  in10Days.setDate(in10Days.getDate() + 10);

  return [
    {
      eventId: 'demo_event_1',
      summary: 'Team Standup Meeting',
      description: 'Daily standup to discuss progress and blockers. Please come prepared with your updates.',
      location: 'Conference Room A',
      startTime: tomorrow.toISOString().split('.')[0] + '-05:00',
      endTime: new Date(tomorrow.getTime() + 30 * 60000).toISOString().split('.')[0] + '-05:00',
      isAllDay: false,
      organizerEmail: 'manager@company.com',
      organizerName: 'Sarah Johnson',
      attendees: [
        { email: 'demo@example.com', name: 'Demo User', status: 'needsAction' },
        { email: 'john@company.com', name: 'John Smith', status: 'accepted' },
        { email: 'alice@company.com', name: 'Alice Chen', status: 'accepted' },
        { email: 'manager@company.com', name: 'Sarah Johnson', status: 'accepted' },
      ],
      calendarLink: 'https://calendar.google.com/calendar/event?eid=demo1',
    },
    {
      eventId: 'demo_event_2',
      summary: 'Q1 Budget Review',
      description: 'Review the Q1 budget allocations and discuss adjustments for Q2. Bring your department budgets and projections.',
      location: 'Executive Conference Room',
      startTime: in2Days.toISOString().split('.')[0] + '-05:00',
      endTime: new Date(in2Days.getTime() + 90 * 60000).toISOString().split('.')[0] + '-05:00',
      isAllDay: false,
      organizerEmail: 'cfo@company.com',
      organizerName: 'Michael Williams',
      attendees: [
        { email: 'demo@example.com', name: 'Demo User', status: 'needsAction' },
        { email: 'cfo@company.com', name: 'Michael Williams', status: 'accepted' },
        { email: 'director1@company.com', name: 'Emily Davis', status: 'tentative' },
        { email: 'director2@company.com', name: 'Robert Lee', status: 'accepted' },
      ],
      calendarLink: 'https://calendar.google.com/calendar/event?eid=demo2',
    },
    {
      eventId: 'demo_event_3',
      summary: 'Client Presentation - Product Demo',
      description: 'Present our new features to ProTech Industries. This is a key opportunity to secure the contract. Please review the deck beforehand.',
      location: 'Zoom Meeting (link in calendar)',
      startTime: in3Days.toISOString().split('.')[0] + '-05:00',
      endTime: new Date(in3Days.getTime() + 60 * 60000).toISOString().split('.')[0] + '-05:00',
      isAllDay: false,
      organizerEmail: 'sales@company.com',
      organizerName: 'David Martinez',
      attendees: [
        { email: 'demo@example.com', name: 'Demo User', status: 'needsAction' },
        { email: 'sales@company.com', name: 'David Martinez', status: 'accepted' },
        { email: 'client@protech.com', name: 'Jennifer Parker', status: 'accepted' },
        { email: 'client2@protech.com', name: 'Tom Anderson', status: 'accepted' },
      ],
      calendarLink: 'https://calendar.google.com/calendar/event?eid=demo3',
    },
    {
      eventId: 'demo_event_4',
      summary: 'Lunch with Marketing Team',
      description: null,
      location: 'Bella Italia Restaurant',
      startTime: in5Days.toISOString().split('.')[0] + '-05:00',
      endTime: new Date(in5Days.getTime() + 90 * 60000).toISOString().split('.')[0] + '-05:00',
      isAllDay: false,
      organizerEmail: 'lisa@company.com',
      organizerName: 'Lisa Brown',
      attendees: [
        { email: 'demo@example.com', name: 'Demo User', status: 'needsAction' },
        { email: 'lisa@company.com', name: 'Lisa Brown', status: 'accepted' },
        { email: 'mark@company.com', name: 'Mark Wilson', status: 'accepted' },
        { email: 'sophie@company.com', name: 'Sophie Taylor', status: 'tentative' },
      ],
      calendarLink: 'https://calendar.google.com/calendar/event?eid=demo4',
    },
    {
      eventId: 'demo_event_5',
      summary: 'Sprint Planning Session',
      description: 'Plan the upcoming sprint. We\'ll review the backlog, estimate stories, and commit to sprint goals for the next two weeks.',
      location: 'Development Lab',
      startTime: in7Days.toISOString().split('.')[0] + '-05:00',
      endTime: new Date(in7Days.getTime() + 120 * 60000).toISOString().split('.')[0] + '-05:00',
      isAllDay: false,
      organizerEmail: 'scrummaster@company.com',
      organizerName: 'Alex Thompson',
      attendees: [
        { email: 'demo@example.com', name: 'Demo User', status: 'needsAction' },
        { email: 'scrummaster@company.com', name: 'Alex Thompson', status: 'accepted' },
        { email: 'dev1@company.com', name: 'Chris Martin', status: 'accepted' },
        { email: 'dev2@company.com', name: 'Nina Rodriguez', status: 'accepted' },
        { email: 'dev3@company.com', name: 'Kevin Zhang', status: 'accepted' },
      ],
      calendarLink: 'https://calendar.google.com/calendar/event?eid=demo5',
    },
    {
      eventId: 'demo_event_6',
      summary: 'All-Hands Company Meeting',
      description: 'Monthly all-hands meeting. CEO will share company updates, Q1 results, and Q2 strategy. Department heads will present their team highlights.',
      location: 'Main Auditorium',
      startTime: in10Days.toISOString().split('.')[0] + '-05:00',
      endTime: new Date(in10Days.getTime() + 60 * 60000).toISOString().split('.')[0] + '-05:00',
      isAllDay: false,
      organizerEmail: 'ceo@company.com',
      organizerName: 'Jessica White',
      attendees: [
        { email: 'demo@example.com', name: 'Demo User', status: 'needsAction' },
        { email: 'ceo@company.com', name: 'Jessica White', status: 'accepted' },
        { email: 'cfo@company.com', name: 'Michael Williams', status: 'accepted' },
        { email: 'cto@company.com', name: 'Andrew Kim', status: 'accepted' },
      ],
      calendarLink: 'https://calendar.google.com/calendar/event?eid=demo6',
    },
  ];
}

/**
 * Check if a user ID is a demo/test user
 */
export function isDemoUser(userId: string): boolean {
  return userId === 'demo_test_user';
}

