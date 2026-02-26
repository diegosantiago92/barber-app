import {
  View, Text, TouchableOpacity, FlatList, ActivityIndicator,
  Alert, TextInput, Modal, ScrollView, Platform
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useState } from "react";
import * as Haptics from "expo-haptics";

type ServiceForm = {
  name: string;
  description: string;
  durationMinutes: string;
  priceDisplay: string;
};

const emptyForm: ServiceForm = { name: "", description: "", durationMinutes: "30", priceDisplay: "" };

export default function ServicesScreen() {
  const colors = useColors();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ServiceForm>(emptyForm);

  const { data: services, refetch, isLoading } = trpc.services.listAll.useQuery();
  const createMutation = trpc.services.create.useMutation({ onSuccess: () => { refetch(); setModalVisible(false); setForm(emptyForm); } });
  const updateMutation = trpc.services.update.useMutation({ onSuccess: () => { refetch(); setModalVisible(false); setEditingId(null); setForm(emptyForm); } });
  const deleteMutation = trpc.services.delete.useMutation({ onSuccess: () => refetch() });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalVisible(true);
  };

  const openEdit = (s: any) => {
    setEditingId(s.id);
    setForm({ name: s.name, description: s.description || "", durationMinutes: String(s.durationMinutes), priceDisplay: s.priceDisplay || "" });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert("Erro", "Nome do serviço é obrigatório"); return; }
    const dur = parseInt(form.durationMinutes, 10);
    if (isNaN(dur) || dur < 5) { Alert.alert("Erro", "Duração inválida (mínimo 5 minutos)"); return; }
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, name: form.name.trim(), description: form.description.trim() || undefined, durationMinutes: dur, priceDisplay: form.priceDisplay.trim() || undefined });
      } else {
        await createMutation.mutateAsync({ name: form.name.trim(), description: form.description.trim() || undefined, durationMinutes: dur, priceDisplay: form.priceDisplay.trim() || undefined });
      }
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("Erro", e.message || "Não foi possível salvar");
    }
  };

  const handleDelete = (id: number, name: string) => {
    Alert.alert("Remover Serviço", `Deseja remover "${name}"? Ele não aparecerá mais para agendamentos.`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Remover", style: "destructive", onPress: () => deleteMutation.mutate({ id }) },
    ]);
  };

  const InputField = ({ label, value, onChangeText, placeholder, keyboardType = "default" as any, multiline = false }: any) => (
    <View style={{ gap: 6, marginBottom: 14 }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: colors.foreground, fontSize: 15, minHeight: multiline ? 80 : undefined, textAlignVertical: multiline ? "top" : "center" }}
      />
    </View>
  );

  return (
    <ScreenContainer>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 22, fontWeight: "800", color: colors.foreground }}>Serviços</Text>
        <TouchableOpacity
          onPress={openCreate}
          style={{ backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 6 }}
        >
          <IconSymbol name="plus.circle.fill" size={16} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>Novo</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={services}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingTop: 60, gap: 12 }}>
              <IconSymbol name="scissors" size={48} color={colors.muted} />
              <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground }}>Nenhum serviço cadastrado</Text>
              <Text style={{ fontSize: 13, color: colors.muted }}>Toque em "Novo" para adicionar</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>{item.name}</Text>
                    {!item.active && (
                      <View style={{ backgroundColor: colors.error + "20", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 10, color: colors.error, fontWeight: "600" }}>INATIVO</Text>
                      </View>
                    )}
                  </View>
                  {item.description && <Text style={{ fontSize: 13, color: colors.muted, marginTop: 4 }}>{item.description}</Text>}
                  <View style={{ flexDirection: "row", gap: 14, marginTop: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <IconSymbol name="timer" size={13} color={colors.muted} />
                      <Text style={{ fontSize: 12, color: colors.muted }}>{item.durationMinutes} min</Text>
                    </View>
                    {item.priceDisplay && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <IconSymbol name="tag.fill" size={13} color={colors.muted} />
                        <Text style={{ fontSize: 12, color: colors.muted }}>{item.priceDisplay}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity onPress={() => openEdit(item)} style={{ padding: 8, backgroundColor: colors.primary + "15", borderRadius: 10 }}>
                    <IconSymbol name="pencil" size={16} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(item.id, item.name)} style={{ padding: 8, backgroundColor: colors.error + "15", borderRadius: 10 }}>
                    <IconSymbol name="trash.fill" size={16} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        />
      )}

      {/* Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground }}>{editingId ? "Editar Serviço" : "Novo Serviço"}</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <IconSymbol name="xmark" size={22} color={colors.muted} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 16 }}>
            <InputField label="Nome do Serviço *" value={form.name} onChangeText={(v: string) => setForm({ ...form, name: v })} placeholder="Ex: Corte de Cabelo" />
            <InputField label="Descrição" value={form.description} onChangeText={(v: string) => setForm({ ...form, description: v })} placeholder="Descrição opcional" multiline />
            <InputField label="Duração (minutos) *" value={form.durationMinutes} onChangeText={(v: string) => setForm({ ...form, durationMinutes: v })} placeholder="30" keyboardType="numeric" />
            <InputField label="Preço (informativo)" value={form.priceDisplay} onChangeText={(v: string) => setForm({ ...form, priceDisplay: v })} placeholder="Ex: R$ 35,00" />
            <TouchableOpacity
              onPress={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              style={{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 8, opacity: (createMutation.isPending || updateMutation.isPending) ? 0.7 : 1 }}
            >
              {(createMutation.isPending || updateMutation.isPending) ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Salvar Serviço</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
