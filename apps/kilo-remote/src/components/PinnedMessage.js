import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useTheme } from '../hooks/useTheme';
import { getPinnedMessageStyles } from '../styles';

const PinnedMessage = ({ message }) => {
  const { theme } = useTheme();
  const styles = getPinnedMessageStyles(theme);
  const [isExpanded, setIsExpanded] = useState(false);

  if (!message) return null;

  return (
    <TouchableOpacity onPress={() => setIsExpanded(!isExpanded)} activeOpacity={0.7}>
      <View style={styles.container}>
        <Icon name="thumb-tack" size={16} color={theme.dim} style={styles.icon} />
        <Text style={styles.text} numberOfLines={isExpanded ? undefined : 1} ellipsizeMode="tail">
          {message}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

export default PinnedMessage;