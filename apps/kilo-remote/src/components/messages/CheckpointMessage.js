import React from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../hooks/useTheme";
import { getCheckpointMessageStyles } from "../../styles";

const CheckpointMessage = ({ item }) => {
  const { theme } = useTheme();
  const styles = getCheckpointMessageStyles(theme);

  return (
    <View style={styles.container}>
      <Feather name="git-commit" size={16} style={styles.icon} />
      <Text style={styles.text}>Checkpoint</Text>
      <LinearGradient
        colors={[theme.highlight, "transparent"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.gradient}
      />
    </View>
  );
};

export default CheckpointMessage;