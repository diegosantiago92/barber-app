import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, TextInput, Alert, ScrollView } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useBarbershop } from "@/lib/barbershop-context";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";

export default function BarbershopSelectScreen() {
  const colors = useColors();
  const router = useRouter();
  const { setActiveBarbershopId } = useBarbershop();
  const { user } = useAuth();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", description: "", address: "", phone: "" });
  const [creating, setCreating] = useState(false);

  const { data: publicShops, isLoading: loadingPublic } = trpc.barbershops.list.useQuery();
  const { data: myShops, isLoading: loadingMine, refetch: refetchMine } = trpc.barbershops.mine.useQuery(undefined, { enabled: !!user });
  const createMutation = trpc.barbershops.create.useMutation({
    onSuccess: (data) => {
      refetchMine();
      setShowCreate(false);
      setForm({ name: "", slug: "", description: "", address: "", phone: "" });
      Alert.alert("Barbearia criada!", "Sua barbearia foi criada com sucesso. Agora configure os serviços e horários.");
    },
  });

  const handleSelect = (id: number) => {
    setActiveBarbershopId(id);
    router.replace("/(tabs)");
  };

  const handleCreate = async () => {
    if (!form.name.trim()) { Alert.alert("Erro", "Nome é obrigatório"); return; }
    if (!form.slug.trim()) { Alert.alert("Erro", "Identificador é obrigatório"); return; }
    setCreating(true);
    try {
      await createMutation.mutateAsync({
        name: form.name.trim(),
        slug: form.slug.trim().toLowerCase().replace(/\s+/g, "-"),
        description: form.description.trim() || undefined,
        address: form.address.trim() || undefined,
        phone: form.phone.trim() || undefined,
      });
    } catch (e: any) {
      Alert.alert("Erro", e.message || "Não foi possível criar a barbearia");
    } finally {
      setCreating(false);
    }
  };

  const allShops = publicShops ?? [];
  const myShopIds = new Set((myShops ?? []).map((s) => s.id));

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
          <Text style={{ fontSize: 26, fontWeight: "800", color: colors.foreground }}>Escolha a Barbearia</Text>
          <Text style={{ fontSize: 14, color: colors.muted, marginTop: 4 }}>Selecione onde deseja agendar ou gerenciar</Text>
        </View>

        {/* My Barbershops (admin/owner) */}
        {user && (myShops ?? []).length > 0 && (
          <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.muted, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Minhas Barbearias</Text>
            {(myShops ?? []).map((shop) => (
              <TouchableOpacity
                key={shop.id}
                onPress={() => handleSelect(shop.id)}
                style={{ backgroundColor: colors.primary + "15", borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1.5, borderColor: colors.primary + "40" }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <IconSymbol name="scissors" size={16} color={colors.primary} />
                      <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>{shop.name}</Text>
                    </View>
                    {shop.address && <Text style={{ fontSize: 12, color: colors.muted }}>{shop.address}</Text>}
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <View style={{ backgroundColor: shop.subscriptionStatus === "active" ? colors.success + "20" : shop.subscriptionStatus === "blocked" ? colors.error + "20" : colors.warning + "20", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ fontSize: 10, fontWeight: "700", color: shop.subscriptionStatus === "active" ? colors.success : shop.subscriptionStatus === "blocked" ? colors.error : colors.warning }}>
                        {shop.subscriptionStatus === "active" ? "ATIVO" : shop.subscriptionStatus === "blocked" ? "BLOQUEADO" : "TRIAL"}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11, color: colors.muted }}>{shop.memberRole === "owner" ? "Proprietário" : "Admin"}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* All Public Barbershops */}
        <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.muted, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Barbearias Disponíveis</Text>
          {loadingPublic ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
          ) : allShops.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 32, gap: 8 }}>
              <IconSymbol name="scissors" size={40} color={colors.muted} />
              <Text style={{ fontSize: 14, color: colors.muted }}>Nenhuma barbearia disponível</Text>
            </View>
          ) : (
            allShops.filter((s) => !myShopIds.has(s.id)).map((shop) => (
              <TouchableOpacity
                key={shop.id}
                onPress={() => handleSelect(shop.id)}
                style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.border }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>{shop.name}</Text>
                    {shop.address && <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{shop.address}</Text>}
                    {shop.phone && <Text style={{ fontSize: 12, color: colors.muted }}>{shop.phone}</Text>}
                  </View>
                  <IconSymbol name="chevron.right" size={18} color={colors.muted} />
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Create Barbershop */}
        {user && (
          <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
            <TouchableOpacity
              onPress={() => setShowCreate(!showCreate)}
              style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, justifyContent: "center" }}
            >
              <IconSymbol name="plus.circle.fill" size={20} color={colors.primary} />
              <Text style={{ fontSize: 15, fontWeight: "700", color: colors.primary }}>Cadastrar Minha Barbearia</Text>
            </TouchableOpacity>

            {showCreate && (
              <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, marginTop: 8 }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground, marginBottom: 14 }}>Nova Barbearia</Text>
                {[
                  { label: "Nome da Barbearia *", key: "name", placeholder: "Ex: Barbearia do João" },
                  { label: "Identificador único *", key: "slug", placeholder: "Ex: barbearia-do-joao (sem espaços)" },
                  { label: "Descrição", key: "description", placeholder: "Descrição opcional" },
                  { label: "Endereço", key: "address", placeholder: "Rua, número, bairro" },
                  { label: "Telefone/WhatsApp", key: "phone", placeholder: "(11) 99999-9999" },
                ].map(({ label, key, placeholder }) => (
                  <View key={key} style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 5 }}>{label}</Text>
                    <TextInput
                      value={(form as any)[key]}
                      onChangeText={(v) => setForm({ ...form, [key]: v })}
                      placeholder={placeholder}
                      placeholderTextColor={colors.muted}
                      style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: colors.foreground, fontSize: 14 }}
                    />
                  </View>
                ))}
                <TouchableOpacity
                  onPress={handleCreate}
                  disabled={creating}
                  style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: "center", marginTop: 4, opacity: creating ? 0.7 : 1 }}
                >
                  {creating ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Criar Barbearia</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
