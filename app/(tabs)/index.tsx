import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { useRouter } from "expo-router";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useState, useMemo } from "react";

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
  const [refreshing, setRefreshing] = useState(false);

  const { data: apiUser } = trpc.auth.me.useQuery();
  const isAdmin = apiUser?.role === "admin";

  const { data: appointments, refetch, isLoading } = trpc.appointments.mine.useQuery(undefined, {
    enabled: !isAdmin,
  });

  const today = new Date().toISOString().split("T")[0];
  const { data: adminAppointments, refetch: refetchAdmin, isLoading: adminLoading } = trpc.appointments.byDate.useQuery(
    { date: today },
    { enabled: isAdmin }
  );

  const onRefresh = async () => {
    setRefreshing(true);
    if (isAdmin) await refetchAdmin();
    else await refetch();
    setRefreshing(false);
  };

  const upcomingAppointments = useMemo(() => {
    if (!appointments) return [];
    return appointments
      .filter((a) => a.status !== "cancelled" && a.date >= today)
      .slice(0, 3);
  }, [appointments, today]);

  const nextAppointment = upcomingAppointments[0];

  const firstName = (apiUser?.name || user?.name || "").split(" ")[0] || "Cliente";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  // Admin view
  if (isAdmin) {
    const todayFormatted = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
    const confirmed = adminAppointments?.filter((a) => a.status === "confirmed") ?? [];
    const completed = adminAppointments?.filter((a) => a.status === "completed") ?? [];
    const cancelled = adminAppointments?.filter((a) => a.status === "cancelled") ?? [];

    return (
      <ScreenContainer>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {/* Header */}
          <View style={{ backgroundColor: colors.primary, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28 }}>
            <Text style={{ color: "#fff", fontSize: 13, opacity: 0.8 }}>{greeting},</Text>
            <Text style={{ color: "#fff", fontSize: 22, fontWeight: "700", marginTop: 2 }}>{firstName} (Admin)</Text>
            <Text style={{ color: "#fff", fontSize: 13, opacity: 0.8, marginTop: 4, textTransform: "capitalize" }}>{todayFormatted}</Text>
          </View>

          <View style={{ padding: 16, gap: 16 }}>
            {/* Stats */}
            <View style={{ flexDirection: "row", gap: 10 }}>
              {[
                { label: "Confirmados", value: confirmed.length, color: colors.success },
                { label: "Concluídos", value: completed.length, color: colors.primary },
                { label: "Cancelados", value: cancelled.length, color: colors.error },
              ].map((s) => (
                <View key={s.label} style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 14, alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ fontSize: 26, fontWeight: "800", color: s.color }}>{s.value}</Text>
                  <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2, textAlign: "center" }}>{s.label}</Text>
                </View>
              ))}
            </View>

            {/* Today's appointments */}
            <View>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground, marginBottom: 10 }}>Agendamentos de Hoje</Text>
              {adminLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : adminAppointments && adminAppointments.length > 0 ? (
                adminAppointments.map((a) => (
                  <View key={a.id} style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View style={{ backgroundColor: colors.primary + "20", borderRadius: 10, padding: 8 }}>
                          <IconSymbol name="clock.fill" size={18} color={colors.primary} />
                        </View>
                        <View>
                          <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>
                            {String(a.time).substring(0, 5)}
                          </Text>
                          <Text style={{ fontSize: 12, color: colors.muted }}>{a.serviceName}</Text>
                        </View>
                      </View>
                      <StatusBadge status={a.status} />
                    </View>
                    <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
                      <Text style={{ fontSize: 13, color: colors.foreground }}>
                        <Text style={{ fontWeight: "600" }}>Cliente: </Text>{a.clientName || "—"}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 20, alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
                  <IconSymbol name="calendar" size={32} color={colors.muted} />
                  <Text style={{ color: colors.muted, marginTop: 8, fontSize: 14 }}>Nenhum agendamento hoje</Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // Client view
  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View style={{ backgroundColor: colors.primary, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36 }}>
          <Text style={{ color: "#fff", fontSize: 13, opacity: 0.8 }}>{greeting},</Text>
          <Text style={{ color: "#fff", fontSize: 22, fontWeight: "700", marginTop: 2 }}>{firstName}</Text>
        </View>

        <View style={{ padding: 16, gap: 16, marginTop: -16 }}>
          {/* Next appointment card */}
          {nextAppointment ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: colors.border, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted }}>PRÓXIMO AGENDAMENTO</Text>
                <StatusBadge status={nextAppointment.status} />
              </View>
              <Text style={{ fontSize: 22, fontWeight: "800", color: colors.foreground }}>
                {String(nextAppointment.time).substring(0, 5)}
              </Text>
              <Text style={{ fontSize: 14, color: colors.muted, marginTop: 2, textTransform: "capitalize" }}>
                {formatDate(nextAppointment.date)}
              </Text>
              <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: "row", alignItems: "center", gap: 8 }}>
                <IconSymbol name="scissors" size={16} color={colors.primary} />
                <Text style={{ fontSize: 14, color: colors.foreground, fontWeight: "500" }}>{nextAppointment.serviceName}</Text>
                {nextAppointment.serviceDuration && (
                  <Text style={{ fontSize: 12, color: colors.muted }}>• {nextAppointment.serviceDuration} min</Text>
                )}
              </View>
            </View>
          ) : (
            <View style={{ backgroundColor: colors.surface, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: colors.border, alignItems: "center", gap: 8 }}>
              <IconSymbol name="calendar" size={36} color={colors.muted} />
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>Nenhum agendamento</Text>
              <Text style={{ fontSize: 13, color: colors.muted, textAlign: "center" }}>Agende seu próximo horário agora mesmo</Text>
            </View>
          )}

          {/* Book button */}
          <TouchableOpacity
            onPress={() => router.push("/book" as any)}
            style={{ backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
          >
            <IconSymbol name="calendar.badge.plus" size={22} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Agendar Horário</Text>
          </TouchableOpacity>

          {/* Upcoming list */}
          {upcomingAppointments.length > 1 && (
            <View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>Próximos Horários</Text>
                <TouchableOpacity onPress={() => router.push("/appointments" as any)}>
                  <Text style={{ fontSize: 13, color: colors.primary, fontWeight: "600" }}>Ver todos</Text>
                </TouchableOpacity>
              </View>
              {upcomingAppointments.slice(1).map((a) => (
                <View key={a.id} style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ backgroundColor: colors.primary + "15", borderRadius: 10, padding: 10 }}>
                    <IconSymbol name="clock.fill" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>
                      {String(a.time).substring(0, 5)} — {a.serviceName}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2, textTransform: "capitalize" }}>
                      {formatDate(a.date)}
                    </Text>
                  </View>
                  <StatusBadge status={a.status} />
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
