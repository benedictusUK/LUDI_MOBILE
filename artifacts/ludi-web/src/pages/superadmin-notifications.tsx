import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetPlatformAdminAccess,
  useGetNotificationAdminState,
  getGetNotificationAdminStateQueryKey,
  useCreatePushTemplate,
  useUpdatePushTemplate,
  useDeletePushTemplate,
  useUpdatePushTrigger,
  usePreviewPushTemplate,
  useSendPushTemplateTest,
  type PushTemplate,
  type PushTrigger,
  type PushTriggerInputAudience,
} from "@workspace/api-client-react";
import Navigation from "@/components/ui/nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Bell, ShieldAlert, ShieldCheck, Plus, Pencil, Trash2, Send, Eye, RefreshCw, AlertTriangle } from "lucide-react";

const POLL_MS = 15000;

function errInfo(e: unknown): { status?: number; message: string } {
  const x = e as { status?: number; message?: string; data?: { error?: string; message?: string } | null };
  return {
    status: x?.status,
    message: x?.data?.error || x?.data?.message || x?.message || "Something went wrong.",
  };
}

const STATUS_STYLE: Record<string, string> = {
  queued: "bg-neutral-100 text-neutral-700",
  retry: "bg-amber-100 text-amber-800",
  sending: "bg-sky-100 text-sky-800",
  accepted: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
  expired: "bg-orange-100 text-orange-800",
  skipped: "bg-neutral-100 text-neutral-600",
};

const fmt = (s?: string | null) => (s ? new Date(s).toLocaleString() : "-");
const audienceLabel = (a: string) => a.replace(/_/g, " ");

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <Navigation />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  );
}

