import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

const { width, height } = Dimensions.get('window');

export default function LoadingAnimation() {
  const { colors, isDark } = useTheme();
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const letterAnims = useRef([...Array(4)].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    // Trophy scale and fade in
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 20,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Stagger letter animations
    const letterSequence = letterAnims.map((anim, index) =>
      Animated.sequence([
        Animated.delay(800 + index * 150),
        Animated.spring(anim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ])
    );

    Animated.parallel(letterSequence).start();
  }, []);

  const letters = ['L', 'U', 'D', 'I'];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Animated.View
          style={[
            styles.trophyContainer,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Text style={styles.trophy}>🏆</Text>
        </Animated.View>

        <View style={styles.textContainer}>
          {letters.map((letter, index) => (
            <Animated.Text
              key={index}
              style={[
                styles.letter,
                { color: colors.text },
                {
                  opacity: letterAnims[index],
                  transform: [
                    {
                      translateY: letterAnims[index].interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              {letter}
            </Animated.Text>
          ))}
        </View>

        <Animated.View style={{ opacity: opacityAnim }}>
          <Text style={[styles.tagline, { color: colors.textSecondary }]}>
            Sports made simple
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  trophyContainer: {
    marginBottom: 24,
  },
  trophy: {
    fontSize: 80,
  },
  textContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  letter: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 1,
  },
});
