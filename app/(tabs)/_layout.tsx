import { Tabs, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform, ActivityIndicator, View } from "react-native";
import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { trpc } from "@/lib/trpc";

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomPadding;
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();

  // Fetch full user from API to get role
  const { data: apiUser } = trpc.auth.me.useQuery(undefined, { enabled: isAuthenticated });
  const isAdmin = apiUser?.role === "admin";

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, loading]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) return null;

  if (isAdmin) {
    return (
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarStyle: {
            paddingTop: 8,
            paddingBottom: bottomPadding,
            height: tabBarHeight,
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            borderTopWidth: 0.5,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Painel",
            tabBarIcon: ({ color }) => <IconSymbol size={26} name="chart.bar.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="schedule"
          options={{
            title: "Horários",
            tabBarIcon: ({ color }) => <IconSymbol size={26} name="clock.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="services"
          options={{
            title: "Serviços",
            tabBarIcon: ({ color }) => <IconSymbol size={26} name="scissors" color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Perfil",
            tabBarIcon: ({ color }) => <IconSymbol size={26} name="person.fill" color={color} />,
          }}
        />
        {/* Hide client-only tabs */}
        <Tabs.Screen name="book" options={{ href: null }} />
        <Tabs.Screen name="appointments" options={{ href: null }} />
      </Tabs>
    );
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          paddingTop: 8,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Início",
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="book"
        options={{
          title: "Agendar",
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="calendar.badge.plus" color={color} />,
        }}
      />
      <Tabs.Screen
        name="appointments"
        options={{
          title: "Meus Horários",
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="list.bullet" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="person.fill" color={color} />,
        }}
      />
      {/* Hide admin-only tabs */}
      <Tabs.Screen name="schedule" options={{ href: null }} />
      <Tabs.Screen name="services" options={{ href: null }} />
    </Tabs>
  );
}
