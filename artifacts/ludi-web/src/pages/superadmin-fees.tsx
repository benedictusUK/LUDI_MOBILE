import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetPlatformAdminAccess,
  useGetFeeAdminState,
  getGetFeeAdminStateQueryKey,
  getGetFeeSettingsQueryKey,
  useUpdateFeeSettings,
} from "@workspace/api-client-react";
import Navigation from "@/components/ui/nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert, ShieldCheck, RefreshCw, AlertTriangle } from "lucide-react";

function errInfo(e: unknown): { status?: number; message: string } {
  const x = e as { status?: number; message?: string; data?: { error?: string; message?: string } | null };
  return { status: x?.status, message: x?.data?.error || x?.data?.message || x?.message || "Something went wrong." };
}

/** Parse a decimal string with at most 2 dp into integer hundredths. null if invalid. */
function toHundredths(s: string, max: number): number | null {
  const t = s.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const [w, f = ""] = t.split(".");
  const n = Number(w) * 100 + Number((f + "00").slice(0, 2));
  return Number.isSafeInteger(n) && n <= max ? n : null;
}
const fromHundredths = (n: number) => (n / 100).toFixed(2);
const gbp = (pence: number) => `£${(pence / 100).toFixed(2)}`;

function calc(base: number, pBps: number, sBps: number, fixed: number) {
  const platform = Math.ceil((base * pBps) / 10000);
  const processing = Math.ceil(((base + platform) * sBps) / 10000) + fixed;
  return { platform, processing, total: base + platform + processing };
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <Navigation />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  );
}

const fmt = (s: string) => new Date(s).toLocaleString();
const describe = (s: { platformBasisPoints: number; stripeBasisPoints: number; stripeFixedMinor: number; revision: number }) =>
  `${fromHundredths(s.platformBasisPoints)}% platform, ${fromHundredths(s.stripeBasisPoints)}% + ${gbp(s.stripeFixedMinor)} processing (rev ${s.revision})`;

