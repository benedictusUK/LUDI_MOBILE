import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetNotificationAdminState, getGetNotificationAdminStateQueryKey, useCreatePushTemplate, useUpdatePushTemplate,
  useDeletePushTemplate, useUpdatePushTrigger, usePreviewPushTemplate, useSendPushTemplateTest,
} from '@workspace/api-client-react';
import { BrandText as Text } from '../../components/brand/BrandText';
import { Banner, Button, Card, Chip, Confirm, Field, LoadError, Screen, SectionTitle, SkeletonBlocks, ToggleRow, useAdminGuard, useAdminStyles } from './adminUi';
import { audienceLabel, errInfo, fmtDate, parseMinutes, placeholderToken, testBlockReason } from './adminHelpers.mjs';

function Preview({ title, body, request, report }) {
  const { s, colors } = useAdminStyles();
  const preview = usePreviewPushTemplate({ request });
  const [out, setOut] = useState(null);
  const [err, setErr] = useState(null);
  const run = () => {
    setErr(null);
    setOut(null);
    preview.mutate({ data: { title: title.trim(), body: body.trim() } }, {
      onSuccess: (result) => setOut({ ...result, sourceTitle: title, sourceBody: body }), onError: (e) => { report(e); setErr(errInfo(e).message); },
    });
  };
  return (
    <Card>
      <Text style={[s.label, { color: colors.text }]}>Sample preview (not sent)</Text>
      {out && out.sourceTitle === title && out.sourceBody === body ? (
        <View style={{ backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 12, marginBottom: 12 }} accessibilityLiveRegion="polite">
          <Text style={[s.label, { color: colors.text }]}>{out.title}</Text>
          <Text style={[s.body, { color: colors.text }]}>{out.body}</Text>
        </View>
      ) : <Text style={[s.hint, { color: colors.textSecondary, marginBottom: 12 }]}>Rendered by the server using sample values for the unsaved text.</Text>}
      {err ? <Banner tone="error">{err}</Banner> : null}
      <Button label="Render preview" icon="eye-outline" variant="secondary" onPress={run} loading={preview.isPending} disabled={!title.trim() || !body.trim()} />
    </Card>
  );
}

function TemplateEditor({ template, placeholders, onClose, onSaved }) {
  const { request, report } = useAdminGuard();
  const { s, colors } = useAdminStyles();
  const create = useCreatePushTemplate({ request });
  const update = useUpdatePushTemplate({ request });
  const [name, setName] = useState(template ? template.name : '');
  const [title, setTitle] = useState(template ? template.title : '');
  const [body, setBody] = useState(template ? template.body : '');
  const [error, setError] = useState(null);
  const busy = create.isPending || update.isPending;
  const valid = name.trim() && title.trim() && body.trim();
  const save = () => {
    if (busy || !valid) return;
    setError(null);
    const data = { name: name.trim(), title: title.trim(), body: body.trim() };
    const opts = { onSuccess: () => onSaved(template ? 'Template updated.' : 'Template created.'), onError: (e) => { report(e); setError(errInfo(e).message); } };
    if (template) update.mutate({ id: template.id, data }, opts); else create.mutate({ data }, opts);
  };
  return (
    <Screen title={template ? 'Edit template' : 'New template'} subtitle="Push text only. In-app notifications are not changed." onBack={onClose} backLabel="Back to notifications">
      <Card>
        <Field label={`Name (${name.length}/80)`} value={name} onChangeText={setName} maxLength={80} editable={!busy} />
        <Field label={`Title (${title.length}/160)`} value={title} onChangeText={setTitle} maxLength={160} editable={!busy} />
        <Field label={`Body (${body.length}/1500)`} value={body} onChangeText={setBody} maxLength={1500} multiline editable={!busy} />
        <Text style={[s.label, { color: colors.text }]}>Placeholders (tap to append to body)</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {placeholders.map((p) => <Chip key={p} label={placeholderToken(p)} disabled={busy || body.length + placeholderToken(p).length > 1500} onPress={() => setBody((b) => `${b}${placeholderToken(p)}`)} />)}
        </View>
      </Card>
      <Preview title={title} body={body} request={request} report={report} />
      {error ? <Banner tone="error" title="Not saved">{error}</Banner> : null}
      <Button label="Save template" onPress={save} loading={busy} disabled={!valid} />
    </Screen>
  );
}

