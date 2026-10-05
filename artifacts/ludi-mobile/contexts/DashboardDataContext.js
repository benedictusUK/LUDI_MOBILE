import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';

const DashboardDataContext = createContext(null);

export function DashboardDataProvider({ children }) {
  const { user, apiRequest } = useAuth();
  const ownerId = user?.id;
  const requestRef = useRef(apiRequest);
  requestRef.current = apiRequest;
  const generation = useRef(0);
  const inFlight = useRef(null);
  const [snapshot, setSnapshot] = useState({ ownerId: null, data: null, error: null, loading: false });

  const reload = useCallback(() => {
    if (!ownerId) return Promise.resolve();
    if (inFlight.current?.ownerId === ownerId) return inFlight.current.promise;
    const revision = ++generation.current;
    setSnapshot(previous => ({
      ownerId, data: previous.ownerId === ownerId ? previous.data : null, error: null, loading: true,
    }));
    const promise = (async () => {
      try {
        // Start during the reveal animation. Home consumes this same in-memory
        // snapshot instead of issuing another set of requests after mounting.
        const [eventsResponse, teamsResponse] = await Promise.all([
          requestRef.current('/api/events?limit=3'),
          requestRef.current('/api/teams'),
        ]);
        if (!eventsResponse.ok || !teamsResponse.ok) {
          throw new Error('We couldn’t load your events and teams. Please try again.');
        }
        const [eventsData, teamsData] = await Promise.all([eventsResponse.json(), teamsResponse.json()]);
        if (!Array.isArray(eventsData.events) || !Array.isArray(teamsData)) {
          throw new Error('The server returned unexpected event data. Please try again.');
        }
        const data = {
          upcomingEvents: await Promise.all(eventsData.events.slice(0, 3).map(async event => {
            if (!event.paymentRequired) return event;
            try {
              const response = await requestRef.current(`/api/events/${encodeURIComponent(event.id)}/payment-status`);
              if (!response.ok) throw new Error('Payment status unavailable');
              const paymentSummary = await response.json();
              if (!paymentSummary || typeof paymentSummary.status !== 'string'
                || !Object.prototype.hasOwnProperty.call(paymentSummary, 'paymentRecord')) throw new Error('Unexpected payment status');
              return { ...event, paymentSummary };
            } catch {
              // Never display an unavailable receipt as unpaid or successfully paid.
              return { ...event, paymentSummaryError: true };
            }
          })),
          recentTeams: teamsData.slice(0, 3),
          stats: { eventsCount: eventsData.totalCount ?? eventsData.events.length, teamsCount: teamsData.length },
        };
        if (generation.current === revision) setSnapshot({ ownerId, data, error: null, loading: false });
        return data;
      } catch (error) {
        if (generation.current === revision) {
          setSnapshot(previous => ({ ...previous, error: error.message, loading: false }));
        }
        throw error;
      } finally {
        if (generation.current === revision) inFlight.current = null;
      }
    })();
    inFlight.current = { ownerId, promise };
    return promise;
  }, [ownerId]);

  useEffect(() => {
    if (ownerId) {
      reload().catch(() => {}); // The error is displayed by the startup/Home UI.
    } else {
      setSnapshot({ ownerId: null, data: null, error: null, loading: false });
    }
    return () => {
      generation.current += 1;
      inFlight.current = null;
    };
  }, [ownerId, reload]);

  const current = snapshot.ownerId === ownerId ? snapshot : { data: null, error: null, loading: true };
  return (
    <DashboardDataContext.Provider value={{ ...current, isReady: !!current.data, reload }}>
      {children}
    </DashboardDataContext.Provider>
  );
}

export function useDashboardData() {
  const context = useContext(DashboardDataContext);
  if (!context) throw new Error('useDashboardData requires DashboardDataProvider');
  return context;
}