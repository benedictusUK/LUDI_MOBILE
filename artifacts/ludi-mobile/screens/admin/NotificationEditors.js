import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetNotificationAdminState, getGetNotificationAdminStateQueryKey, useCreatePushTemplate, useUpdatePushTemplate,
  useDeletePushTemplate, useCreatePushTrigger, useDeletePushTrigger, useUpdatePushTrigger, usePreviewPushTemplate, useSendPushTemplateTest,
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

function TemplateEditor({ template, placeholders, onClose, onSaved, backLabel = 'Back to templates' }) {
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
    <Screen title={template ? 'Edit template' : 'New template'} subtitle="Push text only. In-app notifications are not changed." onBack={onClose} backLabel={backLabel}>
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

function Select({ label, value, options, placeholder, onChange, disabled }) {
  const { s, colors } = useAdminStyles();
  const [open, setOpen] = useState(false);
  const cur = options.find((o) => o.id === value);
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[s.label, { color: colors.text }]}>{label}</Text>
      <Pressable disabled={!!disabled} onPress={() => setOpen(true)} accessibilityRole="button"
        accessibilityLabel={`${label}: ${cur ? cur.label : placeholder}`} accessibilityHint="Opens a list of choices" accessibilityState={{ disabled: !!disabled, expanded: open }}
        style={[s.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', opacity: disabled ? 0.5 : 1 }]}>
        <Text style={{ color: cur ? colors.inputText : colors.inputPlaceholder, fontSize: 16, flex: 1 }}>{cur ? cur.label : placeholder}</Text>
        <Text style={{ color: colors.textSecondary }}>{open ? '\u25b2' : '\u25bc'}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={[s.scrim, { backgroundColor: colors.overlay }]}>
          <View accessibilityViewIsModal style={{ backgroundColor: colors.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.border, maxHeight: '80%' }}>
            <Text accessibilityRole="header" style={[s.label, { color: colors.text, fontSize: 18 }]}>{label}</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              {options.map((o) => (
                <Pressable key={o.id} onPress={() => { onChange(o.id); setOpen(false); }} accessibilityRole="button" accessibilityLabel={o.label}
                  accessibilityState={{ selected: o.id === value }}
                  style={{ minHeight: 48, justifyContent: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.borderLight }}>
                  <Text style={[s.body, { color: o.id === value ? colors.primary : colors.text, fontWeight: o.id === value ? '700' : '400' }]}>{o.label}</Text>
                  {o.hint ? <Text style={[s.hint, { color: colors.textSecondary }]}>{o.hint}</Text> : null}
                </Pressable>
              ))}
            </ScrollView>
            <Button label="Cancel" variant="secondary" onPress={() => setOpen(false)} style={{ marginTop: 10 }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function NotificationEditor({ trigger, d, onClose, onSaved, onNewTemplate }) {
  const { request, report } = useAdminGuard();
  const { s, colors } = useAdminStyles();
  const create = useCreatePushTrigger({ request });
  const update = useUpdatePushTrigger({ request });
  const types = d.triggerTypes || [];
  const [typeId, setTypeId] = useState(trigger ? trigger.type : '');
  const [enabled, setEnabled] = useState(trigger ? trigger.enabled : false);
  const [templateId, setTemplateId] = useState(trigger ? trigger.templateId : null);
  const [audience, setAudience] = useState(trigger ? trigger.audience : '');
  const [minutes, setMinutes] = useState(String(trigger ? trigger.reminderMinutes : 60));
  const [error, setError] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const meta = trigger || types.find((t) => t.id === typeId);
  const mins = parseMinutes(minutes);
  const minsOk = !meta || !meta.scheduled || mins !== null;
  const busy = create.isPending || update.isPending;
  const valid = !!meta && d.templates.some((t) => t.id === templateId) && meta.allowedAudiences.includes(audience) && minsOk;
  const pickType = (t) => { setTypeId(t.id); if (!t.allowedAudiences.includes(audience)) setAudience(t.allowedAudiences[0] || ''); };
  const send = () => {
    if (busy || !valid) return;
    setError(null);
    const reminderMinutes = meta.scheduled ? mins : (trigger ? trigger.reminderMinutes : 60);
    const opts = { onSuccess: () => { setConfirm(false); onSaved(trigger ? 'Notification updated.' : 'Notification created.'); }, onError: (e) => { report(e); setError(errInfo(e).message); } };
    if (trigger) update.mutate({ id: trigger.id, data: { enabled, templateId, audience, reminderMinutes } }, opts);
    else create.mutate({ data: { type: typeId, enabled, templateId, audience, reminderMinutes } }, opts);
  };
  const onSave = () => (enabled && !(trigger && trigger.enabled) ? setConfirm(true) : send());
  return (
    <Screen title={trigger ? 'Edit notification' : 'Create notification'} subtitle="You can add several reminders of the same type." onBack={onClose} backLabel="Back to notifications">
      <Card>
        {trigger ? <Text style={[s.label, { color: colors.text }]}>Notification type</Text> : null}
        {trigger ? <Text style={[s.body, { color: colors.text, marginBottom: 8 }]}>{trigger.label} (type cannot be changed)</Text> : (
          <Select label="Notification type" value={typeId} placeholder="Choose a type" disabled={busy} options={types.map((t) => ({ id: t.id, label: t.label }))}
            onChange={(id) => pickType(types.find((t) => t.id === id))} />
        )}
        {meta ? <Text style={[s.hint, { color: colors.textSecondary, marginBottom: 10 }]}>{meta.description}</Text> : null}
        <Text style={[s.label, { color: colors.text }]}>Template</Text>
        {d.templates.length === 0 ? (
          <View>
            <Text style={[s.hint, { color: colors.textSecondary, marginBottom: 8 }]}>Create a template first. A notification needs push wording.</Text>
            <Button label="Create template" icon="add" variant="secondary" onPress={onNewTemplate} style={{ marginBottom: 10 }} />
          </View>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {d.templates.map((t) => <Chip key={t.id} label={t.name} selected={templateId === t.id} disabled={busy} onPress={() => setTemplateId(t.id)} />)}
          </View>
        )}
        {meta ? (
          <>
            <Text style={[s.label, { color: colors.text }]}>Audience</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {meta.allowedAudiences.map((a) => <Chip key={a} label={audienceLabel(a)} selected={audience === a} disabled={busy} onPress={() => setAudience(a)} />)}
            </View>
          </>
        ) : null}
        {meta && meta.scheduled ? (
          <Field label="Minutes before (5 to 10080)" keyboardType="number-pad" value={minutes} onChangeText={setMinutes}
            editable={!busy} error={minsOk ? null : 'Enter a whole number from 5 to 10080.'} />
        ) : null}
        <ToggleRow label={enabled ? 'Push on' : 'Push off'} value={enabled} onValueChange={setEnabled} disabled={busy} />
      </Card>
      {error && !confirm ? <Banner tone="error" title="Not saved">{error}</Banner> : null}
      <Button label="Save notification" onPress={onSave} disabled={!valid} loading={busy} />
      <Confirm visible={confirm} title="Turn on real pushes?" confirmLabel="Turn on and save" busy={busy} error={confirm ? error : null}
        message={`Saving will start sending real push notifications for "${meta ? meta.label : ''}" to its audience.`}
        onConfirm={send} onCancel={() => setConfirm(false)} />
    </Screen>
  );
}

const STATUS_NOTE = 'Queued or Apple accepted does not prove the person saw or opened the notification.';

export default function NotificationsSection({ onBack }) {
  const { request, report } = useAdminGuard();
  const { s, colors } = useAdminStyles();
  const qc = useQueryClient();
  const q = useGetNotificationAdminState({ request, query: { retry: false, queryKey: getGetNotificationAdminStateQueryKey(), refetchOnWindowFocus: false } });
  const delTemplate = useDeletePushTemplate({ request });
  const delTrigger = useDeletePushTrigger({ request });
  const test = useSendPushTemplateTest({ request });
  const [tab, setTab] = useState('notifications');
  const [editor, setEditor] = useState(null); // { kind: 'notification'|'template', item, from }
  const [deleting, setDeleting] = useState(null); // { kind, item }
  const [testing, setTesting] = useState(null);
  const [delError, setDelError] = useState(null);
  const [testError, setTestError] = useState(null);
  const [notice, setNotice] = useState(null);
  useEffect(() => { if (q.error) report(q.error); }, [q.error, report]);
  const refresh = () => qc.invalidateQueries({ queryKey: getGetNotificationAdminStateQueryKey() });
  const say = (msg) => { setNotice({ ok: true, text: msg }); refresh(); };

  const d = q.data;
  if (!q.isError && d && editor) {
    if (editor.kind === 'template') {
      return <TemplateEditor template={editor.item} placeholders={d.placeholders} backLabel={editor.from ? 'Back to notification' : 'Back to templates'}
        onClose={() => setEditor(editor.from || null)}
        onSaved={(m) => { say(m); setEditor(editor.from || null); }} />;
    }
    return <NotificationEditor trigger={editor.item} d={d}
      onClose={() => setEditor(null)}
      onSaved={(m) => { say(m); setEditor(null); }}
      onNewTemplate={() => setEditor({ kind: 'template', item: null, from: editor })} />;
  }
  const cfg = d && d.configuration;
  const blocked = testBlockReason(cfg);
  const tplName = (id) => { const t = d && d.templates.find((x) => x.id === id); return t ? t.name : 'No template'; };

  const doDelete = () => {
    if (!deleting || delTemplate.isPending || delTrigger.isPending || q.isError) return;
    setDelError(null);
    const isTpl = deleting.kind === 'template';
    const opts = {
      onSuccess: () => { say(isTpl ? 'Template deleted.' : 'Notification deleted.'); setDeleting(null); },
      onError: (e) => { report(e); const i = errInfo(e); setDelError(isTpl && i.status === 409 ? 'This template is used by a notification. Assign a different template to that notification first.' : i.message); },
    };
    if (isTpl) delTemplate.mutate({ id: deleting.item.id }, opts); else delTrigger.mutate({ id: deleting.item.id }, opts);
  };
  const doTest = () => {
    if (!testing || test.isPending || q.isError || blocked) return;
    setTestError(null);
    test.mutate({ data: { templateId: testing.id } }, {
      onSuccess: (r) => {
        setTesting(null);
        say(`${r.queued} test push${r.queued === 1 ? '' : 'es'} queued for your own devices. Queued is not delivered; check the delivery log.`);
      },
      onError: (e) => { report(e); setTestError(errInfo(e).message); },
    });
  };

  return (
    <Screen title="Notification settings" subtitle="Push notifications and the templates behind them." onBack={onBack} backLabel="Back to SuperAdmin"
      right={<Button label="Refresh" variant="secondary" icon="refresh" onPress={() => q.refetch()} loading={q.isFetching} />}>
      <View style={{ flexDirection: 'row', marginBottom: 10 }}>
        <Chip label="Templates" selected={tab === 'templates'} onPress={() => setTab('templates')} />
        <Chip label="Notifications" selected={tab === 'notifications'} onPress={() => setTab('notifications')} />
      </View>
      {q.isLoading ? <SkeletonBlocks count={4} />
        : q.isError || !d ? <LoadError title="Could not load notification settings" message={errInfo(q.error).message} onRetry={() => q.refetch()} busy={q.isFetching} />
        : (
          <>
            {notice ? <Banner tone={notice.ok ? 'success' : 'error'}>{notice.text}</Banner> : null}
            {tab === 'templates' ? (
              <>
                <SectionTitle hint="Test sends go only to your own opted-in iPhones.">Configured templates</SectionTitle>
                <Button label="Create template" icon="add" onPress={() => { setNotice(null); setEditor({ kind: 'template', item: null }); }} style={{ marginBottom: 12 }} />
                {blocked ? <Banner tone="warning" title="Test sends disabled">{blocked}</Banner> : null}
                {d.templates.length === 0 ? <Card><Text style={{ color: colors.textSecondary }}>No templates yet. Create one to use in a notification.</Text></Card>
                  : d.templates.map((t) => (
                    <Card key={t.id}>
                      <Text style={[s.label, { color: colors.text }]}>{t.name}</Text>
                      <View style={{ backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 12, marginBottom: 12 }}>
                        <Text style={[s.label, { color: colors.text, marginBottom: 2 }]}>{t.title}</Text>
                        <Text numberOfLines={4} style={[s.body, { color: colors.text }]}>{t.body}</Text>
                      </View>
                      <Text style={[s.hint, { color: colors.textSecondary, marginTop: 0, marginBottom: 10 }]}>Updated {fmtDate(t.updatedAt)}</Text>
                      <Button label="Edit" icon="create-outline" variant="secondary" onPress={() => { setNotice(null); setEditor({ kind: 'template', item: t }); }} style={{ marginBottom: 8 }} />
                      <Button label="Send test to me" icon="paper-plane-outline" variant="secondary" disabled={!!blocked || test.isPending} onPress={() => { setTestError(null); setTesting(t); }} style={{ marginBottom: 8 }} />
                      <Button label="Delete" icon="trash-outline" variant="danger" onPress={() => { setDelError(null); setDeleting({ kind: 'template', item: t }); }} />
                    </Card>
                  ))}
              </>
            ) : (
              <>
                {cfg.outboxReady === false || cfg.paymentHooksReady === false ? (
                  <Banner tone={cfg.applicationQueueEnabled ? 'warning' : 'error'} title={cfg.applicationQueueEnabled ? 'Application notification queue active' : 'Automatic notifications are blocked'}>
                    Missing database hooks: {[
                      cfg.outboxReady === false && 'event notification queue',
                      cfg.paymentHooksReady === false && 'payment status notifications',
                    ].filter(Boolean).join(', ')}.
                    {' '}{cfg.applicationQueueEnabled ? 'The server handles these notices with a durable, duplicate-protected queue.' : 'Update and publish the server before testing automatic notifications.'}
                    {' '}Self-tests can work once your iPhone is registered.
                  </Banner>
                ) : null}
                {cfg.ownDeviceCount < 1 ? (
                  <Banner tone="warning" title="Register your iPhone first">
                    On the signed iPhone app, open Profile → Notification settings and turn on iPhone push notifications.
                    Allow the iPhone prompt, then return here and tap Refresh.
                  </Banner>
                ) : null}
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

                <SectionTitle hint="New notifications start switched off. Turning one on starts real pushes.">Configured notifications</SectionTitle>
                <Button label="Create notification" icon="add" onPress={() => { setNotice(null); setEditor({ kind: 'notification', item: null }); }} style={{ marginBottom: 12 }} />
                {d.triggers.length === 0 ? <Card><Text style={{ color: colors.textSecondary }}>{d.templates.length === 0 ? 'No notifications yet. Create a template first, then a notification.' : 'No notifications configured yet.'}</Text></Card>
                  : d.triggers.map((t) => (
                    <Card key={t.id}>
                      <Text style={[s.label, { color: colors.text }]}>{t.label}</Text>
                      <Text style={[s.hint, { color: colors.textSecondary, marginBottom: 6 }]}>{t.description}</Text>
                      <Text style={[s.body, { color: t.enabled ? colors.success : colors.textSecondary }]}>{t.enabled ? 'Push on' : 'Push off'}</Text>
                      <Text style={[s.body, { color: colors.text }]}>Template: {tplName(t.templateId)}</Text>
                      <Text style={[s.body, { color: colors.text }]}>Audience: {audienceLabel(t.audience)}</Text>
                      {t.scheduled ? <Text style={[s.body, { color: colors.text }]}>Minutes before: {t.reminderMinutes}</Text> : null}
                      <Text style={[s.hint, { color: colors.textSecondary, marginBottom: 10 }]}>Updated {fmtDate(t.updatedAt)}</Text>
                      <Button label="Edit" icon="create-outline" variant="secondary" onPress={() => { setNotice(null); setEditor({ kind: 'notification', item: t }); }} style={{ marginBottom: 8 }} />
                      <Button label="Delete" icon="trash-outline" variant="danger" onPress={() => { setDelError(null); setDeleting({ kind: 'notification', item: t }); }} />
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
          </>
        )}
      <Confirm visible={!!deleting} title={deleting && deleting.kind === 'template' ? 'Delete template?' : 'Delete notification?'} danger confirmLabel="Delete" busy={delTemplate.isPending || delTrigger.isPending} error={delError}
        message={deleting ? (deleting.kind === 'template' ? `"${deleting.item.name}" will be removed. Templates used by a notification cannot be deleted.` : `"${deleting.item.label}" will be removed and stop sending pushes.`) : ''}
        onConfirm={doDelete} onCancel={() => setDeleting(null)} />
      <Confirm visible={!!testing} title="Send test push?" confirmLabel="Queue test" busy={test.isPending} error={testError}
        message={`The saved template "${testing ? testing.name : ''}" will be queued for your own opted-in iPhones only. Queued is not the same as delivered.`}
        onConfirm={doTest} onCancel={() => setTesting(null)} />
    </Screen>
  );
}
