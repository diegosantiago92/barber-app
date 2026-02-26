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
  const [configs, setConfigs] = useState<DayConfig[]>(DAYS.map((d) => defaultConfig(d.id)));
  const [saving, setSaving] = useState<number | null>(null);
  const [blockedInput, setBlockedInput] = useState("");
  const [blockedReason, setBlockedReason] = useState("");

  const { data: workingHours, refetch: refetchWH } = trpc.workingHours.list.useQuery();
  const { data: blockedDates, refetch: refetchBD } = trpc.blockedDates.list.useQuery();
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
    const cfg = configs.find((c) => c.dayOfWeek === dow);
    if (!cfg) return;
    setSaving(dow);
    try {
      await upsertMutation.mutateAsync(cfg);
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
    if (!blockedInput.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert("Formato inválido", "Use o formato AAAA-MM-DD (ex: 2025-12-25)");
      return;
    }
    try {
      await addBlockedMutation.mutateAsync({ date: blockedInput, reason: blockedReason.trim() || undefined });
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("Erro", e.message || "Não foi possível adicionar");
    }
  };

  const handleRemoveBlocked = (id: number, date: string) => {
    Alert.alert("Remover Bloqueio", `Deseja remover o bloqueio do dia ${date}?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Remover", style: "destructive", onPress: () => removeBlockedMutation.mutate({ id }) },
    ]);
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 }}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: colors.foreground }}>Horários de Funcionamento</Text>
          <Text style={{ fontSize: 13, color: colors.muted, marginTop: 4 }}>Configure os horários disponíveis para agendamento</Text>
        </View>

        {/* Days */}
        {DAYS.map((day) => {
          const cfg = configs.find((c) => c.dayOfWeek === day.id) ?? defaultConfig(day.id);
          return (
            <View key={day.id} style={{ backgroundColor: colors.surface, marginHorizontal: 16, marginBottom: 10, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: cfg.isOpen ? 14 : 0 }}>
                <View>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>{day.label}</Text>
                  {!cfg.isOpen && <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>Fechado</Text>}
                </View>
                <Switch
                  value={cfg.isOpen}
                  onValueChange={(v) => updateConfig(day.id, { isOpen: v })}
                  trackColor={{ false: colors.border, true: colors.primary + "80" }}
                  thumbColor={cfg.isOpen ? colors.primary : colors.muted}
                />
              </View>

              {cfg.isOpen && (
                <View style={{ gap: 12 }}>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 4 }}>Abertura</Text>
                      <TextInput
                        value={cfg.startTime}
                        onChangeText={(v) => updateConfig(day.id, { startTime: v })}
                        placeholder="09:00"
                        placeholderTextColor={colors.muted}
                        style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: colors.foreground, fontSize: 15, textAlign: "center" }}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 4 }}>Fechamento</Text>
                      <TextInput
                        value={cfg.endTime}
                        onChangeText={(v) => updateConfig(day.id, { endTime: v })}
                        placeholder="18:00"
                        placeholderTextColor={colors.muted}
                        style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: colors.foreground, fontSize: 15, textAlign: "center" }}
                      />
                    </View>
                  </View>

                  <View>
                    <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 6 }}>Intervalo entre atendimentos</Text>
                    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                      {INTERVALS.map((i) => (
                        <TouchableOpacity
                          key={i}
                          onPress={() => updateConfig(day.id, { intervalMinutes: i })}
                          style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, borderColor: cfg.intervalMinutes === i ? colors.primary : colors.border, backgroundColor: cfg.intervalMinutes === i ? colors.primary + "15" : colors.background }}
                        >
                          <Text style={{ fontSize: 13, fontWeight: "600", color: cfg.intervalMinutes === i ? colors.primary : colors.muted }}>{i} min</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => saveDay(day.id)}
                    disabled={saving === day.id}
                    style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 10, alignItems: "center", opacity: saving === day.id ? 0.7 : 1 }}
                  >
                    {saving === day.id ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>Salvar {day.short}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {!cfg.isOpen && (
                <TouchableOpacity
                  onPress={() => saveDay(day.id)}
                  disabled={saving === day.id}
                  style={{ marginTop: 8, backgroundColor: colors.border, borderRadius: 12, paddingVertical: 8, alignItems: "center" }}
                >
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>Salvar como fechado</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {/* Blocked Dates */}
        <View style={{ marginHorizontal: 16, marginTop: 8 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground, marginBottom: 12 }}>Dias de Folga / Feriados</Text>
          <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
            <TextInput
              value={blockedInput}
              onChangeText={setBlockedInput}
              placeholder="Data (AAAA-MM-DD)"
              placeholderTextColor={colors.muted}
              style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: colors.foreground, fontSize: 15 }}
            />
            <TextInput
              value={blockedReason}
              onChangeText={setBlockedReason}
              placeholder="Motivo (opcional)"
              placeholderTextColor={colors.muted}
              style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: colors.foreground, fontSize: 15 }}
            />
            <TouchableOpacity
              onPress={handleAddBlocked}
              disabled={addBlockedMutation.isPending}
              style={{ backgroundColor: colors.warning, borderRadius: 12, paddingVertical: 11, alignItems: "center" }}
            >
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>Bloquear Data</Text>
            </TouchableOpacity>
          </View>

          {blockedDates && blockedDates.length > 0 && (
            <View style={{ marginTop: 12, gap: 8 }}>
              {blockedDates.map((b) => (
                <View key={b.id} style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>{b.date}</Text>
                    {b.reason && <Text style={{ fontSize: 12, color: colors.muted }}>{b.reason}</Text>}
                  </View>
                  <TouchableOpacity onPress={() => handleRemoveBlocked(b.id, b.date)} style={{ padding: 6, backgroundColor: colors.error + "15", borderRadius: 8 }}>
                    <IconSymbol name="trash.fill" size={14} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
