import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const VehicleCard = ({ vehicle, onEdit, onDelete, onSetPrimary }) => {
  const { theme } = useTheme();

  // Helper to get appropriate vehicle icon
  const getVehicleIcon = (type) => {
    switch (type) {
      case 'car':
        return 'car-outline';
      case 'bike':
        return 'bicycle-outline';
      default:
        return 'ellipsis-horizontal-circle-outline';
    }
  };

  // Helper to capitalize first letter
  const capitalize = (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.card }]}>
      <View style={styles.header}>
        <Ionicons name="car-outline" size={24} color={theme.primary} />
        <Text style={[styles.title, { color: theme.text }]}>
          {vehicle.make} {vehicle.model}
        </Text>
        {vehicle.is_primary && (
          <View style={[styles.badge, { backgroundColor: theme.primary }]}>
            <Text style={styles.badgeText}>Primary</Text>
          </View>
        )}
      </View>
      
      <View style={styles.details}>
        <Text style={[styles.detailText, { color: theme.text }]}>
          License: {vehicle.license_plate}
        </Text>
        {vehicle.color && (
          <Text style={[styles.detailText, { color: theme.text }]}>
            Color: {vehicle.color}
          </Text>
        )}
        {vehicle.parking_spot && (
          <Text style={[styles.detailText, { color: theme.text }]}>
            Parking: {vehicle.parking_spot}
          </Text>
        )}
      </View>
      
      <View style={styles.actions}>
        {!vehicle.is_primary && (
          <TouchableOpacity onPress={onSetPrimary} style={styles.actionButton}>
            <Text style={[styles.actionText, { color: theme.primary }]}>Set Primary</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onEdit} style={styles.actionButton}>
          <Text style={[styles.actionText, { color: theme.primary }]}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={styles.actionButton}>
          <Text style={[styles.actionText, { color: theme.error }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    marginBottom: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
  },
  details: {
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    marginBottom: 4,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  actionButton: {
    marginLeft: 12,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default VehicleCard; 