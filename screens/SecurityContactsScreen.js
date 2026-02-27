import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  RefreshControl,
  Platform,
  Alert
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather, FontAwesome } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getSecurityContacts, getContactTypeLabel } from '../lib/securityContacts';
import { useFocusEffect } from '@react-navigation/native';
import AppLayout from '../components/AppLayout';

const SecurityContactsScreen = () => {
  const { user, residentData } = useAuth();
  const { theme } = useTheme();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadContacts = async () => {
    if (!residentData?.society_id) {
      console.log("No society ID available:", residentData);
      setLoading(false);
      setError('Unable to load contacts. Society information not available.');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      console.log("Loading contacts for society:", residentData.society_id);
      const { data, error } = await getSecurityContacts(residentData.society_id);
      
      if (error) {
        console.error("Error from API:", error);
        throw error;
      }
      
      console.log("Contacts loaded:", data ? data.length : 0);
      
      if (data) {
        // Group contacts by type
        const groupedContacts = data.reduce((acc, contact) => {
          const type = contact.contact_type;
          if (!acc[type]) {
            acc[type] = [];
          }
          acc[type].push(contact);
          return acc;
        }, {});
        
        // Convert to array format for FlatList
        const contactsArray = Object.entries(groupedContacts).map(([type, contacts]) => ({
          type,
          data: contacts,
        }));
        
        setContacts(contactsArray);
      } else {
        setContacts([]);
      }
    } catch (err) {
      console.error('Error loading emergency contacts:', err);
      setError('Failed to load emergency contacts. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load contacts when screen is focused
  useFocusEffect(
    useCallback(() => {
      loadContacts();
    }, [residentData?.society_id])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadContacts();
  };

  const handleCall = (phoneNumber) => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const handleEmail = (email) => {
    Linking.openURL(`mailto:${email}`);
  };

  const renderContactItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.contactCard, { backgroundColor: theme.card }]}
      onPress={() => handleCall(item.phone)}
    >
      <View style={[styles.contactHeader, { borderBottomColor: theme.border }]}>
        <View style={styles.contactInfo}>
          <Text style={[styles.contactName, { color: theme.text }]}>{item.name}</Text>
          {item.role && <Text style={[styles.contactRole, { color: theme.textSecondary }]}>{item.role}</Text>}
        </View>
        <TouchableOpacity
          style={styles.callButton}
          onPress={() => handleCall(item.phone)}
        >
          <Feather name="phone" size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.contactDetails}>
        <View style={styles.detailRow}>
          <FontAwesome name="phone" size={16} color={theme.textSecondary} style={styles.icon} />
          <Text style={[styles.detailText, { color: theme.text }]}>{item.phone}</Text>
        </View>
        
        {item.email && (
          <TouchableOpacity 
            style={styles.detailRow} 
            onPress={() => handleEmail(item.email)}
          >
            <MaterialCommunityIcons name="email-outline" size={16} color={theme.textSecondary} style={styles.icon} />
            <Text style={[styles.detailText, styles.emailText, { color: theme.primary }]}>{item.email}</Text>
          </TouchableOpacity>
        )}
        
        {item.address && (
          <View style={styles.detailRow}>
            <Feather name="map-pin" size={16} color={theme.textSecondary} style={styles.icon} />
            <Text style={[styles.detailText, { color: theme.text }]}>{item.address}</Text>
          </View>
        )}
        
        {item.description && (
          <Text style={[styles.description, { color: theme.textSecondary }]}>{item.description}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderContactSection = ({ item }) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{getContactTypeLabel(item.type)}</Text>
      </View>
      <FlatList
        data={item.data}
        renderItem={renderContactItem}
        keyExtractor={item => item.id}
        scrollEnabled={false}
      />
    </View>
  );

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="contacts-outline" size={60} color={theme.textSecondary} />
      <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No emergency contacts available</Text>
    </View>
  );

  const renderContent = () => {
    if (loading && !refreshing) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading contacts...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={40} color="#ef4444" />
          <Text style={[styles.errorText, { color: theme.textSecondary }]}>{error}</Text>
          <TouchableOpacity style={[styles.retryButton, { backgroundColor: theme.primary }]} onPress={loadContacts}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (contacts.length === 0) {
      return renderEmptyList();
    }

    return (
      <FlatList
        data={contacts}
        renderItem={renderContactSection}
        keyExtractor={item => item.type}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      />
    );
  };

  return (
    <AppLayout title="Emergency Contacts">
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {renderContent()}
      </View>
    </AppLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  listContainer: {
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  contactCard: {
    borderRadius: 12,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  contactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
  },
  contactRole: {
    fontSize: 14,
    marginTop: 2,
  },
  callButton: {
    backgroundColor: '#4f46e5',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactDetails: {
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  icon: {
    marginRight: 8,
  },
  detailText: {
    fontSize: 14,
    flex: 1,
  },
  emailText: {
    color: '#4f46e5',
  },
  description: {
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});

export default SecurityContactsScreen; 