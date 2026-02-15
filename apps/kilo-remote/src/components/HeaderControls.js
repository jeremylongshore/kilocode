import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useTheme } from '../hooks/useTheme';
import VerboseToggle from './VerboseToggle';

function DisconnectButton() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  return (
    <TouchableOpacity onPress={() => navigation.navigate('Home')} style={{ marginLeft: 15 }}>
      <Icon name="power-off" size={20} color={theme.accent} />
    </TouchableOpacity>
  );
}

const HeaderControls = () => {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 10 }}>
      <VerboseToggle />
      <DisconnectButton />
    </View>
  );
};

export default HeaderControls;