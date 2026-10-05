import React from 'react';
import useBrandStyles from './brand/useBrandStyles';
import { useTheme } from '../contexts/ThemeContext';
import { TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { BrandText as Text } from './brand/BrandText';
import { LinearGradient } from 'expo-linear-gradient';

export default function GradientButton({ 
  onPress, 
  title, 
  disabled = false, 
  loading = false,
  style,
  textStyle 
}) {
  const styles = useBrandStyles(baseStyles);
  const { colors, isDark } = useTheme();
  const inactive = disabled || loading;
  const fill = inactive ? [colors.disabled, colors.disabled] : isDark ? ['#42e6b5', '#2fcf9f'] : ['#087c60', '#096d58'];
  const ink = inactive ? colors.text : colors.buttonText;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.container, style]}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={fill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradient}
      >
        {loading ? (
          <ActivityIndicator color={ink} />
        ) : (
          <Text style={[styles.text, { color: ink }, textStyle]}>{title}</Text>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const baseStyles = StyleSheet.create({
  container: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  gradient: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  text: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
});
