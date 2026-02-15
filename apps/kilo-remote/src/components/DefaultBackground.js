import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../hooks/useTheme';

const DefaultBackground = () => {
  const { theme } = useTheme();
  return <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.background }} />;
};

export default DefaultBackground;