function TriggerCard({ trigger, templates, onSaved }) {
  const { request, report } = useAdminGuard();
  const { s, colors, display } = useAdminStyles();
  const mut = useUpdatePushTrigger({ request });
  const [enabled, setEnabled] = useState(trigger.enabled);
  const [templateId, setTemplateId] = useState(trigger.templateId);
  const [audience, setAudience] = useState(trigger.audience);
  const [minutes, setMinutes] = useState(String(trigger.reminderMinutes));
  const [error, setError] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const mins = parseMinutes(minutes);
  const minsOk = !trigger.scheduled || mins !== null;
  const dirty = enabled !== trigger.enabled || templateId !== trigger.templateId || audience !== trigger.audience
    || (trigger.scheduled && mins !== trigger.reminderMinutes);
  const send = () => {
    if (mut.isPending || !minsOk || !templates.some(t => t.id === templateId) || !trigger.allowedAudiences.includes(audience)) return;
    setError(null);
    mut.mutate({ id: trigger.id, data: { enabled, templateId, audience, reminderMinutes: trigger.scheduled ? mins : trigger.reminderMinutes } }, {
      onSuccess: () => { setConfirm(false); onSaved(`${trigger.label} saved. Push is ${enabled ? 'on' : 'off'}.`); },
      onError: (e) => { report(e); setError(errInfo(e).message); },
    });
  };
  const onSave = () => (enabled && !trigger.enabled ? setConfirm(true) : send());
  return (
    <Card>
      <Text style={[display, { fontSize: 20, color: colors.text }]}>{trigger.label}</Text>
      <Text style={[s.hint, { color: colors.textSecondary, marginBottom: 10 }]}>{trigger.description}</Text>
      <ToggleRow label={enabled ? 'Push on' : 'Push off'} value={enabled} onValueChange={setEnabled} disabled={mut.isPending} />
      <Text style={[s.label, { color: colors.text }]}>Template</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {templates.map((t) => <Chip key={t.id} label={t.name} selected={templateId === t.id} disabled={mut.isPending} onPress={() => setTemplateId(t.id)} />)}
      </View>
      <Text style={[s.label, { color: colors.text }]}>Audience</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {trigger.allowedAudiences.map((a) => <Chip key={a} label={audienceLabel(a)} selected={audience === a} disabled={mut.isPending} onPress={() => setAudience(a)} />)}
      </View>
      {trigger.scheduled ? (
        <Field label="Minutes before (5 to 10080)" keyboardType="number-pad" value={minutes} onChangeText={setMinutes}
          editable={!mut.isPending} error={minsOk ? null : 'Enter a whole number from 5 to 10080.'} />
      ) : null}
      {error ? <Banner tone="error" title="Not saved">{error}</Banner> : null}
      {error && dirty ? <Button label="Retry save" variant="secondary" onPress={onSave} disabled={!minsOk || !templateId} style={{ marginBottom: 10 }} /> : null}
      <Button label="Save trigger" onPress={onSave} disabled={!dirty || !minsOk || !templateId} loading={mut.isPending} />
      <Text style={[s.hint, { color: colors.textSecondary }]}>Updated {fmtDate(trigger.updatedAt)}</Text>
      <Confirm visible={confirm} title="Turn on real pushes?" confirmLabel="Turn on and save" busy={mut.isPending} error={confirm ? error : null}
        message={`Saving will start sending real push notifications for "${trigger.label}" to its audience.`}
        onConfirm={send} onCancel={() => setConfirm(false)} />
    </Card>
  );
}

const STATUS_NOTE = 'Queued or Apple accepted does not prove the person saw or opened the notification.';

