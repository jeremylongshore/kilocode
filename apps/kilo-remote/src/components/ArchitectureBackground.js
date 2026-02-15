import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import Svg, { Line, Circle } from 'react-native-svg';
import { useTheme } from '../hooks/useTheme';

const { width, height } = Dimensions.get('window');

const ArchitectBackground = () => {
  const { theme } = useTheme();

  // Shared animations
  const scan = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    scan.value = withRepeat(withTiming(1, { duration: 6000 }), -1, false);
    pulse.value = withRepeat(withTiming(1, { duration: 3000 }), -1, true);
  }, []);

  const scanStyle = useAnimatedStyle(() => {
    const translateY = interpolate(scan.value, [0, 1], [-height, height]);
    return { transform: [{ translateY }] };
  });

  const pulseStyle = useAnimatedStyle(() => {
    const opacity = interpolate(pulse.value, [0, 1], [0.2, 1]);
    const scale = interpolate(pulse.value, [0, 1], [0.8, 1.1]);
    return { opacity, transform: [{ scale }] };
  });

  // Dynamic grid lines and node points
  const GRID_SIZE = 6;
  const STEP_X = width / GRID_SIZE;
  const STEP_Y = height / GRID_SIZE;

  const lines = [];
  for (let i = 0; i <= GRID_SIZE; i++) {
    lines.push({ x: i * STEP_X, y: i * STEP_Y });
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background },
      ]}
    >
      {/* SVG Grid */}
      <Svg height={height} width={width} style={StyleSheet.absoluteFill}>
        {lines.map((l, i) => (
          <Line
            key={`v-${i}`}
            x1={l.x}
            y1={0}
            x2={l.x}
            y2={height}
            stroke={theme.dim}
            strokeWidth="0.5"
          />
        ))}
        {lines.map((l, i) => (
          <Line
            key={`h-${i}`}
            x1={0}
            y1={l.y}
            x2={width}
            y2={l.y}
            stroke={theme.dim}
            strokeWidth="0.5"
          />
        ))}
      </Svg>

      {/* Scanning Line */}
      <Animated.View
        style={[
          styles.scanLine,
          scanStyle,
          { backgroundColor: theme.accent },
        ]}
      />

      {/* Pulsing Debug Nodes */}
      {Array.from({ length: 4 }).map((_, i) => (
        <Animated.View
          key={i}
          style={[
            styles.node,
            pulseStyle,
            {
              left: (i + 1) * STEP_X - 15,
              top: (i % 2 ? i + 2 : i + 1) * STEP_Y - 15,
              backgroundColor: theme.primary,
              shadowColor: theme.highlight,
            },
          ]}
        />
      ))}

      {/* Ripples */}
      {Array.from({ length: 2 }).map((_, i) => (
        <Animated.View
          key={`r-${i}`}
          style={[
            styles.ripple,
            pulseStyle,
            {
              borderColor: theme.secondary,
              left: width / 2 - (60 + i * 20),
              top: height / 2 - (60 + i * 20),
              width: 120 + i * 40,
              height: 120 + i * 40,
            },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: -1,
  },
  scanLine: {
    position: 'absolute',
    height: 1.5,
    width: '100%',
    opacity: 0.25,
  },
  node: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    shadowOpacity: 0.6,
    shadowRadius: 10,
  },
  ripple: {
    position: 'absolute',
    borderWidth: 0.8,
    borderRadius: 200,
    opacity: 0.15,
  },
});

export default ArchitectBackground;
