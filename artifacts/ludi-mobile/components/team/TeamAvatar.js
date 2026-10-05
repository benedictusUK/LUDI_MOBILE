import React, { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getTeamPictureUri } from '../../lib/teamPicture';

export default function TeamAvatar({ team, path, size = 38, radius = 12, color, style, iconColor = '#ffffff', iconName = 'people-outline', imageLabel }) {
  const [failed, setFailed] = useState(false);
  const uri = getTeamPictureUri(path !== undefined ? path : team?.teamImagePath);
  useEffect(() => { setFailed(false); }, [uri]);
  const bg = color || team?.color || '#1d5183';
  return (
    <View style={[{ width: size, height: size, borderRadius: radius, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, style]}>
      {uri && !failed
        ? <Image source={{ uri }} accessibilityLabel={imageLabel || (team?.name ? `${team.name} picture` : 'Team picture')} onError={() => setFailed(true)} style={{ width: size, height: size }} resizeMode="cover" />
        : <Ionicons name={iconName} size={Math.round(size * 0.55)} color={iconColor} />}
    </View>
  );
}
