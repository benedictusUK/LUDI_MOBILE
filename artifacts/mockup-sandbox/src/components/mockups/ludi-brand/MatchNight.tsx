import React, { useState } from "react";
import "./MatchNight.css";
import { dashboardData, events, logoSrc, teams, user } from "./_shared/fixtures";

type Panel = "notifications" | "event" | "create-team" | "create-event" | "events" | "teams" | "search" | "profile" | null;

export function MatchNight() {
  const [panel, setPanel] = useState<Panel>(null);
  const [selectedEvent, setSelectedEvent] = useState(events[0]);
  const [activeTab, setActiveTab] = useState("Home");
  const openEvent = (event: typeof events[number]) => { setSelectedEvent(event); setPanel("event"); };
  const navTo = (label: string) => {
    setActiveTab(label);
    if (label !== "Home") setPanel(label.toLowerCase() as Panel);
  };
  const selectedTitle = panel === "create-team" ? "Create a team" :
    panel === "create-event" ? "Create an event" :
    panel === "notifications" ? "Notifications" :
    panel === "events" ? "Your events" : panel === "teams" ? "Your teams" :
    panel === "search" ? "Find your next game" : panel === "profile" ? "Alex’s profile" : "Event details";
  const selectedCopy = panel === "create-team" ? "Start a new community team. This preview shows the next step without saving anything." :
    panel === "create-event" ? "Bring people together for a game. This preview does not publish an event." :
    panel === "event" ? `${selectedEvent.name} · ${selectedEvent.sport} at ${selectedEvent.location}. Starts ${selectedEvent.startDate} at ${selectedEvent.startTime}.` :
    panel === "notifications" ? "You’re all caught up with the latest from your teams." :
    panel === "events" ? "Your upcoming fixtures are listed below." :
    panel === "teams" ? "Your teams are ready when you are." :
    panel === "search" ? "Search for local sports and teams in LUDI." : "Your LUDI community at a glance.";
  return <div className="mn-shell">
    <header className="mn-header mn-wrap">
      <div className="mn-brand"><img src={logoSrc} alt="LUDI" /></div>
      <div className="mn-header-right">
        <span className="mn-preview">Design preview · example data</span>
        <button className="mn-icon-button" aria-label="Open notifications" onClick={() => setPanel("notifications")}>
          <svg className="mn-bell" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span className="mn-badge">{dashboardData.stats.notificationsCount}</span>
        </button>
      </div>
    </header>
    <main className="mn-wrap">
      <section className="mn-intro">
        <div><div className="mn-kicker">Your community, in play</div><h1>Good evening, {user.firstName}.</h1><p>Here’s what’s coming up.</p></div>
        <div className="mn-date-chip">THU · 08 OCT</div>
      </section>
      <div className="mn-main-grid">
        <section className="mn-fixture" aria-labelledby="fixture-title">
          <div className="mn-fixture-top"><span className="mn-label">Next up · Football</span><span className="mn-next">UP NEXT</span></div>
          <h2 id="fixture-title">{events[0].name}</h2>
          <div className="mn-event-meta">
            <span className="mn-meta-item"><i className="mn-meta-dot" /> Thu, 8 October</span>
            <span className="mn-meta-item"><i className="mn-meta-dot" /> 6:30 pm</span>
            <span className="mn-meta-item"><i className="mn-meta-dot" /> Clapham Leisure Centre</span>
          </div>
          <div className="mn-fixture-footer">
            <div className="mn-team-line">Playing with<strong>South London FC</strong></div>
            <button className="mn-arrow" onClick={() => openEvent(events[0])}>Event details <span aria-hidden="true">↗</span></button>
          </div>
        </section>
        <aside className="mn-side">
          <div className="mn-stats">
            <button className="mn-stat" onClick={() => setPanel("teams")}><strong>{dashboardData.stats.teamsCount}</strong><span>My teams</span></button>
            <button className="mn-stat" onClick={() => setPanel("events")}><strong>{dashboardData.stats.eventsCount}</strong><span>Events</span></button>
          </div>
          <section className="mn-teams">
            <div className="mn-section-head"><h2>My teams</h2><button className="mn-text-link" onClick={() => setPanel("teams")}>See all</button></div>
            {teams.map((team, index) => <div className="mn-team" key={team.id}>
              <div className={`mn-team-mark ${index ? "mint" : ""}`}>{index ? "SS" : "SL"}</div>
              <div className="mn-team-info"><strong>{team.name}</strong><span>{team.sports.join(", ")}</span></div>
            </div>)}
          </section>
        </aside>
      </div>
      <section className="mn-events">
        <div className="mn-section-head"><h2>Coming up</h2><button className="mn-text-link" onClick={() => setPanel("events")}>See all events →</button></div>
        <div className="mn-event-list">
          {events.map((event, index) => <button className="mn-event-row" key={event.id} onClick={() => openEvent(event)}>
            <span className="mn-event-datebox"><strong>{index ? "11" : "08"}</strong><span>{index ? "SUN" : "THU"}</span></span>
            <span className="mn-event-copy"><strong>{event.name}</strong><span>{index ? "10:00 am · Brixton Recreation Centre" : "6:30 pm · Clapham Leisure Centre"}</span></span>
          </button>)}
        </div>
      </section>
      <div className="mn-actions">
        <button className="mn-create primary" onClick={() => setPanel("create-team")}>＋ Create team</button>
        <button className="mn-create" onClick={() => setPanel("create-event")}>＋ Create event</button>
      </div>
    </main>
    <nav className="mn-nav" aria-label="Primary navigation"><div className="mn-nav-inner">
      {["Home", "Events", "Search", "Teams", "Profile"].map(label => <button key={label} className={activeTab === label ? "active" : ""} onClick={() => navTo(label)} aria-current={activeTab === label ? "page" : undefined}>
        <span className="mn-nav-icon" aria-hidden="true" />{label}
      </button>)}
    </div></nav>
    {panel && <div className="mn-scrim" onMouseDown={e => { if (e.target === e.currentTarget) { setPanel(null); setActiveTab("Home"); } }}>
      <section className="mn-dialog" role="dialog" aria-modal="true" aria-labelledby="mn-dialog-title">
        <div className="mn-dialog-head"><h3 id="mn-dialog-title">{selectedTitle}</h3><button className="mn-close" onClick={() => { setPanel(null); setActiveTab("Home"); }} aria-label="Close">×</button></div>
        <p>{selectedCopy}</p>
        {panel === "notifications" && <><div className="mn-notice">Thursday five-a-side<small>South London FC · Your next fixture is coming up.</small></div><div className="mn-notice">Sunday social badminton<small>Sunday Social · 11 October at 10:00 am.</small></div></>}
        {panel === "events" && events.map(ev => <div className="mn-notice" key={ev.id}>{ev.name}<small>{ev.startDate} · {ev.startTime} · {ev.sport}</small></div>)}
        {panel === "teams" && teams.map(team => <div className="mn-notice" key={team.id}>{team.name}<small>{team.sports.join(", ")}</small></div>)}
        <button className="mn-dialog-action" onClick={() => { setPanel(null); setActiveTab("Home"); }}>
          {panel === "create-team" || panel === "create-event" ? "Got it — preview only" : "Done"}
        </button>
      </section>
    </div>}
  </div>;
}

export default MatchNight;
