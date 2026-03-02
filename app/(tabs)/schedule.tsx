import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator,
  Alert, Switch, TextInput, Platform
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useState, useEffect } from "react";
import * as Haptics from "expo-haptics";
import { useBarbershop } from "@/lib/barbershop-context";

const DAYS = [
  { id: 0, label: "Domingo", short: "Dom" },
  { id: 1, label: "Segunda-feira", short: "Seg" },
  { id: 2, label: "Terça-feira", short: "Ter" },
  { id: 3, label: "Quarta-feira", short: "Qua" },
  { id: 4, label: "Quinta-feira", short: "Qui" },
  { id: 5, label: "Sexta-feira", short: "Sex" },
  { id: 6, label: "Sábado", short: "Sáb" },
];

const INTERVALS = [15, 20, 30, 45, 60];

type DayConfig = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  intervalMinutes: number;
  isOpen: boolean;
};

const defaultConfig = (dow: number): DayConfig => ({
  dayOfWeek: dow,
  startTime: "09:00",
  endTime: "18:00",
  intervalMinutes: 30,
  isOpen: dow !== 0,
});

export default function ScheduleScreen() {
  const colors = useColors();
  const { activeBarbershopId } = useBarbershop();
  const [configs, setConfigs] = useState<DayConfig[]>(DAYS.map((d) => defaultConfig(d.id)));
  const [saving, setSaving] = useState<number | null>(null);
  const [blockedInput, setBlockedInput] = useState("");
  const [blockedReason, setBlockedReason] = useState("");

  const { data: workingHours, refetch: refetchWH } = trpc.workingHours.list.useQuery(
    { barbershopId: activeBarbershopId ?? 0 },
    { enabled: !!activeBarbershopId }
  );
  const { data: blockedDates, refetch: refetchBD } = trpc.blockedDates.list.useQuery(
    { barbershopId: activeBarbershopId ?? 0 },
    { enabled: !!activeBarbershopId }
  );
  const upsertMutation = trpc.workingHours.upsert.useMutation();
  const addBlockedMutation = trpc.blockedDates.add.useMutation({ onSuccess: () => { refetchBD(); setBlockedInput(""); setBlockedReason(""); } });
  const removeBlockedMutation = trpc.blockedDates.remove.useMutation({ onSuccess: () => refetchBD() });

  useEffect(() => {
    if (workingHours && workingHours.length > 0) {
      setConfigs(DAYS.map((d) => {
        const wh = workingHours.find((h) => h.dayOfWeek === d.id);
        if (!wh) return defaultConfig(d.id);
        const start = String(wh.startTime).substring(0, 5);
        const end = String(wh.endTime).substring(0, 5);
        return { dayOfWeek: d.id, startTime: start, endTime: end, intervalMinutes: wh.intervalMinutes, isOpen: wh.isOpen };
      }));
    }
  }, [workingHours]);

  const updateConfig = (dow: number, patch: Partial<DayConfig>) => {
    setConfigs((prev) => prev.map((c) => c.dayOfWeek === dow ? { ...c, ...patch } : c));
  };

  const saveDay = async (dow: number) => {
    if (!activeBarbershopId) return;
    const cfg = configs.find((c) => c.dayOfWeek === dow);
    if (!cfg) return;
    setSaving(dow);
    try {
      await upsertMutation.mutateAsync({ ...cfg, barbershopId: activeBarbershopId });
      await refetchWH();
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Salvo", "Horário atualizado com sucesso!");
    } catch (e: any) {
      Alert.alert("Erro", e.message || "Não foi possível salvar");
    } finally {
      setSaving(null);
    }
  };

  const handleAddBlocked = async () => {
    if (!activeBarbershopId) return;
    if (!blockedInput.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert("Formato inválido", "Use o formato AAAA-MM-DD (ex: 2025-12-25)");
      return;
    }
    try {
      await addBlockedMutation.mutateAsync({ barbershopId: activeBarbershopId, date: blockedInput, reason: blockedReason.trim() || undefined });
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("Erro", e.message || "Não foi possível adicionar");
    }
  };

  const handleRemoveBlocked = (id: number, date: string) => {
    if (!activeBarbershopId) return;
    Alert.alert("Remover Bloqueio", `Deseja remover o bloqueio do dia ${date}?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Remover", style: "destructive", onPress: () => removeBlockedMutation.mutate({ id, barbershopId: activeBarbershopId }) },
    ]);
  };

  if (!activeBarbershopId) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }}>
          <IconSymbol name="calendar" size={48} color={colors.muted} />
          <Text style={{ fontSize: 16, color: colors.muted, textAlign: "center" }}>Selecione uma barbearia para gerenciar os horários</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 }}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: colors.foreground }}>Horários de Funcionamento</Text>
          <Text style={{ fontSize: 13, color: colors.muted, marginTop: 4 }}>Configure os horários disponíveis para agendamento</Text>
        </View>

        {DAYS.map((day) => {
          const cfg = configs.find((c) => c.dayOfWeek === day.id) ?? defaultConfig(day.id);
          return (
            <View key={day.id} style={{ backgroundColor: colors.surface, marginHorizontal: 16, marginBottom: 10, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: cfg.isOpen ? 14 : 0 }}>
                <View>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>{day.label}</Text>
                  {!cfg.isOpen && <Text style={{ fontSize: 12, color: colors.muted }}>Fechado</Text>}
                </View>
                <Switch
                  value={cfg.isOpen}
                  onValueChange={(v) => updateConfig(day.id, { isOpen: v })}
                  trackColor={{ false: colors.border, true: colors.primary + "60" }}
                  thumbColor={cfg.isOpen ? colors.primary : colors.muted}
                />
              </View>

              {cfg.isOpen && (
                <>
                  <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 6, fontWeight: "600" }}>Abertura</Text>
                      <TextInput
                        value={cfg.startTime}
                        onChangeText={(v) => updateConfig(day.id, { startTime: v })}
                        placeholder="09:00"
                        placeholderTextColor={colors.muted}
                        style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: colors.foreground, fontSize: 15 }}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 6, fontWeight: "600" }}>Fechamento</Text>
                      <TextInput
                        value={cfg.endTime}
                        onChangeText={(v) => updateConfig(day.id, { endTime: v })}
                        placeholder="18:00"
                        placeholderTextColor={colors.muted}
                        style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: colors.foreground, fontSize: 15 }}
                      />
                    </View>
                  </View>

                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 8, fontWeight: "600" }}>Intervalo entre horários</Text>
                    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                      {INTERVALS.map((interval) => (
                        <TouchableOpacity
                          key={interval}
                          onPress={() => updateConfig(day.id, { intervalMinutes: interval })}
                          style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: cfg.intervalMinutes === interval ? colors.primary : colors.background, borderWidth: 1, borderColor: cfg.intervalMinutes === interval ? colors.primary : colors.border }}
                        >
                          <Text style={{ fontSize: 13, fontWeight: "600", color: cfg.intervalMinutes === interval ? "#fff" : colors.foreground }}>{interval}min</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => saveDay(day.id)}
                    disabled={saving === day.id}
                    style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 10, alignItems: "center", opacity: saving === day.id ? 0.7 : 1 }}
                  >
                    {saving === day.id ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>Salvar {day.short}</Text>}
                  </TouchableOpacity>
                </>
              )}

              {!cfg.isOpen && (
                <TouchableOpacity
                  onPress={() => saveDay(day.id)}
                  disabled={saving === day.id}
                  style={{ marginTop: 10, backgroundColor: colors.border, borderRadius: 12, paddingVertical: 8, alignItems: "center", opacity: saving === day.id ? 0.7 : 1 }}
                >
                  {saving === day.id ? <ActivityIndicator color={colors.muted} size="small" /> : <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>Salvar como Fechado</Text>}
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {/* Blocked Dates */}
        <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground, marginBottom: 12 }}>Datas Bloqueadas</Text>
          <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 14 }}>Bloqueie feriados ou dias de folga</Text>

          <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
            <TextInput
              value={blockedInput}
              onChangeText={setBlockedInput}
              placeholder="AAAA-MM-DD"
              placeholderTextColor={colors.muted}
              style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: colors.foreground, fontSize: 14 }}
            />
            <TextInput
              value={blockedReason}
              onChangeText={setBlockedReason}
              placeholder="Motivo (opcional)"
              placeholderTextColor={colors.muted}
              style={{ flex: 1.5, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: colors.foreground, fontSize: 14 }}
            />
          </View>
          <TouchableOpacity
            onPress={handleAddBlocked}
            disabled={addBlockedMutation.isPending}
            style={{ backgroundColor: colors.warning, borderRadius: 12, paddingVertical: 11, alignItems: "center", marginBottom: 16, opacity: addBlockedMutation.isPending ? 0.7 : 1 }}
          >
            {addBlockedMutation.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>Bloquear Data</Text>}
          </TouchableOpacity>

          {(blockedDates ?? []).length === 0 ? (
            <Text style={{ fontSize: 13, color: colors.muted, textAlign: "center", paddingVertical: 16 }}>Nenhuma data bloqueada</Text>
          ) : (
            (blockedDates ?? []).map((bd) => (
              <View key={bd.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: colors.surface, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.warning + "40" }}>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>{bd.date}</Text>
                  {bd.reason && <Text style={{ fontSize: 12, color: colors.muted }}>{bd.reason}</Text>}
                </View>
                <TouchableOpacity onPress={() => handleRemoveBlocked(bd.id, bd.date)} style={{ padding: 8, backgroundColor: colors.error + "15", borderRadius: 10 }}>
                  <IconSymbol name="trash.fill" size={16} color={colors.error} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
