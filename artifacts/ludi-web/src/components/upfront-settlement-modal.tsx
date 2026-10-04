import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function UpfrontSettlementModal({ isOpen, onClose, event, attendance }: {
  isOpen: boolean; onClose: () => void;
  event: { id: string; name: string; cost?: string; finalVenueCost?: string; paymentCollectionInitiated?: boolean; createdById: string; venueOrganiserId?: string };
  attendance: { userId: string; status: string | null }[];
}) {
  const [cost, setCost] = useState(event.finalVenueCost ?? event.cost ?? "0");
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);
  const qc = useQueryClient();
  const { toast } = useToast();
  useEffect(() => { if (isOpen) { setCost(event.finalVenueCost ?? event.cost ?? "0"); setError(""); setResult(null); } }, [isOpen, event.id]);
  const { data: quote, isLoading, isError } = useQuery<any>({
    queryKey: [`/api/events/${event.id}/payment-policy`], enabled: isOpen,
  });
  const organiser = event.venueOrganiserId || event.createdById;
  const count = attendance.filter(a => ["attending", "promoted"].includes(a.status || "") && a.userId !== organiser).length;
  const costMinor = /^\d+(?:\.\d{1,2})?$/.test(cost) ? Math.round(Number(cost) * 100) : NaN;
  const shareMinor = count ? Math.ceil(costMinor / count) : 0;
  const exceedsMaximum = quote && shareMinor > quote.baseAmountMinor;
  const fees = (quote?.platformFeeMinor || 0) + (quote?.processingFeeMinor || 0);
  const money = (n: number) => `£${(n / 100).toFixed(2)}`;
  const mutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/events/${event.id}/collect-payment`, { venueCost: cost })).json(),
    onSuccess: data => {
      setResult(data);
      qc.invalidateQueries({ queryKey: ["/api/events"] });
      qc.invalidateQueries({ queryKey: [`/api/events/${event.id}/payment-policy`] });
      qc.invalidateQueries({ queryKey: [`/api/events/${event.id}/payment-summary`] });
      toast({ title: data.settlementComplete ? "Refunds complete" : "Refunds pending", description: data.message });
    },
    onError: e => setError(e instanceof Error ? e.message : "Settlement could not complete"),
  });
  const frozen = event.paymentCollectionInitiated || !!result;
  return <Dialog open={isOpen} onOpenChange={open => { if (!open && !mutation.isPending) onClose(); }}>
    <DialogContent><DialogHeader><DialogTitle>Finalise venue cost</DialogTitle>
      <DialogDescription>{event.name}: payments have already been collected. Only unused venue cost is refunded; both original fee amounts stay fixed.</DialogDescription>
    </DialogHeader>
    <p className="text-sm">{count} registered paying participant{count === 1 ? "" : "s"}. The original organiser and participant list cannot be changed through settlement.</p>
    <Label htmlFor="final-venue-cost">Final venue cost (£)</Label>
    <Input id="final-venue-cost" data-testid="input-final-venue-cost" inputMode="decimal" value={cost} disabled={!!frozen || mutation.isPending} onChange={e => setCost(e.target.value)} />
    {quote && count > 0 && Number.isFinite(costMinor) && <div className="rounded-lg border p-3 text-sm space-y-1">
      <p>Maximum originally paid per player: {money(quote.amountMinor)}</p>
      <p>Original platform charge: {money(quote.platformFeeMinor)}</p>
      <p>Original processing charge: {money(quote.processingFeeMinor)}</p>
      <p>Estimated final total per player: {money(shareMinor + fees)}</p>
      <p>Estimated refund per player: {money(Math.max(0, quote.baseAmountMinor - shareMinor))}</p>
      <p className="text-xs text-neutral-500">Venue shares are allocated in exact pennies; individual totals can differ by 1p.</p>
    </div>}
    {exceedsMaximum && <p role="alert" className="text-red-700">The final venue share exceeds the agreed maximum. No additional payment will be taken.</p>}
    {isError && <p role="alert">Payment details could not be loaded. Close and reopen to retry.</p>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {result && <div role="status" className="rounded-lg border p-3 text-sm">
      <p>{result.message}</p><p>Refunded: £{result.totalRefunded}. Pending: {result.pendingRefunds}. Needs retry: {result.failedRefunds}.</p>
    </div>}
    <Button data-testid="button-collect-payments" disabled={isLoading || isError || !quote || !count || !Number.isFinite(costMinor) || costMinor < 0 || exceedsMaximum || mutation.isPending || result?.settlementComplete}
      onClick={() => { setError(""); mutation.mutate(); }}>
      {mutation.isPending ? "Processing refunds..." : frozen ? "Retry residual refunds" : "Confirm cost and refund residual"}
    </Button>
    <Button variant="outline" disabled={mutation.isPending} onClick={onClose}>Close</Button>
    </DialogContent>
  </Dialog>;
}