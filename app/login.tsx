import { View, Text, TouchableOpacity, ActivityIndicator, Image } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { startOAuthLogin } from "@/constants/oauth";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function LoginScreen() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const colors = useColors();
  const [logging, setLogging] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, loading]);

  const handleLogin = async () => {
    setLogging(true);
    try {
      await startOAuthLogin();
    } finally {
      setLogging(false);
    }
  };

  if (loading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View className="flex-1 items-center justify-between px-8 py-12">
        {/* Header */}
        <View className="items-center gap-3 mt-12">
          <View
            style={{ width: 100, height: 100, borderRadius: 28, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}
          >
            <IconSymbol name="scissors" size={52} color="#fff" />
          </View>
          <Text style={{ fontSize: 32, fontWeight: "800", color: colors.foreground, letterSpacing: -0.5 }}>
            BarberPro
          </Text>
          <Text style={{ fontSize: 15, color: colors.muted, textAlign: "center", lineHeight: 22 }}>
            Agende seu horário com facilidade{"\n"}e sem complicação
          </Text>
        </View>

        {/* Features */}
        <View className="w-full gap-4">
          {[
            { icon: "calendar" as const, title: "Agendamento fácil", desc: "Escolha data e horário em segundos" },
            { icon: "bell.fill" as const, title: "Lembretes automáticos", desc: "Notificação 1h antes do seu horário" },
            { icon: "checkmark.circle.fill" as const, title: "Confirme ou cancele", desc: "Gerencie seus agendamentos com praticidade" },
          ].map((item) => (
            <View key={item.title} style={{ flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: colors.primary + "20", alignItems: "center", justifyContent: "center" }}>
                <IconSymbol name={item.icon} size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>{item.title}</Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Login Button */}
        <View className="w-full gap-3">
          <TouchableOpacity
            onPress={handleLogin}
            disabled={logging}
            style={{ backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 16, alignItems: "center", opacity: logging ? 0.7 : 1 }}
          >
            {logging ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Entrar na conta</Text>
            )}
          </TouchableOpacity>
          <Text style={{ textAlign: "center", fontSize: 12, color: colors.muted, lineHeight: 18 }}>
            Ao entrar, você concorda com os termos de uso{"\n"}e política de privacidade
          </Text>
        </View>
      </View>
    </ScreenContainer>
  );
}
