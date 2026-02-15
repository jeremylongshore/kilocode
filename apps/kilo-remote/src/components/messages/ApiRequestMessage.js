import React, { useState } from 'react';
import { View, Text } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useTheme } from '../../hooks/useTheme';
import { getApiRequestMessageStyles } from '../../styles';
import MessageCard from './MessageCard';

const ApiRequestMessage = ({ item }) => {
  const { theme, isVerbose } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const styles = getApiRequestMessageStyles(theme);
  const request = JSON.parse(item.text);

  if (!isVerbose) {
    return null;
  }

  return (
    <MessageCard
      headerIcon={
        <Icon
          name={expanded ? 'angle-down' : 'angle-right'}
          style={styles.icon}
        />
      }
      headerText="API Request"
      onHeaderPress={() => setExpanded(!expanded)}
    >
      {expanded && (
        <View style={styles.content}>
          <Text selectable style={styles.codeText}>
            {request.request || '_No request data_'}
          </Text>
        </View>
      )}
    </MessageCard>
  );
};

export default ApiRequestMessage;
