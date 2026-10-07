import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetPlatformAdminAccess,
  useGetNotificationAdminState,
  getGetNotificationAdminStateQueryKey,
  useCreatePushTemplate,
  useUpdatePushTemplate,
  useDeletePushTemplate,
  useCreatePushTrigger,
  useDeletePushTrigger,
  useUpdatePushTrigger,
  usePreviewPushTemplate,
  useSendPushTemplateTest,
  type PushTemplate,
  type PushTrigger,
  type PushTriggerInputAudience,
  type PushTriggerType,
  type NotificationAdminState,
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
const audienceLabel = (a: string) => ({
  existing: "Relevant notification recipients", attendees: "Event attendees",
  maybe_voters: "Maybe Voters", team_members: "All Team Members",
  flare_recipients: "Opted-in Flare Recipients", payment_recipient: "Relevant payment player",
} as Record<string, string>)[a] ?? a.replace(/_/g, " ");
const audienceDescription = (a: string) => ({
  attendees: "Players who voted Yes, including players on the reserve list.",
  maybe_voters: "Players who voted Maybe on this event.",
  team_members: "Team members, regardless of their event vote.",
  flare_recipients: "Eligible nearby players who opted in to flare notifications.",
  payment_recipient: "Only the player whose payment needs attention or has changed.",
} as Record<string, string>)[a] ?? "";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <Navigation />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  );
}


type View =
  | { kind: "notifications" }
  | { kind: "templates" }
  | { kind: "notification-form"; trigger: PushTrigger | null }
  | { kind: "template-form"; template: PushTemplate | null };

