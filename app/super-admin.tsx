import {
  View, Text, TouchableOpacity, FlatList, ActivityIndicator,
  Alert, RefreshControl, TextInput, Modal, ScrollView
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useState } from "react";
import { useRouter } from "expo-router";

type SubscriptionStatus = "trial" | "active" | "blocked";

function StatusBadge({ status }: { status: SubscriptionStatus }) {
  const colors = useColors();
  const map: Record<SubscriptionStatus, { label: string; color: string; bg: string }> = {
    trial: { label: "TRIAL", color: colors.warning, bg: colors.warning + "20" },
    active: { label: "ATIVO", color: colors.success, bg: colors.success + "20" },
    blocked: { label: "BLOQUEADO", color: colors.error, bg: colors.error + "20" },
  };
  const s = map[status] ?? map.trial;
  return (
    <View style={{ backgroundColor: s.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ fontSize: 10, fontWeight: "700", color: s.color }}>{s.label}</Text>
    </View>
  );
}

export default function SuperAdminScreen() {
  const colors = useColors();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedShop, setSelectedShop] = useState<any>(null);
  const [detailModal, setDetailModal] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");

  const { data: shops, refetch, isLoading } = trpc.superAdmin.listBarbershops.useQuery();
  const updateStatusMutation = trpc.superAdmin.updateSubscriptionStatus.useMutation({ onSuccess: () => refetch() });
  const addAdminMutation = trpc.superAdmin.addAdminToShop.useMutation({ onSuccess: () => { setNewAdminEmail(""); Alert.alert("Sucesso", "Admin adicionado com sucesso!"); } });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleUpdateStatus = (shopId: number, status: SubscriptionStatus) => {
    const labels: Record<SubscriptionStatus, string> = { trial: "Trial", active: "Ativo", blocked: "Bloqueado" };
    Alert.alert(
      "Alterar Status",
      `Deseja alterar o status para "${labels[status]}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Confirmar", onPress: () => updateStatusMutation.mutate({ shopId, status }) },
      ]
    );
  };

  const handleAddAdmin = async (shopId: number) => {
    if (!newAdminEmail.trim()) { Alert.alert("Erro", "Digite o e-mail do administrador"); return; }
    try {
      await addAdminMutation.mutateAsync({ shopId, email: newAdminEmail.trim() });
    } catch (e: any) {
      Alert.alert("Erro", e.message || "Não foi possível adicionar o admin");
    }
  };

  type ShopItem = NonNullable<typeof shops>[number];

  const filtered = (shops ?? []).filter((s: ShopItem) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.slug.toLowerCase().includes(search.toLowerCase()) ||
    (s.ownerEmail ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: (shops ?? []).length,
    active: (shops ?? []).filter((s: ShopItem) => s.subscriptionStatus === "active").length,
    trial: (shops ?? []).filter((s: ShopItem) => s.subscriptionStatus === "trial").length,
    blocked: (shops ?? []).filter((s: ShopItem) => s.subscriptionStatus === "blocked").length,
  };

  return (
    <ScreenContainer>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <IconSymbol name="chevron.left" size={22} color={colors.primary} />
          </TouchableOpacity>
          <Text style={{ fontSize: 22, fontWeight: "800", color: colors.foreground }}>Painel Super-Admin</Text>
        </View>

        {/* Stats */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
          {[
            { label: "Total", value: stats.total, color: colors.primary },
            { label: "Ativos", value: stats.active, color: colors.success },
            { label: "Trial", value: stats.trial, color: colors.warning },
            { label: "Bloqueados", value: stats.blocked, color: colors.error },
          ].map((stat) => (
            <View key={stat.label} style={{ flex: 1, backgroundColor: stat.color + "15", borderRadius: 12, padding: 10, alignItems: "center", borderWidth: 1, borderColor: stat.color + "30" }}>
              <Text style={{ fontSize: 20, fontWeight: "800", color: stat.color }}>{stat.value}</Text>
              <Text style={{ fontSize: 10, color: colors.muted, textAlign: "center" }}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Search */}
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border }}>
          <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar barbearia ou e-mail..."
            placeholderTextColor={colors.muted}
            style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 8, color: colors.foreground, fontSize: 14 }}
          />
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingTop: 40, gap: 8 }}>
              <IconSymbol name="scissors" size={40} color={colors.muted} />
              <Text style={{ fontSize: 14, color: colors.muted }}>Nenhuma barbearia encontrada</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>{item.name}</Text>
                  <Text style={{ fontSize: 12, color: colors.muted }}>@{item.slug}</Text>
                  {item.ownerEmail && <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{item.ownerEmail}</Text>}
                  {item.address && <Text style={{ fontSize: 12, color: colors.muted }}>{item.address}</Text>}
                </View>
                <StatusBadge status={item.subscriptionStatus as SubscriptionStatus} />
              </View>

              <View style={{ flexDirection: "row", gap: 6, marginBottom: 10 }}>
                <View style={{ flex: 1, backgroundColor: colors.background, borderRadius: 10, padding: 8, alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>{item.appointmentCount ?? 0}</Text>
                  <Text style={{ fontSize: 10, color: colors.muted }}>Agendamentos</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: colors.background, borderRadius: 10, padding: 8, alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>{item.memberCount ?? 0}</Text>
                  <Text style={{ fontSize: 10, color: colors.muted }}>Membros</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: colors.background, borderRadius: 10, padding: 8, alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted }}>{new Date(item.createdAt).toLocaleDateString("pt-BR")}</Text>
                  <Text style={{ fontSize: 10, color: colors.muted }}>Criado em</Text>
                </View>
              </View>

              {/* Status Actions */}
              <View style={{ flexDirection: "row", gap: 6, marginBottom: 8 }}>
                {(["trial", "active", "blocked"] as SubscriptionStatus[]).filter((s) => s !== item.subscriptionStatus).map((status) => {
                  const colorMap: Record<SubscriptionStatus, string> = { trial: colors.warning, active: colors.success, blocked: colors.error };
                  const labelMap: Record<SubscriptionStatus, string> = { trial: "Trial", active: "Ativar", blocked: "Bloquear" };
                  return (
                    <TouchableOpacity
                      key={status}
                      onPress={() => handleUpdateStatus(item.id, status)}
                      disabled={updateStatusMutation.isPending}
                      style={{ flex: 1, backgroundColor: colorMap[status] + "20", borderRadius: 10, paddingVertical: 8, alignItems: "center", borderWidth: 1, borderColor: colorMap[status] + "40" }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "700", color: colorMap[status] }}>{labelMap[status]}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Add Admin */}
              <TouchableOpacity
                onPress={() => { setSelectedShop(item); setDetailModal(true); setNewAdminEmail(""); }}
                style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, justifyContent: "center" }}
              >
                <IconSymbol name="person.fill.badge.plus" size={14} color={colors.primary} />
                <Text style={{ fontSize: 12, fontWeight: "600", color: colors.primary }}>Gerenciar Admins</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/* Detail Modal */}
      <Modal visible={detailModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDetailModal(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground }}>Gerenciar: {selectedShop?.name}</Text>
            <TouchableOpacity onPress={() => setDetailModal(false)}>
              <IconSymbol name="xmark" size={22} color={colors.muted} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 16 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground, marginBottom: 12 }}>Adicionar Administrador</Text>
            <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 12, lineHeight: 20 }}>
              O usuário precisa já ter feito login no app ao menos uma vez. Informe o e-mail cadastrado.
            </Text>
            <TextInput
              value={newAdminEmail}
              onChangeText={setNewAdminEmail}
              placeholder="email@exemplo.com"
              placeholderTextColor={colors.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.foreground, fontSize: 15, marginBottom: 12 }}
            />
            <TouchableOpacity
              onPress={() => selectedShop && handleAddAdmin(selectedShop.id)}
              disabled={addAdminMutation.isPending}
              style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: "center", opacity: addAdminMutation.isPending ? 0.7 : 1 }}
            >
              {addAdminMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Adicionar Admin</Text>}
            </TouchableOpacity>

            <View style={{ marginTop: 24 }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground, marginBottom: 12 }}>Informações da Barbearia</Text>
              {[
                { label: "Nome", value: selectedShop?.name },
                { label: "Slug", value: selectedShop?.slug },
                { label: "Endereço", value: selectedShop?.address || "Não informado" },
                { label: "Telefone", value: selectedShop?.phone || "Não informado" },
                { label: "Proprietário", value: selectedShop?.ownerEmail || "Não informado" },
                { label: "Status", value: selectedShop?.subscriptionStatus },
                { label: "Criado em", value: selectedShop ? new Date(selectedShop.createdAt).toLocaleDateString("pt-BR") : "" },
              ].map(({ label, value }) => (
                <View key={label} style={{ flexDirection: "row", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <Text style={{ flex: 1, fontSize: 13, color: colors.muted }}>{label}</Text>
                  <Text style={{ flex: 2, fontSize: 13, fontWeight: "600", color: colors.foreground, textAlign: "right" }}>{value}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
