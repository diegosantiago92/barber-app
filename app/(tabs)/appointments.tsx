import {
  View, Text, TouchableOpacity, FlatList, ActivityIndicator,
  Alert, RefreshControl, Platform
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useState, useMemo } from "react";
import * as Haptics from "expo-haptics";
import { cancelAppointmentReminder } from "@/lib/notifications";
import { useBarbershop } from "@/lib/barbershop-context";
import { useRouter } from "expo-router";

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
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

export default function AppointmentsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { activeBarbershopId } = useBarbershop();
  const [tab, setTab] = useState<"upcoming" | "history">("upcoming");
  const [refreshing, setRefreshing] = useState(false);

  const { data: appointments, refetch, isLoading } = trpc.appointments.mine.useQuery(
    { barbershopId: activeBarbershopId ?? 0 },
    { enabled: !!activeBarbershopId }
  );
  const cancelMutation = trpc.appointments.cancel.useMutation({
    onSuccess: () => refetch(),
  });

  const today = new Date().toISOString().split("T")[0];

  const upcoming = useMemo(() =>
    (appointments ?? []).filter((a) => a.status !== "cancelled" && a.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date) || String(a.time).localeCompare(String(b.time))),
    [appointments, today]
  );

  const history = useMemo(() =>
    (appointments ?? []).filter((a) => a.status === "cancelled" || a.date < today || a.status === "completed")
      .sort((a, b) => b.date.localeCompare(a.date)),
    [appointments, today]
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleCancel = (id: number) => {
    if (!activeBarbershopId) return;
    Alert.alert(
      "Cancelar Agendamento",
      "Tem certeza que deseja cancelar este agendamento? O horário ficará disponível para outros clientes.",
      [
        { text: "Não", style: "cancel" },
        {
          text: "Cancelar Horário",
          style: "destructive",
          onPress: async () => {
            try {
              await cancelMutation.mutateAsync({ id, barbershopId: activeBarbershopId });
              await cancelAppointmentReminder(id);
              if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (e: any) {
              Alert.alert("Erro", e.message || "Não foi possível cancelar");
            }
          },
        },
      ]
    );
  };

  const data = tab === "upcoming" ? upcoming : history;

  const renderItem = ({ item }: { item: any }) => (
    <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>{item.serviceName}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <IconSymbol name="calendar" size={13} color={colors.muted} />
            <Text style={{ fontSize: 13, color: colors.muted, textTransform: "capitalize" }}>{formatDate(item.date)}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <IconSymbol name="clock.fill" size={13} color={colors.muted} />
            <Text style={{ fontSize: 13, color: colors.muted }}>{String(item.time).substring(0, 5)}</Text>
            {item.serviceDuration && (
              <Text style={{ fontSize: 12, color: colors.muted }}>• {item.serviceDuration} min</Text>
            )}
          </View>
          {item.servicePrice && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <IconSymbol name="tag.fill" size={13} color={colors.muted} />
              <Text style={{ fontSize: 13, color: colors.muted }}>{item.servicePrice}</Text>
            </View>
          )}
        </View>
        <StatusBadge status={item.status} />
      </View>
      {item.status === "confirmed" && item.date >= today && (
        <TouchableOpacity
          onPress={() => handleCancel(item.id)}
          disabled={cancelMutation.isPending}
          style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}
        >
          <IconSymbol name="xmark.circle.fill" size={16} color={colors.error} />
          <Text style={{ color: colors.error, fontSize: 13, fontWeight: "600" }}>Cancelar Agendamento</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (!activeBarbershopId) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }}>
          <IconSymbol name="calendar" size={48} color={colors.muted} />
          <Text style={{ fontSize: 16, color: colors.muted, textAlign: "center" }}>Selecione uma barbearia para ver seus agendamentos</Text>
          <TouchableOpacity onPress={() => router.push("/barbershop-select")} style={{ backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 }}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>Escolher Barbearia</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: "800", color: colors.foreground, marginBottom: 12 }}>Meus Agendamentos</Text>
        <View style={{ flexDirection: "row", backgroundColor: colors.surface, borderRadius: 12, padding: 3, borderWidth: 1, borderColor: colors.border }}>
          {(["upcoming", "history"] as const).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center", backgroundColor: tab === t ? colors.primary : "transparent" }}
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: tab === t ? "#fff" : colors.muted }}>
                {t === "upcoming" ? `Próximos (${upcoming.length})` : `Histórico (${history.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={{ alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 12 }}>
              <IconSymbol name="calendar" size={48} color={colors.muted} />
              <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground }}>
                {tab === "upcoming" ? "Nenhum agendamento próximo" : "Nenhum histórico"}
              </Text>
              {tab === "upcoming" && (
                <TouchableOpacity onPress={() => router.push("/(tabs)/book")} style={{ backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 }}>
                  <Text style={{ color: "#fff", fontWeight: "700" }}>Agendar Agora</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </ScreenContainer>
  );
}
