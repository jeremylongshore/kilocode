import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TextInput } from 'react-native';
import TaskItem from './history/TaskItem';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { getTasks, checkHealth } from '../services/api';
import { getActiveWorkspace, setActiveWorkspace } from '../config';

const HistoryView = () => {
  const [tasks, setTasks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeWorkspace, setActiveWorkspaceState] = useState(getActiveWorkspace());
  const navigation = useNavigation();

  useFocusEffect(
    useCallback(() => {
      const fetchWorkspaceAndTasks = async () => {
        const health = await checkHealth();
        if (health.status === 'ok') {
          setActiveWorkspace(health.workspacePath);
          setActiveWorkspaceState(health.workspacePath);

          const data = await getTasks();
          if (data) {
            const filteredTasks = data.filter(
              (task) =>
                task.workspace === health.workspacePath &&
                task.task.toLowerCase().includes(searchQuery.toLowerCase())
            );
            const sortedTasks = filteredTasks.sort((a, b) => b.ts - a.ts);
            setTasks(sortedTasks);
          }
        }
      };

      fetchWorkspaceAndTasks();
    }, [searchQuery])
  );

  const handleSelect = (item) => {
    navigation.navigate('ChatTab', {
      screen: 'ChatDetail',
      params: { task: item },
    });
  };

  return (
    <View>
      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TaskItem
            item={item}
            onSelect={handleSelect}
          />
        )}
      />
    </View>
  );
};

export default HistoryView;