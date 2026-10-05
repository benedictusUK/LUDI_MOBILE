import React, { useEffect, useRef, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BrandText as Text } from './brand/BrandText';
import TeamPicturePicker from './team/TeamPicturePicker';
import UserAvatar from './UserAvatar';
import { uploadTeamPicture as uploadPicture } from '../lib/teamPicture';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export default function ProfilePictureEditor() {
  const { user, apiRequest, updateUser } = useAuth();
  const { colors } = useTheme();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(undefined);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const uploaded = useRef(null);
  const locked = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const save = async () => {
    if (locked.current || draft === undefined) return;
    locked.current = true;
    setSaving(true);
    setError('');
    try {
      let objectPath = null;
      if (draft) {
        if (uploaded.current?.asset === draft) objectPath = uploaded.current.path;
        else {
          objectPath = await uploadPicture(draft, apiRequest);
          uploaded.current = { asset: draft, path: objectPath };
        }
      }
      const response = await apiRequest('/api/users/profile-picture', {
        method: 'PUT', body: JSON.stringify({ objectPath }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Could not save your photo. Please retry.');
      if (!Object.prototype.hasOwnProperty.call(result, 'profileImageUrl')) throw new Error('The photo save response was incomplete. Please retry.');
      if (!active.current) return;
      updateUser({ profileImageUrl: result.profileImageUrl });
      setMessage(objectPath ? 'Profile photo saved.' : 'Profile photo removed.');
      setEditing(false);
      setDraft(undefined);
      uploaded.current = null;
    } catch (e) {
      if (active.current) setError(e?.message || 'Could not save your photo. Please retry.');
    } finally {
      locked.current = false;
      if (active.current) setSaving(false);
    }
  };
  const button = { minHeight: 44, borderRadius: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 };
  return (
    <View style={{ alignSelf: 'stretch', marginTop: 16, gap: 12 }}>
      {editing ? (
        <>
          <TeamPicturePicker value={draft} existingPath={user?.profileImageUrl}
            onChange={value => { setDraft(value); setError(''); uploaded.current = null; }}
            disabled={saving} AvatarComponent={UserAvatar} noun="photo" testIDPrefix="profile-photo" />
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
            Optional · JPEG, PNG or WebP · up to 5 MB. Shown beside your name in team and attendee lists.
          </Text>
          {!!error && <Text accessibilityRole="alert" style={{ color: colors.error }}>{error}</Text>}
          <TouchableOpacity accessibilityRole="button" testID="button-save-profile-photo"
            onPress={save} disabled={saving || draft === undefined}
            style={[button, { backgroundColor: colors.primary, opacity: saving || draft === undefined ? 0.5 : 1 }]}>
            <Text style={{ color: colors.buttonText, fontWeight: '600' }}>{saving ? 'Saving…' : 'Save photo'}</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" disabled={saving}
            onPress={() => { setEditing(false); setDraft(undefined); setError(''); uploaded.current = null; }} style={button}>
            <Text style={{ color: colors.textSecondary }}>Cancel</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TouchableOpacity accessibilityRole="button" testID="button-edit-profile-photo"
            onPress={() => { setEditing(true); setDraft(undefined); setMessage(''); setError(''); }}
            style={[button, { backgroundColor: colors.primary }]}>
            <Ionicons name="camera-outline" size={18} color={colors.buttonText} />
            <Text style={{ color: colors.buttonText, fontWeight: '600' }}>
              {user?.profileImageUrl ? 'Change profile photo' : 'Add profile photo (optional)'}
            </Text>
          </TouchableOpacity>
          {!!message && <Text accessibilityLiveRegion="polite" style={{ color: colors.textSecondary, textAlign: 'center' }}>{message}</Text>}
        </>
      )}
    </View>
  );
}
