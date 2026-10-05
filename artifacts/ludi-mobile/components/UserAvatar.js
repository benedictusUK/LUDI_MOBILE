import React from 'react';
import TeamAvatar from './team/TeamAvatar';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export default function UserAvatar({ user, path, size = 38, radius = size / 2, ...props }) {
  const { user: currentUser } = useAuth();
  const { colors } = useTheme();
  const person = user?.id && user.id === currentUser?.id ? currentUser : user;
  const name = [person?.firstName, person?.lastName].filter(Boolean).join(' ') || person?.username;
  return <TeamAvatar
    path={path !== undefined ? path : person?.profileImageUrl}
    size={size} radius={radius} color={colors.cardSecondary} iconColor={colors.primary}
    iconName="person-outline" imageLabel={name ? `${name}'s profile photo` : 'Profile photo'}
    {...props}
  />;
}
