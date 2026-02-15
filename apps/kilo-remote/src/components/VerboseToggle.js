import React from 'react';
import { View, Switch, Text } from 'react-native';
import { useTheme } from '../hooks/useTheme';

const VerboseToggle = () => {
  const { isVerbose, toggleVerbose, theme } = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'right' }}>
      {/* <Text style={{ color: theme.text, marginRight: 8 }}>Verbose</Text> */}
      <Switch
        trackColor={{ false: theme.dim, true: theme.accent }}
        thumbColor={isVerbose ? theme.surface : theme.background}
        ios_backgroundColor={theme.dim}
        onValueChange={toggleVerbose}
        value={isVerbose}
        style={{ transform: [{ scale: 0.8 }] }}
      />
    </View>
  );
};

export default VerboseToggle;