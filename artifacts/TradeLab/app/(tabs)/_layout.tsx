import { Tabs } from 'expo-router';
import { Platform, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/constants/colors';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, focused }: { name: IoniconsName; focused: boolean }) {
  return (
    <Ionicons
      name={name}
      size={24}
      color={focused ? colors.foreground : colors.foregroundSubtle}
    />
  );
}

function HomeTabIcon({ focused }: { focused: boolean }) {
  return (
    <View
      style={{
        width: 48,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
        backgroundColor: focused ? 'rgba(124,58,237,0.18)' : 'transparent',
        borderWidth: focused ? 1 : 0,
        borderColor: focused ? 'rgba(124,58,237,0.35)' : 'transparent',
      }}
    >
      <Ionicons
        name={focused ? 'home' : 'home-outline'}
        size={22}
        color={focused ? '#A78BFA' : colors.foregroundSubtle}
      />
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: 1,
          height: 56 + (Platform.OS === 'web' ? 34 : insets.bottom),
          paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.foreground,
        tabBarInactiveTintColor: colors.foregroundSubtle,
        tabBarLabelStyle: {
          fontFamily: 'Inter_500Medium',
          fontSize: 10,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="trade"
        options={{
          title: 'Trade',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'trending-up' : 'trending-up-outline'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: 'Research',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'search' : 'search-outline'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <HomeTabIcon focused={focused} />,
          tabBarActiveTintColor: '#A78BFA',
        }}
      />
      <Tabs.Screen
        name="backtests"
        options={{
          title: 'Strategy Lab',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'bar-chart' : 'bar-chart-outline'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="trader-dna"
        options={{
          title: 'Trader DNA',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'analytics' : 'analytics-outline'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