/* ---------------- Template form (separate view) ---------------- */
function TemplateForm({ template, placeholders, onDone }: { template: PushTemplate | null; placeholders: string[]; onDone: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState(template?.name ?? "");
  const [title, setTitle] = useState(template?.title ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ title: string; body: string } | null>(null);
  const create = useCreatePushTemplate();
  const update = useUpdatePushTemplate();
  const previewMut = usePreviewPushTemplate();
  const valid = name.trim() && title.trim() && body.trim();
  const saving = create.isPending || update.isPending;
  const save = () => {
    setError(null);
    const data = { name: name.trim(), title: title.trim(), body: body.trim() };
    const opts = {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetNotificationAdminStateQueryKey() });
        toast({ title: template ? "Template updated" : "Template created" });
        onDone();
      },
      onError: (e: unknown) => setError(errInfo(e).message),
    };
    if (template) update.mutate({ id: template.id, data }, opts);
    else create.mutate({ data }, opts);
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>{template ? "Edit template" : "New template"}</CardTitle>
        <CardDescription>Push text only. In-app notifications are not changed by templates.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-w-2xl">
        <div className="space-y-1.5">
          <Label htmlFor="tpl-name">Name ({name.length}/80)</Label>
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
              <Button key={p} type="button" size="sm" variant="outline" className="font-mono text-xs h-8" onClick={() => setBody((b) => `${b}${p}`)} data-testid={`button-placeholder-${p.replace(/[{}]/g, "")}`}>{p}</Button>
            ))}
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4" aria-live="polite" data-testid="panel-preview">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Sample preview (not sent)</p>
            <Button type="button" size="sm" variant="outline" disabled={!title.trim() || !body.trim() || previewMut.isPending}
              onClick={() => { setError(null); previewMut.mutate({ data: { title: title.trim(), body: body.trim() } }, { onSuccess: setPreview, onError: (e) => setError(errInfo(e).message) }); }}
              data-testid="button-preview-template">
              <Eye className="h-4 w-4 mr-1" />{previewMut.isPending ? "Rendering..." : "Preview"}
            </Button>
          </div>
          {preview ? (
            <div className="rounded-md bg-neutral-100 p-3">
              <p className="font-semibold text-sm break-words">{preview.title}</p>
              <p className="text-sm text-neutral-700 whitespace-pre-wrap break-words">{preview.body}</p>
            </div>
          ) : <p className="text-sm text-neutral-500">Preview renders the unsaved text with sample values.</p>}
        </div>
        {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3" data-testid="text-template-error">{error}</p>}
        <div className="flex gap-2">
          <Button variant="outline" onClick={onDone} data-testid="button-cancel-template">Cancel</Button>
          <Button onClick={save} disabled={!valid || saving} data-testid="button-save-template">{saving ? "Saving..." : "Save template"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- Notification form (separate view) ---------------- */
function NotificationForm({ trigger, data, onDone, onNewTemplate }: {
  trigger: PushTrigger | null; data: NotificationAdminState; onDone: () => void; onNewTemplate: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const create = useCreatePushTrigger();
  const update = useUpdatePushTrigger();
  const types: PushTriggerType[] = data.triggerTypes;
  const [typeId, setTypeId] = useState<string>(trigger?.type ?? "");
  const initial = trigger ?? null;
  const [enabled, setEnabled] = useState(initial?.enabled ?? false);
  const [templateId, setTemplateId] = useState<string>(initial?.templateId ?? "");
  const [audience, setAudience] = useState<string>(initial?.audience ?? "");
  const [minutes, setMinutes] = useState(String(initial?.reminderMinutes ?? 60));
  const [error, setError] = useState<string | null>(null);

  const meta = trigger
    ? { label: trigger.label, description: trigger.description, scheduled: trigger.scheduled, allowedAudiences: trigger.allowedAudiences }
    : types.find((t) => t.id === typeId);
  const mins = Number(minutes);
  const minsValid = !meta?.scheduled || (Number.isInteger(mins) && mins >= 5 && mins <= 10080);
  const audienceOk = !!meta && meta.allowedAudiences.includes(audience);
  const valid = !!meta && !!templateId && data.templates.some((t) => t.id === templateId) && audienceOk && minsValid;
  const saving = create.isPending || update.isPending;

  const pickType = (id: string) => {
    setTypeId(id);
    const t = types.find((x) => x.id === id);
    if (t) setAudience(t.allowedAudiences.includes(audience) ? audience : t.allowedAudiences[0] ?? "");
  };
  const save = () => {
    if (!valid || !meta) return;
    setError(null);
    const reminderMinutes = meta.scheduled ? mins : trigger?.reminderMinutes ?? 60;
    const opts = {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetNotificationAdminStateQueryKey() });
        toast({ title: trigger ? "Notification updated" : "Notification created", description: enabled ? "Push delivery is on." : "Push delivery is off." });
        onDone();
      },
      onError: (e: unknown) => setError(errInfo(e).message),
    };
    const aud = audience as PushTriggerInputAudience;
    if (trigger) update.mutate({ id: trigger.id, data: { enabled, templateId, audience: aud, reminderMinutes } }, opts);
    else create.mutate({ data: { type: typeId, enabled, templateId, audience: aud, reminderMinutes } }, opts);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{trigger ? "Edit notification" : "Create notification"}</CardTitle>
        <CardDescription>You can add several reminders of the same type with different timing or audience.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-w-2xl">
        <div className="space-y-1.5">
          <Label>Notification type</Label>
          {trigger ? (
            <p className="text-sm font-medium" data-testid="text-notification-type">{trigger.label} <span className="text-neutral-500 font-normal">(type cannot be changed)</span></p>
          ) : (
            <Select value={typeId} onValueChange={pickType}>
              <SelectTrigger aria-label="Notification type" data-testid="select-notification-type"><SelectValue placeholder="Choose a type" /></SelectTrigger>
              <SelectContent>{types.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          )}
          {meta && <p className="text-sm text-neutral-500">{meta.description}</p>}
        </div>

        {data.templates.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-sm" data-testid="state-need-template">
            <p className="font-medium">Create a template first</p>
            <p className="text-neutral-500 mb-3">A notification needs a template for its push wording.</p>
            <Button type="button" onClick={onNewTemplate} data-testid="button-create-template-first"><Plus className="h-4 w-4 mr-2" />Create template</Button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label>Template</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger aria-label="Template" data-testid="select-notification-template"><SelectValue placeholder="Choose template" /></SelectTrigger>
              <SelectContent>{data.templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}

        {meta && (
          <div className="space-y-1.5">
            <Label>Recipients</Label>
            <Select value={audience} onValueChange={setAudience}>
              <SelectTrigger aria-label="Recipients" data-testid="select-notification-audience"><SelectValue placeholder="Choose recipients" /></SelectTrigger>
              <SelectContent>{meta.allowedAudiences.map((a) => <SelectItem key={a} value={a} className="capitalize">{audienceLabel(a)}</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-sm text-neutral-500">{audienceDescription(audience)}</p>
          </div>
        )}
        {meta?.scheduled && (
          <div className="space-y-1.5">
            <Label htmlFor="notif-minutes">Minutes before (5 to 10080)</Label>
            <Input id="notif-minutes" type="number" inputMode="numeric" min={5} max={10080} value={minutes} onChange={(e) => setMinutes(e.target.value)} aria-invalid={!minsValid} data-testid="input-notification-minutes" />
            {!minsValid && <p className="text-xs text-red-700">Enter a whole number from 5 to 10080.</p>}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Switch id="notif-enabled" checked={enabled} onCheckedChange={setEnabled} data-testid="switch-notification-enabled" />
          <Label htmlFor="notif-enabled">{enabled ? "Push on: saving starts real pushes" : "Push off"}</Label>
        </div>
        {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3" data-testid="text-notification-error">{error}</p>}
        <div className="flex gap-2">
          <Button variant="outline" onClick={onDone} data-testid="button-cancel-notification">Cancel</Button>
          <Button onClick={save} disabled={!valid || saving} data-testid="button-save-notification">{saving ? "Saving..." : "Save notification"}</Button>
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
    query: { queryKey: getGetNotificationAdminStateQueryKey(), enabled: isAdmin, refetchInterval: POLL_MS },
    request: { credentials: "include" },
  });
  const delTemplate = useDeletePushTemplate();
  const delTrigger = useDeletePushTrigger();
  const test = useSendPushTemplateTest();

  const [view, setView] = useState<View>({ kind: "notifications" });
  const [returnTo, setReturnTo] = useState<View | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<PushTemplate | null>(null);
  const [deletingTrigger, setDeletingTrigger] = useState<PushTrigger | null>(null);
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
          <p className="text-neutral-500 mb-6">{forbidden ? "This page is only available to LUDI platform administrators." : errInfo(access.error).message}</p>
          {forbidden ? <Link href="/" className="text-primary font-medium">Back to dashboard</Link> : <Button onClick={() => access.refetch()}>Try again</Button>}
        </div>
      </Shell>
    );
  }

  const data = state.data;
  const cfg = data?.configuration;
  const canTest = !!cfg && cfg.configured && cfg.ownDeviceCount > 0;
  const testReason = !cfg ? "" : !cfg.configured ? "Push credentials are not configured." : cfg.ownDeviceCount < 1 ? "None of your own iPhones are registered and opted in." : "";
  const refresh = () => qc.invalidateQueries({ queryKey: getGetNotificationAdminStateQueryKey() });
  const tplName = (id: string | null) => data?.templates.find((t) => t.id === id)?.name ?? "No template";

  const sendTest = (t: PushTemplate) => {
    setTestMsg(null);
    test.mutate({ data: { templateId: t.id } }, {
      onSuccess: (r) => {
        setTestMsg({ ok: true, text: `${r.queued} test push${r.queued === 1 ? "" : "es"} queued for your device${r.queued === 1 ? "" : "s"}. Queued does not mean delivered; check the delivery log.` });
        refresh();
      },
      onError: (e) => setTestMsg({ ok: false, text: errInfo(e).message }),
    });
  };
  const confirmDelete = () => {
    setDeleteError(null);
    if (deletingTemplate) {
      delTemplate.mutate({ id: deletingTemplate.id }, {
        onSuccess: () => { refresh(); toast({ title: "Template deleted" }); setDeletingTemplate(null); },
        onError: (e) => { const i = errInfo(e); setDeleteError(i.status === 409 ? "This template is used by a notification. Assign a different template to that notification first." : i.message); },
      });
    } else if (deletingTrigger) {
      delTrigger.mutate({ id: deletingTrigger.id }, {
        onSuccess: () => { refresh(); toast({ title: "Notification deleted" }); setDeletingTrigger(null); },
        onError: (e) => setDeleteError(errInfo(e).message),
      });
    }
  };
  const deleting = deletingTemplate ?? deletingTrigger;
  const delPending = delTemplate.isPending || delTrigger.isPending;
  const tab = view.kind === "templates" || view.kind === "template-form" ? "templates" : "notifications";
  const backFromTemplate = () => { setView(returnTo ?? { kind: "templates" }); setReturnTo(null); };

  return (
    <Shell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary text-sm font-medium mb-1"><ShieldCheck className="h-4 w-4" />SuperAdmin</div>
          <h1 className="text-3xl font-bold text-neutral-900">Notification settings</h1>
          <p className="text-neutral-500 mt-1 max-w-2xl">Create the push notifications LUDI sends and the templates behind them. In-app notifications are unchanged.</p>
        </div>
        <Link href="/superadmin/fees" className="text-primary font-medium text-sm self-center" data-testid="link-fees">Fee management</Link>
        <Button variant="outline" onClick={() => state.refetch()} disabled={state.isFetching} data-testid="button-refresh">
          <RefreshCw className={`h-4 w-4 mr-2 ${state.isFetching ? "animate-spin" : ""}`} />Refresh
        </Button>
      </div>

      <nav aria-label="Notification sections" className="flex gap-2 border-b mb-6">
        {(["templates", "notifications"] as const).map((k) => (
          <button key={k} type="button" aria-current={tab === k ? "page" : undefined}
            onClick={() => { setReturnTo(null); setView({ kind: k }); }}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 ${tab === k ? "border-primary text-primary" : "border-transparent text-neutral-500"}`}
            data-testid={`tab-${k}`}>
            {k === "templates" ? "Templates" : "Notifications"}
          </button>
        ))}
      </nav>

      {state.isLoading ? (
        <div className="space-y-4"><Skeleton className="h-32" /><Skeleton className="h-64" /></div>
      ) : state.isError || !data ? (
        <div role="alert" className="text-center py-12" data-testid="state-error">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
          <p className="font-medium mb-1">Could not load notification settings</p>
          <p className="text-neutral-500 text-sm mb-4">{errInfo(state.error).message}</p>
          <Button onClick={() => state.refetch()}>Try again</Button>
        </div>
      ) : view.kind === "template-form" ? (
        <TemplateForm template={view.template} placeholders={data.placeholders} onDone={backFromTemplate} />
      ) : view.kind === "notification-form" ? (
        <NotificationForm trigger={view.trigger} data={data} onDone={() => setView({ kind: "notifications" })}
          onNewTemplate={() => { setReturnTo(view); setView({ kind: "template-form", template: null }); }} />
      ) : view.kind === "templates" ? (
        <section aria-labelledby="h-templates" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="h-templates" className="text-xl font-semibold text-neutral-900">Configured templates</h2>
              <p className="text-sm text-neutral-500">Test sends go only to your own opted-in, registered iPhones.</p>
            </div>
            <Button onClick={() => setView({ kind: "template-form", template: null })} data-testid="button-new-template"><Plus className="h-4 w-4 mr-2" />Create template</Button>
          </div>
          {!canTest && testReason && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3" data-testid="text-test-disabled">{testReason} Test sends are disabled.</p>}
          {testMsg && <p role={testMsg.ok ? "status" : "alert"} className={`text-sm rounded-md p-3 border ${testMsg.ok ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-red-50 border-red-200 text-red-800"}`} data-testid="text-test-result">{testMsg.text}</p>}
          {data.templates.length === 0 ? (
            <div className="text-center border border-dashed rounded-lg p-10" data-testid="state-no-templates">
              <p className="font-medium">No templates yet</p>
              <p className="text-sm text-neutral-500">Create one to use in a notification.</p>
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
                      <Button size="sm" variant="outline" onClick={() => setView({ kind: "template-form", template: t })} data-testid={`button-edit-template-${t.id}`}><Pencil className="h-4 w-4 mr-1" />Edit</Button>
                      <Button size="sm" variant="outline" disabled={!canTest || test.isPending} title={testReason} onClick={() => sendTest(t)} data-testid={`button-test-template-${t.id}`}><Send className="h-4 w-4 mr-1" />Send test to me</Button>
                      <Button size="sm" variant="outline" className="text-red-700" onClick={() => { setDeleteError(null); setDeletingTrigger(null); setDeletingTemplate(t); }} data-testid={`button-delete-template-${t.id}`}><Trash2 className="h-4 w-4 mr-1" />Delete</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      ) : (
        <div className="space-y-8">
          <section aria-labelledby="h-triggers" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="h-triggers" className="text-xl font-semibold text-neutral-900">Configured notifications</h2>
                <p className="text-sm text-neutral-500">New notifications start switched off. Turning one on starts sending real pushes.</p>
              </div>
              <Button onClick={() => setView({ kind: "notification-form", trigger: null })} data-testid="button-new-notification"><Plus className="h-4 w-4 mr-2" />Create notification</Button>
            </div>
            {data.triggers.length === 0 ? (
              <div className="text-center border border-dashed rounded-lg p-10" data-testid="state-no-notifications">
                <p className="font-medium">No notifications configured</p>
                <p className="text-sm text-neutral-500">
                  {data.templates.length === 0 ? "Start by creating a template, then create a notification." : "Create a notification to start sending pushes."}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {data.triggers.map((t) => (
                  <Card key={t.id} data-testid={`card-trigger-${t.id}`}>
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-semibold break-words">{t.label}</h3>
                          <p className="text-sm text-neutral-500">{t.description}</p>
                        </div>
                        <Badge className={t.enabled ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-100"} data-testid={`badge-trigger-${t.id}`}>{t.enabled ? "Push on" : "Push off"}</Badge>
                      </div>
                      <dl className="grid grid-cols-2 gap-2 text-sm">
                        <div><dt className="text-neutral-500">Template</dt><dd>{tplName(t.templateId)}</dd></div>
                        <div><dt className="text-neutral-500">Recipients</dt><dd>{audienceLabel(t.audience)}</dd></div>
                        {t.scheduled && <div><dt className="text-neutral-500">Minutes before</dt><dd>{t.reminderMinutes}</dd></div>}
                        <div><dt className="text-neutral-500">Updated</dt><dd>{fmt(t.updatedAt)}</dd></div>
                      </dl>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setView({ kind: "notification-form", trigger: t })} data-testid={`button-edit-trigger-${t.id}`}><Pencil className="h-4 w-4 mr-1" />Edit</Button>
                        <Button size="sm" variant="outline" className="text-red-700" onClick={() => { setDeleteError(null); setDeletingTemplate(null); setDeletingTrigger(t); }} data-testid={`button-delete-trigger-${t.id}`}><Trash2 className="h-4 w-4 mr-1" />Delete</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

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
              {(cfg!.outboxReady === false || cfg!.paymentHooksReady === false) && (
                <p role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                  {cfg!.applicationQueueEnabled
                    ? "The application notification queue is active. It handles missing database hooks with durable duplicate protection."
                    : "Automatic notifications are blocked by missing database hooks. Update and publish the server."}
                </p>
              )}
              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div><dt className="text-neutral-500">Bundle ID</dt><dd className="font-mono break-all" data-testid="text-bundle-id">{cfg!.bundleId || "-"}</dd></div>
                <div><dt className="text-neutral-500">Registered devices</dt><dd className="font-semibold" data-testid="text-device-count">{cfg!.deviceCount}</dd></div>
                <div><dt className="text-neutral-500">Your devices</dt><dd className="font-semibold" data-testid="text-own-device-count">{cfg!.ownDeviceCount}</dd></div>
              </dl>
              {!cfg!.configured && (
                <div className="rounded-md bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900" data-testid="panel-missing">
                  <p className="font-medium mb-1">Server credentials are missing</p>
                  {cfg!.missing.length > 0 && <ul className="list-disc pl-5 mb-2 font-mono text-xs">{cfg!.missing.map((m) => <li key={m}>{m}</li>)}</ul>}
                  <p>Apple push key details are set as server secrets by whoever deploys LUDI. They are never entered or shown in this page. Until they are set, nothing is sent and deliveries stay queued.</p>
                </div>
              )}
              <p className="text-xs text-neutral-500">Accepted by Apple means Apple took the message for delivery. It does not prove the person saw or opened it.</p>
            </CardContent>
          </Card>

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

      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o) { setDeletingTemplate(null); setDeletingTrigger(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deletingTemplate?.name ?? deletingTrigger?.label}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingTemplate ? "This cannot be undone. Templates used by a notification cannot be deleted." : "This cannot be undone. The notification will stop sending pushes."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3" data-testid="text-delete-error">{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmDelete(); }} disabled={delPending} data-testid="button-confirm-delete">{delPending ? "Deleting..." : "Delete"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Shell>
  );
}
