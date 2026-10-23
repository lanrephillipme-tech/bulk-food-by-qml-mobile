import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AuthBundle, AuthRole, requestPasswordReset, resendSignupConfirmation, signIn, signUp } from "./src/api";
import { palette } from "./src/data";
import { registerForPushNotifications } from "./src/notifications";
import { HomeScreen } from "./src/screens/HomeScreen";
import { CatalogScreen } from "./src/screens/CatalogScreen";
import { introSlides } from "./src/intro-slides";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

type AuthScreen = "intro" | "signin" | "signup" | "forgot" | "confirmation";
type Notice = { tone: "success" | "error" | "info"; text: string } | null;

const SESSION_KEY = "qml.mobile.session";

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
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState("");
  const [pushStatus, setPushStatus] = useState("Notifications not enabled");
  const [catalogOpen, setCatalogOpen] = useState(true);

  useEffect(() => {
    const handleUrl = (url: string | null) => {
      if (url?.split(/[?#]/)[0] !== "bulkfoodqml://auth/confirm") return;
      setAuthScreen("signin");
      setNotice({ tone: "info", text: "Sign in to continue after completing the email link." });
    };
    Linking.getInitialURL().then(handleUrl).catch(() => undefined);
    const subscription = Linking.addEventListener("url", ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let active = true;
    async function restoreSession() {
      try {
        const rawSession = await AsyncStorage.getItem(SESSION_KEY);
        if (!active) return;
        if (rawSession) {
          const restored = JSON.parse(rawSession) as AuthBundle;
          const expiresAt = Date.parse(restored.session?.expiresAt || "");
          if (restored.session?.token && Number.isFinite(expiresAt) && expiresAt > Date.now()) {
            setSessionBundle(restored);
          } else {
            await AsyncStorage.removeItem(SESSION_KEY);
            setAuthScreen("signin");
          }
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

  async function completeAuth(bundle: AuthBundle, fallbackMessage: string, persistSession = true, signupEmail = "") {
    if (bundle.requiresConfirmation || !bundle.session?.token) {
      setNotice({ tone: "info", text: bundle.message || "Check your email or phone, then sign in." });
      setPendingConfirmationEmail(signupEmail);
      setAuthScreen(signupEmail ? "confirmation" : "signin");
      return;
    }

    if (persistSession) await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(bundle));
    else await AsyncStorage.removeItem(SESSION_KEY);
    setSessionBundle(bundle);
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
          <Image source={introSlides[0].image} style={styles.bootImage} resizeMode="contain" accessibilityLabel="QML groceries" />
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
        catalogOpen ? <CatalogScreen token={sessionBundle.session.token} onBack={() => setCatalogOpen(false)} /> : <HomeScreen
          onOpenCatalog={() => setCatalogOpen(true)}
          notificationStatus={pushStatus}
          onEnableNotifications={handleEnableNotifications}
          onSignOut={handleSignOut}
          viewerName={viewerName}
        />
      ) : (
        <AuthExperience
          currentScreen={authScreen}
          notice={notice}
          pendingConfirmationEmail={pendingConfirmationEmail}
          onResendConfirmation={async (email) => {
            const response = await resendSignupConfirmation(email);
            setNotice({ tone: "success", text: response.message || "If the signup is pending, a new activation email is on its way." });
          }}
          onForgotPassword={async (identifier) => {
            const response = await requestPasswordReset(identifier);
            setNotice({ tone: "success", text: response.message || "Password reset instructions sent." });
            setAuthScreen("signin");
          }}
          onNavigate={(screen) => {
            setNotice(null);
            setAuthScreen(screen);
          }}
          onSignIn={async (identifier, password, rememberMe) => {
            try {
              const bundle = await signIn(identifier, password);
              await completeAuth(bundle, "Signed in securely.", rememberMe);
            } catch (error) {
              if (/email.*not confirmed|not confirmed.*email/i.test(error instanceof Error ? error.message : "") && identifier.includes("@")) {
                setPendingConfirmationEmail(identifier);
                setNotice({ tone: "info", text: "Confirm your email before signing in. You can request another activation link here." });
                setAuthScreen("confirmation");
                return;
              }
              throw error;
            }
          }}
          onSignUp={async (input) => {
            const bundle = await signUp(input);
            await completeAuth(bundle, "Account created.", true, input.identifier);
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
  pendingConfirmationEmail,
  onResendConfirmation,
  onForgotPassword,
  onNavigate,
  onSignIn,
  onSignUp
}: {
  currentScreen: AuthScreen;
  notice: Notice;
  pendingConfirmationEmail: string;
  onResendConfirmation: (email: string) => Promise<void>;
  onForgotPassword: (identifier: string) => Promise<void>;
  onNavigate: (screen: AuthScreen) => void;
  onSignIn: (identifier: string, password: string, rememberMe: boolean) => Promise<void>;
  onSignUp: (input: { name: string; identifier: string; password: string; role: AuthRole; referralCode?: string }) => Promise<void>;
}) {
  const [slideIndex, setSlideIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [role, setRole] = useState<AuthRole>("customer");
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [formError, setFormError] = useState("");
  const { height } = useWindowDimensions();
  const touchStart = useRef(0);

  useEffect(() => {
    setFormError("");
    setPassword("");
    setConfirmPassword("");
    setRoleMenuOpen(false);
  }, [currentScreen]);

  useEffect(() => {
    if (pendingConfirmationEmail) setIdentifier(pendingConfirmationEmail);
  }, [pendingConfirmationEmail]);

  async function submit(action: () => Promise<void>) {
    if (busy) return;
    if (!identifier.trim()) {
      setFormError(currentScreen === "forgot" ? "Enter your email address." : "Enter your email or phone number.");
      return;
    }
    if (currentScreen === "forgot" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier.trim())) {
      setFormError("Enter a valid email address.");
      return;
    }
    if (currentScreen === "signup" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier.trim())) {
      setFormError("Enter a valid email address for account activation.");
      return;
    }
    if (currentScreen === "signup" && !name.trim()) {
      setFormError("Enter your full name.");
      return;
    }
    if (currentScreen === "signin" && !password) {
      setFormError("Enter your password.");
      return;
    }
    if (currentScreen === "signup" && password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }
    if (currentScreen === "signup" && password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }
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
      <SafeAreaView style={styles.introShell}>
        <ScrollView contentContainerStyle={styles.introContent}>
          <View
            onTouchStart={(event) => { touchStart.current = event.nativeEvent.pageX; }}
            onTouchEnd={(event) => {
              const delta = event.nativeEvent.pageX - touchStart.current;
              if (Math.abs(delta) > 60) setSlideIndex((value) => Math.max(0, Math.min(introSlides.length - 1, value + (delta < 0 ? 1 : -1))));
            }}
          >
            <Image source={slide.image} style={[styles.introImage, { height: Math.min(420, Math.max(200, height * 0.43)) }]} resizeMode="cover" accessibilityLabel={slide.title} />
            <View style={styles.introBody}>
              <Text style={styles.introTitle}>{slide.title}</Text>
              <Text style={styles.introText}>{slide.text}</Text>
            </View>
          </View>
          <View style={styles.introFooter}>
            <View style={styles.dots}>
              {introSlides.map((item, index) => (
                <Pressable key={index} accessibilityRole="button" accessibilityLabel={`Open slide ${index + 1}`} accessibilityState={{ selected: index === slideIndex }} style={styles.dotButton} onPress={() => setSlideIndex(index)}>
                  <View style={[styles.dot, index === slideIndex ? styles.dotActive : null]} />
                </Pressable>
              ))}
            </View>
            <View style={styles.introActions}>
              <Pressable accessibilityRole="button" style={styles.skipButton} onPress={() => onNavigate("signin")}>
                <Text style={styles.skipText}>Skip</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={[styles.primaryButton, styles.introNext]}
                onPress={() => slideIndex === introSlides.length - 1 ? onNavigate("signup") : setSlideIndex((value) => value + 1)}
              >
                <Text style={styles.primaryButtonText}>{slideIndex === introSlides.length - 1 ? "Get Started" : "Next"}</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.authShell}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboard}>
        <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
          <View style={styles.brandLockup} accessibilityLabel="QML Foods">
            <Image source={require("./assets/brand/qml-logo-solid-green.png")} style={styles.brandImage} resizeMode="contain" />
            <Text style={styles.brandWordmark}>QML Foods</Text>
          </View>
          <View style={styles.formHeader}>
            <Pressable style={styles.backButton} onPress={() => onNavigate(currentScreen === "signin" ? "intro" : "signin")}>
              <Ionicons name="chevron-back" size={22} color={palette.charcoal} />
            </Pressable>
            <Text style={styles.formTitle}>
              {currentScreen === "signin" ? "Log in" : currentScreen === "signup" ? "Create Account" : "Forgot Password"}
            </Text>
            <View style={styles.backButtonPlaceholder} />
          </View>

          <View style={styles.formCard}>
            {notice ? <InlineNotice notice={notice} /> : null}
            {formError ? <InlineNotice notice={{ tone: "error", text: formError }} /> : null}

            {currentScreen === "signin" ? (
              <>
                <Text style={styles.formCopy}>Enter your email and password to securely access your account and manage your services.</Text>
                <LabeledInput icon="mail-outline" label="Email address" value={identifier} onChangeText={setIdentifier} placeholder="Email address" />
                <LabeledInput icon="lock-closed-outline" label="Password" value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry />
                <View style={styles.loginOptions}>
                  <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: rememberMe }} style={styles.rememberButton} onPress={() => setRememberMe((value) => !value)}>
                    <Ionicons name={rememberMe ? "checkbox" : "square-outline"} size={19} color={rememberMe ? palette.green : palette.muted} />
                    <Text style={styles.rememberText}>Remember me</Text>
                  </Pressable>
                  <Pressable style={styles.textLink} onPress={() => onNavigate("forgot")}>
                    <Text style={styles.textLinkText}>Forgot Password</Text>
                  </Pressable>
                </View>
                <SubmitButton
                  busy={busy}
                  label="Login"
                  onPress={() => submit(() => onSignIn(identifier.trim(), password, rememberMe))}
                />
                <Pressable style={styles.accountSwitch} onPress={() => onNavigate("signup")}>
                  <Text style={styles.accountSwitchText}>Don't have an account?</Text>
                  <Text style={styles.textLinkText}>Sign Up Here</Text>
                </Pressable>
                <SocialOptions onUnavailable={(provider) => setFormError(`${provider} sign-in isn't configured yet.`)} />
              </>
            ) : null}

            {currentScreen === "signup" ? (
              <>
                <Text style={styles.formCopy}>Create a new account to get started and enjoy seamless access to our features.</Text>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Account type</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Account type: ${signupRoles.find((item) => item.key === role)?.label || "Customer"}`}
                    accessibilityState={{ expanded: roleMenuOpen }}
                    style={styles.roleDropdown}
                    onPress={() => setRoleMenuOpen((open) => !open)}
                  >
                    <Text style={styles.roleDropdownLabel}>{signupRoles.find((item) => item.key === role)?.label || "Customer"}</Text>
                    <Ionicons name={roleMenuOpen ? "chevron-up" : "chevron-down"} size={19} color={palette.charcoal} />
                  </Pressable>
                  <Text style={styles.roleDescription}>{signupRoles.find((item) => item.key === role)?.text}</Text>
                  {roleMenuOpen ? (
                    <View style={styles.roleMenu}>
                      {signupRoles.map((item) => (
                        <Pressable
                          key={item.key}
                          accessibilityRole="button"
                          accessibilityState={{ selected: role === item.key }}
                          style={[styles.roleMenuOption, role === item.key ? styles.roleMenuOptionActive : null]}
                          onPress={() => {
                            setRole(item.key);
                            setRoleMenuOpen(false);
                          }}
                        >
                          <Text style={styles.roleMenuOptionTitle}>{item.label}</Text>
                          <Text style={styles.roleMenuOptionText}>{item.text}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
                <LabeledInput icon="person-outline" label="Full name" value={name} onChangeText={setName} placeholder="Ada Okonkwo" />
                <LabeledInput icon="mail-outline" label="Email address" value={identifier} onChangeText={setIdentifier} placeholder="Email address" />
                <LabeledInput icon="lock-closed-outline" label="Password" value={password} onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry />
                <LabeledInput icon="lock-closed-outline" label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm Password" secureTextEntry />
                <LabeledInput icon="gift-outline" label="Referral code" value={referralCode} onChangeText={setReferralCode} placeholder="Optional" />
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
                <Pressable style={styles.accountSwitch} onPress={() => onNavigate("signin")}>
                  <Text style={styles.accountSwitchText}>Already have an account?</Text>
                  <Text style={styles.textLinkText}>Sign in here</Text>
                </Pressable>
                <SocialOptions onUnavailable={(provider) => setFormError(`${provider} sign-up isn't configured yet.`)} />
              </>
            ) : null}

            {currentScreen === "forgot" ? (
              <>
                <Text style={styles.formCopy}>Enter your email address to receive a secure reset link and regain access to your account.</Text>
                <LabeledInput icon="mail-outline" label="Email address" value={identifier} onChangeText={setIdentifier} placeholder="Email address" />
                <SubmitButton
                  busy={busy}
                  label="Continue"
                  onPress={() => submit(() => onForgotPassword(identifier.trim()))}
                />
                <Pressable style={styles.accountSwitch} onPress={() => onNavigate("signin")}>
                  <Text style={styles.textLinkText}>Back to Log in</Text>
                </Pressable>
              </>
            ) : null}

            {currentScreen === "confirmation" ? (
              <>
                <View style={styles.confirmationIcon}>
                  <Ionicons name="mail-open-outline" size={27} color={palette.green} />
                </View>
                <Text style={styles.formCopy}>We sent an activation link to {pendingConfirmationEmail || "your email address"}. Open it to confirm your email, then come back here to sign in.</Text>
                <SubmitButton
                  busy={busy}
                  label="Resend activation email"
                  onPress={() => submit(() => onResendConfirmation(pendingConfirmationEmail))}
                />
                <Pressable style={styles.accountSwitch} onPress={() => onNavigate("signin")}>
                  <Text style={styles.textLinkText}>Go to sign in</Text>
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
  secureTextEntry,
  icon
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputFrame}>
        <Ionicons name={icon} size={18} color={palette.muted} />
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={placeholder}
          placeholderTextColor="#8B968F"
          secureTextEntry={secureTextEntry && !passwordVisible}
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
        />
        {secureTextEntry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={passwordVisible ? "Hide password" : "Show password"}
            onPress={() => setPasswordVisible((visible) => !visible)}
            hitSlop={8}
          >
            <Ionicons name={passwordVisible ? "eye-off-outline" : "eye-outline"} size={19} color={palette.muted} />
          </Pressable>
        ) : null}
      </View>
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

function SocialOptions({ onUnavailable }: { onUnavailable: (provider: string) => void }) {
  const providers = [
    { name: "Facebook", icon: "logo-facebook" as const },
    { name: "Google", icon: "logo-google" as const },
    { name: "Apple", icon: "logo-apple" as const }
  ];
  return (
    <View style={styles.socialSection}>
      <View style={styles.socialDivider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>Or Continue With Account</Text>
        <View style={styles.dividerLine} />
      </View>
      <View style={styles.socialButtons}>
        {providers.map((provider) => (
          <Pressable
            key={provider.name}
            accessibilityRole="button"
            accessibilityLabel={`Continue with ${provider.name}`}
            style={styles.socialButton}
            onPress={() => onUnavailable(provider.name)}
          >
            <Ionicons name={provider.icon} size={19} color={palette.charcoal} />
          </Pressable>
        ))}
      </View>
    </View>
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
    backgroundColor: "#F3F5F4",
    flex: 1,
    paddingHorizontal: 22
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
    backgroundColor: palette.white,
    flex: 1,
    gap: 14,
    justifyContent: "center"
  },
  bootImage: { width: 240, height: 240 },
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
  brandLockup: {
    alignItems: "center",
    flexDirection: "column",
    gap: 2,
    justifyContent: "center",
    marginBottom: 18
  },
  brandImage: {
    height: 68,
    width: 68
  },
  brandWordmark: {
    color: palette.green,
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
    backgroundColor: "#6CC51D"
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap"
  },
  dotButton: { width: 24, height: 36, alignItems: "center", justifyContent: "center" },
  introShell: { flex: 1, backgroundColor: palette.white },
  introContent: { flexGrow: 1, width: "100%", maxWidth: 480, alignSelf: "center", paddingBottom: 20 },
  introImage: { width: "100%" },
  introFooter: { marginTop: "auto", paddingHorizontal: 18, paddingTop: 12, gap: 16 },
  introActions: { flexDirection: "row", gap: 12, alignItems: "center" },
  introNext: { flex: 1, backgroundColor: "#65AD16" },
  skipButton: { width: 64, minHeight: 50, alignItems: "center", justifyContent: "center" },
  skipText: { color: "#497F10", fontWeight: "800" },
  formCard: {
    backgroundColor: palette.white,
    borderColor: "#E7ECE9",
    borderRadius: 12,
    borderWidth: 1,
    gap: 18,
    padding: 16
  },
  formContent: {
    alignSelf: "center",
    flexGrow: 1,
    justifyContent: "center",
    maxWidth: 464,
    paddingBottom: 26,
    paddingHorizontal: 12,
    width: "100%"
  },
  formCopy: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center"
  },
  confirmationIcon: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#EAF5ED",
    borderColor: "#CDE6D3",
    borderRadius: 30,
    borderWidth: 1,
    height: 58,
    justifyContent: "center",
    marginBottom: 4,
    width: 58
  },
  formHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16
  },
  formTitle: {
    color: palette.charcoal,
    fontSize: 26,
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
    color: palette.charcoal,
    fontSize: 15,
    minHeight: 46,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 0,
    flex: 1,
    flexShrink: 1
  },
  inputFrame: {
    alignItems: "center",
    backgroundColor: palette.white,
    borderColor: "#EEF1EF",
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 50,
    paddingHorizontal: 13
  },
  inputGroup: {
    gap: 7
  },
  inputLabel: {
    color: palette.charcoal,
    fontSize: 13,
    fontWeight: "800"
  },
  loginOptions: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -5
  },
  rememberButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    minHeight: 36
  },
  rememberText: {
    color: palette.muted,
    fontSize: 12
  },
  accountSwitch: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    justifyContent: "center",
    minHeight: 36
  },
  accountSwitchText: {
    color: palette.muted,
    fontSize: 12
  },
  socialSection: {
    gap: 11,
    paddingTop: 2
  },
  socialDivider: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10
  },
  dividerLine: {
    backgroundColor: palette.border,
    flex: 1,
    height: 1
  },
  dividerText: {
    color: palette.muted,
    fontSize: 11
  },
  socialButtons: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "center"
  },
  socialButton: {
    alignItems: "center",
    backgroundColor: palette.white,
    borderColor: palette.border,
    borderRadius: 24,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  introBody: {
    paddingHorizontal: 28,
    paddingTop: 22,
    alignItems: "center"
  },
  introCount: {
    color: palette.green,
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 14
  },
  introText: {
    color: "#737982",
    fontSize: 16,
    lineHeight: 23,
    marginTop: 10,
    textAlign: "center"
  },
  introTitle: {
    color: "#000000",
    fontSize: 27,
    fontWeight: "900",
    lineHeight: 32,
    textAlign: "center"
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
    borderRadius: 26,
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 14
  },
  primaryButtonText: {
    color: palette.white,
    fontWeight: "900"
  },
  roleDropdown: {
    alignItems: "center",
    backgroundColor: palette.offWhite,
    borderColor: palette.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: 12
  },
  roleDropdownLabel: {
    color: palette.charcoal,
    fontSize: 15,
    fontWeight: "900"
  },
  roleDescription: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 17
  },
  roleMenu: {
    backgroundColor: palette.white,
    borderColor: palette.border,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden"
  },
  roleMenuOption: {
    borderBottomColor: palette.border,
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  roleMenuOptionActive: {
    backgroundColor: palette.mint
  },
  roleMenuOptionText: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2
  },
  roleMenuOptionTitle: {
    color: palette.charcoal,
    fontSize: 14,
    fontWeight: "800"
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: palette.white,
    borderColor: palette.border,
    borderWidth: 1,
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
