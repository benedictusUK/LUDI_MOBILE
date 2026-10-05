import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';

const { width, height } = Dimensions.get('window');

export default function LoadingScreen({ onComplete }) {
  const { colors, isDark } = useTheme();
  const [currentStep, setCurrentStep] = useState(0);
  const letterOpacities = useRef([...Array(4)].map(() => new Animated.Value(0))).current;
  const letterTranslates = useRef([...Array(4)].map(() => new Animated.Value(50))).current;
  const underlineWidth = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineTranslate = useRef(new Animated.Value(20)).current;
  const particleAnimations = useRef([...Array(6)].map(() => ({
    scale: new Animated.Value(0),
    opacity: new Animated.Value(0),
    y: new Animated.Value(0),
  }))).current;
  const particleLoops = useRef([]);

  useEffect(() => {
    // Step 0: LUDI text animation (1000ms) - starts immediately
    const timer1 = setTimeout(() => {
      letterOpacities.forEach((opacity, index) => {
        Animated.timing(opacity, {
          toValue: 1,
          duration: 500,
          delay: index * 100,
          useNativeDriver: true,
        }).start();
      });
      letterTranslates.forEach((translate, index) => {
        Animated.timing(translate, {
          toValue: 0,
          duration: 500,
          delay: index * 100,
          useNativeDriver: true,
        }).start();
      });
      setCurrentStep(1);
    }, 0);

    // Step 1: Underline and tagline animation (1200ms)
    const timer2 = setTimeout(() => {
      Animated.parallel([
        Animated.timing(underlineWidth, {
          toValue: 1,
          duration: 800,
          useNativeDriver: false,
        }),
        Animated.timing(taglineOpacity, {
          toValue: 1,
          duration: 600,
          delay: 300,
          useNativeDriver: true,
        }),
        Animated.timing(taglineTranslate, {
          toValue: 0,
          duration: 600,
          delay: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Start particle animations
      particleAnimations.forEach((particle, i) => {
        const loop = Animated.loop(
          Animated.sequence([
            Animated.delay(i * 200),
            Animated.parallel([
              Animated.sequence([
                Animated.timing(particle.scale, {
                  toValue: 1,
                  duration: 1000,
                  useNativeDriver: true,
                }),
                Animated.timing(particle.scale, {
                  toValue: 0,
                  duration: 1000,
                  useNativeDriver: true,
                }),
              ]),
              Animated.sequence([
                Animated.timing(particle.opacity, {
                  toValue: 1,
                  duration: 1000,
                  useNativeDriver: true,
                }),
                Animated.timing(particle.opacity, {
                  toValue: 0,
                  duration: 1000,
                  useNativeDriver: true,
                }),
              ]),
              Animated.timing(particle.y, {
                toValue: -60,
                duration: 2000,
                useNativeDriver: true,
              }),
            ]),
            Animated.delay(3000),
          ])
        );
        particleLoops.current.push(loop);
        loop.start();
      });
      
      setCurrentStep(2);
    }, 1000);

    // Step 2: Complete and call onComplete (after animation finishes)
    const timer3 = setTimeout(() => {
      onComplete?.();
    }, 2200);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      particleLoops.current.forEach(loop => loop.stop());
      particleLoops.current = [];
      [...letterOpacities, ...letterTranslates, underlineWidth, taglineOpacity, taglineTranslate]
        .forEach(value => value.stopAnimation());
    };
  }, []);

  return (
    <LinearGradient
      accessible
      accessibilityLabel="Loading LUDI"
      colors={isDark ? ['#0f172a', '#1e293b'] : ['#EBF4FF', '#E0F2F1']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.centeredContent}>
        {/* LUDI Text Animation - Centered */}
        <View style={styles.textContainer}>
          <View style={styles.ludiContainer}>
            {'LUDI'.split('').map((letter, index) => (
              <Animated.Text
                key={index}
                style={[
                  styles.letter,
                  { color: colors.text },
                  {
                    opacity: letterOpacities[index],
                    transform: [{ translateY: letterTranslates[index] }],
                  },
                ]}
              >
                {letter}
              </Animated.Text>
            ))}
          </View>

          {/* Underline Animation */}
          <View style={[styles.underlineContainer, { backgroundColor: isDark ? '#334155' : '#e5e7eb' }]}>
            <Animated.View
              style={[
                styles.underline,
                {
                  width: underlineWidth.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            >
              <LinearGradient
                colors={['#3b82f6', '#10b981']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.underlineGradient}
              />
            </Animated.View>
          </View>
        </View>

        {/* Tagline Animation */}
        <Animated.Text
          style={[
            styles.tagline,
            { color: colors.textSecondary },
            {
              opacity: taglineOpacity,
              transform: [{ translateY: taglineTranslate }],
            },
          ]}
        >
          Don't just watch
        </Animated.Text>

        {/* Particles/Sparkle Effect */}
        {currentStep >= 2 && particleAnimations.map((particle, i) => {
          const positions = [
            { left: 100, top: 200 },
            { left: width - 100, top: 250 },
            { left: 80, top: 300 },
            { left: width - 80, top: 180 },
            { left: 120, top: 400 },
            { left: width - 120, top: 350 },
          ];

          return (
            <Animated.View
              key={i}
              style={[
                styles.particle,
                { backgroundColor: isDark ? '#60a5fa' : '#3b82f6' },
                {
                  left: positions[i].left,
                  top: positions[i].top,
                  opacity: particle.opacity,
                  transform: [
                    { scale: particle.scale },
                    { translateY: particle.y },
                  ],
                },
              ]}
            />
          );
        })}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centeredContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    alignItems: 'center',
  },
  ludiContainer: {
    flexDirection: 'row',
  },
  letter: {
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: 4,
  },
  underlineContainer: {
    width: 256,
    height: 4,
    borderRadius: 2,
    marginTop: 16,
    overflow: 'hidden',
  },
  underline: {
    height: '100%',
  },
  underlineGradient: {
    flex: 1,
    borderRadius: 2,
  },
  tagline: {
    fontSize: 20,
    fontWeight: '500',
    marginTop: 24,
  },
  particle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