export default function NotificationsSection({ onBack }) {
  const { request, report } = useAdminGuard();
  const { s, colors } = useAdminStyles();
  const qc = useQueryClient();
  const q = useGetNotificationAdminState({ request, query: { retry: false, queryKey: getGetNotificationAdminStateQueryKey(), refetchOnWindowFocus: false } });
  const del = useDeletePushTemplate({ request });
  const test = useSendPushTemplateTest({ request });
  const [editing, setEditing] = useState(undefined); // undefined list, null new, object edit
  const [deleting, setDeleting] = useState(null);
  const [testing, setTesting] = useState(null);
  const [delError, setDelError] = useState(null);
  const [testError, setTestError] = useState(null);
  const [notice, setNotice] = useState(null);
  useEffect(() => { if (q.error) report(q.error); }, [q.error, report]);
  const refresh = () => qc.invalidateQueries({ queryKey: getGetNotificationAdminStateQueryKey() });
  const saved = (msg) => { setNotice({ ok: true, text: msg }); setEditing(undefined); refresh(); };

  const d = q.data;
  if (!q.isError && d && editing !== undefined) {
    return <TemplateEditor template={editing} placeholders={d.placeholders} onClose={() => setEditing(undefined)} onSaved={saved} />;
  }
  const cfg = d && d.configuration;
  const blocked = testBlockReason(cfg);

  const doDelete = () => {
    if (!deleting || del.isPending || q.isError) return;
    setDelError(null);
    del.mutate({ id: deleting.id }, {
      onSuccess: () => { setNotice({ ok: true, text: 'Template deleted.' }); setDeleting(null); refresh(); },
      onError: (e) => { report(e); const i = errInfo(e); setDelError(i.status === 409 ? 'This template is used by a trigger. Assign a different template to that trigger first.' : i.message); },
    });
  };
  const doTest = () => {
    if (!testing || test.isPending || q.isError || blocked) return;
    setTestError(null);
    test.mutate({ data: { templateId: testing.id } }, {
      onSuccess: (r) => {
        setTesting(null);
        setNotice({ ok: true, text: `${r.queued} test push${r.queued === 1 ? '' : 'es'} queued for your own devices. Queued is not delivered; check the delivery log.` });
        refresh();
      },
      onError: (e) => { report(e); setTestError(errInfo(e).message); },
    });
  };

  return (
    <Screen title="Notifications" subtitle="Push wording and which events send it." onBack={onBack} backLabel="Back to SuperAdmin"
      right={<Button label="Refresh" variant="secondary" icon="refresh" onPress={() => q.refetch()} loading={q.isFetching} />}>
      {q.isLoading ? <SkeletonBlocks count={4} />
        : q.isError || !d ? <LoadError title="Could not load notification settings" message={errInfo(q.error).message} onRetry={() => q.refetch()} busy={q.isFetching} />
        : (
          <>
            {notice ? <Banner tone={notice.ok ? 'success' : 'error'}>{notice.text}</Banner> : null}
            <Card accent={cfg.configured ? colors.success : colors.warning}>
              <Text style={[s.label, { color: cfg.configured ? colors.success : colors.warning }]}>Apple push: {cfg.configured ? 'Configured' : 'Not configured'}</Text>
              <Text style={[s.body, { color: colors.text }]}>Bundle ID: {cfg.bundleId || '-'}</Text>
              <Text style={[s.body, { color: colors.text }]}>Registered devices: {cfg.deviceCount}</Text>
              <Text style={[s.body, { color: colors.text }]}>Your devices: {cfg.ownDeviceCount}</Text>
              {!cfg.configured ? (
                <Text style={[s.hint, { color: colors.text }]}>
                  Missing server settings: {cfg.missing.length ? cfg.missing.join(', ') : 'unspecified'}. They are set by whoever deploys LUDI and never appear here. Nothing is sent until they exist.
                </Text>
              ) : null}
            </Card>

            <SectionTitle hint="Switched off by default. Turning one on starts real pushes.">Triggers</SectionTitle>
            {d.triggers.length === 0 ? <Card><Text style={{ color: colors.textSecondary }}>No triggers are defined.</Text></Card>
              : d.triggers.map((t) => <TriggerCard key={`${t.id}-${t.updatedAt}`} trigger={t} templates={d.templates} onSaved={(m) => { setNotice({ ok: true, text: m }); refresh(); }} />)}

            <SectionTitle hint="Test sends go only to your own opted-in iPhones.">Templates</SectionTitle>
            <Button label="New template" icon="add" onPress={() => { setNotice(null); setEditing(null); }} style={{ marginBottom: 12 }} />
            {blocked ? <Banner tone="warning" title="Test sends disabled">{blocked}</Banner> : null}
            {d.templates.length === 0 ? <Card><Text style={{ color: colors.textSecondary }}>No templates yet. Create one to assign it to a trigger.</Text></Card>
              : d.templates.map((t) => (
                <Card key={t.id}>
                  <Text style={[s.label, { color: colors.text }]}>{t.name}</Text>
                  <View style={{ backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 12, marginBottom: 12 }}>
                    <Text style={[s.label, { color: colors.text, marginBottom: 2 }]}>{t.title}</Text>
                    <Text numberOfLines={4} style={[s.body, { color: colors.text }]}>{t.body}</Text>
                  </View>
                  <Text style={[s.hint, { color: colors.textSecondary, marginTop: 0, marginBottom: 10 }]}>Updated {fmtDate(t.updatedAt)}</Text>
                  <Button label="Edit" icon="create-outline" variant="secondary" onPress={() => { setNotice(null); setEditing(t); }} style={{ marginBottom: 8 }} />
                  <Button label="Send test to me" icon="paper-plane-outline" variant="secondary" disabled={!!blocked || test.isPending} onPress={() => { setTestError(null); setTesting(t); }} style={{ marginBottom: 8 }} />
                  <Button label="Delete" icon="trash-outline" variant="danger" onPress={() => { setDelError(null); setDeleting(t); }} />
                </Card>
              ))}

            <SectionTitle hint={`Latest ${d.deliveries.length} of up to 60. ${STATUS_NOTE}`}>Delivery log</SectionTitle>
            {d.deliveries.length === 0 ? <Card><Text style={{ color: colors.textSecondary }}>No deliveries recorded yet.</Text></Card>
              : d.deliveries.map((x) => {
                const trig = d.triggers.find((t) => t.id === x.triggerId);
                return (
                  <Card key={x.id}>
                    <Text style={[s.label, { color: colors.text }]}>{x.title}</Text>
                    <Text style={[s.body, { color: colors.primary }]}>Status: {x.status}</Text>
                    <Text style={[s.hint, { color: colors.textSecondary }]}>{trig ? trig.label : x.triggerId} - {x.environment} - {x.attempts} attempt{x.attempts === 1 ? '' : 's'}</Text>
                    <Text style={[s.hint, { color: colors.textSecondary, marginTop: 2 }]}>Created {fmtDate(x.createdAt)}{x.acceptedAt ? `. Apple accepted ${fmtDate(x.acceptedAt)}` : ''}</Text>
                    {x.reason ? <Text style={[s.hint, { color: colors.text }]}>Reason: {x.reason}</Text> : null}
                  </Card>
                );
              })}
          </>
        )}
      <Confirm visible={!!deleting} title="Delete template?" danger confirmLabel="Delete" busy={del.isPending} error={delError}
        message={`"${deleting ? deleting.name : ''}" will be removed. Templates used by a trigger cannot be deleted.`}
        onConfirm={doDelete} onCancel={() => setDeleting(null)} />
      <Confirm visible={!!testing} title="Send test push?" confirmLabel="Queue test" busy={test.isPending} error={testError}
        message={`The saved template "${testing ? testing.name : ''}" will be queued for your own opted-in iPhones only. Queued is not the same as delivered.`}
        onConfirm={doTest} onCancel={() => setTesting(null)} />
    </Screen>
  );
}
