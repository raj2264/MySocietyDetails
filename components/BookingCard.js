import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const BookingCard = ({ booking, onPress, onCancel }) => {
  const { theme } = useTheme();

  const getStatusColor = (status) => {
    const colors = {
      'pending': '#F9C74F',
      'confirmed': '#4361EE',
      'in_progress': '#4CC9F0',
      'completed': '#4CAF50',
      'cancelled': '#FF3B30',
      'rejected': '#FF3B30'
    };
    
    return colors[status] || '#A0A0A0';
  };

  const getStatusIcon = (status) => {
    const icons = {
      'pending': 'time-outline',
      'confirmed': 'checkmark-circle-outline',
      'in_progress': 'construct-outline',
      'completed': 'checkmark-done-outline',
      'cancelled': 'close-circle-outline',
      'rejected': 'close-circle-outline'
    };
    
    return icons[status] || 'help-circle-outline';
  };

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

  const statusColor = getStatusColor(booking.status);
  const statusIcon = getStatusIcon(booking.status);

  const canCancel = booking.status === 'pending' || booking.status === 'confirmed';

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.card }]}
      onPress={() => onPress(booking)}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.vendorInfo}>
          <Text style={[styles.vendorName, { color: theme.text }]} numberOfLines={1}>
            {booking.vendor?.name || 'Unknown Vendor'}
          </Text>
          <Text style={[styles.category, { color: theme.text + 'CC' }]}>
            {booking.vendor?.category || 'Service'}
          </Text>
        </View>
        <View style={[styles.statusTag, { backgroundColor: `${statusColor}20` }]}>
          <Ionicons name={statusIcon} size={16} color={statusColor} style={styles.statusIcon} />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {booking.status.replace('_', ' ').charAt(0).toUpperCase() + booking.status.replace('_', ' ').slice(1)}
          </Text>
        </View>
      </View>

      <Text style={[styles.description, { color: theme.text }]} numberOfLines={2}>
        {booking.service_description}
      </Text>

      <View style={styles.dateTimeContainer}>
        <View style={styles.dateTime}>
          <Ionicons name="calendar-outline" size={16} color={theme.text + '99'} />
          <Text style={[styles.dateTimeText, { color: theme.text + 'CC' }]}>
            {formatDate(booking.booking_date)}
          </Text>
        </View>
        <View style={styles.dateTime}>
          <Ionicons name="time-outline" size={16} color={theme.text + '99'} />
          <Text style={[styles.dateTimeText, { color: theme.text + 'CC' }]}>
            {formatTime(booking.booking_date)}
          </Text>
        </View>
      </View>

      {booking.notes && (
        <View style={styles.notesContainer}>
          <Text style={[styles.notesLabel, { color: theme.text + 'AA' }]}>Notes:</Text>
          <Text style={[styles.notes, { color: theme.text + 'CC' }]} numberOfLines={2}>
            {booking.notes}
          </Text>
        </View>
      )}

      {canCancel && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => onCancel(booking)}
          >
            <Ionicons name="close-circle" size={16} color="#FF3B30" />
            <Text style={styles.cancelText}>Cancel Booking</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  vendorInfo: {
    flex: 1,
    marginRight: 8,
  },
  vendorName: {
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
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  statusIcon: {
    marginRight: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  description: {
    fontSize: 16,
    marginBottom: 12,
  },
  dateTimeContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  dateTime: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  dateTimeText: {
    fontSize: 14,
    marginLeft: 6,
  },
  notesContainer: {
    marginBottom: 12,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  notes: {
    fontSize: 14,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    paddingTop: 12,
    marginTop: 8,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cancelText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
});

export default BookingCard; 