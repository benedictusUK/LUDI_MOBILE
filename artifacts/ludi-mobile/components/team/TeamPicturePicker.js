import React, { useState } from 'react';
import { Alert, Image, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BrandText as Text } from '../brand/BrandText';
import { useTheme } from '../../contexts/ThemeContext';
import { pickTeamPicture } from '../../lib/teamPicture';
import TeamAvatar from './TeamAvatar';

// value: asset = newly chosen, null = removed, undefined = unchanged.
export default function TeamPicturePicker({ value, existingPath, onChange, disabled, AvatarComponent = TeamAvatar, noun = 'picture', testIDPrefix = 'team-picture' }) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const hasImage = value ? true : value === undefined && !!existingPath;
  const choose = async () => {
    if (disabled || busy) return;
    setBusy(true);
    setError('');
    try {
      const asset = await pickTeamPicture();
      if (asset) onChange(asset);
    } catch (e) {
      setError(e?.message || 'Could not open your photos. Please try again.');
      Alert.alert('Picture', e?.message || 'Could not open your photos. Check photo permissions and try again.');
    } finally { setBusy(false); }
  };
  const btn = { minHeight: 44, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 6, opacity: disabled ? 0.5 : 1 };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      {value?.uri
        ? <Image source={{ uri: value.uri }} style={{ width: 72, height: 72, borderRadius: 18 }} />
        : <AvatarComponent path={value === null ? null : existingPath} size={72} radius={18} color={colors.cardSecondary} iconColor={colors.icon} />}
      <View style={{ flex: 1, gap: 8 }}>
        {!!error && <Text accessibilityRole="alert" style={{ color: colors.error, fontSize: 13 }}>{error}</Text>}
        <TouchableOpacity accessibilityRole="button" disabled={disabled || busy} onPress={choose} style={btn} testID={`button-${testIDPrefix}`}>
          <Ionicons name="image-outline" size={18} color={colors.primary} />
          <Text style={{ color: colors.text, fontWeight: '600' }}>{hasImage ? `Change ${noun}` : `Add ${noun} (optional)`}</Text>
        </TouchableOpacity>
        {hasImage && (
          <TouchableOpacity accessibilityRole="button" disabled={disabled || busy} onPress={() => { setError(''); onChange(null); }} style={btn} testID={`button-remove-${testIDPrefix}`}>
            <Ionicons name="trash-outline" size={18} color={colors.error} />
            <Text style={{ color: colors.error, fontWeight: '600' }}>Remove {noun}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
