// Fictional examples shared by every direction; never reads or changes app data.
export const user = {
  firstName: "Alex", username: "alex", dateOfBirth: "1995-01-01",
  postcode: "SW4", gender: "male",
};
export const events = [
  { id: "football", name: "Thursday five-a-side", startDate: "2026-10-08", startTime: "18:30", sport: "Football", location: "Clapham Leisure Centre" },
  { id: "badminton", name: "Sunday social badminton", startDate: "2026-10-11", startTime: "10:00", sport: "Badminton", location: "Brixton Recreation Centre" },
];
export const teams = [
  { id: "south-london", name: "South London FC", sports: ["Football"], color: "#3b82f6" },
  { id: "sunday-social", name: "Sunday Social", sports: ["Badminton"], color: "#10b981" },
];
export const dashboardData = {
  stats: { teamsCount: 2, eventsCount: 2, notificationsCount: 2 },
  upcomingEvents: events, recentTeams: teams,
};
export const logoSrc = "/__mockup/images/ludi-brand-logo.png";
