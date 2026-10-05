import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useGetFeeAdminState, getGetFeeAdminStateQueryKey, useUpdateFeeSettings } from '@workspace/api-client-react';
import { BrandText as Text } from '../../components/brand/BrandText';
import { Banner, Button, Card, Field, LoadError, Screen, SectionTitle, SkeletonBlocks, useAdminGuard, useAdminStyles } from './adminUi';
import { describeFees, errInfo, fmtDate, fromHundredths, gbp, toHundredths } from './adminHelpers.mjs';

const toDraft = (s) => ({ platform: fromHundredths(s.platformBasisPoints), stripe: fromHundredths(s.stripeBasisPoints), fixed: fromHundredths(s.stripeFixedMinor) });

export default function FeesSection({ onBack }) {
  const { request, report } = useAdminGuard();
  const { s, colors } = useAdminStyles();
  const qc = useQueryClient();
  const q = useGetFeeAdminState({ request, query: { retry: false, queryKey: getGetFeeAdminStateQueryKey(), refetchOnWindowFocus: false } });
  const update = useUpdateFeeSettings({ request });
  const [draft, setDraft] = useState(null);
  const [loaded, setLoaded] = useState(null); // settings snapshot the draft was built from
  const [error, setError] = useState(null);
  const [stale, setStale] = useState(false);
  const [saved, setSaved] = useState(false);
  const initialised = useRef(false);

  useEffect(() => { if (q.error) report(q.error); }, [q.error, report]);
  useEffect(() => {
    if (q.data && !initialised.current) {
      initialised.current = true;
      setLoaded(q.data.settings); setDraft(toDraft(q.data.settings));
    }
  }, [q.data]);

  const reload = async () => {
    setError(null);
    const r = await q.refetch();
    if (!r.isError && r.data) { setLoaded(r.data.settings); setDraft(toDraft(r.data.settings)); setStale(false); setSaved(false); }
  };

  const pBps = draft ? toHundredths(draft.platform, 10000) : null;
  const sBps = draft ? toHundredths(draft.stripe, 10000) : null;
  const fixed = draft ? toHundredths(draft.fixed, 1000000) : null;
  const valid = pBps !== null && sBps !== null && fixed !== null;
  const dirty = !!loaded && valid && (pBps !== loaded.platformBasisPoints || sBps !== loaded.stripeBasisPoints || fixed !== loaded.stripeFixedMinor);

  const save = () => {
    if (!loaded || !valid || stale || update.isPending || q.isError) return;
    setError(null); setSaved(false);
    update.mutate(
      { data: { platformBasisPoints: pBps, stripeBasisPoints: sBps, stripeFixedMinor: fixed, revision: loaded.revision } },
      {
        onSuccess: (next) => {
          qc.setQueryData(getGetFeeAdminStateQueryKey(), next);
          setLoaded(next.settings); setDraft(toDraft(next.settings)); setStale(false); setSaved(true);
        },
        onError: (e) => {
          report(e);
          const i = errInfo(e);
          if (i.status === 409) { setStale(true); setError(`${i.message} Newer rates exist. Your draft is kept; reload the latest rates to continue.`); }
          else setError(i.message);
        },
      },
    );
  };
  const set = (k) => (v) => { setSaved(false); setDraft((d) => ({ ...d, [k]: v })); };
  const bad = 'Enter a number with at most 2 decimal places in range.';

  return (
    <Screen title="Fees" subtitle="Default charges added to participant payments." onBack={onBack} backLabel="Back to SuperAdmin">
      {q.isLoading ? <SkeletonBlocks count={3} height={150} />
        : q.isError || !q.data || !loaded || !draft ? (
          <LoadError title="Could not load fee settings" message={errInfo(q.error).message} onRetry={() => q.refetch()} busy={q.isFetching} />
        ) : (
          <>
            <Banner tone="warning" title="New events only">
              {`Existing events and their payments are unchanged. ${q.data.processingChargeNotice}`}
            </Banner>
            <Card>
              <Text style={[s.hint, { color: colors.textSecondary, marginTop: 0, marginBottom: 12 }]}>Loaded revision {loaded.revision}. Applies to: {String(q.data.appliesTo).replace(/_/g, ' ')}.</Text>
              <Field label="Platform fee (%)" keyboardType="decimal-pad" value={draft.platform} onChangeText={set('platform')}
                editable={!stale && !update.isPending} error={pBps === null ? bad : null} hint="Percent of the base price. From 0 to 100%." />
              <Field label="Processing percentage (%)" keyboardType="decimal-pad" value={draft.stripe} onChangeText={set('stripe')}
                editable={!stale && !update.isPending} error={sBps === null ? bad : null} hint="Percent of base plus platform fee. From 0 to 100%." />
              <Field label="Processing fixed charge (GBP)" keyboardType="decimal-pad" value={draft.fixed} onChangeText={set('fixed')}
                editable={!stale && !update.isPending} error={fixed === null ? bad : null} hint={fixed !== null ? `${gbp(fixed)} per payment, up to 10000.00.` : 'Up to 10000.00 GBP.'} />
              {error ? <Banner tone="error" title="Not saved">{error}</Banner> : null}
              {saved ? <Banner tone="success">Saved. Applies to new events only.</Banner> : null}
              {stale ? <Button label="Reload latest rates" onPress={reload} loading={q.isFetching} icon="refresh" variant="secondary" style={{ marginBottom: 10 }} /> : null}
              <Button label="Save fees" onPress={save} disabled={!dirty || stale} loading={update.isPending} />
            </Card>
            <SectionTitle hint="Most recent changes, before and after.">Audit history</SectionTitle>
            {q.data.audit.length === 0 ? (
              <Card><Text style={{ color: colors.textSecondary }}>No fee changes recorded yet.</Text></Card>
            ) : q.data.audit.map((a) => (
              <Card key={a.id}>
                <Text style={[s.hint, { color: colors.textSecondary, marginTop: 0 }]}>{fmtDate(a.createdAt)} - actor {a.actorId || 'unknown'}</Text>
                <View style={{ marginTop: 6 }}>
                  <Text style={[s.body, { color: colors.text }]}>Before: {describeFees(a.before)}</Text>
                  <Text style={[s.body, { color: colors.text, marginTop: 4 }]}>After: {describeFees(a.after)}</Text>
                </View>
              </Card>
            ))}
          </>
        )}
    </Screen>
  );
}
