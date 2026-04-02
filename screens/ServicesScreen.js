import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  Animated,
  Dimensions,
  Platform,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';
import { supabase } from '../lib/supabase';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';


import useNoStuckLoading from '../hooks/useNoStuckLoading';
const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 32;
const CARD_HEIGHT = 180;

const ServicesScreen = () => {
  const { theme, isDarkMode } = useTheme();
  const { residentData } = useAuth();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  useNoStuckLoading(loading, setLoading);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingDate, setBookingDate] = useState(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [bookingNotes, setBookingNotes] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);

  // Animation values
  const scrollY = new Animated.Value(0);
  const modalOpacity = new Animated.Value(0);
  const modalScale = new Animated.Value(0.9);

  const loadServices = async (isRefresh = false) => {
    try {
      if (!isRefresh) {
        setLoading(true);
      }
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('Error loading services:', error);
      Alert.alert('Error', 'Failed to load services');
    } finally {
      if (!isRefresh) {
        setLoading(false);
      }
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadServices(true);
  };

  const handleBookService = (service) => {
    console.log('Booking service:', service);
    setSelectedService(service);
    modalOpacity.setValue(0);
    modalScale.setValue(0.9);
    setShowBookingModal(true);
    requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(modalScale, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const handleCloseModal = () => {
    Animated.parallel([
      Animated.timing(modalOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(modalScale, {
        toValue: 0.9,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowBookingModal(false);
      setBookingNotes('');
      setBookingDate(new Date(Date.now() + 24 * 60 * 60 * 1000));
    });
  };

  const handleBookingSubmit = async () => {
    if (!selectedService || !residentData?.id) return;

    try {
      setBookingLoading(true);
      
      // Create the booking directly in service_bookings table
      const { error } = await supabase
        .from('service_bookings')
        .insert({
          service_id: selectedService.id,
          resident_id: residentData.id,
          booking_date: bookingDate.toISOString(),
          notes: bookingNotes,
          status: 'pending'
        });

      if (error) {
        console.error('Error creating booking:', error);
        throw new Error('Failed to create booking. Please try again.');
      }

      Alert.alert(
        'Success',
        'Service booking request submitted successfully. You can track the status in My Bookings.',
        [{ text: 'OK', onPress: handleCloseModal }]
      );
    } catch (error) {
      console.error('Error booking service:', error);
      Alert.alert('Error', error.message || 'Failed to book service. Please try again.');
    } finally {
      setBookingLoading(false);
    }
  };

  const getFilteredServices = () => {
    let filtered = [...services];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(service => 
        service.name.toLowerCase().includes(query) ||
        service.category.toLowerCase().includes(query) ||
        service.description?.toLowerCase().includes(query)
      );
    }
    
    if (selectedCategory) {
      filtered = filtered.filter(service => service.category === selectedCategory);
    }
    
    return filtered;
  };

  const categories = Array.from(new Set(services.map(s => s.category))).sort();

  const renderServiceItem = ({ item, index }) => {
    const inputRange = [
      (index - 1) * CARD_HEIGHT,
      index * CARD_HEIGHT,
      (index + 1) * CARD_HEIGHT,
    ];

    const scale = scrollY.interpolate({
      inputRange,
      outputRange: [0.9, 1, 0.9],
      extrapolate: 'clamp',
    });

    const opacity = scrollY.interpolate({
      inputRange,
      outputRange: [0.7, 1, 0.7],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View
        style={[
          styles.serviceCardContainer,
          {
            transform: [{ scale }],
            opacity,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.serviceCard, { backgroundColor: theme.card }]}
          onPress={() => handleBookService(item)}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={[theme.primary + '20', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardGradient}
          />
          
          <View style={styles.serviceHeader}>
            <View style={styles.serviceTitleContainer}>
              <Text style={[styles.serviceName, { color: theme.text }]}>{item.name}</Text>
              <View style={[styles.categoryBadge, { backgroundColor: theme.primary + '20' }]}>
                <Text style={[styles.categoryText, { color: theme.primary }]}>
                  {item.category}
                </Text>
              </View>
            </View>
          </View>
          
          {item.description && (
            <Text style={[styles.serviceDescription, { color: theme.text + 'CC' }]}>
              {item.description}
            </Text>
          )}
          
          {item.price_range && (
            <View style={styles.priceContainer}>
              <Ionicons name="cash-outline" size={16} color={theme.text + '80'} />
              <Text style={[styles.servicePrice, { color: theme.text + 'CC' }]}>
                {item.price_range}
              </Text>
            </View>
          )}
          
          <TouchableOpacity
            style={[styles.bookButton, { backgroundColor: theme.primary }]}
            onPress={() => handleBookService(item)}
          >
            <Text style={styles.bookButtonText}>Book Now</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" style={styles.bookButtonIcon} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons 
        name="construct-outline" 
        size={80} 
        color={theme.text + '30'} 
      />
      <Text style={[styles.emptyTitle, { color: theme.text }]}>
        No services available
      </Text>
      <Text style={[styles.emptyText, { color: theme.text + 'AA' }]}>
        {searchQuery || selectedCategory
          ? "No services match your search criteria. Try adjusting your filters."
          : "There are no services available at the moment. Please check back later."}
      </Text>
    </View>
  );

  return (
    <AppLayout title="Services">
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.searchContainer}>
          <View style={[styles.searchBar, { backgroundColor: theme.card }]}>
            <Ionicons name="search" size={20} color={theme.text + '80'} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search services..."
              placeholderTextColor={theme.text + '80'}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={20} color={theme.text + '80'} />
              </TouchableOpacity>
            ) : null}
          </View>
          
          <TouchableOpacity
            style={[styles.filterButton, { backgroundColor: theme.card }]}
            onPress={() => setShowCategoryFilter(!showCategoryFilter)}
          >
            <Ionicons
              name={showCategoryFilter ? "close" : "filter"}
              size={20}
              color={theme.text}
            />
          </TouchableOpacity>
        </View>

        {showCategoryFilter && (
          <View style={[styles.categoryFilter, { backgroundColor: theme.card }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryList}
            >
              <TouchableOpacity
                style={[
                  styles.categoryItem,
                  !selectedCategory && { backgroundColor: theme.primary + '20' }
                ]}
                onPress={() => setSelectedCategory('')}
              >
                <Text
                  style={[
                    styles.categoryItemText,
                    { color: !selectedCategory ? theme.primary : theme.text }
                  ]}
                >
                  All
                </Text>
              </TouchableOpacity>
              
              {categories.map(category => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryItem,
                    selectedCategory === category && { backgroundColor: theme.primary + '20' }
                  ]}
                  onPress={() => setSelectedCategory(category)}
                >
                  <Text
                    style={[
                      styles.categoryItemText,
                      { color: selectedCategory === category ? theme.primary : theme.text }
                    ]}
                  >
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <Animated.FlatList
          data={getFilteredServices()}
          renderItem={renderServiceItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[theme.primary]}
              tintColor={theme.primary}
            />
          }
          ListEmptyComponent={loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : renderEmptyList}
        />

        <Modal
          visible={showBookingModal}
          transparent={true}
          animationType="fade"
          onRequestClose={handleCloseModal}
          statusBarTranslucent
        >
          <View style={[styles.modalOverlay, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.02)' }]}>
            <View style={styles.modalContainer}>
              <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>
                    Book Service
                  </Text>
                  <TouchableOpacity
                    onPress={handleCloseModal}
                    style={styles.closeButton}
                  >
                    <Ionicons name="close" size={24} color={theme.text} />
                  </TouchableOpacity>
                </View>

                {selectedService && (
                  <>
                    <View style={styles.serviceInfo}>
                      <Text style={[styles.serviceTitle, { color: theme.text }]}>
                        {selectedService.name}
                      </Text>
                      <View style={[styles.categoryBadge, { backgroundColor: theme.primary + '20' }]}>
                        <Text style={[styles.categoryText, { color: theme.primary }]}>
                          {selectedService.category}
                        </Text>
                      </View>
                    </View>

                    {selectedService.description && (
                      <Text style={[styles.serviceDescription, { color: theme.text + 'CC' }]}>
                        {selectedService.description}
                      </Text>
                    )}

                    {selectedService.price_range && (
                      <View style={styles.priceContainer}>
                        <Ionicons name="cash-outline" size={16} color={theme.text + '80'} />
                        <Text style={[styles.servicePrice, { color: theme.text + 'CC' }]}>
                          {selectedService.price_range}
                        </Text>
                      </View>
                    )}
                    
                    <TouchableOpacity
                      style={[styles.dateButton, { backgroundColor: theme.background }]}
                      onPress={() => setShowDatePicker(true)}
                    >
                      <Ionicons name="calendar" size={20} color={theme.text} />
                      <Text style={[styles.dateButtonText, { color: theme.text }]}>
                        {bookingDate.toLocaleDateString()}
                      </Text>
                    </TouchableOpacity>

                    {showDatePicker && (
                      <DateTimePicker
                        value={bookingDate}
                        mode="date"
                        display="default"
                        minimumDate={new Date()}
                        onChange={(event, selectedDate) => {
                          setShowDatePicker(false);
                          if (selectedDate) {
                            setBookingDate(selectedDate);
                          }
                        }}
                      />
                    )}

                    <TextInput
                      style={[styles.notesInput, { 
                        backgroundColor: theme.background,
                        color: theme.text,
                        borderColor: theme.text + '40'
                      }]}
                      placeholder="Add any specific requirements or notes..."
                      placeholderTextColor={theme.text + '80'}
                      value={bookingNotes}
                      onChangeText={setBookingNotes}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                    />

                    <TouchableOpacity
                      style={[styles.submitButton, { backgroundColor: theme.primary }]}
                      onPress={handleBookingSubmit}
                      disabled={bookingLoading}
                    >
                      {bookingLoading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Text style={styles.submitButtonText}>Submit Booking Request</Text>
                          <Ionicons name="arrow-forward" size={16} color="#fff" style={styles.submitButtonIcon} />
                        </>
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </View>
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
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  clearButton: {
    padding: 4,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryFilter: {
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  categoryList: {
    paddingVertical: 8,
    gap: 8,
  },
  categoryItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  categoryItemText: {
    fontSize: 14,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  serviceCardContainer: {
    marginBottom: 16,
  },
  serviceCard: {
    borderRadius: 16,
    padding: 16,
    height: CARD_HEIGHT,
    overflow: 'hidden',
  },
  cardGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '100%',
    opacity: 0.5,
  },
  serviceHeader: {
    marginBottom: 12,
  },
  serviceTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceName: {
    fontSize: 20,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  serviceDescription: {
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 4,
  },
  servicePrice: {
    fontSize: 14,
    fontWeight: '500',
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    marginTop: 'auto',
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  bookButtonIcon: {
    marginLeft: 4,
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
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    zIndex: 1001,
  },
  modalContent: {
    borderRadius: 20,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    zIndex: 1002,
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
  serviceInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  serviceTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  dateButtonText: {
    marginLeft: 8,
    fontSize: 16,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    minHeight: 100,
    fontSize: 16,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  submitButtonIcon: {
    marginLeft: 4,
  },
});

export default ServicesScreen; 