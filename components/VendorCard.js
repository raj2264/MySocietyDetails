import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const VendorCard = ({ vendor, onPress, onBook }) => {
  const { theme } = useTheme();

  const handleCall = () => {
    if (vendor.phone) {
      const phoneUrl = Platform.OS === 'android' 
        ? `tel:${vendor.phone}` 
        : `telprompt:${vendor.phone}`;
      Linking.openURL(phoneUrl).catch(err => {
        console.error('Error opening phone app:', err);
      });
    }
  };

  const getCategoryColor = (category) => {
    const colors = {
      'Plumber': '#4361EE',
      'Electrician': '#F72585',
      'Carpenter': '#8B5E34',
      'Painter': '#3A86FF',
      'Cleaning': '#06D6A0',
      'Security': '#FF6B6B',
      'Gardening': '#43AA8B',
      'Pest Control': '#F94144',
      'Laundry': '#277DA1',
      'Food Delivery': '#F9C74F',
      'Grocery Delivery': '#90BE6D',
      'Maintenance': '#577590',
      'Other': '#9D4EDD'
    };
    
    return colors[category] || '#4361EE';
  };

  const categoryColor = getCategoryColor(vendor.category);

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.card }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.nameContainer}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {vendor.name}
          </Text>
          {vendor.is_available ? (
            <View style={styles.availableTag}>
              <Text style={styles.availableText}>Available</Text>
            </View>
          ) : (
            <View style={[styles.availableTag, styles.unavailableTag]}>
              <Text style={[styles.availableText, styles.unavailableText]}>Unavailable</Text>
            </View>
          )}
        </View>
        <View style={[styles.categoryTag, { backgroundColor: `${categoryColor}20` }]}>
          <Text style={[styles.categoryText, { color: categoryColor }]}>
            {vendor.category}
          </Text>
        </View>
      </View>
      
      {vendor.description && (
        <Text 
          style={[styles.description, { color: theme.text + 'CC' }]} 
          numberOfLines={2}
        >
          {vendor.description}
        </Text>
      )}
      
      <View style={styles.infoContainer}>
        {vendor.contact_person && (
          <View style={styles.infoItem}>
            <Ionicons name="person-outline" size={16} color={theme.text + '99'} />
            <Text style={[styles.infoText, { color: theme.text + 'CC' }]}>
              {vendor.contact_person}
            </Text>
          </View>
        )}
        
        {vendor.phone && (
          <View style={styles.infoItem}>
            <Ionicons name="call-outline" size={16} color={theme.text + '99'} />
            <Text style={[styles.infoText, { color: theme.text + 'CC' }]}>
              {vendor.phone}
            </Text>
          </View>
        )}
        
        {vendor.service_hours && (
          <View style={styles.infoItem}>
            <Ionicons name="time-outline" size={16} color={theme.text + '99'} />
            <Text style={[styles.infoText, { color: theme.text + 'CC' }]}>
              {vendor.service_hours}
            </Text>
          </View>
        )}
      </View>
      
      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.callButton]}
          onPress={handleCall}
        >
          <Ionicons name="call" size={18} color="#fff" />
          <Text style={styles.actionButtonText}>Call</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.actionButton, 
            styles.bookButton,
            !vendor.is_available && styles.disabledButton
          ]}
          onPress={() => {
            console.log('Book Service button pressed for vendor:', vendor.name);
            if (vendor.is_available) {
              onBook(vendor);
            } else {
              console.log('Vendor is not available for booking');
            }
          }}
          disabled={!vendor.is_available}
        >
          <Ionicons name="calendar" size={18} color="#fff" />
          <Text style={styles.actionButtonText}>Book Service</Text>
        </TouchableOpacity>
      </View>
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
  nameContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
  availableTag: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  availableText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  unavailableTag: {
    backgroundColor: '#FF3B30',
  },
  unavailableText: {
    color: '#FFFFFF',
  },
  categoryTag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
  },
  description: {
    fontSize: 14,
    marginBottom: 12,
  },
  infoContainer: {
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 14,
    marginLeft: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  callButton: {
    backgroundColor: '#4CAF50',
    marginRight: 8,
    flex: 1,
  },
  bookButton: {
    backgroundColor: '#4361EE',
    flex: 2,
  },
  disabledButton: {
    backgroundColor: '#A0A0A0',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 6,
  },
});

export default VendorCard; 