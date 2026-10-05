import { useEffect, useRef } from 'react';
import useBrandStyles from './brand/useBrandStyles';
import { View, TouchableOpacity, Animated, StyleSheet, Dimensions, Platform, StatusBar } from 'react-native';
import { BrandText as Text } from './brand/BrandText';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '../contexts/NotificationContext';
import { useTheme } from '../contexts/ThemeContext';

const SAFE_AREA_TOP = Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 24) + 10;

const { width } = Dimensions.get('window');

const getNotificationIcon = (type) => {
  switch (type) {
    case 'new_event':
    case 'event_created':
      return 'calendar';
    case 'event_changed':
    case 'event_update':
      return 'calendar-outline';
    case 'team_join_request':
      return 'person-add';
    case 'team_invitation':
      return 'mail';
    case 'team_join_approved':
      return 'checkmark-circle';
    case 'payment_authorization_required':
    case 'payment_captured':
      return 'card';
    case 'flare_gun':
      return 'flame';
    case 'reserve_promotion':
      return 'arrow-up-circle';
    case 'member_blocked':
    case 'member_unblocked':
      return 'person-remove';
    case 'system':
      return 'information-circle';
    default:
      return 'notifications';
  }
};

const getNotificationColor = (type, isDark) => {
  switch (type) {
    case 'new_event':
    case 'event_created':
      return '#3b82f6';
    case 'team_join_request':
    case 'team_invitation':
      return '#8b5cf6';
    case 'payment_authorization_required':
    case 'payment_captured':
      return '#f59e0b';
    case 'flare_gun':
      return '#ef4444';
    case 'reserve_promotion':
      return '#10b981';
    default:
      return isDark ? '#60a5fa' : '#3b82f6';
  }
};

export default function NotificationToast() {
  const styles = useBrandStyles(baseStyles);
  const { latestNotification, clearLatestNotification } = useNotifications();
  const { isDark } = useTheme();
  const slideAnim = useRef(new Animated.Value(-150 - SAFE_AREA_TOP)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (latestNotification) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: SAFE_AREA_TOP,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        hideToast();
      }, 4000);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [latestNotification]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -150 - SAFE_AREA_TOP,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      clearLatestNotification();
    });
  };

  if (!latestNotification) return null;

  const iconName = getNotificationIcon(latestNotification.type);
  const iconColor = getNotificationColor(latestNotification.type, isDark);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? '#10243a' : '#ffffff', borderWidth: 1, borderColor: isDark ? '#304b63' : '#cbdcea',
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
          shadowColor: '#020b14',
        },
      ]}
    >
      <TouchableOpacity
        style={styles.content}
        onPress={hideToast}
        activeOpacity={0.9}
        data-testid="notification-toast"
      >
        <View style={[styles.iconContainer, { backgroundColor: `${iconColor}20` }]}>
          <Ionicons name={iconName} size={24} color={iconColor} />
        </View>
        <View style={styles.textContainer}>
          <Text
            style={[styles.title, { color: isDark ? '#f2f7fc' : '#102943' }]}
            numberOfLines={1}
          >
            {latestNotification.title}
          </Text>
          <Text
            style={[styles.message, { color: isDark ? '#acbfd0' : '#526b80' }]}
            numberOfLines={2}
          >
            {latestNotification.message}
          </Text>
        </View>
        <TouchableOpacity
          onPress={hideToast}
          style={styles.closeButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          data-testid="button-close-toast"
        >
          <Ionicons
            name="close"
            size={20}
            color={isDark ? '#acbfd0' : '#526b80'}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const baseStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 9999,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
  },
  closeButton: {
    padding: 4,
  },
});
