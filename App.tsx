import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AuthBundle, AuthRole, requestPasswordReset, signIn, signUp } from "./src/api";
import { palette } from "./src/data";
import { registerForPushNotifications } from "./src/notifications";
import { HomeScreen } from "./src/screens/HomeScreen";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

type AuthScreen = "intro" | "signin" | "signup" | "forgot";
type Notice = { tone: "success" | "error" | "info"; text: string } | null;

const SESSION_KEY = "qml.mobile.session";

const introSlides = [
  {
    title: "Bulk food, paid your way",
    text: "Create food plans, join group buys, and keep household staples moving without leaving the QML wallet."
  },
  {
    title: "Built for local markets",
    text: "Discover Nigerian produce, proteins, grains, tubers, oils, and fresh stock from nearby verified sellers."
  },
  {
    title: "Delivery and roles in one place",
    text: "Customers, vendors, logistics partners, financiers, and corporate buyers can start from the same app."
  }
];

const signupRoles: Array<{ key: AuthRole; label: string; text: string }> = [
  { key: "customer", label: "Customer", text: "Buy food and manage food plans." },
  { key: "vendor", label: "Vendor", text: "List produce and receive orders." },
  { key: "financier", label: "Financier", text: "Fund verified food plans." },
  { key: "logistics", label: "Logistics", text: "Deliver eligible orders." },
  { key: "corporate", label: "Corporate", text: "Buy staff and team packs." }
];

export default function App() {
  const [bootReady, setBootReady] = useState(false);
  const [sessionBundle, setSessionBundle] = useState<AuthBundle | null>(null);
  const [authScreen, setAuthScreen] = useState<AuthScreen>("intro");
  const [notice, setNotice] = useState<Notice>(null);
  const [pushStatus, setPushStatus] = useState("Notifications not enabled");

  useEffect(() => {
    let active = true;
    async function restoreSession() {
      try {
        const rawSession = await AsyncStorage.getItem(SESSION_KEY);
        if (!active) return;
        if (rawSession) {
          const restored = JSON.parse(rawSession) as AuthBundle;
          if (restored.session?.token) setSessionBundle(restored);
        }
      } catch {
        await AsyncStorage.removeItem(SESSION_KEY);
      } finally {
        if (active) {
          setBootReady(true);
          SplashScreen.hideAsync().catch(() => undefined);
        }
      }
    }
    restoreSession();
    return () => {
      active = false;
    };
  }, []);

  const viewerName = useMemo(() => {
    const user = sessionBundle?.user;
    return user?.full_name || user?.name || user?.email || user?.phone || "friend";
  }, [sessionBundle]);

  async function completeAuth(bundle: AuthBundle, fallbackMessage: string) {
    if (bundle.requiresConfirmation || !bundle.session?.token) {
      setNotice({ tone: "info", text: bundle.message || "Check your email or phone, then sign in." });
      setAuthScreen("signin");
      return;
    }

    setSessionBundle(bundle);
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(bundle));
    setNotice({ tone: "success", text: bundle.message || fallbackMessage });
  }

  async function handleSignOut() {
    setSessionBundle(null);
    setPushStatus("Notifications not enabled");
    await AsyncStorage.removeItem(SESSION_KEY);
    setAuthScreen("signin");
  }

  async function handleEnableNotifications() {
    setPushStatus("Checking notification permission...");
    try {
      const result = await registerForPushNotifications(sessionBundle?.session?.token);
      setPushStatus(result.message);
      setNotice({
        tone: result.status === "registered" ? "success" : result.status === "denied" ? "error" : "info",
        text: result.message
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Push notification setup failed.";
      setPushStatus(message);
      setNotice({ tone: "error", text: message });
    }
  }

  if (!bootReady) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <SafeAreaView style={styles.bootScreen}>
          <View style={styles.logoMark}>
            <Ionicons name="basket" size={34} color={palette.white} />
          </View>
          <Text style={styles.bootTitle}>Bulk Food by QML</Text>
          <ActivityIndicator color={palette.green} />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {sessionBundle?.session?.token ? (
        <HomeScreen
          notificationStatus={pushStatus}
          onEnableNotifications={handleEnableNotifications}
          onSignOut={handleSignOut}
          viewerName={viewerName}
        />
      ) : (
        <AuthExperience
          currentScreen={authScreen}
          notice={notice}
          onForgotPassword={async (identifier) => {
            const response = await requestPasswordReset(identifier);
            setNotice({ tone: "success", text: response.message || "Password reset instructions sent." });
            setAuthScreen("signin");
          }}
          onNavigate={(screen) => {
            setNotice(null);
            setAuthScreen(screen);
          }}
          onSignIn={async (identifier, password) => {
            const bundle = await signIn(identifier, password);
            await completeAuth(bundle, "Signed in securely.");
          }}
          onSignUp={async (input) => {
            const bundle = await signUp(input);
            await completeAuth(bundle, "Account created.");
          }}
        />
      )}
      {notice ? <NoticeBanner notice={notice} onDismiss={() => setNotice(null)} /> : null}
    </SafeAreaProvider>
  );
}

