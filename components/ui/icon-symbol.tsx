import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

const MAPPING = {
  "house.fill": "home",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  "chevron.left": "chevron-left",
  "calendar": "calendar-today",
  "calendar.badge.plus": "event-available",
  "clock.fill": "schedule",
  "person.fill": "person",
  "person.2.fill": "people",
  "scissors": "content-cut",
  "list.bullet": "list",
  "checkmark.circle.fill": "check-circle",
  "xmark.circle.fill": "cancel",
  "bell.fill": "notifications",
  "gear": "settings",
  "plus.circle.fill": "add-circle",
  "trash.fill": "delete",
  "pencil": "edit",
  "arrow.right.circle.fill": "arrow-circle-right",
  "star.fill": "star",
  "info.circle": "info",
  "exclamationmark.circle": "error",
  "checkmark": "check",
  "xmark": "close",
  "arrow.left": "arrow-back",
  "magnifyingglass": "search",
  "square.and.pencil": "edit-note",
  "rectangle.portrait.and.arrow.right": "logout",
  "phone.fill": "phone",
  "envelope.fill": "email",
  "chart.bar.fill": "bar-chart",
  "lock.fill": "lock",
  "shield.fill": "shield",
  "sun.max.fill": "wb-sunny",
  "moon.fill": "nightlight-round",
  "dollarsign.circle.fill": "attach-money",
  "tag.fill": "local-offer",
  "timer": "timer",
  "arrow.clockwise": "refresh",
  "minus.circle.fill": "remove-circle",
  "person.fill.badge.plus": "person-add",
  "building.2.fill": "store",
  "creditcard.fill": "credit-card",
} as IconMapping;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
