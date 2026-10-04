import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { registerPushToken } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

export type PushRegistrationResult = {
  status: "registered" | "denied" | "unavailable" | "error";
  message: string;
  token?: string;
};

export async function registerForPushNotifications(sessionToken?: string): Promise<PushRegistrationResult> {
  if (Platform.OS === "web") {
    return { status: "unavailable", message: "Push notifications are available in the Android and iOS builds." };
  }

  if (!Device.isDevice) {
    return { status: "unavailable", message: "Use a physical device to register for push notifications." };
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#138A36"
    });
  }

  const existingPermission = await Notifications.getPermissionsAsync();
  let permissionStatus = existingPermission.status;
  if (permissionStatus !== "granted") {
    const requestedPermission = await Notifications.requestPermissionsAsync();
    permissionStatus = requestedPermission.status;
  }

  if (permissionStatus !== "granted") {
    return { status: "denied", message: "Notifications were not enabled." };
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
  if (!projectId) {
    return { status: "error", message: "Missing Expo project ID for push notifications." };
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
  const token = tokenResponse.data;
  await registerPushToken({
    token,
    platform: Platform.OS,
    deviceName: Device.deviceName,
    projectId
  }, sessionToken);

  return { status: "registered", message: "Push notifications are active.", token };
}