function AuthExperience({
  currentScreen,
  notice,
  onForgotPassword,
  onNavigate,
  onSignIn,
  onSignUp
}: {
  currentScreen: AuthScreen;
  notice: Notice;
  onForgotPassword: (identifier: string) => Promise<void>;
  onNavigate: (screen: AuthScreen) => void;
  onSignIn: (identifier: string, password: string) => Promise<void>;
  onSignUp: (input: { name: string; identifier: string; password: string; role: AuthRole; referralCode?: string }) => Promise<void>;
}) {
  const [slideIndex, setSlideIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [role, setRole] = useState<AuthRole>("customer");
  const [formError, setFormError] = useState("");

  async function submit(action: () => Promise<void>) {
    setBusy(true);
    setFormError("");
    try {
      await action();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (currentScreen === "intro") {
    const slide = introSlides[slideIndex];
    return (
      <SafeAreaView style={styles.authShell}>
        <View style={styles.introTop}>
          <View style={styles.logoMark}>
            <Ionicons name="basket" size={34} color={palette.white} />
          </View>
          <Text style={styles.brand}>Bulk Food by QML</Text>
        </View>
        <View style={styles.introBody}>
          <Text style={styles.introCount}>{slideIndex + 1} / {introSlides.length}</Text>
          <Text style={styles.introTitle}>{slide.title}</Text>
          <Text style={styles.introText}>{slide.text}</Text>
          <View style={styles.dots}>
            {introSlides.map((item, index) => (
              <View key={item.title} style={[styles.dot, index === slideIndex ? styles.dotActive : null]} />
            ))}
          </View>
        </View>
        <View style={styles.authActions}>
          <Pressable
            style={styles.primaryButton}
            onPress={() => slideIndex === introSlides.length - 1 ? onNavigate("signup") : setSlideIndex((value) => value + 1)}
          >
            <Text style={styles.primaryButtonText}>{slideIndex === introSlides.length - 1 ? "Get started" : "Next"}</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => onNavigate("signin")}>
            <Text style={styles.secondaryButtonText}>I already have an account</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.authShell}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboard}>
        <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
          <View style={styles.formHeader}>
            <Pressable style={styles.backButton} onPress={() => onNavigate(currentScreen === "signin" ? "intro" : "signin")}>
              <Ionicons name="chevron-back" size={22} color={palette.charcoal} />
            </Pressable>
            <Text style={styles.formTitle}>
              {currentScreen === "signin" ? "Sign in" : currentScreen === "signup" ? "Create account" : "Forgot password"}
            </Text>
            <View style={styles.backButtonPlaceholder} />
          </View>

          <View style={styles.formCard}>
            {notice ? <InlineNotice notice={notice} /> : null}
            {formError ? <InlineNotice notice={{ tone: "error", text: formError }} /> : null}

            {currentScreen === "signin" ? (
              <>
                <Text style={styles.formCopy}>Access your wallet, food plans, roles, orders, and delivery updates.</Text>
                <LabeledInput label="Email or phone" value={identifier} onChangeText={setIdentifier} placeholder="ada@example.com or +234..." />
                <LabeledInput label="Password" value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry />
                <Pressable style={styles.textLink} onPress={() => onNavigate("forgot")}>
                  <Text style={styles.textLinkText}>Forgot password?</Text>
                </Pressable>
                <SubmitButton
                  busy={busy}
                  label="Sign in"
                  onPress={() => submit(() => onSignIn(identifier.trim(), password))}
                />
                <Pressable style={styles.secondaryButton} onPress={() => onNavigate("signup")}>
                  <Text style={styles.secondaryButtonText}>Create account</Text>
                </Pressable>
              </>
            ) : null}

            {currentScreen === "signup" ? (
              <>
                <Text style={styles.formCopy}>Choose the account type first. Role approvals can continue after account creation.</Text>
                <View style={styles.roleGrid}>
                  {signupRoles.map((item) => (
                    <Pressable
                      key={item.key}
                      style={[styles.roleOption, role === item.key ? styles.roleOptionActive : null]}
                      onPress={() => setRole(item.key)}
                    >
                      <Text style={styles.roleOptionTitle}>{item.label}</Text>
                      <Text style={styles.roleOptionText}>{item.text}</Text>
                    </Pressable>
                  ))}
                </View>
                <LabeledInput label="Full name" value={name} onChangeText={setName} placeholder="Ada Okonkwo" />
                <LabeledInput label="Email or phone" value={identifier} onChangeText={setIdentifier} placeholder="ada@example.com or +234..." />
                <LabeledInput label="Password" value={password} onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry />
                <LabeledInput label="Referral code" value={referralCode} onChangeText={setReferralCode} placeholder="Optional" />
                <SubmitButton
                  busy={busy}
                  label="Create account"
                  onPress={() => submit(() => onSignUp({
                    name: name.trim(),
                    identifier: identifier.trim(),
                    password,
                    role,
                    referralCode: referralCode.trim() || undefined
                  }))}
                />
                <Pressable style={styles.secondaryButton} onPress={() => onNavigate("signin")}>
                  <Text style={styles.secondaryButtonText}>Back to sign in</Text>
                </Pressable>
              </>
            ) : null}

            {currentScreen === "forgot" ? (
              <>
                <Text style={styles.formCopy}>Enter the email address on your account and QML will request a secure reset link.</Text>
                <LabeledInput label="Email" value={identifier} onChangeText={setIdentifier} placeholder="ada@example.com" />
                <SubmitButton
                  busy={busy}
                  label="Send reset link"
                  onPress={() => submit(() => onForgotPassword(identifier.trim()))}
                />
                <Pressable style={styles.secondaryButton} onPress={() => onNavigate("signin")}>
                  <Text style={styles.secondaryButtonText}>Back to sign in</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={placeholder}
        placeholderTextColor="#8B968F"
        secureTextEntry={secureTextEntry}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

function SubmitButton({ busy, label, onPress }: { busy: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable disabled={busy} style={[styles.primaryButton, busy ? styles.disabledButton : null]} onPress={onPress}>
      {busy ? <ActivityIndicator color={palette.white} /> : <Text style={styles.primaryButtonText}>{label}</Text>}
    </Pressable>
  );
}

function InlineNotice({ notice }: { notice: NonNullable<Notice> }) {
  return (
    <View style={[styles.inlineNotice, notice.tone === "error" ? styles.inlineError : notice.tone === "success" ? styles.inlineSuccess : null]}>
      <Text style={styles.inlineNoticeText}>{notice.text}</Text>
    </View>
  );
}

function NoticeBanner({ notice, onDismiss }: { notice: NonNullable<Notice>; onDismiss: () => void }) {
  return (
    <Pressable style={[styles.noticeBanner, notice.tone === "error" ? styles.noticeError : notice.tone === "success" ? styles.noticeSuccess : null]} onPress={onDismiss}>
      <Text style={styles.noticeText}>{notice.text}</Text>
      <Ionicons name="close" size={18} color={palette.charcoal} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  authActions: {
    gap: 10
  },
  authShell: {
    backgroundColor: palette.offWhite,
    flex: 1,
    padding: 18
  },
  backButton: {
    alignItems: "center",
    backgroundColor: palette.white,
    borderColor: palette.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  backButtonPlaceholder: {
    width: 42
  },
  bootScreen: {
    alignItems: "center",
    backgroundColor: palette.offWhite,
    flex: 1,
    gap: 14,
    justifyContent: "center"
  },
  bootTitle: {
    color: palette.charcoal,
    fontSize: 24,
    fontWeight: "900"
  },
  brand: {
    color: palette.charcoal,
    fontSize: 19,
    fontWeight: "900"
  },
  disabledButton: {
    opacity: 0.7
  },
  dot: {
    backgroundColor: "#CDD7D0",
    borderRadius: 999,
    height: 8,
    width: 8
  },
  dotActive: {
    backgroundColor: palette.green,
    width: 28
  },
  dots: {
    flexDirection: "row",
    gap: 8,
    marginTop: 24
  },
  formCard: {
    backgroundColor: palette.white,
    borderColor: palette.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 16
  },
  formContent: {
    flexGrow: 1,
    paddingBottom: 26
  },
  formCopy: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20
  },
  formHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16
  },
  formTitle: {
    color: palette.charcoal,
    fontSize: 22,
    fontWeight: "900"
  },
  inlineError: {
    backgroundColor: "#FDECE9",
    borderColor: "#F7B7AD"
  },
  inlineNotice: {
    backgroundColor: "#EDF4FF",
    borderColor: "#C8DDFC",
    borderRadius: 8,
    borderWidth: 1,
    padding: 12
  },
  inlineNoticeText: {
    color: palette.charcoal,
    fontSize: 13,
    lineHeight: 18
  },
  inlineSuccess: {
    backgroundColor: palette.mint,
    borderColor: "#BFE8CB"
  },
  input: {
    backgroundColor: palette.offWhite,
    borderColor: palette.border,
    borderRadius: 8,
    borderWidth: 1,
    color: palette.charcoal,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 12
  },
  inputGroup: {
    gap: 7
  },
  inputLabel: {
    color: palette.charcoal,
    fontSize: 13,
    fontWeight: "800"
  },
  introBody: {
    flex: 1,
    justifyContent: "center"
  },
  introCount: {
    color: palette.green,
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 14
  },
  introText: {
    color: palette.muted,
    fontSize: 17,
    lineHeight: 25,
    marginTop: 14
  },
  introTitle: {
    color: palette.charcoal,
    fontSize: 36,
    fontWeight: "900",
    lineHeight: 42
  },
  introTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12
  },
  keyboard: {
    flex: 1
  },
  logoMark: {
    alignItems: "center",
    backgroundColor: palette.green,
    borderRadius: 8,
    height: 58,
    justifyContent: "center",
    width: 58
  },
  noticeBanner: {
    alignItems: "center",
    backgroundColor: "#EDF4FF",
    borderColor: "#C8DDFC",
    borderRadius: 8,
    borderWidth: 1,
    bottom: 20,
    flexDirection: "row",
    gap: 10,
    left: 16,
    padding: 12,
    position: "absolute",
    right: 16
  },
  noticeError: {
    backgroundColor: "#FDECE9",
    borderColor: "#F7B7AD"
  },
  noticeSuccess: {
    backgroundColor: palette.mint,
    borderColor: "#BFE8CB"
  },
  noticeText: {
    color: palette.charcoal,
    flex: 1,
    fontSize: 13,
    lineHeight: 18
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: palette.green,
    borderRadius: 8,
    minHeight: 50,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 14
  },
  primaryButtonText: {
    color: palette.white,
    fontWeight: "900"
  },
  roleGrid: {
    gap: 8
  },
  roleOption: {
    backgroundColor: palette.offWhite,
    borderColor: palette.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12
  },
  roleOptionActive: {
    backgroundColor: palette.mint,
    borderColor: palette.green
  },
  roleOptionText: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3
  },
  roleOptionTitle: {
    color: palette.charcoal,
    fontSize: 14,
    fontWeight: "900"
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: palette.mint,
    borderRadius: 8,
    minHeight: 50,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 14
  },
  secondaryButtonText: {
    color: palette.green,
    fontWeight: "900",
    textAlign: "center"
  },
  textLink: {
    alignSelf: "flex-end",
    paddingVertical: 2
  },
  textLinkText: {
    color: palette.green,
    fontWeight: "900"
  }
});
