import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { STARTUP_ANIMATION_DURATION_MS } from '../lib/startup';

const animation = require('../assets/images/ludi-startup-v2.webp');
const finalFrame = require('../assets/images/ludi-startup-final.png');

export default function LoadingScreen({ onComplete, playAnimation = false }) {
  const [finished, setFinished] = useState(!playAnimation);
  const [imageError, setImageError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const started = useRef(false);
  const timer = useRef(null);
  const callback = useRef(onComplete);
  callback.current = onComplete;

  useEffect(() => () => clearTimeout(timer.current), []);

  const onDisplay = () => {
    if (!playAnimation || started.current) return;
    started.current = true;
    // Start only when the locally bundled first frame is actually displayed,
    // not on mount or while the decoder is still loading. The asset itself has
    // one loop; the final poster also prevents native decoders restarting it.
    timer.current = setTimeout(() => {
      setFinished(true);
      callback.current?.();
    }, STARTUP_ANIMATION_DURATION_MS);
  };

  const retry = () => {
    clearTimeout(timer.current);
    started.current = false;
    setFinished(!playAnimation);
    setImageError(false);
    setAttempt(value => value + 1);
  };

  return (
    <View style={styles.screen} testID="ludi-startup-animation" accessibilityLabel="LUDI is starting">
      {imageError ? (
        <View style={styles.error}>
          <Text style={styles.text}>The LUDI animation couldn’t load.</Text>
          <TouchableOpacity onPress={retry} accessibilityRole="button" style={styles.retry}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Image key={attempt} source={finished || !playAnimation ? finalFrame : animation}
          contentFit="contain" style={styles.image} transition={0}
          autoplay={playAnimation && !finished} onDisplay={onDisplay}
          onError={() => { clearTimeout(timer.current); setImageError(true); }}
          accessibilityLabel="LUDI brand animation" testID="ludi-startup-image" />
      )}
      {!imageError && (finished || !playAnimation) && (
        <View style={styles.waiting} testID="ludi-startup-waiting">
          <ActivityIndicator color="#17e6a1" />
          <Text style={styles.waitingText}>Getting LUDI ready…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  waiting: { position: 'absolute', bottom: '12%', alignItems: 'center', gap: 12 },
  waitingText: { color: '#b7c8c3', fontSize: 14 },
  error: { padding: 24, alignItems: 'center' },
  text: { color: '#fff', fontSize: 16, textAlign: 'center' },
  retry: { backgroundColor: '#17e6a1', borderRadius: 12, padding: 14, minHeight: 44, marginTop: 20 },
  retryText: { color: '#001b13', fontWeight: '700' },
});
