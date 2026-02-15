import React from 'react';
import { View, Text } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useTheme } from '../../hooks/useTheme';
import { getApiRequestMessageStyles } from '../../styles'; // Re-using styles for now
import MessageCard from './MessageCard';

const ToolMessage = ({ item }) => {
  const { theme, isVerbose } = useTheme();
  const styles = getApiRequestMessageStyles(theme); // Re-using styles
  const tool = JSON.parse(item.text);

  if (!isVerbose) {
    return (
      <MessageCard>
        <View style={styles.content}>
          <Text selectable style={styles.codeText}>
            {item.text}
          </Text>
        </View>
      </MessageCard>
    );
  }

  return (
    <MessageCard
      headerIcon={<Icon name="wrench" size={16} style={styles.icon} />}
      headerText={`Tool Used: ${tool.tool}`}
    >
      <View style={styles.content}>
        <Text selectable style={styles.codeText}>
          {item.text}
        </Text>
      </View>
    </MessageCard>
  );
};

export default ToolMessage;