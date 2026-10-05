import React, { useState } from "react";
import { Bell, CalendarDays, ChevronRight, CircleUserRound, House, Plus, Search, Shield, Users, X } from "lucide-react";
import { dashboardData, events, logoSrc, teams, user } from "./_shared/fixtures";
import "./CommunityClub.css";

type DialogState = { title: string; body: string; action?: string } | null;

function formatEventDate(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  return {
    month: parsed.toLocaleDateString("en-GB", { month: "short" }),
    day: parsed.toLocaleDateString("en-GB", { day: "2-digit" }),
    weekday: parsed.toLocaleDateString("en-GB", { weekday: "long" }),
  };
}

export function CommunityClub() {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [toast, setToast] = useState("");
  const [activeTab, setActiveTab] = useState("Home");
  const showDialog = (title: string, body: string, action?: string) => setDialog({ title, body, action });
  const dismissDialog = () => setDialog(null);

  const navItems = [
    { name: "Home", icon: House }, { name: "Events", icon: CalendarDays }, { name: "Search", icon: Search },
    { name: "Teams", icon: Users }, { name: "Profile", icon: CircleUserRound },
  ];

  return (
    <div className="club-home">
      <header className="club-topbar">
        <div className="club-topbar-inner">
          <div className="club-brand"><img src={logoSrc} alt="LUDI" /></div>
          <div className="club-head-right">
            <span className="club-preview">DESIGN PREVIEW · EXAMPLE DATA</span>
            <button className="club-bell" aria-label="View notifications" onClick={() => showDialog("You’re all caught up", "Two unread notifications are waiting in your LUDI inbox.", "Close")}>
              <Bell size={20} aria-hidden="true" /><span className="club-badge">{dashboardData.stats.notificationsCount}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="club-shell">
        <section className="club-intro" aria-label="Welcome">
          <div>
            <p className="club-eyebrow">Your local sports circle</p>
            <h1 className="club-greeting">Good to see you, {user.firstName}.</h1>
            <p className="club-subtitle">A little movement. A lot of good company.</p>
          </div>
          <div className="club-small-counts" aria-label="Your activity">
            <div className="club-count"><span className="club-count-number">{dashboardData.stats.teamsCount}</span><span className="club-count-label">your<br />teams</span></div>
            <div className="club-count"><span className="club-count-number">{dashboardData.stats.eventsCount}</span><span className="club-count-label">upcoming<br />events</span></div>
          </div>
        </section>

        <div className="club-layout">
          <div className="club-maincol">
            <section className="club-section" aria-labelledby="club-events-title">
              <div className="club-section-heading">
                <h2 id="club-events-title">Next up for you</h2>
                <button className="club-link" onClick={() => { setActiveTab("Events"); showDialog("All upcoming events", "Your Events view is selected. Thursday five-a-side and Sunday social badminton are coming up."); }}>See all</button>
              </div>
              <div className="club-event-list">
                {events.map((event, index) => {
                  const date = formatEventDate(event.startDate);
                  return (
                    <button className={`club-event ${index === 0 ? "featured" : ""}`} key={event.id}
                      onClick={() => showDialog(event.name, `${date.weekday} · ${event.startTime} · ${event.location}`, "Got it")}>
                      <span className="club-datebox"><span className="club-date-month">{date.month}</span><span className="club-date-day">{date.day}</span></span>
                      <span className="club-event-copy">
                        <span className="club-event-kicker">{index === 0 ? "YOUR NEXT GAME" : "COMING UP"}</span>
                        <span className="club-event-title">{event.name}</span>
                        <span className="club-event-meta">{event.startTime} · {event.sport} · {event.location}</span>
                      </span>
                      <ChevronRight className="club-event-arrow" size={19} aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          <aside className="club-sidecol">
            <section className="club-teams-panel club-section" aria-labelledby="club-teams-title">
              <div className="club-section-heading">
                <h2 id="club-teams-title">Your people</h2>
                <button className="club-link" onClick={() => { setActiveTab("Teams"); showDialog("Your teams", "South London FC and Sunday Social are your teams. Pick a team to see its activities."); }}>See all</button>
              </div>
              <div className="club-team-list">
                {teams.map((team, index) => (
                  <button className="club-team-row" key={team.id} onClick={() => showDialog(team.name, `You’re part of this ${team.sports.join(", ")} team. Team details are shown in this preview.`, "Lovely")}>
                    <span className={`club-team-mark ${index === 0 ? "blue" : "green"}`}>{index === 0 ? <Shield size={20} /> : <Users size={20} />}</span>
                    <span><span className="club-team-name">{team.name}</span><span className="club-team-sport">{team.sports.join(", ")}</span></span>
                    <ChevronRight size={17} className="club-team-arrow" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </section>

            <section className="club-action-box club-section" aria-labelledby="club-actions-title">
              <div className="club-section-heading"><h2 id="club-actions-title">Bring everyone together</h2></div>
              <p>Start a team or get a game on the calendar.</p>
              <div className="club-actions">
                <button className="club-action" onClick={() => showDialog("Create a team", "A friendly place to organise your people. This preview won’t create or save a team.", "Sounds good")}><Plus size={16} />Create team</button>
                <button className="club-action" onClick={() => showDialog("Create an event", "Get a match or social game started. This preview won’t publish or save an event.", "Sounds good")}><CalendarDays size={15} />Create event</button>
              </div>
            </section>
          </aside>
        </div>
      </main>

      <nav className="club-bottom-nav" aria-label="Main navigation">
        <div className="club-nav-inner">
          {navItems.map(({ name, icon: Icon }) => (
            <button className={`club-nav-item ${activeTab === name ? "active" : ""}`} key={name} onClick={() => {
              setActiveTab(name);
              if (name !== "Home") showDialog(`${name}`, `You selected ${name}. This is a home-screen design preview.`, "Back to home");
              else setToast("You’re home");
            }} aria-current={activeTab === name ? "page" : undefined}>
              <Icon size={19} aria-hidden="true" /><span>{name}</span>
            </button>
          ))}
        </div>
      </nav>

      {dialog && <div className="club-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) dismissDialog(); }}>
        <section className="club-dialog" role="dialog" aria-modal="true" aria-labelledby="club-dialog-title">
          <div className="club-dialog-top"><h3 id="club-dialog-title">{dialog.title}</h3><button className="club-close" aria-label="Close dialog" onClick={dismissDialog}><X size={18} /></button></div>
          <p>{dialog.body}</p>
          <button className="club-dialog-cta" onClick={() => { dismissDialog(); if (dialog.action === "Back to home") setActiveTab("Home"); }}>{dialog.action || "Close"}</button>
        </section>
      </div>}
      {toast && <button className="club-toast" onClick={() => setToast("")}>{toast} · dismiss</button>}
    </div>
  );
}

export default CommunityClub;
