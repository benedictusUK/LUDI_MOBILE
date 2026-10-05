import React, { useEffect, useRef, useState } from "react";
import {
  Bell, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3,
  Home, MapPin, Plus, Search, Shield, Users, X,
} from "lucide-react";
import { dashboardData, events, logoSrc, teams, user } from "./_shared/fixtures";
import "./MatchNightRefined.css";

type VotingStatus = "Can attend" | "Not voted" | "Maybe";
type PaymentStatus = "Paid" | "Payment due";
type PreviewEvent = {
  id: string;
  name: string;
  startDate: string;
  startTime: string;
  sport: string;
  location: string;
  teamName: string;
  voting: VotingStatus;
  requiresPayment: boolean;
  paymentStatus?: PaymentStatus;
  paidAmountPence?: number;
};
type Panel = "notifications" | "event" | "create-team" | "create-event" | "events" | "teams" | "search" | "profile" | null;

const previewEvents: PreviewEvent[] = [
  {
    ...events[0],
    teamName: teams[0].name,
    voting: "Can attend",
    requiresPayment: true,
    paymentStatus: "Paid",
    paidAmountPence: 1082,
  },
  {
    ...events[1],
    teamName: teams[1].name,
    voting: "Not voted",
    requiresPayment: true,
    paymentStatus: "Payment due",
    paidAmountPence: 0,
  },
  {
    id: "midweek-football",
    name: "Midweek five-a-side",
    startDate: "2026-10-14",
    startTime: "19:00",
    sport: "Football",
    location: events[0].location,
    teamName: teams[0].name,
    voting: "Maybe",
    requiresPayment: false,
  },
];

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
    long: parsed.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
  };
}

