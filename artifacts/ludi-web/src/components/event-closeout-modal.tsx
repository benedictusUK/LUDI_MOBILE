import { useEffect, useMemo, useRef, useState } from "react";
import {
  useGetEventCloseout,
  getGetEventCloseoutQueryKey,
  type EventCloseoutState,
  useSaveEventCloseout,
  useReconcileEventCloseout,
  useCreateEventCloseoutLink,
  useCloseEventCloseout,
} from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Copy, Link2, Loader2, Lock, Share2, UserPlus, X } from "lucide-react";

type Method = "online" | "cash";
interface DraftPlayer {
  userId: string;
  name: string;
  email: string;
  method: Method;
  cash: string;
}

const gbp = (minor: number | undefined | null) => `£${((minor ?? 0) / 100).toFixed(2)}`;
const toMinor = (v: string): number | null => {
  const t = v.trim();
  if (t === "") return 0;
  if (!/^\d+(?:\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
};
const toInput = (minor: number) => (minor ? (minor / 100).toFixed(2) : "");
const errMsg = (e: unknown, fallback: string) => {
  const x = e as any;
  return x?.data?.message || x?.data?.error || x?.message || fallback;
};
const initials = (n: string) => n.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  reconciling: "Reconciling",
  ready: "Ready to close",
  closing: "Closing",
  closed: "Closed",
};

export function EventCloseoutModal({
  isOpen,
  onClose,
  eventId,
  eventName,
}: {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  eventName: string;
}) {
  const { toast } = useToast();
  const query = useGetEventCloseout(eventId, { query: { queryKey: getGetEventCloseoutQueryKey(eventId), enabled: isOpen && !!eventId, refetchOnWindowFocus: false, refetchInterval: 20000 } });
  const save = useSaveEventCloseout();
  const reconcile = useReconcileEventCloseout();
  const makeLink = useCreateEventCloseoutLink();
  const closeMut = useCloseEventCloseout();

  const fetched = query.data as EventCloseoutState | undefined;
  const [override, setOverride] = useState<EventCloseoutState | null>(null);
  const state = override ?? fetched;

  const [venueCost, setVenueCost] = useState("");
  const [players, setPlayers] = useState<DraftPlayer[]>([]);
  const [dirty, setDirty] = useState(false);
  const [addId, setAddId] = useState("");
  const [links, setLinks] = useState<Record<string, string>>({});
  const [ack, setAck] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const seededRevision = useRef<string | null>(null);

  useEffect(() => {
    setOverride(null);
  }, [fetched]);

  // Seed local draft from server whenever the server revision changes and nothing is unsaved.
  useEffect(() => {
    if (!state || state.supported === false) return;
    if (seededRevision.current === state.revision && dirty) return;
    if (dirty) return;
    seededRevision.current = state.revision;
    setVenueCost(toInput(state.venueCostMinor));
    setPlayers(
      (state.players ?? []).map((p) => ({
        userId: p.userId,
        name: p.name,
        email: p.email,
        method: p.method,
        cash: toInput(p.cashAmountMinor),
      })),
    );
  }, [state?.revision, state?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOpen) {
      setAck(false);
      setConfirming(false);
      setNotice("");
      setActionError("");
      setDirty(false);
      setOverride(null);
      seededRevision.current = null;
    }
  }, [isOpen]);

  const status: string = state?.status ?? "draft";
  const frozen = status !== "draft";
  const closed = status === "closed";
  const serverPlayers = state?.players ?? [];
  const serverById = useMemo(() => new Map(serverPlayers.map((p) => [p.userId, p])), [serverPlayers]);
  const candidates = (state?.candidates ?? []).filter((c) => !players.some((p) => p.userId === c.userId));
  const busy = save.isPending || reconcile.isPending || makeLink.isPending || closeMut.isPending;

  const costMinor = toMinorSafe(venueCost);
  function toMinorSafe(v: string) {
    return toMinor(v);
  }
  const cashInvalid = players.some((p) => {
    if (p.method !== "cash") return false;
    const m = toMinor(p.cash);
    if (m === null) return true;
    const sp = serverById.get(p.userId);
    return frozen && !!sp && m > sp.shareMinor;
  });
  const draftValid = costMinor !== null && costMinor > 0 && players.length > 0 && !cashInvalid;
  const refundPending = !!state?.refundPending || serverPlayers.some((p) => p.refundPending);

  const patch = (userId: string, change: Partial<DraftPlayer>) => {
    setPlayers((prev) => prev.map((p) => (p.userId === userId ? { ...p, ...change } : p)));
    setDirty(true);
  };

  const applyState = (s: EventCloseoutState) => {
    setOverride(s);
    seededRevision.current = s.revision;
    setVenueCost(toInput(s.venueCostMinor));
    setPlayers(s.players.map((p) => ({ userId: p.userId, name: p.name, email: p.email, method: p.method, cash: toInput(p.cashAmountMinor) })));
    setDirty(false);
    query.refetch();
  };

  const doSave = (then?: () => void) => {
    setActionError("");
    if (!draftValid && !frozen) return;
    if (cashInvalid) return;
    save.mutate(
      {
        id: eventId,
        data: {
          venueCostMinor: frozen ? (state?.venueCostMinor ?? 0) : (costMinor as number),
          players: players.map((p) => ({
            userId: p.userId,
            method: p.method,
            cashAmountMinor: p.method === "cash" ? (toMinor(p.cash) as number) : 0,
          })),
        },
      },
      {
        onSuccess: (s) => {
          applyState(s);
          toast({ title: "Saved", description: frozen ? "Cash updates saved. Refunds are being planned." : "Draft saved." });
          then?.();
        },
        onError: (e: unknown) => setActionError(errMsg(e, "Could not save. Nothing was changed.")),
      },
    );
  };

  const doReconcile = () => {
    setActionError("");
    reconcile.mutate({ id: eventId }, {
      onSuccess: (s) => {
        applyState(s);
        toast({ title: "Reconciliation started", description: "Unused venue base is being refunded." });
      },
      onError: (e: unknown) => setActionError(errMsg(e, "Could not reconcile. Try again.")),
    });
  };

  const doLink = (userId: string) => {
    setActionError("");
    makeLink.mutate({ id: eventId, data: { userId } }, {
      onSuccess: (r) => {
        setLinks((l) => ({ ...l, [userId]: r.url }));
        if (r.state) setOverride(r.state);
      },
      onError: (e: unknown) => setActionError(errMsg(e, "Could not create a payment link.")),
    });
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied" });
    } catch {
      toast({ title: "Copy failed", description: "Select the link and copy it manually.", variant: "destructive" });
    }
  };
  const share = async (url: string, name: string) => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `${eventName} payment`, text: `Pay your share for ${eventName}, ${name}`, url });
      } catch {
        /* dismissed */
      }
    } else copy(url);
  };

  const doClose = () => {
    setActionError("");
    if (!state) return;
    const expected = state.payoutMinor as number;
    const revision = state.revision as string;
    closeMut.mutate({ id: eventId, data: { acknowledged: true, expectedPayoutMinor: expected, revision } }, {
      onSuccess: (s) => {
        applyState(s);
        setAck(false);
        if (s.status === "closed") {
          setConfirming(false);
          toast({ title: "Event closed" });
        } else if (s.payoutMinor !== expected || s.revision !== revision) {
          setNotice("The payout amount changed while you were confirming. Review the new amount and confirm again.");
        } else if (s.payoutError) {
          setActionError(s.payoutError);
        }
      },
      onError: (e: unknown) => {
        setAck(false);
        setActionError(errMsg(e, "Could not close the event."));
        query.refetch();
      },
    });
  };

  const addPlayer = (userId: string) => {
    const c = (state?.candidates ?? []).find((x) => x.userId === userId);
    if (!c) return;
    setPlayers((prev) => [...prev, { userId, name: c.name, email: c.email, method: "online", cash: "" }]);
    setDirty(true);
    setAddId("");
  };

  const canCloseNow = (status === "ready" || status === "closing") && !refundPending && !dirty;
  const closeEnabled = canCloseNow && ack && !busy;

  const body = () => {
    if (query.isLoading) {
      return (
        <div className="space-y-3 py-4" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 rounded-lg bg-neutral-100 animate-pulse" />
          ))}
        </div>
      );
    }
    if (query.isError || !state) {
      return (
        <div className="py-6 text-center space-y-3" role="alert">
          <p className="text-sm text-red-700">{errMsg(query.error, "Close details could not be loaded.")}</p>
          <Button variant="outline" onClick={() => query.refetch()}>Retry</Button>
        </div>
      );
    }
    if (state.supported === false) {
      return <p className="py-6 text-sm text-neutral-600">This event does not use the close flow.</p>;
    }

    return (
      <div className="space-y-5 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={closed ? "default" : "secondary"} data-testid="badge-closeout-status">{STATUS_LABEL[status] ?? status}</Badge>
          {refundPending && <Badge variant="outline" className="border-amber-500 text-amber-700">Refunds pending</Badge>}
          <Button variant="ghost" size="sm" className="ml-auto" disabled={query.isFetching} onClick={() => { setOverride(null); query.refetch(); }}>
            {query.isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}Refresh payments
          </Button>
        </div>

        {frozen && (
          <div className="flex gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
            <Lock className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              {closed
                ? "This event is closed. The final roster, venue cost and payout below are the permanent record."
                : "The roster and venue cost were confirmed and are now frozen, because unused venue base has been refunded against them. You can still mark online players as cash and retry venue-only refunds. Original fees are never refunded."}
            </p>
          </div>
        )}

        <section>
          <label htmlFor="closeout-cost" className="text-sm font-medium text-neutral-800">Final venue cost (GBP)</label>
          <div className="relative mt-1 max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">£</span>
            <Input
              id="closeout-cost"
              inputMode="decimal"
              className="pl-7"
              value={frozen ? toInput(state.venueCostMinor) : venueCost}
              disabled={frozen || busy}
              placeholder="0.00"
              onChange={(e) => {
                setVenueCost(e.target.value);
                setDirty(true);
              }}
            />
          </div>
          {!frozen && costMinor === null && <p className="text-xs text-red-600 mt-1">Enter pounds and pence, for example 84.50.</p>}
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-neutral-800">Final players ({players.length})</h3>
          </div>
          {players.length === 0 && (
            <p className="rounded-lg border border-dashed p-4 text-sm text-neutral-600">No players yet. Add the people who played.</p>
          )}
          <ul className="space-y-2">
            {players.map((p) => {
              const sp = serverById.get(p.userId);
              const isOrganiser = p.userId === state.organiserId;
              const onlineLocked = false;
              const methodLocked = frozen && (closed || !sp || sp.method === "cash");
              const url = links[p.userId] ?? sp?.linkUrl;
              const canLink = !!sp?.canPayLink && !isOrganiser && p.method === "online" && !dirty;
              return (
                <li key={p.userId} className="rounded-lg border p-3" data-testid={`closeout-player-${p.userId}`}>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8"><AvatarFallback className="text-xs">{initials(p.name)}</AvatarFallback></Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">
                        {p.name}
                        {isOrganiser && <span className="ml-2 text-xs rounded-full bg-amber-100 text-amber-800 px-2 py-0.5">Organiser</span>}
                      </div>
                      <div className="text-xs text-neutral-500 truncate">{p.email}</div>
                    </div>
                    <div className="text-right text-xs text-neutral-600">
                      {sp && <div>Share {gbp(sp.shareMinor)}</div>}
                      {sp && <div>Paid online {gbp(sp.onlinePaidMinor)}</div>}
                    </div>
                    {!frozen && (
                      <Button variant="ghost" size="icon" aria-label={`Remove ${p.name}`} disabled={busy} onClick={() => { setPlayers((prev) => prev.filter((x) => x.userId !== p.userId)); setDirty(true); }}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {isOrganiser ? (
                    <p className="mt-2 text-xs text-neutral-600">Your own venue share is self-funded. It is not a cash receipt and is deducted at close.</p>
                  ) : (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Select value={p.method} disabled={busy || methodLocked} onValueChange={(v) => patch(p.userId, { method: v as Method })}>
                      <SelectTrigger className="w-36" aria-label={`Payment method for ${p.name}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="online" disabled={frozen && sp?.method === "cash"}>Online</SelectItem>
                        <SelectItem value="cash">Cash received</SelectItem>
                      </SelectContent>
                    </Select>
                    {p.method === "cash" && (
                      <div className="relative w-36">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-sm">£</span>
                        <Input
                          inputMode="decimal"
                          className="pl-7"
                          aria-label={`Cash received from ${p.name}`}
                          placeholder="0.00"
                          value={p.cash}
                          disabled={busy || closed}
                          onChange={(e) => patch(p.userId, { cash: e.target.value })}
                        />
                      </div>
                    )}
                    {sp?.refundPending && <Badge variant="outline" className="border-amber-500 text-amber-700">Refund pending</Badge>}
                    {canLink && !closed && (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => doLink(p.userId)}>
                        <Link2 className="h-3.5 w-3.5 mr-1" />
                        {url ? "New link" : "Payment link"}
                      </Button>
                    )}
                  </div>
                  )}
                  {url && canLink && (
                    <div className="mt-2 flex items-center gap-2 rounded-md bg-neutral-50 border p-2">
                      <input readOnly aria-label={`Payment link for ${p.name}`} value={url} className="flex-1 min-w-0 bg-transparent text-xs" onFocus={(e) => e.currentTarget.select()} />
                      <Button size="sm" variant="ghost" onClick={() => copy(url)} aria-label="Copy link"><Copy className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => share(url, p.name)} aria-label="Share link"><Share2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {!frozen && (
            <div className="mt-3 flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-neutral-500" />
              <Select value={addId} onValueChange={addPlayer} disabled={busy || candidates.length === 0}>
                <SelectTrigger className="flex-1" aria-label="Add player"><SelectValue placeholder={candidates.length ? "Add a player who never voted or paid" : "No other candidates available"} /></SelectTrigger>
                <SelectContent>
                  {candidates.map((c) => (
                    <SelectItem key={c.userId} value={c.userId}>{c.name} ({c.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </section>

        {frozen && (
          <section className="rounded-lg border p-4 text-sm space-y-1.5" aria-label="Receipt">
            <h3 className="font-medium text-neutral-800 mb-1">{closed ? "Receipt" : "Settlement so far"}</h3>
            <Row k="Final venue cost" v={gbp(state.venueCostMinor)} />
            <Row k="Expected venue payout" v={gbp(state.expectedVenuePayoutMinor)} />
            <Row k="Cash already received (deducted)" v={`- ${gbp(state.cashReceivedMinor)}`} />
            <Row k="Your own venue share (deducted)" v={`- ${gbp(state.organiserShareMinor)}`} />
            <Row k="Expected from online payments" v={gbp(state.expectedOnlinePayoutMinor)} />
            <Row k="Collected online" v={gbp(state.onlineCollectedMinor)} />
            <div className="border-t pt-2 mt-2"><Row k={closed ? "Paid out to you" : "Payout on close"} v={gbp(state.payoutMinor)} strong /></div>
            {state.shortfallMinor > 0 && <Row k="Shortfall against expected" v={gbp(state.shortfallMinor)} />}
            {closed && state.closedAt && <p className="text-xs text-neutral-500 pt-1">Closed {new Date(state.closedAt).toLocaleString()}</p>}
          </section>
        )}

        {state.payoutError && !closed && (
          <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>Payout did not complete: {state.payoutError} Review the figures and try Close again.</p>
          </div>
        )}
        {notice && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="status">{notice}</div>}
        {actionError && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{actionError}</div>}

        {confirming && canCloseNow && (
          <section className="rounded-lg border-2 border-neutral-800 p-4 space-y-3" aria-label="Confirm close">
            <p className="font-semibold text-neutral-900" data-testid="text-close-confirm">
              Are you sure you’re ready to close this event? You will be paid {gbp(state.payoutMinor)}.
            </p>
            <p className="text-sm text-neutral-700" data-testid="text-close-match">
              {state.shortfallMinor > 0
                ? `This is ${gbp(state.shortfallMinor)} less than the expected value of your venue.`
                : "This matches the expected payment value for your venue"}
            </p>
            <p className="text-xs text-neutral-600">
              Cash already received and your own venue share are deducted from the venue total. Closing releases the money to your connected Stripe account; when it reaches your bank depends on Stripe.
            </p>
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <Checkbox checked={ack} onCheckedChange={(c) => setAck(!!c)} className="mt-0.5" data-testid="checkbox-close-ack" />
              <span>I confirm all payments I expect from players have been paid.</span>
            </label>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setConfirming(false); setAck(false); }} disabled={closeMut.isPending}>Not yet</Button>
              <Button onClick={doClose} disabled={!closeEnabled} data-testid="button-confirm-close">
                {closeMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {status === "closing" ? "Retry close" : "Close event"}
              </Button>
            </div>
          </section>
        )}
      </div>
    );
  };

  const hasState = !!state && state.supported !== false && !query.isLoading;

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[95vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>Close event</DialogTitle>
          <DialogDescription>
            Settle the final venue bill for {eventName}. Saving a draft pays no one; confirming refunds unused venue base only, and does not pay you.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">{body()}</div>
        {hasState && !closed && (
          <div className="shrink-0 flex flex-wrap gap-2 pt-3 border-t">
            {!frozen && (
              <>
                <Button variant="outline" disabled={!draftValid || !dirty || busy} onClick={() => doSave()}>
                  {save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save draft
                </Button>
                <Button disabled={!draftValid || dirty || busy || !state?.canReconcile} onClick={doReconcile} data-testid="button-reconcile">
                  {reconcile.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Confirm players and cost
                </Button>
                {dirty && <span className="self-center text-xs text-neutral-500">Save your draft before confirming.</span>}
                {!state?.canReconcile && <span className="self-center text-xs text-neutral-600">Finalise players after the event ends. You can record cash payments now.</span>}
              </>
            )}
            {frozen && (
              <>
                <Button variant="outline" disabled={!dirty || cashInvalid || busy} onClick={() => doSave(() => doReconcile())}>
                  {save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save cash updates and refund
                </Button>
                {(refundPending || status === "reconciling") && (
                  <Button variant="outline" disabled={busy} onClick={doReconcile}>
                    {reconcile.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Retry refunds
                  </Button>
                )}
                {!confirming && (
                  <Button className="ml-auto" disabled={!canCloseNow || busy} onClick={() => { setConfirming(true); setNotice(""); }} data-testid="button-start-close">
                    {status === "closing" ? "Retry close" : "Close event"}
                  </Button>
                )}
                {!canCloseNow && status !== "reconciling" && refundPending && (
                  <span className="self-center text-xs text-neutral-500">Close unlocks once all refunds succeed.</span>
                )}
                {status === "reconciling" && <span className="self-center text-xs text-neutral-500">Refunds in progress.</span>}
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "font-semibold text-neutral-900" : "text-neutral-700"}`}>
      <span>{k}</span>
      <span className="tabular-nums">{v}</span>
    </div>
  );
}