export default function SuperAdminFees() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const access = useGetPlatformAdminAccess({ request: { credentials: "include" } });
  const isAdmin = access.data?.isSuperAdmin === true;
  const state = useGetFeeAdminState({
    query: { queryKey: getGetFeeAdminStateQueryKey(), enabled: isAdmin },
    request: { credentials: "include" },
  });
  const update = useUpdateFeeSettings({ request: { credentials: "include" } });

  const settings = state.data?.settings;
  const [platform, setPlatform] = useState("");
  const [stripe, setStripe] = useState("");
  const [fixed, setFixed] = useState("");
  const [base, setBase] = useState("10.00");
  const [final, setFinal] = useState("8.00");
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  const rev = settings?.revision;
  useEffect(() => {
    if (settings) {
      setPlatform(fromHundredths(settings.platformBasisPoints));
      setStripe(fromHundredths(settings.stripeBasisPoints));
      setFixed(fromHundredths(settings.stripeFixedMinor));
      setStale(false);
    }
    // re-init only when the saved revision changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rev]);

  const pBps = toHundredths(platform, 10000);
  const sBps = toHundredths(stripe, 10000);
  const fixedMinor = toHundredths(fixed, 1000000);
  const baseMinor = toHundredths(base, 100000000);
  const finalMinor = toHundredths(final, 100000000);
  const valid = pBps !== null && sBps !== null && fixedMinor !== null;
  const dirty = !!settings && valid &&
    (pBps !== settings.platformBasisPoints || sBps !== settings.stripeBasisPoints || fixedMinor !== settings.stripeFixedMinor);

  const max = useMemo(
    () => (valid && baseMinor !== null ? calc(baseMinor, pBps!, sBps!, fixedMinor!) : null),
    [valid, baseMinor, pBps, sBps, fixedMinor],
  );
  const fin = useMemo(() => {
    if (!valid || finalMinor === null || baseMinor === null || !max || finalMinor > baseMinor) return null;
    const f = calc(finalMinor, pBps!, sBps!, fixedMinor!);
    // Original fees retained: customer pays final share + original fees.
    const charged = finalMinor + max.platform + max.processing;
    return { charged, refund: max.total - charged, ...f };
  }, [valid, finalMinor, baseMinor, max, pBps, sBps, fixedMinor]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getGetFeeAdminStateQueryKey() });
    qc.invalidateQueries({ queryKey: getGetFeeSettingsQueryKey() });
    qc.invalidateQueries({ queryKey: ["/api/platform-charges"] });
  };

  const save = () => {
    if (!settings || !valid) return;
    setError(null);
    update.mutate(
      { data: { platformBasisPoints: pBps!, stripeBasisPoints: sBps!, stripeFixedMinor: fixedMinor!, revision: settings.revision } },
      {
        onSuccess: (next) => {
          qc.setQueryData(getGetFeeAdminStateQueryKey(), next);
          invalidate();
          setStale(false);
          toast({ title: "Fee settings saved", description: "Applies to new events only." });
        },
        onError: (e) => {
          const i = errInfo(e);
          if (i.status === 409) {
            setStale(true);
            setError("These settings were changed elsewhere. Reload the latest values before saving again.");
          } else setError(i.message);
        },
      },
    );
  };
  const reload = () => {
    setError(null);
    state.refetch().then((r) => {
      const s = r.data?.settings;
      if (s) {
        setPlatform(fromHundredths(s.platformBasisPoints));
        setStripe(fromHundredths(s.stripeBasisPoints));
        setFixed(fromHundredths(s.stripeFixedMinor));
        setStale(false);
      }
    });
    invalidate();
  };

  if (access.isLoading) {
    return (
      <Shell>
        <Skeleton className="h-10 w-64 mb-6" />
        <Skeleton className="h-64 w-full" />
      </Shell>
    );
  }
  if (access.isError || !isAdmin) {
    const forbidden = !access.isError || [401, 403].includes(errInfo(access.error).status ?? 0);
    return (
      <Shell>
        <div role="alert" className="max-w-md mx-auto text-center py-16" data-testid="state-no-access">
          <ShieldAlert className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">{forbidden ? "SuperAdmin access required" : "Could not check access"}</h1>
          <p className="text-neutral-500 mb-6">{forbidden ? "This page is only available to LUDI platform administrators." : errInfo(access.error).message}</p>
          {forbidden ? <Link href="/" className="text-primary font-medium">Back to dashboard</Link> : <Button onClick={() => access.refetch()}>Try again</Button>}
        </div>
      </Shell>
    );
  }

  const field = (id: string, label: string, hint: string, val: string, set: (v: string) => void, ok: boolean, suffix: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input id={id} inputMode="decimal" value={val} onChange={(e) => set(e.target.value)} aria-invalid={!ok} data-testid={`input-${id}`} />
        <span className="text-sm text-neutral-500 w-8">{suffix}</span>
      </div>
      <p className={`text-xs ${ok ? "text-neutral-500" : "text-red-700"}`}>{ok ? hint : "Enter a number with at most 2 decimal places in range."}</p>
    </div>
  );

  return (
    <Shell>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary text-sm font-medium mb-1"><ShieldCheck className="h-4 w-4" />SuperAdmin</div>
          <h1 className="text-3xl font-bold text-neutral-900">Fee management</h1>
          <p className="text-neutral-500 mt-1 max-w-2xl">Platform and processing charges added to new event payments.</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/superadmin/notifications" className="text-primary font-medium text-sm" data-testid="link-notifications">Notification management</Link>
          <Button variant="outline" onClick={reload} disabled={state.isFetching} data-testid="button-refresh">
            <RefreshCw className={`h-4 w-4 mr-2 ${state.isFetching ? "animate-spin" : ""}`} />Reload
          </Button>
        </div>
      </div>

      {state.isLoading ? (
        <div className="space-y-4"><Skeleton className="h-56" /><Skeleton className="h-56" /></div>
      ) : state.isError || !state.data || !settings ? (
        <div role="alert" className="text-center py-12" data-testid="state-error">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
          <p className="font-medium mb-1">Could not load fee settings</p>
          <p className="text-neutral-500 text-sm mb-4">{errInfo(state.error).message}</p>
          <Button onClick={() => state.refetch()}>Try again</Button>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="rounded-md bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900 space-y-2" data-testid="panel-notice">
            <p className="font-medium">Rates apply to new events only.</p>
            <p>Existing events and payments keep their frozen terms, and earlier authorisations are preserved.</p>
            <p>{state.data.processingChargeNotice}</p>
            <p>The processing charge here is a configured amount, not Stripe's actual provider fee. These rates do not change Stripe's prices, and actual deductions may differ. UK consumer card-surcharge restrictions must be considered before live use.</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Rates</CardTitle>
              <CardDescription>Saved revision {settings.revision}. Previous defaults: 5% platform, 2.9% + 0.30 GBP processing.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                {field("platform-percent", "Platform fee", "Percent of base price", platform, setPlatform, pBps !== null, "%")}
                {field("processing-percent", "Processing percentage", "Percent of base plus platform fee", stripe, setStripe, sBps !== null, "%")}
                {field("processing-fixed", "Processing fixed charge", "GBP per payment, whole pence", fixed, setFixed, fixedMinor !== null, "GBP")}
              </div>
              {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3" data-testid="text-save-error">{error}</p>}
              <div className="flex flex-wrap justify-end gap-2">
                {stale && <Button variant="outline" onClick={reload} data-testid="button-reload-latest">Reload latest</Button>}
                <Button onClick={save} disabled={!dirty || update.isPending || stale} data-testid="button-save-fees">{update.isPending ? "Saving..." : "Save fees"}</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Example preview</CardTitle>
              <CardDescription>Calculated in whole pence from the values above, before saving.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="example-base">Maximum base price (GBP)</Label>
                  <Input id="example-base" inputMode="decimal" value={base} onChange={(e) => setBase(e.target.value)} aria-invalid={baseMinor === null} data-testid="input-example-base" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="example-final">Final venue share (GBP)</Label>
                  <Input id="example-final" inputMode="decimal" value={final} onChange={(e) => setFinal(e.target.value)} aria-invalid={finalMinor === null} data-testid="input-example-final" />
                </div>
              </div>
              {!max ? (
                <p className="text-sm text-neutral-500" data-testid="text-preview-invalid">Enter valid rates and a valid base price to see the preview.</p>
              ) : (
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm" data-testid="panel-max-example">
                  <div><dt className="text-neutral-500">Base</dt><dd className="font-semibold">{gbp(baseMinor!)}</dd></div>
                  <div><dt className="text-neutral-500">Platform</dt><dd className="font-semibold" data-testid="text-example-platform">{gbp(max.platform)}</dd></div>
                  <div><dt className="text-neutral-500">Processing</dt><dd className="font-semibold" data-testid="text-example-processing">{gbp(max.processing)}</dd></div>
                  <div><dt className="text-neutral-500">Maximum total</dt><dd className="font-semibold" data-testid="text-example-total">{gbp(max.total)}</dd></div>
                </dl>
              )}
              {max && (
                fin ? (
                  <p className="text-sm text-neutral-700 border-t pt-4" data-testid="text-flexible-example">
                    With a flexible final venue share of {gbp(finalMinor!)}, the original fees are retained: the customer is charged {gbp(fin.charged)} and {gbp(fin.refund)} is refunded from the authorised {gbp(max.total)}.
                  </p>
                ) : (
                  <p className="text-sm text-red-700 border-t pt-4">Final share must be a valid amount no greater than the base price.</p>
                )
              )}
            </CardContent>
          </Card>

          <section aria-labelledby="h-audit">
            <h2 id="h-audit" className="text-xl font-semibold mb-1">Audit history</h2>
            <p className="text-sm text-neutral-500 mb-4">Applies to: {state.data.appliesTo.replace(/_/g, " ")}.</p>
            {state.data.audit.length === 0 ? (
              <p className="text-neutral-500 text-sm border border-dashed rounded-lg p-6 text-center" data-testid="state-no-audit">No changes recorded yet.</p>
            ) : (
              <Card>
                <ul className="divide-y">
                  {state.data.audit.map((a) => (
                    <li key={a.id} className="p-4 text-sm" data-testid={`row-audit-${a.id}`}>
                      <p className="text-xs text-neutral-500">{fmt(a.createdAt)} - actor {a.actorId ?? "unknown"}</p>
                      <p className="mt-1"><span className="text-neutral-500">Before:</span> {describe(a.before)}</p>
                      <p><span className="text-neutral-500">After:</span> {describe(a.after)}</p>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </section>
        </div>
      )}
    </Shell>
  );
}
