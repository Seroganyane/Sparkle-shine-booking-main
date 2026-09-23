import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { Calendar, Clock, MapPin } from "lucide-react-native";

const DashboardScreen = () => {
  const [bookings] = useState([
    {
      id: "1",
      date: "2026-06-20",
      time: "10:00 AM",
      service: "Premium Wash",
      status: "confirmed",
    },
    {
      id: "2",
      date: "2026-06-25",
      time: "2:00 PM",
      service: "Standard Wash",
      status: "pending",
    },
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "#10b981";
      case "pending":
        return "#f59e0b";
      case "cancelled":
        return "#ef4444";
      default:
        return "#64748b";
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Bookings</Text>
        <Text style={styles.subtitle}>Manage your car wash bookings</Text>
      </View>

      {bookings.length > 0 ? (
        <View style={styles.bookingsList}>
          {bookings.map((booking) => (
            <View key={booking.id} style={styles.bookingCard}>
              <View style={styles.bookingHeader}>
                <Text style={styles.bookingService}>{booking.service}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(booking.status) + "20" },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      { color: getStatusColor(booking.status) },
                    ]}
                  >
                    {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                  </Text>
                </View>
              </View>

              <View style={styles.bookingDetails}>
                <View style={styles.detailRow}>
                  <Calendar size={18} color="#0ea5e9" />
                  <Text style={styles.detailText}>{booking.date}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Clock size={18} color="#0ea5e9" />
                  <Text style={styles.detailText}>{booking.time}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() =>
                  Alert.alert("Cancel Booking", "Are you sure you want to cancel this booking?")
                }
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No bookings yet</Text>
          <TouchableOpacity style={styles.bookButton}>
            <Text style={styles.bookButtonText}>Book Now</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.statsSection}>
        <Text style={styles.statsTitle}>Your Stats</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>12</Text>
            <Text style={styles.statLabel}>Total Washes</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>8</Text>
            <Text style={styles.statLabel}>Reward Points</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>2</Text>
            <Text style={styles.statLabel}>Free Washes</Text>
          </View>
        </View>
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
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ffffff",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 4,
  },
  bookingsList: {
    paddingHorizontal: 20,
    gap: 12,
  },
  bookingCard: {
    backgroundColor: "#1e293b",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  bookingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  bookingService: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  bookingDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailText: {
    color: "#64748b",
    fontSize: 14,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: "#ef4444",
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#ef4444",
    fontWeight: "600",
  },
  emptyState: {
    paddingHorizontal: 20,
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyStateText: {
    color: "#64748b",
    fontSize: 16,
    marginBottom: 20,
  },
  bookButton: {
    backgroundColor: "#0ea5e9",
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 6,
  },
  bookButtonText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  statsSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#1e293b",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#0ea5e9",
  },
  statLabel: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 4,
  },
});

export default DashboardScreen;
