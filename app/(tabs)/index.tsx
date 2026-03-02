import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl, ScrollView, Alert, Platform } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { useRouter } from "expo-router";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useState, useMemo } from "react";
import { useBarbershop } from "@/lib/barbershop-context";
import * as Haptics from "expo-haptics";

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
}

function StatusBadge({ status }: { status: string }) {
  const colors = useColors();
  const map: Record<string, { label: string; color: string; bg: string }> = {
    confirmed: { label: "Confirmado", color: colors.success, bg: colors.success + "20" },
    cancelled: { label: "Cancelado", color: colors.error, bg: colors.error + "20" },
    completed: { label: "Concluído", color: colors.muted, bg: colors.muted + "20" },
  };
  const s = map[status] ?? map.confirmed;
  return (
    <View style={{ backgroundColor: s.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ fontSize: 11, fontWeight: "600", color: s.color }}>{s.label}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const router = useRouter();
  const { activeBarbershopId, setActiveBarbershopId } = useBarbershop();
  const [refreshing, setRefreshing] = useState(false);
  const [adminTab, setAdminTab] = useState<"today" | "all">("today");

  const { data: apiUser } = trpc.auth.me.useQuery();
  const isSuperAdmin = apiUser?.role === "superadmin";

  // Get user's barbershops to determine role
  const { data: myShops } = trpc.barbershops.mine.useQuery(undefined, { enabled: !!user });
  const activeShop = myShops?.find((s) => s.id === activeBarbershopId);
  const isAdmin = activeShop?.memberRole === "owner" || activeShop?.memberRole === "admin";

  // Get barbershop info
  const { data: shopInfo } = trpc.barbershops.bySlug.useQuery(
    { slug: activeShop?.slug ?? "" },
    { enabled: !!activeShop?.slug && !isAdmin }
  );

  const today = new Date().toISOString().split("T")[0];

  // Client appointments
  const { data: appointments, refetch, isLoading } = trpc.appointments.mine.useQuery(
    { barbershopId: activeBarbershopId ?? 0 },
    { enabled: !!activeBarbershopId && !isAdmin }
  );

  // Admin: today's appointments
  const { data: todayAppointments, refetch: refetchToday, isLoading: todayLoading } = trpc.appointments.byDate.useQuery(
    { barbershopId: activeBarbershopId ?? 0, date: today },
    { enabled: !!activeBarbershopId && isAdmin }
  );

  // Admin: all appointments
  const { data: allAppointments, refetch: refetchAll, isLoading: allLoading } = trpc.appointments.all.useQuery(
    { barbershopId: activeBarbershopId ?? 0 },
    { enabled: !!activeBarbershopId && isAdmin && adminTab === "all" }
  );

  const cancelMutation = trpc.appointments.cancel.useMutation({ onSuccess: () => { refetch(); refetchToday(); } });
  const completeMutation = trpc.appointments.complete.useMutation({ onSuccess: () => { refetchToday(); refetchAll(); } });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchToday(), refetchAll()]);
    setRefreshing(false);
  };

  const upcomingAppointments = useMemo(() => {
    if (!appointments) return [];
    return appointments.filter((a) => a.status !== "cancelled" && a.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date) || String(a.time).localeCompare(String(b.time)));
  }, [appointments, today]);

  const nextAppointment = upcomingAppointments[0];

  const handleCancelAdmin = (id: number) => {
    if (!activeBarbershopId) return;
    Alert.alert("Cancelar Agendamento", "Deseja cancelar este agendamento?", [
      { text: "Não", style: "cancel" },
      { text: "Cancelar", style: "destructive", onPress: () => cancelMutation.mutate({ id, barbershopId: activeBarbershopId }) },
    ]);
  };

  const handleComplete = (id: number) => {
    if (!activeBarbershopId) return;
    Alert.alert("Marcar como Concluído", "Confirmar atendimento realizado?", [
      { text: "Não", style: "cancel" },
      { text: "Confirmar", onPress: () => completeMutation.mutate({ id, barbershopId: activeBarbershopId }) },
    ]);
  };

  // No barbershop selected
  if (!activeBarbershopId) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 20 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary + "20", alignItems: "center", justifyContent: "center" }}>
            <IconSymbol name="scissors" size={40} color={colors.primary} />
          </View>
          <View style={{ alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 24, fontWeight: "800", color: colors.foreground, textAlign: "center" }}>Bem-vindo ao BarberPro</Text>
            <Text style={{ fontSize: 15, color: colors.muted, textAlign: "center", lineHeight: 22 }}>Selecione uma barbearia para começar a agendar ou gerenciar seus horários</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/barbershop-select")}
            style={{ backgroundColor: colors.primary, borderRadius: 16, paddingHorizontal: 32, paddingVertical: 14, width: "100%", alignItems: "center" }}
          >
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Escolher Barbearia</Text>
          </TouchableOpacity>
          {isSuperAdmin && (
            <TouchableOpacity
              onPress={() => router.push("/super-admin")}
              style={{ backgroundColor: colors.warning + "20", borderRadius: 16, paddingHorizontal: 32, paddingVertical: 14, width: "100%", alignItems: "center", borderWidth: 1, borderColor: colors.warning + "40" }}
            >
              <Text style={{ color: colors.warning, fontSize: 16, fontWeight: "700" }}>Painel Super-Admin</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScreenContainer>
    );
  }

  // Blocked barbershop
  if (activeShop?.subscriptionStatus === "blocked") {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 }}>
          <IconSymbol name="lock.fill" size={48} color={colors.error} />
          <Text style={{ fontSize: 20, fontWeight: "800", color: colors.foreground, textAlign: "center" }}>Acesso Bloqueado</Text>
          <Text style={{ fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 22 }}>O acesso a esta barbearia foi temporariamente suspenso. Entre em contato com o suporte.</Text>
          <TouchableOpacity onPress={() => setActiveBarbershopId(null)} style={{ backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 }}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>Escolher Outra Barbearia</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  // ─── ADMIN VIEW ─────────────────────────────────────────────────────────────
  if (isAdmin) {
    const displayAppointments = adminTab === "today" ? (todayAppointments ?? []) : (allAppointments ?? []);
    const isLoadingAdmin = adminTab === "today" ? todayLoading : allLoading;

    return (
      <ScreenContainer>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {/* Header */}
          <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }}>
            <TouchableOpacity onPress={() => router.push("/barbershop-select")} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <IconSymbol name="chevron.left.forwardslash.chevron.right" size={14} color={colors.muted} />
              <Text style={{ fontSize: 12, color: colors.muted }}>{activeShop?.name}</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 26, fontWeight: "800", color: colors.foreground }}>Painel do Barbeiro</Text>
            <Text style={{ fontSize: 14, color: colors.muted, marginTop: 2 }}>
              {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
            </Text>
          </View>

          {/* Stats */}
          <View style={{ flexDirection: "row", paddingHorizontal: 20, gap: 12, marginBottom: 20 }}>
            {[
              { label: "Hoje", value: (todayAppointments ?? []).filter((a) => a.status !== "cancelled").length, icon: "calendar", color: colors.primary },
              { label: "Confirmados", value: (todayAppointments ?? []).filter((a) => a.status === "confirmed").length, icon: "checkmark.circle.fill", color: colors.success },
              { label: "Concluídos", value: (todayAppointments ?? []).filter((a) => a.status === "completed").length, icon: "star.fill", color: colors.warning },
            ].map((stat) => (
              <View key={stat.label} style={{ flex: 1, backgroundColor: stat.color + "15", borderRadius: 14, padding: 14, alignItems: "center", gap: 4, borderWidth: 1, borderColor: stat.color + "30" }}>
                <IconSymbol name={stat.icon as any} size={22} color={stat.color} />
                <Text style={{ fontSize: 22, fontWeight: "800", color: stat.color }}>{stat.value}</Text>
                <Text style={{ fontSize: 11, color: colors.muted, textAlign: "center" }}>{stat.label}</Text>
              </View>
            ))}
          </View>

          {/* Quick Actions */}
          <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.muted, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Ações Rápidas</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {[
                { label: "Serviços", icon: "scissors", route: "/(tabs)/services" },
                { label: "Horários", icon: "clock.fill", route: "/(tabs)/schedule" },
                { label: "Perfil", icon: "person.fill", route: "/(tabs)/profile" },
              ].map((action) => (
                <TouchableOpacity
                  key={action.label}
                  onPress={() => router.push(action.route as any)}
                  style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 14, alignItems: "center", gap: 6, borderWidth: 1, borderColor: colors.border }}
                >
                  <IconSymbol name={action.icon as any} size={22} color={colors.primary} />
                  <Text style={{ fontSize: 12, fontWeight: "600", color: colors.foreground }}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Appointments Tabs */}
          <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
            <View style={{ flexDirection: "row", backgroundColor: colors.surface, borderRadius: 12, padding: 3, borderWidth: 1, borderColor: colors.border }}>
              {(["today", "all"] as const).map((t) => (
                <TouchableOpacity key={t} onPress={() => setAdminTab(t)} style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center", backgroundColor: adminTab === t ? colors.primary : "transparent" }}>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: adminTab === t ? "#fff" : colors.muted }}>
                    {t === "today" ? "Hoje" : "Todos"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {isLoadingAdmin ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
          ) : displayAppointments.length === 0 ? (
            <View style={{ alignItems: "center", paddingTop: 32, gap: 8 }}>
              <IconSymbol name="calendar" size={40} color={colors.muted} />
              <Text style={{ fontSize: 15, color: colors.muted }}>{adminTab === "today" ? "Nenhum agendamento para hoje" : "Nenhum agendamento"}</Text>
            </View>
          ) : (
            <View style={{ paddingHorizontal: 20, gap: 10 }}>
              {displayAppointments.map((item: any) => (
                <View key={item.id} style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>{item.clientName || "Cliente"}</Text>
                      <Text style={{ fontSize: 13, color: colors.muted }}>{item.serviceName}</Text>
                      <View style={{ flexDirection: "row", gap: 12, marginTop: 6 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <IconSymbol name="calendar" size={12} color={colors.muted} />
                          <Text style={{ fontSize: 12, color: colors.muted }}>{item.date}</Text>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <IconSymbol name="clock.fill" size={12} color={colors.muted} />
                          <Text style={{ fontSize: 12, color: colors.muted }}>{String(item.time).substring(0, 5)}</Text>
                        </View>
                      </View>
                    </View>
                    <StatusBadge status={item.status} />
                  </View>
                  {item.status === "confirmed" && (
                    <View style={{ flexDirection: "row", gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
                      <TouchableOpacity onPress={() => handleComplete(item.id)} style={{ flex: 1, backgroundColor: colors.success + "20", borderRadius: 10, paddingVertical: 8, alignItems: "center" }}>
                        <Text style={{ fontSize: 12, fontWeight: "700", color: colors.success }}>Concluir</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleCancelAdmin(item.id)} style={{ flex: 1, backgroundColor: colors.error + "20", borderRadius: 10, paddingVertical: 8, alignItems: "center" }}>
                        <Text style={{ fontSize: 12, fontWeight: "700", color: colors.error }}>Cancelar</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </ScreenContainer>
    );
  }

  // ─── CLIENT VIEW ─────────────────────────────────────────────────────────────
  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }}>
          <TouchableOpacity onPress={() => router.push("/barbershop-select")} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
            <IconSymbol name="chevron.left.forwardslash.chevron.right" size={14} color={colors.muted} />
            <Text style={{ fontSize: 12, color: colors.muted }}>{activeShop?.name ?? "Barbearia"}</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 26, fontWeight: "800", color: colors.foreground }}>
            Olá, {user?.name?.split(" ")[0] ?? "Cliente"}! 👋
          </Text>
          <Text style={{ fontSize: 14, color: colors.muted, marginTop: 2 }}>
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
          </Text>
        </View>

        {/* Next Appointment */}
        {nextAppointment ? (
          <View style={{ marginHorizontal: 20, marginBottom: 20, backgroundColor: colors.primary, borderRadius: 20, padding: 20 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Próximo Agendamento</Text>
            <Text style={{ fontSize: 20, fontWeight: "800", color: "#fff", marginBottom: 4 }}>{nextAppointment.serviceName}</Text>
            <View style={{ flexDirection: "row", gap: 16, marginTop: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <IconSymbol name="calendar" size={14} color="rgba(255,255,255,0.8)" />
                <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.9)", textTransform: "capitalize" }}>{formatDate(nextAppointment.date)}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <IconSymbol name="clock.fill" size={14} color="rgba(255,255,255,0.8)" />
                <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.9)" }}>{String(nextAppointment.time).substring(0, 5)}</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={{ marginHorizontal: 20, marginBottom: 20, backgroundColor: colors.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.border, alignItems: "center", gap: 8 }}>
            <IconSymbol name="calendar" size={32} color={colors.muted} />
            <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>Nenhum agendamento próximo</Text>
            <Text style={{ fontSize: 13, color: colors.muted }}>Agende agora mesmo!</Text>
          </View>
        )}

        {/* CTA */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <TouchableOpacity
            onPress={() => { if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/(tabs)/book"); }}
            style={{ backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 10 }}
          >
            <IconSymbol name="plus.circle.fill" size={22} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Agendar Horário</Text>
          </TouchableOpacity>
        </View>

        {/* Upcoming list */}
        {upcomingAppointments.length > 0 && (
          <View style={{ paddingHorizontal: 20 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground, marginBottom: 12 }}>Próximos Agendamentos</Text>
            {upcomingAppointments.slice(0, 3).map((item) => (
              <View key={item.id} style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>{item.serviceName}</Text>
                    <Text style={{ fontSize: 12, color: colors.muted, marginTop: 3, textTransform: "capitalize" }}>{formatDate(item.date)} • {String(item.time).substring(0, 5)}</Text>
                  </View>
                  <StatusBadge status={item.status} />
                </View>
              </View>
            ))}
            {upcomingAppointments.length > 3 && (
              <TouchableOpacity onPress={() => router.push("/(tabs)/appointments")} style={{ alignItems: "center", paddingVertical: 10 }}>
                <Text style={{ fontSize: 14, color: colors.primary, fontWeight: "600" }}>Ver todos ({upcomingAppointments.length})</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