function formatGBP(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

export function MatchNightRefined() {
  const [panel, setPanel] = useState<Panel>(null);
  const [activeTab, setActiveTab] = useState("Home");
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedEventId, setSelectedEventId] = useState(previewEvents[0].id);
  const [toast, setToast] = useState("");
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const dragStartX = useRef<number | null>(null);
  const dragStartY = useRef<number | null>(null);
  const dragged = useRef(false);
  const suppressClick = useRef(false);
  const toastTimer = useRef<number | undefined>(undefined);

  const selectedEvent = previewEvents.find((event) => event.id === selectedEventId) ?? previewEvents[0];
  const isEventDetail = panel === "event";
  const title = panel === "create-team" ? "Create a team"
    : panel === "create-event" ? "Create an event"
    : panel === "notifications" ? "Notifications"
    : panel === "events" ? "All upcoming events"
    : panel === "teams" ? "Your teams"
    : panel === "search" ? "Find your next game"
    : panel === "profile" ? "Alex’s profile"
    : "Event details";

  const announce = (message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2600);
  };

  const openPanel = (nextPanel: Panel, trigger?: HTMLElement) => {
    returnFocusRef.current = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setPanel(nextPanel);
  };
  const closePanel = () => {
    setPanel(null);
    window.requestAnimationFrame(() => {
      if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
      else document.querySelector<HTMLElement>(".mnr-nav-item[aria-current='page']")?.focus();
    });
  };
  const openEvent = (event: PreviewEvent, trigger?: HTMLElement) => {
    setSelectedEventId(event.id);
    openPanel("event", trigger);
  };
  const selectTab = (label: string) => {
    setActiveTab(label);
    if (label === "Home") {
      setPanel(null);
      return;
    }
    openPanel(label.toLowerCase() as Panel);
  };
  const changePosition = (position: number) => {
    setActiveIndex(Math.max(0, Math.min(3, position)));
  };

  useEffect(() => {
    if (!panel) return;
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePanel();
      }
      if (event.key === "Tab" && dialogRef.current) {
        const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [panel]);

  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
  }, []);

  const handleCarouselKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      changePosition(activeIndex - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      changePosition(activeIndex + 1);
    }
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    suppressClick.current = false;
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button")) return;
    dragStartX.current = event.clientX;
    dragStartY.current = event.clientY;
    dragged.current = false;
  };
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartX.current === null || dragStartY.current === null) return;
    const dx = event.clientX - dragStartX.current;
    const dy = event.clientY - dragStartY.current;
    if (Math.abs(dx) > 9 && Math.abs(dx) > Math.abs(dy) * 1.15) {
      dragged.current = true;
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    }
  };
  const resetDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragStartX.current = null;
    dragStartY.current = null;
    dragged.current = false;
  };
  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartX.current === null || dragStartY.current === null) return;
    const dx = event.clientX - dragStartX.current;
    const dy = event.clientY - dragStartY.current;
    if (dragged.current && Math.abs(dx) > Math.abs(dy) * 1.15) {
      suppressClick.current = true;
      if (Math.abs(dx) >= 40) {
        changePosition(activeIndex + (dx < 0 ? 1 : -1));
      }
      window.setTimeout(() => { suppressClick.current = false; }, 500);
    }
    resetDrag(event);
  };
  const blockAccidentalClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (suppressClick.current) {
      event.preventDefault();
      event.stopPropagation();
      suppressClick.current = false;
    }
  };

  const previewAction = (message: string) => announce(message);
  const activeCard = activeIndex < 3 ? previewEvents[activeIndex] : null;

  return (
    <div className="mn-refined">
      <header className="mnr-header mnr-wrap">
        <div className="mnr-brand"><img src={logoSrc} alt="LUDI" /></div>
        <div className="mnr-header-actions">
          <span className="mnr-preview">Design preview · example data</span>
          <button className="mnr-notify" aria-label="Open notifications" onClick={(event) => openPanel("notifications", event.currentTarget)}>
            <Bell aria-hidden="true" />
            <span className="mnr-notify-count">{dashboardData.stats.notificationsCount}</span>
          </button>
        </div>
      </header>

      <main className="mnr-wrap mnr-main">
        <section className="mnr-welcome">
          <div>
            <p className="mnr-eyebrow">Your community, in play</p>
            <h1>Good evening, <span>{user.firstName}.</span></h1>
            <p className="mnr-welcome-copy">Your next game, vote and payment at a glance.</p>
          </div>
          <div className="mnr-counts" aria-label="Example activity">
            <div className="mnr-count"><strong>2</strong><span>My teams</span></div>
            <div className="mnr-count"><strong>3</strong><span>Events</span></div>
          </div>
        </section>

        <div className="mnr-layout">
          <section className="mnr-primary" aria-labelledby="mnr-up-next">
            <div className="mnr-section-head">
              <div><h2 id="mnr-up-next">UP NEXT</h2><p className="mnr-section-note">The next three fixtures, in date order.</p></div>
              <button className="mnr-link" onClick={(event) => openPanel("events", event.currentTarget)}>View all</button>
            </div>

            <div
              className="mnr-carousel"
              role="region"
              aria-roledescription="carousel"
              aria-label="Upcoming event preview"
              tabIndex={0}
              onKeyDown={handleCarouselKeyDown}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={resetDrag}
              onClickCapture={blockAccidentalClick}
            >
              <div className="mnr-stack" aria-live="polite">
                {activeCard ? (
                  <>
                    {activeIndex < 2 && <div className="mnr-card-peek mnr-card-peek-back" aria-hidden="true" />}
                    <article className="mnr-next-card" key={activeCard.id} aria-label={`Event ${activeIndex + 1} of 3: ${activeCard.name}`}>
                      <div className="mnr-card-top">
                        <span className="mnr-card-label">{activeIndex === 0 ? "Next event" : "Coming next"}</span>
                        <span className="mnr-card-index">{String(activeIndex + 1).padStart(2, "0")} <i>/</i> 03</span>
                      </div>
                      <div className="mnr-event-heading">
                        <div className="mnr-date-block" aria-label={dateParts(activeCard.startDate).long}>
                          <span>{dateParts(activeCard.startDate).weekday}</span>
                          <strong>{dateParts(activeCard.startDate).day}</strong>
                          <small>{dateParts(activeCard.startDate).month}</small>
                        </div>
                        <div className="mnr-title-group">
                          <span className="mnr-sport">{activeCard.sport} <i aria-hidden="true" /></span>
                          <h3>{activeCard.name}</h3>
                          <div className="mnr-time"><Clock3 aria-hidden="true" /><strong>{activeCard.startTime}</strong><span>Kick-off</span></div>
                        </div>
                      </div>
                      <div className="mnr-venue"><MapPin aria-hidden="true" /><span>{activeCard.location}</span></div>
                      <div className="mnr-status-grid">
                        <div className="mnr-status-cell">
                          <span className="mnr-status-label">Your vote</span>
                          <strong className={`mnr-vote mnr-vote-${activeCard.voting.toLowerCase().replace(/\s+/g, "-")}`}>
                            {activeCard.voting === "Can attend" && <Check aria-hidden="true" />}
                            {activeCard.voting}
                          </strong>
                        </div>
                        {activeCard.requiresPayment && (
                          <div className="mnr-status-cell mnr-payment-cell">
                            <span className="mnr-status-label">Payment</span>
                            <strong className={`mnr-payment mnr-payment-${activeCard.paymentStatus === "Paid" ? "paid" : "due"}`}>
                              {activeCard.paymentStatus}
                            </strong>
                            <span className="mnr-paid-amount">Paid {formatGBP(activeCard.paidAmountPence ?? 0)}</span>
                          </div>
                        )}
                        {!activeCard.requiresPayment && (
                          <div className="mnr-status-cell">
                            <span className="mnr-status-label">With</span>
                            <strong className="mnr-team-name">{activeCard.teamName}</strong>
                          </div>
                        )}
                      </div>
                      <div className="mnr-event-foot">
                        <span className="mnr-team-context">{activeCard.teamName}</span>
                        <button className="mnr-details" onClick={(event) => openEvent(activeCard, event.currentTarget)}>
                          Event details <ChevronRight aria-hidden="true" />
                        </button>
                      </div>
                    </article>
                  </>
                ) : (
                  <article className="mnr-view-all-card">
                    <span className="mnr-view-all-mark"><CalendarDays aria-hidden="true" /></span>
                    <p className="mnr-eyebrow">That’s the next three</p>
                    <h3>See what else is on.</h3>
                    <p>Browse all example events from your teams.</p>
                    <button className="mnr-details" onClick={(event) => openPanel("events", event.currentTarget)}>
                      View all events <ChevronRight aria-hidden="true" />
                    </button>
                  </article>
                )}
              </div>
              <div className="mnr-carousel-controls" aria-label="Carousel controls">
                <button className="mnr-step-button" aria-label="Previous card" onClick={() => changePosition(activeIndex - 1)} disabled={activeIndex === 0}>
                  <ChevronLeft aria-hidden="true" />
                </button>
                <div className="mnr-position-list" role="group" aria-label="Choose a carousel position">
                  {[0, 1, 2, 3].map((position) => (
                    <button
                      key={position}
                      className={`mnr-position${activeIndex === position ? " active" : ""}`}
                      aria-label={position < 3 ? `Show event ${position + 1}` : "Show view all events"}
                      aria-current={activeIndex === position ? "step" : undefined}
                      onClick={() => changePosition(position)}
                    />
                  ))}
                </div>
                <span className="mnr-position-count">{activeIndex === 3 ? "ALL" : `0${activeIndex + 1}`}<i>/</i>04</span>
                <button className="mnr-step-button" aria-label="Next card" onClick={() => changePosition(activeIndex + 1)} disabled={activeIndex === 3}>
                  <ChevronRight aria-hidden="true" />
                </button>
              </div>
              <p className="mnr-swipe-hint">Swipe or use the arrows to see what’s next</p>
            </div>
          </section>

          <aside className="mnr-side">
            <section className="mnr-team-card" aria-labelledby="mnr-teams-title">
              <div className="mnr-section-head">
                <div><h2 id="mnr-teams-title">YOUR TEAMS</h2><p className="mnr-section-note">Your people, ready to play.</p></div>
                <button className="mnr-link" onClick={(event) => openPanel("teams", event.currentTarget)}>See all</button>
              </div>
              {teams.map((team, index) => (
                <div className="mnr-team-row" key={team.id}>
                  <span className={`mnr-team-mark${index ? " alt" : ""}`} aria-hidden="true">{index ? "SS" : "SL"}</span>
                  <span className="mnr-team-copy"><strong>{team.name}</strong><small>{team.sports.join(", ")}</small></span>
                  <ChevronRight aria-hidden="true" />
                </div>
              ))}
            </section>
            <section className="mnr-create-card" aria-labelledby="mnr-create-title">
              <p className="mnr-eyebrow">Bring people together</p>
              <h2 id="mnr-create-title">Make the next game happen.</h2>
              <div className="mnr-create-actions">
                <button onClick={(event) => openPanel("create-team", event.currentTarget)}><Plus aria-hidden="true" />Create team</button>
                <button onClick={(event) => openPanel("create-event", event.currentTarget)}><CalendarDays aria-hidden="true" />Create event</button>
              </div>
            </section>
          </aside>
        </div>
        <p className="mnr-footnote">Example community activity shown for design preview. No account or payment data.</p>
      </main>

      <nav className="mnr-bottom-nav" aria-label="Primary navigation">
        {navItems.map(({ label, icon: Icon }) => (
          <button key={label} className={`mnr-nav-item${activeTab === label ? " active" : ""}`} aria-current={activeTab === label ? "page" : undefined} onClick={() => selectTab(label)}>
            <Icon aria-hidden="true" /><span>{label}</span>
          </button>
        ))}
      </nav>

      {panel && (
        <div className="mnr-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closePanel(); }}>
          <section className="mnr-dialog" role="dialog" aria-modal="true" aria-labelledby="mnr-dialog-title" ref={dialogRef}>
            <div className="mnr-dialog-head">
              <div><p className="mnr-eyebrow">LUDI · design preview</p><h3 id="mnr-dialog-title">{title}</h3></div>
              <button className="mnr-close" ref={closeRef} aria-label="Close dialog" onClick={closePanel}><X aria-hidden="true" /></button>
            </div>
            {isEventDetail && (
              <>
                <p className="mnr-dialog-copy">A community {selectedEvent.sport.toLowerCase()} get-together. This is example preview information only.</p>
                <div className="mnr-detail-list">
                  <span><CalendarDays aria-hidden="true" />{dateParts(selectedEvent.startDate).long}</span>
                  <span><Clock3 aria-hidden="true" />{selectedEvent.startTime}</span>
                  <span><MapPin aria-hidden="true" />{selectedEvent.location}</span>
                  <span><Users aria-hidden="true" />{selectedEvent.teamName}</span>
                  <span><Check aria-hidden="true" />Vote preview: {selectedEvent.voting}</span>
                  {selectedEvent.requiresPayment && <span><span className="mnr-pound" aria-hidden="true">£</span>Payment preview: {selectedEvent.paymentStatus} · {formatGBP(selectedEvent.paidAmountPence ?? 0)} paid</span>}
                  {!selectedEvent.requiresPayment && <span><Check aria-hidden="true" />No payment required</span>}
                </div>
                <div className="mnr-preview-actions">
                  <button onClick={() => previewAction("Preview only — no vote was saved.")}>Preview vote choices</button>
                  {selectedEvent.requiresPayment && <button onClick={() => previewAction("Payment preview only — no payment was made.")}>Preview payment</button>}
                </div>
                <p className="mnr-disclaimer">These controls do not save a vote or make a payment.</p>
                <button className="mnr-confirm" onClick={closePanel}>Done</button>
              </>
            )}
            {panel === "notifications" && (
              <>
                <p className="mnr-dialog-copy">A quick look at what is happening in your teams.</p>
                <div className="mnr-notice"><strong>Thursday five-a-side</strong><small>South London FC · Your next fixture is coming up.</small></div>
                <div className="mnr-notice"><strong>Sunday social badminton</strong><small>Sunday Social · 11 October at 10:00.</small></div>
                <button className="mnr-confirm" onClick={closePanel}>Got it</button>
              </>
            )}
            {panel === "events" && (
              <>
                <p className="mnr-dialog-copy">Example fixtures, shown in date order.</p>
                {previewEvents.map((event) => (
                  <button className="mnr-event-notice" key={event.id} onClick={(clickEvent) => openEvent(event, clickEvent.currentTarget)}>
                    <span className="mnr-notice-date">{dateParts(event.startDate).day}<small>{dateParts(event.startDate).month}</small></span>
                    <span><strong>{event.name}</strong><small>{dateParts(event.startDate).weekday} · {event.startTime} · {event.sport}</small></span>
                    <ChevronRight aria-hidden="true" />
                  </button>
                ))}
                <button className="mnr-confirm" onClick={closePanel}>Done</button>
              </>
            )}
            {panel === "teams" && (
              <>
                <p className="mnr-dialog-copy">Two example teams in this preview.</p>
                {teams.map((team) => <div className="mnr-notice" key={team.id}><strong>{team.name}</strong><small>{team.sports.join(", ")}</small></div>)}
                <button className="mnr-confirm" onClick={closePanel}>Done</button>
              </>
            )}
            {(panel === "create-team" || panel === "create-event") && (
              <>
                <p className="mnr-dialog-copy">{panel === "create-team"
                  ? "Start a new community team. This preview shows the start of the flow without creating or saving anything."
                  : "Bring people together for a game. This preview does not publish an event or book a venue."}</p>
                <button className="mnr-confirm" onClick={() => { closePanel(); announce("Preview only — nothing was created or saved."); }}>Continue preview</button>
                <button className="mnr-secondary" onClick={closePanel}>Not now</button>
              </>
            )}
            {(panel === "search" || panel === "profile") && (
              <>
                <p className="mnr-dialog-copy">{panel === "search"
                  ? "Explore local sports and teams in LUDI. Search is shown here as a local preview."
                  : "Your LUDI community at a glance. Account details are not connected in this preview."}</p>
                {panel === "search" && <label className="mnr-search-label">Search teams or sports<input type="search" placeholder="Try football or badminton" onChange={() => undefined} /></label>}
                {panel === "profile" && <div className="mnr-notice"><strong>{user.firstName}</strong><small>Example profile · preview only</small></div>}
                <button className="mnr-confirm" onClick={closePanel}>Done</button>
              </>
            )}
          </section>
        </div>
      )}
      {toast && <div className="mnr-toast" role="status">{toast}</div>}
    </div>
  );
}

export default MatchNightRefined;
