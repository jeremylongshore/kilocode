import React from 'react';
import { View, Text } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useTheme } from '../../hooks/useTheme';
import { getCommandMessageStyles } from '../../styles';
import MessageCard from './MessageCard';

const CommandMessage = ({ item }) => {
  const { theme, isVerbose } = useTheme();
  const styles = getCommandMessageStyles(theme);

  if (!isVerbose) {
    return (
      <MessageCard>
        <View style={styles.commandBox}>
          <Text style={styles.commandText}>$ {'>'} {item.text}</Text>
        </View>
      </MessageCard>
    );
  }

  return (
    <MessageCard
      headerIcon={<Icon name="terminal" size={16} style={styles.icon} />}
      headerText="Running"
    >
      <View style={styles.commandBox}>
        <Text style={styles.commandText}>{item.text}</Text>
      </View>

      <View style={styles.footer}>
        <Icon name="check" size={12} color={theme.dim} />
        <Text style={styles.footerText}>Auto-approved commands</Text>
      </View>
    </MessageCard>
  );
};

export default CommandMessage;