/* ---------------- Template editor ---------------- */
function TemplateDialog({
  open, onClose, template, placeholders,
}: { open: boolean; onClose: () => void; template: PushTemplate | null; placeholders: string[] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ title: string; body: string } | null>(null);
  const create = useCreatePushTemplate();
  const update = useUpdatePushTemplate();
  const previewMut = usePreviewPushTemplate();

  useEffect(() => {
    if (open) {
      setName(template?.name ?? "");
      setTitle(template?.title ?? "");
      setBody(template?.body ?? "");
      setError(null);
      setPreview(null);
    }
  }, [open, template]);

  const valid = name.trim() && title.trim() && body.trim();
  const saving = create.isPending || update.isPending;

  const done = () => {
    qc.invalidateQueries({ queryKey: getGetNotificationAdminStateQueryKey() });
    toast({ title: template ? "Template updated" : "Template created" });
    onClose();
  };
  const save = () => {
    setError(null);
    const data = { name: name.trim(), title: title.trim(), body: body.trim() };
    const opts = { onSuccess: done, onError: (e: unknown) => setError(errInfo(e).message) };
    if (template) update.mutate({ id: template.id, data }, opts);
    else create.mutate({ data }, opts);
  };
  const runPreview = () => {
    setError(null);
    previewMut.mutate(
      { data: { title: title.trim(), body: body.trim() } },
      { onSuccess: setPreview, onError: (e) => setError(errInfo(e).message) },
    );
  };
  const insert = (p: string) => setBody((b) => `${b}${p}`);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? "Edit push template" : "New push template"}</DialogTitle>
          <DialogDescription>
            Push text only. In-app notifications are not changed by templates.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tpl-name">Name</Label>
            <Input id="tpl-name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} data-testid="input-template-name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-title">Title ({title.length}/160)</Label>
            <Input id="tpl-title" maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} data-testid="input-template-title" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-body">Body ({body.length}/1500)</Label>
            <Textarea id="tpl-body" rows={5} maxLength={1500} value={body} onChange={(e) => setBody(e.target.value)} data-testid="input-template-body" />
          </div>
          <div>
            <p className="text-sm text-neutral-500 mb-2">Variables (tap to append to body)</p>
            <div className="flex flex-wrap gap-2">
              {placeholders.map((p) => (
                <Button key={p} type="button" size="sm" variant="outline" className="font-mono text-xs h-8" onClick={() => insert(p)} data-testid={`button-placeholder-${p.replace(/[{}]/g, "")}`}>
                  {p}
                </Button>
              ))}
            </div>
          </div>
          <div className="rounded-lg border bg-white p-4" aria-live="polite" data-testid="panel-preview">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Sample preview (not sent)</p>
              <Button type="button" size="sm" variant="outline" disabled={!title.trim() || !body.trim() || previewMut.isPending} onClick={runPreview} data-testid="button-preview-template">
                <Eye className="h-4 w-4 mr-1" />{previewMut.isPending ? "Rendering..." : "Preview"}
              </Button>
            </div>
            {preview ? (
              <div className="rounded-md bg-neutral-100 p-3">
                <p className="font-semibold text-sm break-words">{preview.title}</p>
                <p className="text-sm text-neutral-700 whitespace-pre-wrap break-words">{preview.body}</p>
              </div>
            ) : (
              <p className="text-sm text-neutral-500">Preview renders the unsaved text with sample values.</p>
            )}
          </div>
          {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3" data-testid="text-template-error">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={!valid || saving} data-testid="button-save-template">{saving ? "Saving..." : "Save template"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Trigger card ---------------- */
function TriggerCard({ trigger, templates }: { trigger: PushTrigger; templates: PushTemplate[] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const mut = useUpdatePushTrigger();
  const [enabled, setEnabled] = useState(trigger.enabled);
  const [templateId, setTemplateId] = useState(trigger.templateId);
  const [audience, setAudience] = useState<string>(trigger.audience);
  const [minutes, setMinutes] = useState(String(trigger.reminderMinutes));
  const [error, setError] = useState<string | null>(null);

  // Re-initialise from the latest server copy whenever it changes.
  useEffect(() => {
    setEnabled(trigger.enabled);
    setTemplateId(trigger.templateId);
    setAudience(trigger.audience);
    setMinutes(String(trigger.reminderMinutes));
  }, [trigger.updatedAt, trigger.enabled, trigger.templateId, trigger.audience, trigger.reminderMinutes]);

  const mins = Number(minutes);
  const minsValid = !trigger.scheduled || (Number.isInteger(mins) && mins >= 5 && mins <= 10080);
  const dirty =
    enabled !== trigger.enabled || templateId !== trigger.templateId || audience !== trigger.audience ||
    (trigger.scheduled && mins !== trigger.reminderMinutes);

  const save = () => {
    setError(null);
    mut.mutate(
      {
        id: trigger.id,
        data: {
          enabled,
          templateId,
          audience: audience as PushTriggerInputAudience,
          reminderMinutes: trigger.scheduled ? mins : trigger.reminderMinutes,
        },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetNotificationAdminStateQueryKey() });
          toast({ title: `${trigger.label} saved`, description: enabled ? "Push delivery is on." : "Push delivery is off." });
        },
        onError: (e) => setError(errInfo(e).message),
      },
    );
  };

  return (
    <Card data-testid={`card-trigger-${trigger.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <CardTitle className="text-base">{trigger.label}</CardTitle>
            <CardDescription className="mt-1">{trigger.description}</CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Label htmlFor={`sw-${trigger.id}`} className="text-sm">{enabled ? "Push on" : "Push off"}</Label>
            <Switch id={`sw-${trigger.id}`} checked={enabled} onCheckedChange={setEnabled} data-testid={`switch-trigger-${trigger.id}`} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Template</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger aria-label="Template" data-testid={`select-trigger-template-${trigger.id}`}><SelectValue placeholder="Choose template" /></SelectTrigger>
              <SelectContent>
                {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Audience</Label>
            <Select value={audience} onValueChange={setAudience}>
              <SelectTrigger aria-label="Audience" data-testid={`select-trigger-audience-${trigger.id}`}><SelectValue /></SelectTrigger>
              <SelectContent>
                {trigger.allowedAudiences.map((a) => <SelectItem key={a} value={a} className="capitalize">{audienceLabel(a)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {trigger.scheduled && (
            <div className="space-y-1.5">
              <Label htmlFor={`min-${trigger.id}`}>Minutes before (5 to 10080)</Label>
              <Input id={`min-${trigger.id}`} type="number" inputMode="numeric" min={5} max={10080} value={minutes} onChange={(e) => setMinutes(e.target.value)} aria-invalid={!minsValid} data-testid={`input-trigger-minutes-${trigger.id}`} />
              {!minsValid && <p className="text-xs text-red-700">Enter a whole number from 5 to 10080.</p>}
            </div>
          )}
        </div>
        {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">{error}</p>}
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-neutral-500">Updated {fmt(trigger.updatedAt)}</p>
          <Button onClick={save} disabled={!dirty || !minsValid || !templateId || mut.isPending} data-testid={`button-save-trigger-${trigger.id}`}>
            {mut.isPending ? "Saving..." : "Save trigger"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- Page ---------------- */
export default function SuperAdminNotifications() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const access = useGetPlatformAdminAccess({ request: { credentials: "include" } });
  const isAdmin = access.data?.isSuperAdmin === true;
  const state = useGetNotificationAdminState({
    query: {
      queryKey: getGetNotificationAdminStateQueryKey(),
      enabled: isAdmin,
      refetchInterval: POLL_MS,
    },
    request: { credentials: "include" },
  });
  const del = useDeletePushTemplate();
  const test = useSendPushTemplateTest();

  const [editing, setEditing] = useState<PushTemplate | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<PushTemplate | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (access.isLoading) {
    return (
      <Shell>
        <Skeleton className="h-10 w-64 mb-6" />
        <Skeleton className="h-40 w-full mb-4" />
        <Skeleton className="h-64 w-full" />
      </Shell>
    );
  }
  if (access.isError || !isAdmin) {
    const forbidden = !access.isError || errInfo(access.error).status === 403 || errInfo(access.error).status === 401;
    return (
      <Shell>
        <div role="alert" className="max-w-md mx-auto text-center py-16" data-testid="state-no-access">
          <ShieldAlert className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-neutral-900 mb-2">{forbidden ? "SuperAdmin access required" : "Could not check access"}</h1>
          <p className="text-neutral-500 mb-6">
            {forbidden ? "This page is only available to LUDI platform administrators." : errInfo(access.error).message}
          </p>
          {forbidden ? (
            <Link href="/" className="text-primary font-medium">Back to dashboard</Link>
          ) : (
            <Button onClick={() => access.refetch()}>Try again</Button>
          )}
        </div>
      </Shell>
    );
  }

  const data = state.data;
  const cfg = data?.configuration;
  const canTest = !!cfg && cfg.configured && cfg.ownDeviceCount > 0;
  const testReason = !cfg ? "" : !cfg.configured ? "Push credentials are not configured." : cfg.ownDeviceCount < 1 ? "None of your own iPhones are registered and opted in." : "";

  const sendTest = (t: PushTemplate) => {
    setTestMsg(null);
    test.mutate(
      { data: { templateId: t.id } },
      {
        onSuccess: (r) => {
          setTestMsg({ ok: true, text: `${r.queued} test push${r.queued === 1 ? "" : "es"} queued for your device${r.queued === 1 ? "" : "s"}. Queued does not mean delivered; check the delivery log.` });
          qc.invalidateQueries({ queryKey: getGetNotificationAdminStateQueryKey() });
        },
        onError: (e) => setTestMsg({ ok: false, text: errInfo(e).message }),
      },
    );
  };
  const confirmDelete = () => {
    if (!deleting) return;
    setDeleteError(null);
    del.mutate(
      { id: deleting.id },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetNotificationAdminStateQueryKey() });
          toast({ title: "Template deleted" });
          setDeleting(null);
        },
        onError: (e) => {
          const i = errInfo(e);
          setDeleteError(i.status === 409 ? "This template is used by a trigger. Assign a different template to that trigger first." : i.message);
        },
      },
    );
  };

  return (
    <Shell>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary text-sm font-medium mb-1"><ShieldCheck className="h-4 w-4" />SuperAdmin</div>
          <h1 className="text-3xl font-bold text-neutral-900">Push notification manager</h1>
          <p className="text-neutral-500 mt-1 max-w-2xl">Control push wording and which events send it. Original in-app notifications are unchanged, and trigger switches affect push delivery only.</p>
        </div>
        <Link href="/superadmin/fees" className="text-primary font-medium text-sm self-center" data-testid="link-fees">Fee management</Link>
        <Button variant="outline" onClick={() => state.refetch()} disabled={state.isFetching} data-testid="button-refresh">
          <RefreshCw className={`h-4 w-4 mr-2 ${state.isFetching ? "animate-spin" : ""}`} />Refresh
        </Button>
      </div>

      {state.isLoading ? (
        <div className="space-y-4"><Skeleton className="h-32" /><Skeleton className="h-64" /><Skeleton className="h-64" /></div>
      ) : state.isError || !data ? (
        <div role="alert" className="text-center py-12" data-testid="state-error">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
          <p className="font-medium mb-1">Could not load notification settings</p>
          <p className="text-neutral-500 text-sm mb-4">{errInfo(state.error).message}</p>
          <Button onClick={() => state.refetch()}>Try again</Button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Configuration */}
          <Card data-testid="card-configuration">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" />Apple push status</CardTitle>
                <Badge className={cfg!.configured ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" : "bg-amber-100 text-amber-800 hover:bg-amber-100"} data-testid="badge-configured">
                  {cfg!.configured ? "Configured" : "Not configured"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div><dt className="text-neutral-500">Bundle ID</dt><dd className="font-mono break-all" data-testid="text-bundle-id">{cfg!.bundleId || "-"}</dd></div>
                <div><dt className="text-neutral-500">Registered devices</dt><dd className="font-semibold" data-testid="text-device-count">{cfg!.deviceCount}</dd></div>
                <div><dt className="text-neutral-500">Your devices</dt><dd className="font-semibold" data-testid="text-own-device-count">{cfg!.ownDeviceCount}</dd></div>
              </dl>
              {!cfg!.configured && (
                <div className="rounded-md bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900" data-testid="panel-missing">
                  <p className="font-medium mb-1">Server credentials are missing</p>
                  {cfg!.missing.length > 0 && (
                    <ul className="list-disc pl-5 mb-2 font-mono text-xs">{cfg!.missing.map((m) => <li key={m}>{m}</li>)}</ul>
                  )}
                  <p>Apple push key details are set as server secrets by whoever deploys LUDI. They are never entered or shown in this page. Until they are set, nothing is sent and deliveries stay queued.</p>
                </div>
              )}
              <p className="text-xs text-neutral-500">Accepted by Apple means Apple took the message for delivery. It does not prove the person saw or opened it.</p>
            </CardContent>
          </Card>

          {/* Triggers */}
          <section aria-labelledby="h-triggers">
            <h2 id="h-triggers" className="text-xl font-semibold text-neutral-900 mb-1">Triggers</h2>
            <p className="text-sm text-neutral-500 mb-4">Event and payment reminders start switched off. Turning one on is an explicit action that starts sending real pushes.</p>
            {data.triggers.length === 0 ? (
              <p className="text-neutral-500 text-sm border border-dashed rounded-lg p-6 text-center">No triggers are defined.</p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {data.triggers.map((t) => <TriggerCard key={t.id} trigger={t} templates={data.templates} />)}
              </div>
            )}
          </section>

          {/* Templates */}
          <section aria-labelledby="h-templates">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 id="h-templates" className="text-xl font-semibold text-neutral-900">Templates</h2>
                <p className="text-sm text-neutral-500">Test sends go only to your own opted-in, registered iPhones.</p>
              </div>
              <Button onClick={() => { setEditing(null); setDialogOpen(true); }} data-testid="button-new-template"><Plus className="h-4 w-4 mr-2" />New template</Button>
            </div>
            {!canTest && testReason && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3 mb-3" data-testid="text-test-disabled">{testReason} Test sends are disabled.</p>}
            {testMsg && <p role={testMsg.ok ? "status" : "alert"} className={`text-sm rounded-md p-3 mb-3 border ${testMsg.ok ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-red-50 border-red-200 text-red-800"}`} data-testid="text-test-result">{testMsg.text}</p>}
            {data.templates.length === 0 ? (
              <div className="text-center border border-dashed rounded-lg p-10" data-testid="state-no-templates">
                <p className="font-medium">No templates yet</p>
                <p className="text-sm text-neutral-500">Create one to assign it to a trigger.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {data.templates.map((t) => (
                  <Card key={t.id} data-testid={`card-template-${t.id}`}>
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold break-words min-w-0">{t.name}</h3>
                        <span className="text-xs text-neutral-500 shrink-0">{fmt(t.updatedAt)}</span>
                      </div>
                      <div className="rounded-md bg-neutral-100 p-3 text-sm">
                        <p className="font-medium break-words">{t.title}</p>
                        <p className="text-neutral-700 whitespace-pre-wrap break-words line-clamp-4">{t.body}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => { setEditing(t); setDialogOpen(true); }} data-testid={`button-edit-template-${t.id}`}><Pencil className="h-4 w-4 mr-1" />Edit</Button>
                        <Button size="sm" variant="outline" disabled={!canTest || test.isPending} title={testReason} onClick={() => sendTest(t)} data-testid={`button-test-template-${t.id}`}><Send className="h-4 w-4 mr-1" />Send test to me</Button>
                        <Button size="sm" variant="outline" className="text-red-700" onClick={() => { setDeleteError(null); setDeleting(t); }} data-testid={`button-delete-template-${t.id}`}><Trash2 className="h-4 w-4 mr-1" />Delete</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* Deliveries */}
          <section aria-labelledby="h-deliveries">
            <h2 id="h-deliveries" className="text-xl font-semibold text-neutral-900 mb-1">Recent deliveries</h2>
            <p className="text-sm text-neutral-500 mb-4">Refreshes every {POLL_MS / 1000} seconds.</p>
            {data.deliveries.length === 0 ? (
              <p className="text-neutral-500 text-sm border border-dashed rounded-lg p-6 text-center" data-testid="state-no-deliveries">No deliveries recorded yet.</p>
            ) : (
              <Card>
                <ul className="divide-y">
                  {data.deliveries.map((d) => {
                    const trig = data.triggers.find((t) => t.id === d.triggerId);
                    return (
                      <li key={d.id} className="p-4 flex flex-wrap items-start justify-between gap-3" data-testid={`row-delivery-${d.id}`}>
                        <div className="min-w-0">
                          <p className="font-medium break-words">{d.title}</p>
                          <p className="text-xs text-neutral-500">{trig?.label ?? d.triggerId} - {d.environment} - {d.attempts} attempt{d.attempts === 1 ? "" : "s"}</p>
                          <p className="text-xs text-neutral-500">Created {fmt(d.createdAt)}{d.acceptedAt ? ` - Apple accepted ${fmt(d.acceptedAt)}` : ""}</p>
                          {d.reason && <p className="text-xs text-neutral-700 mt-1 break-words">Reason: {d.reason}</p>}
                        </div>
                        <Badge className={`${STATUS_STYLE[d.status] ?? STATUS_STYLE.queued} hover:opacity-100`} data-testid={`status-delivery-${d.id}`}>{d.status}</Badge>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}
          </section>
        </div>
      )}

      <TemplateDialog open={dialogOpen} onClose={() => setDialogOpen(false)} template={editing} placeholders={data?.placeholders ?? []} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleting?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone. Templates used by a trigger cannot be deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3" data-testid="text-delete-error">{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmDelete(); }} disabled={del.isPending} data-testid="button-confirm-delete">{del.isPending ? "Deleting..." : "Delete"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Shell>
  );
}
