import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { LogOut, User, Mail, Award } from "lucide-react-native";
import { useAuth } from "../context/AuthContext";

const ProfileScreen = () => {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", onPress: () => {} },
      {
        text: "Sign Out",
        onPress: async () => {
          try {
            await signOut();
          } catch (error) {
            Alert.alert("Error", "Failed to sign out");
          }
        },
        style: "destructive",
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <User size={40} color="#0ea5e9" />
        </View>
        <Text style={styles.name}>
          {user?.user_metadata?.full_name || "User"}
        </Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      {/* Profile Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Information</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <User size={20} color="#0ea5e9" />
            <View>
              <Text style={styles.infoLabel}>Full Name</Text>
              <Text style={styles.infoValue}>
                {user?.user_metadata?.full_name || "Not set"}
              </Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Mail size={20} color="#0ea5e9" />
            <View>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{user?.email}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Rewards Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Rewards</Text>
        <View style={styles.rewardsGrid}>
          <View style={styles.rewardCard}>
            <Award size={28} color="#f59e0b" />
            <Text style={styles.rewardValue}>8</Text>
            <Text style={styles.rewardLabel}>Points</Text>
          </View>
          <View style={styles.rewardCard}>
            <Award size={28} color="#10b981" />
            <Text style={styles.rewardValue}>2</Text>
            <Text style={styles.rewardLabel}>Free Washes</Text>
          </View>
        </View>
      </View>

      {/* Settings Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <TouchableOpacity style={styles.settingItem}>
          <Text style={styles.settingLabel}>Notifications</Text>
          <Text style={styles.settingValue}>Enabled</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingItem}>
          <Text style={styles.settingLabel}>Dark Mode</Text>
          <Text style={styles.settingValue}>On</Text>
        </TouchableOpacity>
      </View>

      {/* Sign Out Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
        >
          <LogOut size={20} color="#ef4444" />
          <Text style={styles.signOutText}>Sign Out</Text>
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
  profileHeader: {
    alignItems: "center",
    paddingVertical: 30,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#1e293b",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  name: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#ffffff",
  },
  email: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: "#1e293b",
    borderRadius: 8,
    padding: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  infoLabel: {
    fontSize: 12,
    color: "#64748b",
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
    marginTop: 2,
  },
  rewardsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  rewardCard: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  rewardValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#0ea5e9",
    marginTop: 8,
  },
  rewardLabel: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 4,
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  settingValue: {
    fontSize: 14,
    color: "#0ea5e9",
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 30,
    paddingTop: 20,
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#ef4444",
    paddingVertical: 12,
    borderRadius: 8,
  },
  signOutText: {
    color: "#ef4444",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default ProfileScreen;
