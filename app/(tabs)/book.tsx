import {
  ScrollView, Text, View, TouchableOpacity, ActivityIndicator,
  Alert, Platform
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useState, useMemo } from "react";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { scheduleAppointmentReminder } from "@/lib/notifications";
import { useBarbershop } from "@/lib/barbershop-context";

const DAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function generateDays(count = 30) {
  const days = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

export default function BookScreen() {
  const colors = useColors();
  const router = useRouter();
  const { activeBarbershopId } = useBarbershop();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const { data: services, isLoading: servicesLoading } = trpc.services.listPublic.useQuery(
    { barbershopId: activeBarbershopId ?? 0 },
    { enabled: !!activeBarbershopId }
  );
  const { data: slots, isLoading: slotsLoading } = trpc.appointments.availableSlots.useQuery(
    { barbershopId: activeBarbershopId ?? 0, date: selectedDate ? toDateStr(selectedDate) : "" },
    { enabled: !!selectedDate && !!activeBarbershopId }
  );
  const { data: blockedDates } = trpc.blockedDates.list.useQuery(
    { barbershopId: activeBarbershopId ?? 0 },
    { enabled: !!activeBarbershopId }
  );
  const { data: workingHours } = trpc.workingHours.list.useQuery(
    { barbershopId: activeBarbershopId ?? 0 },
    { enabled: !!activeBarbershopId }
  );

  const createMutation = trpc.appointments.create.useMutation();
  const days = useMemo(() => generateDays(30), []);

  const isDateBlocked = (d: Date) => {
    const str = toDateStr(d);
    if (blockedDates?.some((b) => b.date === str)) return true;
    const dow = d.getDay();
    const wh = workingHours?.find((h) => h.dayOfWeek === dow);
    if (!wh || !wh.isOpen) return true;
    return false;
  };

  const handleConfirm = async () => {
    if (!selectedService || !selectedDate || !selectedTime || !activeBarbershopId) return;
    try {
      const result = await createMutation.mutateAsync({
        barbershopId: activeBarbershopId,
        serviceId: selectedService.id,
        date: toDateStr(selectedDate),
        time: selectedTime,
      });
      try {
        await scheduleAppointmentReminder({
          appointmentId: result.id,
          serviceName: selectedService.name,
          date: toDateStr(selectedDate),
          time: selectedTime,
        });
      } catch (e) { console.warn("Failed to schedule notification:", e); }
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep(4);
    } catch (e: any) {
      Alert.alert("Erro", e.message || "Não foi possível realizar o agendamento");
    }
  };

  const reset = () => {
    setStep(1);
    setSelectedService(null);
    setSelectedDate(null);
    setSelectedTime(null);
  };

  const StepIndicator = () => (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, gap: 0 }}>
      {[1, 2, 3].map((s, i) => (
        <View key={s} style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: step > s ? colors.success : step === s ? colors.primary : colors.border }}>
            {step > s ? <IconSymbol name="checkmark" size={14} color="#fff" /> : <Text style={{ color: step === s ? "#fff" : colors.muted, fontSize: 12, fontWeight: "700" }}>{s}</Text>}
          </View>
          {i < 2 && <View style={{ width: 40, height: 2, backgroundColor: step > s + 1 ? colors.success : step > s ? colors.primary : colors.border }} />}
        </View>
      ))}
    </View>
  );

  if (!activeBarbershopId) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }}>
          <IconSymbol name="calendar" size={48} color={colors.muted} />
          <Text style={{ fontSize: 16, color: colors.muted, textAlign: "center" }}>Selecione uma barbearia para agendar</Text>
          <TouchableOpacity onPress={() => router.push("/barbershop-select")} style={{ backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 }}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>Escolher Barbearia</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  if (step === 4) {
    return (
      <ScreenContainer className="items-center justify-center px-8">
        <View style={{ alignItems: "center", gap: 16 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.success + "20", alignItems: "center", justifyContent: "center" }}>
            <IconSymbol name="checkmark.circle.fill" size={52} color={colors.success} />
          </View>
          <Text style={{ fontSize: 22, fontWeight: "800", color: colors.foreground, textAlign: "center" }}>Agendamento Confirmado!</Text>
          <Text style={{ fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20 }}>
            Seu horário foi agendado com sucesso.{"\n"}Você receberá um lembrete 1h antes.
          </Text>
          <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, width: "100%", gap: 8, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 13, color: colors.muted }}>Serviço</Text>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>{selectedService?.name}</Text>
            <Text style={{ fontSize: 13, color: colors.muted, marginTop: 4 }}>Data e Hora</Text>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>
              {selectedDate?.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })} às {selectedTime}
            </Text>
          </View>
          <TouchableOpacity onPress={reset} style={{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, marginTop: 8 }}>
            <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Novo Agendamento</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/(tabs)/appointments")}>
            <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "600" }}>Ver meus agendamentos</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
        <Text style={{ fontSize: 22, fontWeight: "800", color: colors.foreground }}>Agendar Horário</Text>
        <StepIndicator />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>

        {/* Step 1: Service */}
        {step === 1 && (
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground, marginBottom: 4 }}>Escolha o serviço</Text>
            {servicesLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : services && services.length > 0 ? (
              services.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => { setSelectedService(s); setStep(2); if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: selectedService?.id === s.id ? colors.primary : colors.border }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>{s.name}</Text>
                      {s.description && <Text style={{ fontSize: 13, color: colors.muted, marginTop: 4 }}>{s.description}</Text>}
                      <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <IconSymbol name="timer" size={14} color={colors.muted} />
                          <Text style={{ fontSize: 12, color: colors.muted }}>{s.durationMinutes} min</Text>
                        </View>
                        {s.priceDisplay && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <IconSymbol name="tag.fill" size={14} color={colors.muted} />
                            <Text style={{ fontSize: 12, color: colors.muted }}>{s.priceDisplay}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary + "15", alignItems: "center", justifyContent: "center" }}>
                      <IconSymbol name="chevron.right" size={16} color={colors.primary} />
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 24, alignItems: "center", gap: 8, borderWidth: 1, borderColor: colors.border }}>
                <IconSymbol name="scissors" size={32} color={colors.muted} />
                <Text style={{ color: colors.muted, fontSize: 14 }}>Nenhum serviço disponível</Text>
              </View>
            )}
          </View>
        )}

        {/* Step 2: Date */}
        {step === 2 && (
          <View style={{ gap: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <TouchableOpacity onPress={() => setStep(1)}>
                <IconSymbol name="chevron.left" size={22} color={colors.primary} />
              </TouchableOpacity>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>Escolha a data</Text>
            </View>
            <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 4 }}>Serviço selecionado</Text>
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>{selectedService?.name}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
              {days.map((d) => {
                const blocked = isDateBlocked(d);
                const isSelected = selectedDate && toDateStr(d) === toDateStr(selectedDate);
                return (
                  <TouchableOpacity
                    key={toDateStr(d)}
                    disabled={blocked}
                    onPress={() => { setSelectedDate(d); setSelectedTime(null); if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                    style={{ width: 64, paddingVertical: 12, borderRadius: 14, alignItems: "center", gap: 4, borderWidth: 1.5, borderColor: isSelected ? colors.primary : colors.border, backgroundColor: isSelected ? colors.primary : blocked ? colors.border + "50" : colors.surface, opacity: blocked ? 0.4 : 1 }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: "600", color: isSelected ? "#fff" : colors.muted }}>{DAYS_PT[d.getDay()]}</Text>
                    <Text style={{ fontSize: 20, fontWeight: "800", color: isSelected ? "#fff" : colors.foreground }}>{d.getDate()}</Text>
                    <Text style={{ fontSize: 10, color: isSelected ? "#ffffffcc" : colors.muted }}>{MONTHS_PT[d.getMonth()]}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {selectedDate && (
              <TouchableOpacity onPress={() => setStep(3)} style={{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: "center" }}>
                <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Continuar</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Step 3: Time */}
        {step === 3 && (
          <View style={{ gap: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <TouchableOpacity onPress={() => setStep(2)}>
                <IconSymbol name="chevron.left" size={22} color={colors.primary} />
              </TouchableOpacity>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>Escolha o horário</Text>
            </View>
            <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 2 }}>Serviço</Text>
              <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>{selectedService?.name}</Text>
              <Text style={{ fontSize: 13, color: colors.muted, marginTop: 8, marginBottom: 2 }}>Data</Text>
              <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground, textTransform: "capitalize" }}>
                {selectedDate?.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
              </Text>
            </View>
            {slotsLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : slots && slots.length > 0 ? (
              <>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                  {slots.map((slot) => (
                    <TouchableOpacity
                      key={slot}
                      onPress={() => { setSelectedTime(slot); if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                      style={{ paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: selectedTime === slot ? colors.primary : colors.border, backgroundColor: selectedTime === slot ? colors.primary : colors.surface }}
                    >
                      <Text style={{ fontSize: 15, fontWeight: "700", color: selectedTime === slot ? "#fff" : colors.foreground }}>{slot}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {selectedTime && (
                  <TouchableOpacity
                    onPress={handleConfirm}
                    disabled={createMutation.isPending}
                    style={{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 8, opacity: createMutation.isPending ? 0.7 : 1 }}
                  >
                    {createMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Confirmar Agendamento</Text>}
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 24, alignItems: "center", gap: 8, borderWidth: 1, borderColor: colors.border }}>
                <IconSymbol name="clock.fill" size={32} color={colors.muted} />
                <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center" }}>Nenhum horário disponível para esta data</Text>
                <TouchableOpacity onPress={() => { setSelectedDate(null); setStep(2); }}>
                  <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "600" }}>Escolher outra data</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
