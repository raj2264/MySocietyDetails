import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import AppLayout from '../components/AppLayout';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

export default function EVChargingScreen() {
  const { theme, isDarkMode } = useTheme();
  const { user, residentData } = useAuth();
  const [spots, setSpots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchSpots = async () => {
    try {
      if (!residentData?.society_id) {
        throw new Error('No society found for this resident');
      }

      const { data, error } = await supabase
        .from('ev_charging_spots')
        .select('*')
        .eq('society_id', residentData.society_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSpots(data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching charging spots:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSpots();
  }, [residentData?.society_id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSpots();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'available':
        return { bg: isDarkMode ? '#1a472a' : '#dcfce7', text: isDarkMode ? '#4ade80' : '#166534' };
      case 'in_use':
        return { bg: isDarkMode ? '#1e3a8a' : '#dbeafe', text: isDarkMode ? '#60a5fa' : '#1e40af' };
      case 'maintenance':
        return { bg: isDarkMode ? '#7f1d1d' : '#fee2e2', text: isDarkMode ? '#f87171' : '#991b1b' };
      default:
        return { bg: isDarkMode ? '#374151' : '#f3f4f6', text: isDarkMode ? '#9ca3af' : '#4b5563' };
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'available':
        return 'Available';
      case 'in_use':
        return 'In Use';
      case 'maintenance':
        return 'Maintenance';
      default:
        return 'Unknown';
    }
  };

  const renderContent = () => {
    if (loading && !refreshing) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.text }]}>Loading charging spots...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.error} />
          <Text style={[styles.errorText, { color: theme.text }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.primary }]}
            onPress={fetchSpots}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
      >
        <View style={styles.statsContainer}>
          <Card style={styles.statsCard}>
            <View style={styles.statsContent}>
              <Text style={[styles.statsNumber, { color: theme.text }]}>
                {spots.length}
              </Text>
              <Text style={[styles.statsLabel, { color: theme.textSecondary }]}>
                Total Spots
              </Text>
            </View>
          </Card>
          <Card style={styles.statsCard}>
            <View style={styles.statsContent}>
              <Text style={[styles.statsNumber, { color: '#4ade80' }]}>
                {spots.filter(spot => spot.status === 'available').length}
              </Text>
              <Text style={[styles.statsLabel, { color: theme.textSecondary }]}>
                Available
              </Text>
            </View>
          </Card>
          <Card style={styles.statsCard}>
            <View style={styles.statsContent}>
              <Text style={[styles.statsNumber, { color: '#60a5fa' }]}>
                {spots.filter(spot => spot.status === 'in_use').length}
              </Text>
              <Text style={[styles.statsLabel, { color: theme.textSecondary }]}>
                In Use
              </Text>
            </View>
          </Card>
        </View>

        <View style={styles.spotsContainer}>
          {spots.map((spot) => {
            const statusColors = getStatusColor(spot.status);
            return (
              <Card key={spot.id} style={styles.spotCard}>
                <View style={styles.spotHeader}>
                  <View style={styles.spotTitleContainer}>
                    <Text style={[styles.spotTitle, { color: theme.text }]}>
                      {spot.location_name}
                    </Text>
                    <Badge
                      style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}
                      textStyle={{ color: statusColors.text }}
                    >
                      {getStatusText(spot.status)}
                    </Badge>
                  </View>
                </View>
                <View style={styles.spotDetails}>
                  <View style={styles.detailRow}>
                    <Ionicons name="flash-outline" size={20} color={theme.textSecondary} />
                    <Text style={[styles.detailText, { color: theme.text }]}>
                      {spot.charger_type} • {spot.capacity_kw}kW
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="git-network-outline" size={20} color={theme.textSecondary} />
                    <Text style={[styles.detailText, { color: theme.text }]}>
                      {spot.number_of_ports} {spot.number_of_ports === 1 ? 'Port' : 'Ports'}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="cash-outline" size={20} color={theme.textSecondary} />
                    <Text style={[styles.detailText, { color: theme.text }]}>
                      ₹{spot.hourly_rate}/hour
                    </Text>
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  return (
    <AppLayout title="EV Charging">
      {renderContent()}
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
  },
  statsCard: {
    flex: 1,
    padding: 16,
  },
  statsContent: {
    alignItems: 'center',
  },
  statsNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statsLabel: {
    fontSize: 14,
  },
  spotsContainer: {
    gap: 16,
  },
  spotCard: {
    padding: 16,
    marginBottom: 12,
  },
  spotHeader: {
    marginBottom: 12,
  },
  spotTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  spotTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  spotDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 15,
  },
}); 