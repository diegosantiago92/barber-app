import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Configure notification handler (only on native)
if (Platform.OS !== "web") Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("barber-reminders", {
      name: "Lembretes de Agendamento",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === "granted") return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function scheduleAppointmentReminder(params: {
  appointmentId: number;
  serviceName: string;
  date: string;
  time: string;
}) {
  if (Platform.OS === "web") return null;

  const granted = await requestNotificationPermissions();
  if (!granted) return null;

  const [year, month, day] = params.date.split("-").map(Number);
  const [hour, minute] = params.time.split(":").map(Number);

  // Schedule 1 hour before
  const appointmentDate = new Date(year, month - 1, day, hour, minute, 0);
  const reminderDate = new Date(appointmentDate.getTime() - 60 * 60 * 1000);

  // Don't schedule if reminder is in the past
  if (reminderDate <= new Date()) return null;

  const notifId = await Notifications.scheduleNotificationAsync({
    identifier: `appointment-${params.appointmentId}`,
    content: {
      title: "Lembrete de Agendamento",
      body: `Seu horário de ${params.serviceName} é às ${params.time}. Deseja confirmar ou cancelar?`,
      data: {
        appointmentId: params.appointmentId,
        type: "appointment_reminder",
        date: params.date,
        time: params.time,
        serviceName: params.serviceName,
      },
      categoryIdentifier: "appointment_actions",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: reminderDate,
    },
  });

  return notifId;
}

export async function cancelAppointmentReminder(appointmentId: number) {
  if (Platform.OS === "web") return;
  await Notifications.cancelScheduledNotificationAsync(`appointment-${appointmentId}`);
}

export async function setupNotificationCategories() {
  if (Platform.OS === "web") return;

  await Notifications.setNotificationCategoryAsync("appointment_actions", [
    {
      identifier: "confirm",
      buttonTitle: "Confirmar",
      options: { opensAppToForeground: false },
    },
    {
      identifier: "cancel_appointment",
      buttonTitle: "Cancelar Horário",
      options: { opensAppToForeground: true, isDestructive: true },
    },
  ]);
}
