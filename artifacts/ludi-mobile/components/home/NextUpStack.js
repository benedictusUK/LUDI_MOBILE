import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { eventDateParts, moneyLabel, nextCardIndex, paymentPresentation, voteLabel } from '../../lib/homeEventPresentation';
import { useBrandTypography } from './brand';

export default function NextUpStack({ events, palette, onEvent, onViewAll, onRetry }) {
  const typography = useBrandTypography();
  const scroll = useRef(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(true);
  const cards = events.slice(0, 3);
  const signature = cards.map(event => event.id).join('|');
  useEffect(() => {
    let mounted = true;
    if (typeof AccessibilityInfo.isReduceMotionEnabled === 'function') {
      AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); }).catch(() => {});
    }
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; listener?.remove(); };
  }, []);
  useEffect(() => {
    setIndex(0);
    scroll.current?.scrollTo({ x: 0, animated: false });
  }, [signature, width]);
  const move = delta => {
    const next = nextCardIndex(index, delta, cards.length);
    setIndex(next);
    scroll.current?.scrollTo({ x: next * width, animated: !reduceMotion && Platform.OS !== 'web' });
  };
  const updateScrollPosition = event => setIndex(Math.max(0, Math.min(cards.length, Math.round(event.nativeEvent.contentOffset.x / width))));
  const body = (extra = {}) => [typography.body, extra];
  const display = (extra = {}) => [typography.display, extra];
  return (
    <View>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={display({ fontSize: 24, color: palette.text })}>UP NEXT</Text>
          <Text style={body({ fontSize: 11, color: palette.muted, marginTop: 3 })}>
            {cards.length ? `Your next ${cards.length === 1 ? 'fixture' : `${cards.length} fixtures`}, in date order.` : 'Find your next game.'}
          </Text>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={onViewAll} style={styles.link}>
          <Text style={body({ color: palette.mint, fontSize: 14 })}>View all</Text>
        </TouchableOpacity>
      </View>
      <View onLayout={event => setWidth(Math.round(event.nativeEvent.layout.width))} style={styles.stack}>
        {cards.length > 1 && <View pointerEvents="none" style={styles.peek} />}
        {width > 0 && (
          <ScrollView ref={scroll} horizontal pagingEnabled snapToInterval={width}
            disableIntervalMomentum decelerationRate="fast" showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={updateScrollPosition}
            onScroll={Platform.OS === 'web' ? updateScrollPosition : undefined} scrollEventThrottle={32}
            testID="next-up-carousel" accessibilityLabel="Upcoming events. Swipe horizontally to browse."
            contentContainerStyle={styles.cardTrack}>
            {cards.map((event, position) => {
              const date = eventDateParts(event);
              const vote = voteLabel(event.userAttendance);
              const payment = paymentPresentation(event.paymentSummary, event.paymentSummaryError);
              return (
                <LinearGradient key={event.id} colors={['#135cc7', '#104898', '#0e345f']}
                  style={[styles.card, { width }]} testID={`next-up-event-${position + 1}`}>
                  <View pointerEvents="none" style={styles.orbit} />
                  <View style={styles.topRow}>
                    <Text style={body(styles.kicker)}>{position === 0 ? 'NEXT EVENT' : 'COMING NEXT'}</Text>
                    <Text style={body(styles.kicker)}>{position + 1} / {cards.length}</Text>
                  </View>
                  <View style={styles.heading}>
                    <View style={styles.date} accessibilityLabel={date.full}>
                      <Text style={body(styles.dateSmall)}>{date.weekday.toUpperCase()}</Text>
                      <Text style={display(styles.dateNumber)}>{date.day}</Text>
                      <Text style={body(styles.dateSmall)}>{date.month.toUpperCase()}</Text>
                    </View>
                    <View style={styles.titleGroup}>
                      <Text style={body(styles.sport)}>{event.sport || 'SPORT'}</Text>
                      <Text style={display(styles.title)} numberOfLines={3}>{event.name}</Text>
                      <View style={styles.timeRow}>
                        <Ionicons name="time-outline" size={18} color="#42e6b5" />
                        <Text style={display(styles.time)}>{date.time}</Text>
                        <Text style={body(styles.timeNote)}>Start time</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.venue}>
                    <Ionicons name="location-outline" size={18} color="#42e6b5" />
                    <Text style={body(styles.venueText)}>{event.location || 'Venue to be confirmed'}</Text>
                  </View>
                  <View style={styles.statusRow}>
                    <View style={styles.statusCell}>
                      <Text style={body(styles.statusLabel)}>YOUR VOTE</Text>
                      <Text style={body(styles.statusValue)}>{vote}</Text>
                    </View>
                    {event.paymentRequired && (
                      <View style={styles.statusCell}>
                        <Text style={body(styles.statusLabel)}>PAYMENT</Text>
                        <Text style={body([styles.statusValue, { color: payment.label === 'Paid' ? '#83f1d0' : '#ffe09b' }])}>{payment.label}</Text>
                        <Text style={body(styles.paid)} testID={`paid-amount-${event.id}`}>
                          {payment.paidMinor === null ? 'Amount unavailable' : `Paid ${moneyLabel(payment.paidMinor, payment.currency)}`}
                        </Text>
                        {payment.refundedMinor > 0 && <Text style={body(styles.paid)}>Refunded {moneyLabel(payment.refundedMinor, payment.currency)}</Text>}
                        {event.paymentSummaryError && <TouchableOpacity accessibilityRole="button" onPress={onRetry} style={{ paddingTop: 8 }}>
                          <Text style={body({ fontSize: 12, color: '#ffffff', textDecorationLine: 'underline' })}>Retry status</Text>
                        </TouchableOpacity>}
                      </View>
                    )}
                    {!event.paymentRequired && <View style={styles.statusCell}>
                      <Text style={body(styles.statusLabel)}>WITH</Text>
                      <Text style={body(styles.statusValue)}>{event.primaryTeam?.name || 'Your community'}</Text>
                    </View>}
                  </View>
                  <View style={styles.footer}>
                    <Text style={body(styles.team)} numberOfLines={2}>{event.primaryTeam?.name || 'Your community'}</Text>
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`View ${event.name}, voting and payment details`}
                      testID={`event-details-${position + 1}`} style={styles.details} onPress={() => onEvent(event.id)}>
                      <Text style={body(styles.detailsText)}>Event details</Text>
                      <Ionicons name="chevron-forward" size={17} color="#052b28" />
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              );
            })}
            <LinearGradient colors={['#135cc7', '#0e345f']} style={[styles.card, styles.allCard, { width }]} testID="view-all-events-card">
              <Ionicons name="calendar-outline" size={36} color="#42e6b5" />
              <Text style={display([styles.title, { marginTop: 20 }])}>{cards.length ? 'See what else is on.' : 'Your next game starts here.'}</Text>
              <Text style={body({ color: '#d2e4f5', fontSize: 14, lineHeight: 21, marginVertical: 18 })}>
                {cards.length ? 'Browse all events from your teams.' : 'No upcoming events yet. Browse events or create a game with your team.'}
              </Text>
              <TouchableOpacity accessibilityRole="button" onPress={onViewAll} style={styles.details}>
                <Text style={body(styles.detailsText)}>View all events</Text><Ionicons name="chevron-forward" size={18} color="#052b28" />
              </TouchableOpacity>
            </LinearGradient>
          </ScrollView>
        )}
      </View>
      {cards.length > 0 && (
        <View>
          <View style={styles.controls}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Previous event card" disabled={index === 0}
              accessibilityState={{ disabled: index === 0 }} style={[styles.arrow, { opacity: index === 0 ? 0.35 : 1, borderColor: palette.border }]} onPress={() => move(-1)}>
              <Ionicons name="chevron-back" size={20} color={palette.text} />
            </TouchableOpacity>
            {Array.from({ length: cards.length + 1 }, (_, position) => (
              <TouchableOpacity key={position} accessibilityRole="button" accessibilityState={{ selected: position === index }}
                accessibilityLabel={position === cards.length ? 'Show view all events card' : `Show event ${position + 1}`}
                style={styles.dotTarget} onPress={() => move(position - index)}>
                <View style={[styles.dot, { borderColor: palette.muted }, position === index && { width: 22, backgroundColor: palette.mint, borderColor: palette.mint }]} />
              </TouchableOpacity>
            ))}
            {width >= 340 && <Text accessibilityLiveRegion="polite" style={body({ color: palette.muted, fontSize: 11, marginHorizontal: 5 })}>
              {index === cards.length ? 'ALL' : index + 1} / {cards.length + 1}
            </Text>}
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Next event card" testID="next-event-card"
              disabled={index === cards.length} accessibilityState={{ disabled: index === cards.length }}
              style={[styles.arrow, { opacity: index === cards.length ? 0.35 : 1, borderColor: palette.border }]} onPress={() => move(1)}>
              <Ionicons name="chevron-forward" size={20} color={palette.text} />
            </TouchableOpacity>
          </View>
          <Text style={body({ fontSize: 10, color: palette.muted, textAlign: 'center' })}>Swipe or use the arrows to see what’s next</Text>
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  link: { minHeight: 44, justifyContent: 'center', paddingLeft: 12 },
  stack: { marginBottom: 6 }, cardTrack: { alignItems: 'stretch' },
  peek: { position: 'absolute', top: 8, bottom: -6, left: 12, right: 12, borderRadius: 22, backgroundColor: '#0d2847', borderWidth: 1, borderColor: '#345478' },
  card: { minHeight: 335, borderRadius: 21, padding: 18, borderWidth: 1, borderColor: '#4c88c9', overflow: 'hidden' },
  orbit: { position: 'absolute', width: 245, height: 245, borderRadius: 125, right: -100, top: -110, borderWidth: 18, borderColor: '#ffffff08' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  kicker: { color: '#e1f1ff', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  heading: { flexDirection: 'row', gap: 12 },
  date: { width: 68, backgroundColor: '#e7f3fc', borderRadius: 16, paddingVertical: 12, alignItems: 'center', alignSelf: 'flex-start' },
  dateSmall: { fontSize: 11, fontWeight: '700', color: '#355775', letterSpacing: 1 },
  dateNumber: { fontSize: 38, color: '#102943', marginVertical: 2 },
  titleGroup: { flex: 1 }, sport: { color: '#d4edff', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '700' },
  title: { color: '#ffffff', fontSize: 29, lineHeight: 32, marginTop: 6 },
  timeRow: { flexDirection: 'row', gap: 7, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' },
  time: { color: '#ffffff', fontSize: 26 }, timeNote: { color: '#d1e4f5', fontSize: 10 },
  venue: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: '#ffffff30', paddingTop: 12, marginTop: 14, marginBottom: 12 },
  venueText: { flex: 1, fontSize: 12, color: '#edf6ff', lineHeight: 18 },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusCell: { flex: 1, backgroundColor: '#05254e40', borderColor: '#ffffff30', borderWidth: 1, borderRadius: 12, padding: 10 },
  statusLabel: { color: '#cce5fb', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  statusValue: { color: '#ffffff', fontSize: 13, fontWeight: '700', marginTop: 6 },
  paid: { fontSize: 12, color: '#d9eaff', marginTop: 5 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12 },
  team: { color: '#d0e6f7', fontSize: 11, flex: 1 },
  details: { flexDirection: 'row', gap: 6, backgroundColor: '#42e6b5', paddingHorizontal: 13, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  detailsText: { color: '#052b28', fontWeight: '700', fontSize: 12 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  arrow: { width: 44, height: 44, borderWidth: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  dotTarget: { minWidth: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderWidth: 1, borderRadius: 8 },
  allCard: { justifyContent: 'center' },
});
