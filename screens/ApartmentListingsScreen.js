import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import AppLayout from '../components/AppLayout';
import ListingForm from '../components/ListingForm';

const ApartmentListingsScreen = () => {
  const { user } = useAuth();
  const { isDarkMode, theme } = useTheme();
  const navigation = useNavigation();
  
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingListing, setEditingListing] = useState(null);
  const [resident, setResident] = useState(null);
  
  // Fetch resident data
  const fetchResidentData = async () => {
    try {
      const { data, error } = await supabase
        .from('residents')
        .select('id, name, email, unit_number, society_id')
        .eq('user_id', user.id)
        .single();
        
      if (error) throw error;
      setResident(data);
    } catch (error) {
      console.error('Error fetching resident data:', error);
      Alert.alert('Error', 'Failed to fetch your resident information');
    }
  };
  
  // Fetch apartment listings
  const fetchListings = async () => {
    try {
      setLoading(true);
      
      if (!resident) return;
      
      const { data, error } = await supabase
        .from('apartment_listings')
        .select('*')
        .eq('resident_id', resident.id)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setListings(data || []);
    } catch (error) {
      console.error('Error fetching apartment listings:', error);
      Alert.alert('Error', 'Failed to fetch your apartment listings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  // Handle refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchListings();
  }, [resident]);
  
  // Handle form submission
  const handleSubmit = async (formData) => {
    try {
      if (!resident) {
        Alert.alert('Error', 'Resident information not available');
        return;
      }
      
      setLoading(true);
      
      if (editingListing) {
        // Update existing listing
        const { error } = await supabase
          .from('apartment_listings')
          .update({
            apartment_number: formData.apartmentNumber,
            listing_type: formData.listingType,
            title: formData.title,
            description: formData.description,
            price: formData.price,
            contact_phone: formData.contactPhone,
            contact_email: formData.contactEmail,
            updated_at: new Date()
          })
          .eq('id', editingListing.id);
          
        if (error) throw error;
        Alert.alert('Success', 'Listing updated successfully');
      } else {
        // Create new listing
        const { error } = await supabase
          .from('apartment_listings')
          .insert({
            society_id: resident.society_id,
            resident_id: resident.id,
            apartment_number: formData.apartmentNumber,
            listing_type: formData.listingType,
            title: formData.title,
            description: formData.description,
            price: formData.price,
            contact_phone: formData.contactPhone,
            contact_email: formData.contactEmail
          });
          
        if (error) throw error;
        Alert.alert('Success', 'Listing created successfully');
      }
      
      setShowForm(false);
      setEditingListing(null);
      fetchListings();
    } catch (error) {
      console.error('Error saving listing:', error);
      Alert.alert('Error', 'Failed to save your listing');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle listing deletion
  const handleDelete = async (listing) => {
    Alert.alert(
      'Confirm Deletion',
      'Are you sure you want to delete this listing?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const { error } = await supabase
                .from('apartment_listings')
                .delete()
                .eq('id', listing.id);
                
              if (error) throw error;
              
              Alert.alert('Success', 'Listing deleted successfully');
              fetchListings();
            } catch (error) {
              console.error('Error deleting listing:', error);
              Alert.alert('Error', 'Failed to delete the listing');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };
  
  // Handle edit listing
  const handleEdit = (listing) => {
    setEditingListing(listing);
    setShowForm(true);
  };
  
  // Load data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchResidentData();
      }
    }, [user])
  );
  
  // Fetch listings when resident data is available
  useEffect(() => {
    if (resident) {
      fetchListings();
    }
  }, [resident]);
  
  // Render listing card
  const renderListingCard = (listing) => {
    return (
      <View
        key={listing.id}
        style={[
          styles.card,
          { backgroundColor: theme.card }
        ]}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.listingType, { color: listing.listing_type === 'sale' ? '#e74c3c' : '#3498db' }]}>
            {listing.listing_type === 'sale' ? 'FOR SALE' : 'FOR RENT'}
          </Text>
          <Text style={[styles.price, { color: theme.text }]}>
            ₹{Number(listing.price).toLocaleString()}
          </Text>
        </View>
        
        <Text style={[styles.title, { color: theme.text }]}>
          {listing.title}
        </Text>
        
        <Text style={[styles.apartment, { color: theme.text }]}>
          Apartment: {listing.apartment_number}
        </Text>
        
        {listing.description && (
          <Text 
            style={[styles.description, { color: isDarkMode ? '#aaa' : '#666' }]}
            numberOfLines={3}
          >
            {listing.description}
          </Text>
        )}
        
        <View style={styles.contactInfo}>
          <Text style={[styles.contactLabel, { color: isDarkMode ? '#aaa' : '#666' }]}>
            Contact:
          </Text>
          <Text style={[styles.contactText, { color: theme.text }]}>
            {listing.contact_email}
          </Text>
          {listing.contact_phone && (
            <Text style={[styles.contactText, { color: theme.text }]}>
              {listing.contact_phone}
            </Text>
          )}
        </View>
        
        <View style={styles.cardActions}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.editButton]} 
            onPress={() => handleEdit(listing)}
          >
            <Ionicons name="pencil" size={16} color="#fff" />
            <Text style={styles.actionButtonText}>Edit</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.deleteButton]} 
            onPress={() => handleDelete(listing)}
          >
            <Ionicons name="trash" size={16} color="#fff" />
            <Text style={styles.actionButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };
  
  return (
    <AppLayout title="Apartment Listings" showBackButton={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.container}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {!showForm && (
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: theme.primary }]}
              onPress={() => {
                setEditingListing(null);
                setShowForm(true);
              }}
            >
              <Ionicons name="add" size={24} color="#fff" />
              <Text style={styles.addButtonText}>Create New Listing</Text>
            </TouchableOpacity>
          )}
          
          {showForm ? (
            <ListingForm
              initialData={editingListing}
              onSubmit={handleSubmit}
              onCancel={() => {
                setShowForm(false);
                setEditingListing(null);
              }}
              resident={resident}
              isDarkMode={isDarkMode}
              theme={theme}
            />
          ) : loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.loadingText, { color: theme.text }]}>
                Loading listings...
              </Text>
            </View>
          ) : listings.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="home-outline"
                size={64}
                color={isDarkMode ? '#aaa' : '#666'}
              />
              <Text style={[styles.emptyText, { color: theme.text }]}>
                You don't have any apartment listings yet
              </Text>
              <Text style={[styles.emptySubtext, { color: isDarkMode ? '#aaa' : '#666' }]}>
                Create a listing to sell or rent your apartment
              </Text>
            </View>
          ) : (
            <View style={styles.listingsContainer}>
              {listings.map(renderListingCard)}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
    padding: 20,
    marginTop: 40,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 16,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  listingsContainer: {
    padding: 16,
  },
  card: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  listingType: {
    fontWeight: 'bold',
    fontSize: 12,
  },
  price: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  apartment: {
    fontSize: 14,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    marginBottom: 12,
  },
  contactInfo: {
    marginBottom: 12,
  },
  contactLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  contactText: {
    fontSize: 14,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginLeft: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  editButton: {
    backgroundColor: '#3498db',
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
  },
});

export default ApartmentListingsScreen; 