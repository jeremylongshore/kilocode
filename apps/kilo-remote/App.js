import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';
import { NavigationContainer, useNavigation, DefaultTheme } from '@react-navigation/native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { useFonts } from 'expo-font';
import ChatView from './src/components/ChatView';
import HistoryView from './src/components/HistoryView';
import HomeScreen from './src/components/HomeScreen';
import HeaderTitle from './src/components/HeaderTitle';
import HeaderControls from './src/components/HeaderControls';
import Icon from 'react-native-vector-icons/FontAwesome';
import { ThemeProvider } from './src/context/ThemeContext';
import { useTheme } from './src/hooks/useTheme';


const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const MyTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: 'transparent',
  },
};


function ChatStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="ChatMain" component={ChatView} options={{ headerShown: false }} />
      <Stack.Screen name="ChatDetail" component={ChatView} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

function MainTabs({ insets }) {
  const { theme } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName;

          if (route.name === 'ChatTab') {
            iconName = 'comment';
          } else if (route.name === 'History') {
            iconName = 'history';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.background,
          height: 50 + insets.bottom / 2,
          paddingBottom: insets.bottom / 2,
        },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.dim,
      })}
    >
      <Tab.Screen name="ChatTab" component={ChatStack} options={{ title: 'Chat' }} />
      <Tab.Screen name="History" component={HistoryView} />
    </Tab.Navigator>
  );
}

const AppContent = () => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [fontsLoaded] = useFonts({
    'JetBrainsMono-Regular': require('./assets/fonts/JetBrainsMono-Regular.ttf'),
    'Orbitron-Regular': require('./assets/fonts/Orbitron-Regular.ttf'),
    'IBMPlexSerif-Regular': require('./assets/fonts/IBMPlexSerif-Regular.ttf'),
  });

  const MyTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: theme.background,
    },
  };

  if (!fontsLoaded) {
    return <View><Text>Loading fonts...</Text></View>;
  }

  return (
    <NavigationContainer theme={MyTheme}>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{ cardStyle: { backgroundColor: 'transparent' } }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
        <Stack.Screen
          name="Main"
          options={{
            headerTitle: () => <HeaderTitle />,
            headerRight: () => <HeaderControls />,
            headerTitleAlign: 'left',
            headerLeft: () => null,
            headerStyle: { backgroundColor: theme.background, height: 70 + insets.top / 2 },
          }}
        >
          {(props) => <MainTabs {...props} insets={insets} />}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
