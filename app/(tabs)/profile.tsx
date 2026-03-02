import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  Alert, ActivityIndicator, Platform
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import * as Haptics from "expo-haptics";

export default function ProfileScreen() {
  const colors = useColors();
  const { logout } = useAuth();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const { data: user, refetch } = trpc.auth.me.useQuery();
  const updateMutation = trpc.profile.update.useMutation({
    onSuccess: () => {
      refetch();
      setEditing(false);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Sucesso", "Perfil atualizado!");
    },
  });

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setPhone((user as any).phone || "");
    }
  }, [user]);

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert("Erro", "Nome é obrigatório"); return; }
    try {
      await updateMutation.mutateAsync({ name: name.trim(), phone: phone.trim() || undefined });
    } catch (e: any) {
      Alert.alert("Erro", e.message || "Não foi possível salvar");
    }
  };

  const handleLogout = () => {
    Alert.alert("Sair", "Deseja sair da sua conta?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/login");
        },
      },
    ]);
  };

  const isAdmin = user?.role === "admin";
  const isSuperAdmin = user?.role === "superadmin";

  const InfoRow = ({ icon, label, value }: { icon: any; label: string; value: string }) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary + "15", alignItems: "center", justifyContent: "center" }}>
        <IconSymbol name={icon} size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, color: colors.muted, fontWeight: "600" }}>{label}</Text>
        <Text style={{ fontSize: 14, color: colors.foreground, marginTop: 1 }}>{value || "—"}</Text>
      </View>
    </View>
  );

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={{ backgroundColor: colors.primary, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, alignItems: "center", gap: 10 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "#ffffff30", alignItems: "center", justifyContent: "center" }}>
            <IconSymbol name="person.fill" size={38} color="#fff" />
          </View>
          <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700" }}>{user?.name || "Usuário"}</Text>
          {(isAdmin || isSuperAdmin) && (
            <View style={{ backgroundColor: "#ffffff30", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>{isSuperAdmin ? "SUPER-ADMIN" : "ADMINISTRADOR"}</Text>
            </View>
          )}
        </View>

        <View style={{ padding: 16, marginTop: -16 }}>
          {/* Profile Card */}
          <View style={{ backgroundColor: colors.surface, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 16 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>Informações Pessoais</Text>
              {!editing && (
                <TouchableOpacity onPress={() => setEditing(true)} style={{ padding: 6, backgroundColor: colors.primary + "15", borderRadius: 8 }}>
                  <IconSymbol name="pencil" size={16} color={colors.primary} />
                </TouchableOpacity>
              )}
            </View>

            {editing ? (
              <View style={{ gap: 12 }}>
                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 12, color: colors.muted, fontWeight: "600" }}>NOME</Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Seu nome"
                    placeholderTextColor={colors.muted}
                    style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: colors.foreground, fontSize: 15 }}
                  />
                </View>
                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 12, color: colors.muted, fontWeight: "600" }}>TELEFONE</Text>
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="(11) 99999-9999"
                    placeholderTextColor={colors.muted}
                    keyboardType="phone-pad"
                    style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: colors.foreground, fontSize: 15 }}
                  />
                </View>
                <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                  <TouchableOpacity
                    onPress={() => { setEditing(false); setName(user?.name || ""); setPhone((user as any)?.phone || ""); }}
                    style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 11, alignItems: "center" }}
                  >
                    <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSave}
                    disabled={updateMutation.isPending}
                    style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 11, alignItems: "center", opacity: updateMutation.isPending ? 0.7 : 1 }}
                  >
                    {updateMutation.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>Salvar</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View>
                <InfoRow icon="person.fill" label="NOME" value={user?.name || ""} />
                <InfoRow icon="envelope.fill" label="E-MAIL" value={user?.email || ""} />
                <InfoRow icon="phone.fill" label="TELEFONE" value={(user as any)?.phone || ""} />
                {isAdmin && <InfoRow icon="shield.fill" label="PERFIL" value="Administrador" />}
              </View>
            )}
          </View>

          {/* Notifications info */}
          <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 16, flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary + "15", alignItems: "center", justifyContent: "center" }}>
              <IconSymbol name="bell.fill" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>Lembretes Automáticos</Text>
              <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4, lineHeight: 18 }}>
                Você receberá uma notificação 1 hora antes de cada agendamento com opção de confirmar ou cancelar.
              </Text>
            </View>
          </View>

          {/* Super-Admin Panel */}
          {isSuperAdmin && (
            <TouchableOpacity
              onPress={() => router.push("/super-admin")}
              style={{ backgroundColor: colors.warning + "15", borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: colors.warning + "30", marginBottom: 12 }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.warning + "20", alignItems: "center", justifyContent: "center" }}>
                <IconSymbol name="shield.fill" size={18} color={colors.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: colors.warning }}>Painel Super-Admin</Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>Gerenciar barbearias e assinaturas</Text>
              </View>
              <IconSymbol name="chevron.right" size={16} color={colors.warning} />
            </TouchableOpacity>
          )}

          {/* Logout */}
          <TouchableOpacity
            onPress={handleLogout}
            style={{ backgroundColor: colors.error + "15", borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: colors.error + "30" }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.error + "20", alignItems: "center", justifyContent: "center" }}>
              <IconSymbol name="rectangle.portrait.and.arrow.right" size={18} color={colors.error} />
            </View>
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.error }}>Sair da Conta</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
