import React from 'react';
import { View, Text } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useTheme } from '../../hooks/useTheme';
import { getKiloSaidMessageStyles } from '../../styles'; // Re-using styles
import MessageCard from './MessageCard';

const SwitchModeMessage = ({ item }) => {
  const { theme } = useTheme();
  const styles = getKiloSaidMessageStyles(theme); // Re-using styles
  const tool = JSON.parse(item.text);
  const { mode, reason } = tool;

  return (
    <MessageCard
      headerIcon={<Icon name="retweet" size={16} style={styles.icon} />}
      headerText={`Switching to ${mode} mode`}
    >
      <Text style={styles.body}>{reason}</Text>
    </MessageCard>
  );
};

export default SwitchModeMessage;