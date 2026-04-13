import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';
import { supabase } from '../lib/supabase';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import useNoStuckLoading from '../hooks/useNoStuckLoading';

const MyBookingsScreen = () => {
  const { theme, isDarkMode } = useTheme();
  const { residentData } = useAuth();
  const router = useRouter();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  useNoStuckLoading(loading, setLoading);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const hasLoadedOnceRef = useRef(false);
  const isFetchingRef = useRef(false);

  const loadBookings = async () => {
    if (!residentData?.id) {
      setBookings([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('service_bookings')
        .select(`
          *,
          service:services (
            id,
            name,
            category,
            description
          )
        `)
        .eq('resident_id', residentData.id)
        .order('booking_date', { ascending: false });
      
      if (error) throw error;
      
      setBookings(data || []);
    } catch (error) {
      console.error('Error loading bookings:', error);
      Alert.alert('Error', 'Failed to load bookings');
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (!residentData?.id || isFetchingRef.current) return;
      const shouldShowLoader = !hasLoadedOnceRef.current;
      if (shouldShowLoader) {
        setLoading(true);
      }
      isFetchingRef.current = true;
      Promise.resolve(loadBookings())
        .catch(error => console.error('Error in loadBookings:', error))
        .finally(() => {
          isFetchingRef.current = false;
          setLoading(false);
          hasLoadedOnceRef.current = true;
        });
    }, [residentData?.id])
  );

  const handleRefresh = () => {
    if (isFetchingRef.current) return;
    setRefreshing(true);
    isFetchingRef.current = true;
    Promise.resolve(loadBookings())
      .catch(error => console.error('Error during refresh:', error))
      .finally(() => {
        isFetchingRef.current = false;
        setRefreshing(false);
      });
  };

  const handleBookingPress = (booking) => {
    setSelectedBooking(booking);
    setShowDetailsModal(true);
  };

  const handleCancelBooking = (booking) => {
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const { error } = await supabase
                .from('service_bookings')
                .update({ status: 'cancelled' })
                .eq('id', booking.id);
              
              if (error) throw error;
              
              Alert.alert('Success', 'Booking cancelled successfully');
              await loadBookings();
            } catch (error) {
              console.error('Error cancelling booking:', error);
              Alert.alert('Error', 'Failed to cancel booking');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const renderBookingItem = ({ item }) => {
    const statusColor = getStatusColor(item.status);
    const statusIcon = getStatusIcon(item.status);

    return (
      <TouchableOpacity
        style={[styles.bookingCard, { backgroundColor: theme.card }]}
        onPress={() => handleBookingPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.serviceInfo}>
            <Text style={[styles.serviceName, { color: theme.text }]} numberOfLines={1}>
              {item.service?.name || 'Service'}
            </Text>
            <Text style={[styles.category, { color: theme.text + 'CC' }]}>
              {item.service?.category || 'Category'}
            </Text>
          </View>
          <View style={[styles.statusTag, { backgroundColor: `${statusColor}20` }]}>
            <Ionicons name={statusIcon} size={16} color={statusColor} style={styles.statusIcon} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
        </View>

        <Text style={[styles.description, { color: theme.text }]} numberOfLines={2}>
          {item.service_description || item.service?.description || 'No description available'}
        </Text>

        <View style={styles.dateTimeContainer}>
          <View style={styles.dateTime}>
            <Ionicons name="calendar-outline" size={16} color={theme.text + '99'} />
            <Text style={[styles.dateTimeText, { color: theme.text + 'CC' }]}>
              {formatDate(item.booking_date)}
            </Text>
          </View>
          <View style={styles.dateTime}>
            <Ionicons name="time-outline" size={16} color={theme.text + '99'} />
            <Text style={[styles.dateTimeText, { color: theme.text + 'CC' }]}>
              {formatTime(item.booking_date)}
            </Text>
          </View>
        </View>

        {(item.status === 'pending' || item.status === 'confirmed') && (
          <TouchableOpacity
            style={[styles.cancelButton, { backgroundColor: theme.error }]}
            onPress={() => handleCancelBooking(item)}
          >
            <Ionicons name="close-circle" size={18} color="#FFFFFF" />
            <Text style={styles.cancelButtonText}>Cancel Booking</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons 
        name="calendar-outline" 
        size={64} 
        color={theme.text + '50'} 
      />
      <Text style={[styles.emptyTitle, { color: theme.text }]}>
        No bookings found
      </Text>
      <Text style={[styles.emptyText, { color: theme.text + 'AA' }]}>
        You haven't booked any services yet. Go to the Services section to book a service.
      </Text>
      
      <TouchableOpacity
        style={[styles.emptyButton, { backgroundColor: theme.primary }]}
        onPress={() => router.push('/services')}
      >
        <Text style={styles.emptyButtonText}>Browse Services</Text>
      </TouchableOpacity>
    </View>
  );

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': '#F9C74F',
      'confirmed': '#4361EE',
      'completed': '#4CAF50',
      'cancelled': '#FF3B30'
    };
    
    return colors[status] || '#A0A0A0';
  };

  const getStatusIcon = (status) => {
    const icons = {
      'pending': 'time-outline',
      'confirmed': 'checkmark-circle-outline',
      'completed': 'checkmark-done-outline',
      'cancelled': 'close-circle-outline'
    };
    
    return icons[status] || 'help-circle-outline';
  };

  return (
    <AppLayout title="My Bookings">
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <FlatList
            data={bookings}
            renderItem={renderBookingItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={renderEmptyList}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[theme.primary]}
                tintColor={theme.primary}
              />
            }
          />
        )}
        
        <Modal
          visible={showDetailsModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowDetailsModal(false)}
        >
          <View style={[styles.modalOverlay, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.02)' }]}>
            <View style={[styles.modalContainer, { backgroundColor: theme.card }]}>
              {selectedBooking && (
                <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                    <Text style={[styles.modalTitle, { color: theme.text }]}>
                      Booking Details
                    </Text>
                    <TouchableOpacity
                      onPress={() => setShowDetailsModal(false)}
                      style={styles.closeButton}
                    >
                      <Ionicons name="close" size={24} color={theme.text} />
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.detailSection}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                      Service Information
                    </Text>
                    <Text style={[styles.serviceName, { color: theme.text }]}>
                      {selectedBooking.service?.name || 'Service'}
                    </Text>
                    <Text style={[styles.category, { color: theme.text + 'CC' }]}>
                      {selectedBooking.service?.category || 'Category'}
                    </Text>
                  </View>
                  
                  <View style={styles.detailSection}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                      Booking Information
                    </Text>
                    <View style={styles.infoRow}>
                      <Ionicons name="calendar-outline" size={16} color={theme.text + '99'} />
                      <Text style={[styles.infoText, { color: theme.text + 'CC' }]}>
                        {formatDate(selectedBooking.booking_date)}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Ionicons name="time-outline" size={16} color={theme.text + '99'} />
                      <Text style={[styles.infoText, { color: theme.text + 'CC' }]}>
                        {formatTime(selectedBooking.booking_date)}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Ionicons name="information-circle-outline" size={16} color={theme.text + '99'} />
                      <Text style={[styles.infoText, { color: theme.text + 'CC' }]}>
                        Status: 
                        <Text style={{ 
                          color: getStatusColor(selectedBooking.status),
                          fontWeight: '600'
                        }}>
                          {' ' + selectedBooking.status.charAt(0).toUpperCase() + selectedBooking.status.slice(1)}
                        </Text>
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.detailSection}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                      Service Description
                    </Text>
                    <Text style={[styles.description, { color: theme.text }]}>
                      {selectedBooking.service_description || selectedBooking.service?.description || 'No description available'}
                    </Text>
                  </View>
                  
                  {selectedBooking.notes && (
                    <View style={styles.detailSection}>
                      <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        Additional Notes
                      </Text>
                      <Text style={[styles.description, { color: theme.text }]}>
                        {selectedBooking.notes}
                      </Text>
                    </View>
                  )}
                  
                  {(selectedBooking.status === 'pending' || selectedBooking.status === 'confirmed') && (
                    <TouchableOpacity
                      style={[styles.cancelButton, { backgroundColor: theme.error }]}
                      onPress={() => {
                        setShowDetailsModal(false);
                        handleCancelBooking(selectedBooking);
                      }}
                    >
                      <Ionicons name="close-circle" size={18} color="#FFFFFF" />
                      <Text style={styles.cancelButtonText}>Cancel Booking</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </AppLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContainer: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookingCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  serviceInfo: {
    flex: 1,
    marginRight: 12,
  },
  serviceName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  category: {
    fontSize: 14,
  },
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusIcon: {
    marginRight: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  description: {
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  dateTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dateTime: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateTimeText: {
    marginLeft: 4,
    fontSize: 14,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  emptyButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 16,
    maxHeight: '80%',
  },
  modalContent: {
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  detailSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    marginLeft: 8,
    fontSize: 14,
  },
});

export default MyBookingsScreen; 