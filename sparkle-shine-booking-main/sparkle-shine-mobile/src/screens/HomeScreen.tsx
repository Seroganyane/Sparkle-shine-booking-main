import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from "react-native";
import { Sparkles, Calendar, Zap, Gift } from "lucide-react-native";

const HomeScreen = ({ navigation }: any) => {
  const features = [
    {
      icon: Calendar,
      title: "Easy Booking",
      desc: "Book your car wash in seconds",
    },
    {
      icon: Zap,
      title: "Quick Service",
      desc: "Fast and efficient washing",
    },
    { icon: Gift, title: "Rewards", desc: "Earn points on every wash" },
    { icon: Sparkles, title: "Premium Products", desc: "Shop quality car care items" },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AquaLux</Text>
        <Text style={styles.headerSubtitle}>Professional Car Wash</Text>
      </View>

      <View style={styles.heroSection}>
        <Text style={styles.heroText}>Keep Your Car Sparkling Clean</Text>
        <TouchableOpacity
          style={styles.bookButton}
          onPress={() => navigation.navigate("Dashboard")}
        >
          <Text style={styles.bookButtonText}>Book Now</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.featuresSection}>
        <Text style={styles.sectionTitle}>Why Choose AquaLux?</Text>
        <View style={styles.featuresGrid}>
          {features.map((feature, idx) => (
            <View key={idx} style={styles.featureCard}>
              <feature.icon size={32} color="#0ea5e9" />
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureDesc}>{feature.desc}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate("Shop")}
        >
          <Text style={styles.actionTitle}>Shop Products</Text>
          <Text style={styles.actionDesc}>Browse our premium car care products</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate("Dashboard")}
        >
          <Text style={styles.actionTitle}>Your Bookings</Text>
          <Text style={styles.actionDesc}>View and manage your reservations</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#0ea5e9",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 4,
  },
  heroSection: {
    margin: 20,
    padding: 24,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    alignItems: "center",
  },
  heroText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 16,
  },
  bookButton: {
    backgroundColor: "#0ea5e9",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  bookButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 16,
  },
  featuresSection: {
    padding: 20,
  },
  featuresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  featureCard: {
    width: "48%",
    padding: 12,
    backgroundColor: "#1e293b",
    borderRadius: 8,
    alignItems: "center",
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
    marginTop: 8,
  },
  featureDesc: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
    marginTop: 4,
  },
  quickActions: {
    paddingHorizontal: 20,
    paddingBottom: 30,
    gap: 12,
  },
  actionCard: {
    backgroundColor: "#1e293b",
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#0ea5e9",
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 4,
  },
  actionDesc: {
    fontSize: 13,
    color: "#64748b",
  },
});

export default HomeScreen;
