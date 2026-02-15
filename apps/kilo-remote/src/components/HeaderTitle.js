import React from 'react';
import { View, Text } from 'react-native';
import { getWorkspacePath, getServerUrl } from '../config';
import { useTheme } from '../hooks/useTheme';
import { getHeaderTitleStyles } from '../styles';

const HeaderTitle = () => {
  const { theme } = useTheme();
  const styles = getHeaderTitleStyles(theme);
  const fullPath = getWorkspacePath();
  const parts = fullPath.split('/');
  const folder = parts[parts.length - 1];
  console.log("HeaderTitle rendered")
  return (
    <View>
      <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
        {folder}
      </Text>
    </View>
  );
};

export default HeaderTitle;