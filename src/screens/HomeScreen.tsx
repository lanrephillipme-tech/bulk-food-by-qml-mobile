import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { activePlan, categories, packages, palette, roles, user } from "../data";

const money = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0
});

export function HomeScreen() {
  const progress = activePlan.paid / activePlan.total;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{user.city}, {user.country}</Text>
            <Text style={styles.title}>Good morning, {user.name}</Text>
          </View>
          <Pressable style={styles.iconButton}>
            <Ionicons name="notifications-outline" size={22} color={palette.charcoal} />
          </Pressable>
        </View>

        <View style={styles.scoreCard}>
          <View>
            <Text style={styles.scoreLabel}>QML Score</Text>
            <Text style={styles.score}>{user.qmlScore}</Text>
            <Text style={styles.scoreCopy}>Eligible for up to {money.format(user.creditLimit)}</Text>
          </View>
          <View style={styles.wallet}>
            <Text style={styles.walletLabel}>Wallet</Text>
            <Text style={styles.walletValue}>{money.format(user.walletBalance)}</Text>
          </View>
        </View>

        <View style={styles.planCard}>
          <View style={styles.planHeader}>
            <View>
              <Text style={styles.cardLabel}>Active food plan</Text>
              <Text style={styles.planTitle}>{activePlan.title}</Text>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusText}>{activePlan.status}</Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <View style={styles.planMeta}>
            <Text>{money.format(activePlan.paid)} paid</Text>
            <Text>{money.format(activePlan.total - activePlan.paid)} balance</Text>
          </View>
          <View style={styles.actions}>
            <Pressable style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Pay Now</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Request Delivery</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.quickActions}>
          <QuickAction icon="basket-outline" label="Shop" />
          <QuickAction icon="account-group-outline" label="Group Buy" />
          <QuickAction icon="wallet-outline" label="Start Plan" />
          <QuickAction icon="map-outline" label="Track" />
        </View>

        <SectionTitle title="Switch or add role" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roleList}>
          {roles.map((role) => (
            <Pressable style={styles.roleCard} key={role.key}>
              <Text style={styles.roleStatus}>{role.status}</Text>
              <Text style={styles.roleTitle}>{role.label}</Text>
              <Text style={styles.roleText}>{role.text}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <SectionTitle title="Food categories" />
        <View style={styles.categories}>
          {categories.map((category) => (
            <Pressable style={styles.category} key={category}>
              <Text style={styles.categoryText}>{category}</Text>
            </Pressable>
          ))}
        </View>

        <SectionTitle title="Recommended packages" />
        <View style={styles.packageList}>
          {packages.map((item) => (
            <Pressable style={styles.packageCard} key={item.id}>
              <ImageBackground source={{ uri: item.image }} style={styles.packageImage} imageStyle={styles.packageImageStyle}>
                <View style={styles.packageTag}>
                  <Text style={styles.packageTagText}>{item.tag}</Text>
                </View>
              </ImageBackground>
              <View style={styles.packageBody}>
                <Text style={styles.packageTitle}>{item.title}</Text>
                <Text style={styles.packageSubtitle}>{item.subtitle}</Text>
                <Text style={styles.packagePrice}>{money.format(item.price)}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickAction({ icon, label }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string }) {
  return (
    <Pressable style={styles.quickAction}>
      <MaterialCommunityIcons name={icon} size={22} color={palette.green} />
      <Text style={styles.quickActionText}>{label}</Text>
    </Pressable>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: palette.offWhite,
    flex: 1
  },
  content: {
    padding: 18,
    paddingBottom: 34
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18
  },
  eyebrow: {
    color: palette.muted,
    fontSize: 13,
    marginBottom: 4
  },
  title: {
    color: palette.charcoal,
    fontSize: 25,
    fontWeight: "800"
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: palette.white,
    borderRadius: 8,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  scoreCard: {
    backgroundColor: palette.charcoal,
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
    padding: 18
  },
  scoreLabel: {
    color: "#BFD0C5",
    fontSize: 13
  },
  score: {
    color: palette.white,
    fontSize: 42,
    fontWeight: "900",
    lineHeight: 48
  },
  scoreCopy: {
    color: "#DDE7E0",
    fontSize: 13
  },
  wallet: {
    alignItems: "flex-end",
    justifyContent: "center"
  },
  walletLabel: {
    color: "#BFD0C5",
    fontSize: 13
  },
  walletValue: {
    color: palette.gold,
    fontSize: 17,
    fontWeight: "800",
    marginTop: 4
  },
  planCard: {
    backgroundColor: palette.white,
    borderColor: palette.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 16
  },
  planHeader: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between"
  },
  cardLabel: {
    color: palette.muted,
    fontSize: 13,
    marginBottom: 4
  },
  planTitle: {
    color: palette.charcoal,
    fontSize: 18,
    fontWeight: "800"
  },
  statusPill: {
    alignSelf: "flex-start",
    backgroundColor: palette.mint,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  statusText: {
    color: palette.green,
    fontSize: 12,
    fontWeight: "800"
  },
  progressTrack: {
    backgroundColor: "#EDF0EB",
    borderRadius: 999,
    height: 10,
    marginTop: 18,
    overflow: "hidden"
  },
  progressFill: {
    backgroundColor: palette.gold,
    height: "100%"
  },
  planMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: palette.green,
    borderRadius: 8,
    flex: 1,
    paddingVertical: 13
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: palette.mint,
    borderRadius: 8,
    flex: 1,
    paddingVertical: 13
  },
  primaryButtonText: {
    color: palette.white,
    fontWeight: "800"
  },
  secondaryButtonText: {
    color: palette.green,
    fontWeight: "800"
  },
  quickActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14
  },
  quickAction: {
    alignItems: "center",
    backgroundColor: palette.white,
    borderColor: palette.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    paddingVertical: 12
  },
  quickActionText: {
    color: palette.charcoal,
    fontSize: 12,
    fontWeight: "700"
  },
  sectionTitle: {
    color: palette.charcoal,
    fontSize: 19,
    fontWeight: "900",
    marginBottom: 10,
    marginTop: 22
  },
  roleList: {
    gap: 10,
    paddingRight: 18
  },
  roleCard: {
    backgroundColor: palette.white,
    borderColor: palette.border,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 128,
    padding: 14,
    width: 178
  },
  roleStatus: {
    alignSelf: "flex-start",
    backgroundColor: "#FFF3D1",
    borderRadius: 999,
    color: "#8B6100",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 12,
    paddingHorizontal: 9,
    paddingVertical: 5
  },
  roleTitle: {
    color: palette.charcoal,
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 6
  },
  roleText: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18
  },
  categories: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  category: {
    backgroundColor: palette.white,
    borderColor: palette.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  categoryText: {
    color: palette.charcoal,
    fontWeight: "700"
  },
  packageList: {
    gap: 12
  },
  packageCard: {
    backgroundColor: palette.white,
    borderColor: palette.border,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden"
  },
  packageImage: {
    height: 132,
    justifyContent: "flex-start",
    padding: 10
  },
  packageImageStyle: {
    backgroundColor: "#D9D9D9"
  },
  packageTag: {
    alignSelf: "flex-start",
    backgroundColor: palette.white,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  packageTagText: {
    color: palette.green,
    fontSize: 12,
    fontWeight: "800"
  },
  packageBody: {
    padding: 14
  },
  packageTitle: {
    color: palette.charcoal,
    fontSize: 18,
    fontWeight: "900"
  },
  packageSubtitle: {
    color: palette.muted,
    marginTop: 4
  },
  packagePrice: {
    color: palette.green,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 10
  }
});
