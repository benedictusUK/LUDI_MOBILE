import React, { useState } from "react";
import {
  ArrowRight, Bell, CalendarDays, ChevronRight, Clock3, Home,
  MapPin, Plus, Search, Shield, Users, X,
} from "lucide-react";
import { dashboardData, events, logoSrc, teams, user } from "./_shared/fixtures";
import "./CleanSport.css";

type DialogState =
  | { kind: "event"; eventId: string }
  | { kind: "notifications" }
  | { kind: "create-team" }
  | { kind: "create-event" }
  | null;

const navItems = [
  { label: "Home", icon: Home },
  { label: "Events", icon: CalendarDays },
  { label: "Search", icon: Search },
  { label: "Teams", icon: Users },
  { label: "Profile", icon: Shield },
];

function dateParts(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  return {
    weekday: parsed.toLocaleDateString("en-GB", { weekday: "short" }),
    month: parsed.toLocaleDateString("en-GB", { month: "short" }),
    day: parsed.toLocaleDateString("en-GB", { day: "2-digit" }),
    long: parsed.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }),
  };
}

export function CleanSport() {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [activeTab, setActiveTab] = useState("Home");
  const [toast, setToast] = useState("");
  const nextEvent = events[0];
  const eventDetails = dialog?.kind === "event" ? events.find((item) => item.id === dialog.eventId) : undefined;
  const selectedDate = eventDetails ? dateParts(eventDetails.startDate) : null;

  const announce = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  const selectTab = (label: string) => {
    setActiveTab(label);
    if (label !== "Home") announce(`${label} selected · preview navigation`);
  };

  return (
    <div className="clean-sport">
      <div className="cs-shell">
        <header className="cs-topbar">
          <div className="cs-brand-plate">
            <img src={logoSrc} alt="LUDI" />
          </div>
          <div className="cs-top-actions">
            <span className="cs-preview-tag">Design preview · example data</span>
            <button className="cs-notify" aria-label="Open notifications" onClick={() => setDialog({ kind: "notifications" })}>
              <Bell aria-hidden="true" />
              <span className="cs-notify-count">{dashboardData.stats.notificationsCount}</span>
            </button>
          </div>
        </header>

        <main className="cs-main">
          <section className="cs-welcome" aria-label="Welcome">
            <div>
              <p className="cs-eyebrow">Your local sports community</p>
              <h1>Good to see you, <span>{user.firstName}.</span></h1>
              <p className="cs-welcome-copy">A good week starts with a game.</p>
            </div>
            <div className="cs-counts" aria-label="Your activity">
              <div className="cs-count"><strong>{dashboardData.stats.teamsCount}</strong><span>My teams</span></div>
              <div className="cs-count"><strong>{dashboardData.stats.eventsCount}</strong><span>Events</span></div>
            </div>
          </section>

          <div className="cs-layout">
            <div className="cs-primary-column">
              <section aria-labelledby="cs-upcoming-title">
                <div className="cs-section-head">
                  <div>
                    <h2 id="cs-upcoming-title">UP NEXT</h2>
                    <p className="cs-section-note">Your next chance to get out and play.</p>
                  </div>
                  <button className="cs-link-button" onClick={() => selectTab("Events")}>See all</button>
                </div>
                <article className="cs-next-card">
                  <div className="cs-next-top">
                    <span className="cs-next-label">Next event</span>
                    <span className="cs-next-pill"><i aria-hidden="true" /> Coming up</span>
                  </div>
                  <div className="cs-event-core">
                    <div className="cs-date-block" aria-label={dateParts(nextEvent.startDate).long}>
                      <span>{dateParts(nextEvent.startDate).weekday}</span>
                      <strong>{dateParts(nextEvent.startDate).day}</strong>
                    </div>
                    <div>
                      <h3 className="cs-event-title">{nextEvent.name}</h3>
                      <div className="cs-event-meta">
                        <span><Clock3 aria-hidden="true" />{nextEvent.startTime}</span>
                        <span><MapPin aria-hidden="true" />{nextEvent.location}</span>
                      </div>
                    </div>
                  </div>
                  <div className="cs-event-foot">
                    <span className="cs-sport-mark">{nextEvent.sport}</span>
                    <button className="cs-open-event" onClick={() => setDialog({ kind: "event", eventId: nextEvent.id })}>
                      Event details <ArrowRight aria-hidden="true" />
                    </button>
                  </div>
                </article>
              </section>

              <section className="cs-paper-card" aria-labelledby="cs-more-events">
                <div className="cs-section-head">
                  <div><h2 id="cs-more-events">MORE TO PLAY</h2><p className="cs-section-note">The next dates on your calendar.</p></div>
                  <button className="cs-link-button" onClick={() => selectTab("Events")}>See all</button>
                </div>
                <div className="cs-event-list">
                  {events.slice(1).map((event) => {
                    const date = dateParts(event.startDate);
                    return (
                      <button className="cs-event-row" key={event.id} onClick={() => setDialog({ kind: "event", eventId: event.id })}>
                        <span className="cs-mini-date"><span>{date.month}</span><strong>{date.day}</strong></span>
                        <span><span className="cs-row-title">{event.name}</span><span className="cs-row-subtitle">{date.weekday} · {event.startTime} · {event.sport}</span></span>
                        <ChevronRight className="cs-row-arrow" aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>

            <aside className="cs-side-column">
              <section className="cs-paper-card" aria-labelledby="cs-teams-title">
                <div className="cs-section-head">
                  <div><h2 id="cs-teams-title">YOUR TEAMS</h2><p className="cs-section-note">Your people, ready to play.</p></div>
                  <button className="cs-link-button" onClick={() => selectTab("Teams")}>See all</button>
                </div>
                <div className="cs-team-list">
                  {teams.map((team) => (
                    <div className="cs-team-row" key={team.id}>
                      <span className="cs-team-avatar" aria-hidden="true">{team.name.slice(0, 1)}</span>
                      <span><span className="cs-team-name">{team.name}</span><span className="cs-team-sport">{team.sports.join(", ")}</span></span>
                      <ChevronRight className="cs-team-chevron" size={17} aria-hidden="true" />
                    </div>
                  ))}
                </div>
              </section>

              <section className="cs-paper-card" aria-labelledby="cs-create-title">
                <div className="cs-section-head">
                  <div><h2 id="cs-create-title">MAKE IT HAPPEN</h2><p className="cs-section-note">Bring your next game together.</p></div>
                </div>
                <div className="cs-create-grid">
                  <button className="cs-create-button" onClick={() => setDialog({ kind: "create-team" })}><Plus aria-hidden="true" />Create team</button>
                  <button className="cs-create-button secondary" onClick={() => setDialog({ kind: "create-event" })}><CalendarDays aria-hidden="true" />Create event</button>
                </div>
              </section>
            </aside>
          </div>
          <p className="cs-preview-footnote">Example community activity shown for design preview.</p>
        </main>
      </div>

      <nav className="cs-bottom-nav" aria-label="Main navigation">
        {navItems.map(({ label, icon: Icon }) => (
          <button key={label} className={`cs-nav-item${activeTab === label ? " active" : ""}`} aria-current={activeTab === label ? "page" : undefined} onClick={() => selectTab(label)}>
            <Icon aria-hidden="true" /><span>{label}</span>
          </button>
        ))}
      </nav>

      {dialog && (
        <div className="cs-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(null); }}>
          <section className="cs-modal" role="dialog" aria-modal="true" aria-labelledby="cs-dialog-title">
            <div className="cs-modal-top">
              <div>
                <p className="cs-modal-kicker">LUDI · design preview</p>
                <h3 id="cs-dialog-title">
                  {dialog.kind === "event" ? "Event details" : dialog.kind === "notifications" ? "Notifications" : dialog.kind === "create-team" ? "Create a team" : "Create an event"}
                </h3>
              </div>
              <button className="cs-close" aria-label="Close dialog" onClick={() => setDialog(null)}><X /></button>
            </div>
            {dialog.kind === "event" && eventDetails && selectedDate && (
              <>
                <p className="cs-modal-body">A community {eventDetails.sport.toLowerCase()} get-together. Open the details to see what your next game looks like.</p>
                <div className="cs-modal-detail">
                  <span><CalendarDays />{selectedDate.long}</span>
                  <span><Clock3 />{eventDetails.startTime}</span>
                  <span><MapPin />{eventDetails.location}</span>
                  <span><Users />{eventDetails.sport}</span>
                </div>
                <button className="cs-modal-confirm" onClick={() => { setDialog(null); announce("Event details opened in preview."); }}>Done</button>
              </>
            )}
            {dialog.kind === "notifications" && (
              <>
                <p className="cs-modal-body">A quick look at what is new in your community.</p>
                <div className="cs-notice-item"><i className="cs-notice-dot" /><span>Your teams and upcoming events are ready when you are.</span></div>
                <div className="cs-notice-item"><i className="cs-notice-dot" /><span>New games are being organised around your area.</span></div>
                <button className="cs-modal-confirm" onClick={() => setDialog(null)}>Got it</button>
              </>
            )}
            {(dialog.kind === "create-team" || dialog.kind === "create-event") && (
              <>
                <p className="cs-modal-body">
                  {dialog.kind === "create-team"
                    ? "Bring people together around the sport you love. This preview shows the start of the flow; it will not create or save a team."
                    : "Set up a game and invite your community. This preview shows the start of the flow; it will not create or book an event."}
                </p>
                <button className="cs-modal-confirm" onClick={() => { const kind = dialog.kind === "create-team" ? "team" : "event"; setDialog(null); announce(`Create ${kind} flow preview selected.`); }}>Continue preview</button>
                <button className="cs-modal-secondary" onClick={() => setDialog(null)}>Not now</button>
              </>
            )}
          </section>
        </div>
      )}
      {toast && <div className="cs-toast" role="status">{toast}</div>}
    </div>
  );
}

export default CleanSport;
