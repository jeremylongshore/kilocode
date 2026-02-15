import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useTheme } from '../../hooks/useTheme';
import { getTaskItemStyles } from '../../styles';

const TaskItem = ({ item, onSelect }) => {
  const { theme } = useTheme();
  const styles = getTaskItemStyles(theme);

  const formatDate = (ts) => {
    const date = new Date(ts);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <TouchableOpacity onPress={() => onSelect(item)} activeOpacity={0.8}>
      <View style={styles.card}>
        <View style={styles.titleRow}>
          <Icon name="puzzle-piece" size={18} color={theme.accent} style={styles.icon} />
          <Text style={styles.taskText}>
            {item.task?.substring(0, 200) || 'Untitled Task'}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <Icon name="calendar" size={14} color={theme.dim} style={styles.iconSmall} />
          <Text style={styles.metaText}>
            {formatDate(item.ts)} • #{item.number} • {item.mode}
          </Text>
        </View>

        <View style={styles.tokenRow}>
          <Icon name="cube" size={14} color={theme.highlight} style={styles.iconSmall} />
          <Text style={styles.tokenText}>
            <Text style={styles.tokenLabel}>In:</Text> {item.tokensIn ?? 0}{'   '}
            <Text style={styles.tokenLabel}>Out:</Text> {item.tokensOut ?? 0}{'   '}
            <Text style={styles.tokenLabel}>Total:</Text>{' '}
            <Text style={styles.tokenTotal}>{item.tokensTotal ?? 0}</Text>
          </Text>
        </View>

        <View style={styles.costRow}>
          <Icon name="dollar" size={14} color={theme.success} style={styles.iconSmall} />
          <Text style={styles.costText}>${item.totalCost?.toFixed(4) ?? '0.0000'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default TaskItem;
