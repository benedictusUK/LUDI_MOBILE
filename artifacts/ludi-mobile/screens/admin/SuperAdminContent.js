import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAdminSession } from '../../contexts/AdminSessionContext';
import { BrandText as Text } from '../../components/brand/BrandText';
import { AdminGuardContext, Card, Screen, useAdminStyles } from './adminUi';
import { errInfo, isAccessError } from './adminHelpers.mjs';
import NotificationsSection from './NotificationEditors';
import FeesSection from './FeeEditor';

function HubTile({ icon, title, body, onPress }) {
  const { s, colors, display } = useAdminStyles();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}. ${body}`}>
      <Card>
        <View style={s.row}>
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
            <Ionicons name={icon} size={24} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[display, { fontSize: 22, color: colors.text }]}>{title}</Text>
            <Text style={[s.hint, { color: colors.textSecondary }]}>{body}</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={colors.icon} />
        </View>
      </Card>
    </Pressable>
  );
}

export default function SuperAdminContent({ navigation }) {
  const { request, onAccessError } = useAdminSession();
  const [section, setSection] = useState(null);
  const [denied, setDenied] = useState(false);
  const report = useCallback((e) => {
    if (isAccessError(errInfo(e))) setDenied(true);
    if (onAccessError) onAccessError(e);
  }, [onAccessError]);
  const guard = useMemo(() => ({ request, report }), [request, report]);
  const leave = () => (navigation && navigation.goBack ? navigation.goBack() : null);

  if (denied) {
    return (
      <Screen title="SuperAdmin" onBack={leave}>
        <Card><Text accessibilityRole="alert">SuperAdmin access is no longer available for this account.</Text></Card>
      </Screen>
    );
  }
  return (
    <AdminGuardContext.Provider value={guard}>
      {section === 'notifications' ? <NotificationsSection onBack={() => setSection(null)} />
        : section === 'fees' ? <FeesSection onBack={() => setSection(null)} />
        : (
          <Screen title="SuperAdmin" subtitle="Platform controls. These are separate from team organiser tools." onBack={leave} backLabel="Go back">
            <HubTile icon="notifications-outline" title="Notifications" body="Push wording, triggers, test sends and delivery log." onPress={() => setSection('notifications')} />
            <HubTile icon="card-outline" title="Fees" body="Default platform and processing charges for new events." onPress={() => setSection('fees')} />
          </Screen>
        )}
    </AdminGuardContext.Provider>
  );
}
