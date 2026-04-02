import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Platform,
  Animated,
  Easing
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, parseISO } from 'date-fns';
import GuardSidebar from '../components/GuardSidebar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


import useNoStuckLoading from '../hooks/useNoStuckLoading';
const GUARD_STORAGE_KEY = 'guard_data';

export default function GuardVisitorsScreen() {
  const [guardData, setGuardData] = useState(null);
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  useNoStuckLoading(loading, setLoading);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sidebarVisible, setSidebarVisible] = useState(false);
  
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomTabBarPadding = 55 + Math.max(insets.bottom, 0);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0.95)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;
  const scaleAnim = useRef(new Animated.Value(0.99)).current;

  useEffect(() => {
    loadGuardData();
  }, []);

  // Add entrance animation
  useEffect(() => {
    if (!loading && guardData) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
          easing: Easing.bezier(0.2, 0, 0.2, 1),
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
          easing: Easing.bezier(0.2, 0, 0.2, 1),
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }),
      ]).start();
    }
  }, [loading, guardData]);

  const loadGuardData = async () => {
    try {
      setLoading(true);
      
      // Load guard data from AsyncStorage
      const guardDataString = await AsyncStorage.getItem(GUARD_STORAGE_KEY);
      let guard = guardDataString ? JSON.parse(guardDataString) : null;
      
      if (!guard) {
        // Check current session
        const { data: session } = await supabase.auth.getSession();
        
        if (!session?.session) {
          Alert.alert('Error', 'Session expired. Please login again.');
          return;
        }
        
        // If not in AsyncStorage, try to fetch from Supabase
        if (session.session?.user) {
          const { data, error } = await supabase
            .from('guards')
            .select('*')
            .eq('user_id', session.session.user.id)
            .single();
            
          if (error || !data) {
            console.error('Error loading guard data:', error);
            Alert.alert('Error', 'Failed to load guard data');
            return;
          }
          
          guard = data;
          await AsyncStorage.setItem(GUARD_STORAGE_KEY, JSON.stringify(guard));
        }
      }
      
      setGuardData(guard);
      
      // Load visitors for this society
      if (guard?.society_id) {
        fetchVisitors(guard.society_id);
      }
    } catch (error) {
      console.error('Error loading guard data:', error);
      Alert.alert('Error', 'Failed to load guard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchVisitors = async (societyId) => {
    try {
      const { data, error } = await supabase
        .from('visitors')
        .select('*')
        .eq('society_id', societyId)
        .order('created_at', { ascending: false });
        
      if (error) {
        throw error;
      }
      
      setVisitors(data || []);
    } catch (error) {
      console.error('Error fetching visitors:', error);
      Alert.alert('Error', 'Failed to load visitors');
    } finally {
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    if (guardData?.society_id) {
      fetchVisitors(guardData.society_id);
    } else {
      setRefreshing(false);
    }
  };

  const handleCheckOutVisitor = async (visitorId) => {
    try {
      // Get the visitor data first to preserve the type field
      const { data: visitorData, error: fetchError } = await supabase
        .from('visitors')
        .select('type')
        .eq('id', visitorId)
        .single();
        
      if (fetchError) {
        throw fetchError;
      }
      
      // Update visitor in database
      const { error } = await supabase
        .from('visitors')
        .update({
          check_out_time: new Date().toISOString(),
          checked_out_by: guardData.id,
          type: visitorData.type || 'guest' // Preserve the type field
        })
        .eq('id', visitorId);
        
      if (error) {
        throw error;
      }
      
      // Update in local list
      const updatedVisitors = visitors.map(visitor => 
        visitor.id === visitorId 
          ? { ...visitor, check_out_time: new Date().toISOString() } 
          : visitor
      );
      
      setVisitors(updatedVisitors);
      Alert.alert('Success', 'Visitor checked out successfully');
    } catch (error) {
      console.error('Error checking out visitor:', error);
      Alert.alert('Error', 'Failed to check out visitor');
    }
  };
  
  // Filter visitors based on search query and filter status
  const filteredVisitors = visitors.filter(visitor => {
    // Search filter
    const matchesSearch = 
      searchQuery === '' || 
      visitor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      visitor.flat_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (visitor.purpose && visitor.purpose.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // Status filter
    let matchesStatus = true;
    if (filterStatus === 'active') {
      matchesStatus = visitor.check_in_time && !visitor.check_out_time;
    } else if (filterStatus === 'checkedOut') {
      matchesStatus = visitor.check_out_time;
    }
    
    return matchesSearch && matchesStatus;
  });

  const getStatusLabel = (visitor) => {
    if (visitor.check_out_time) return 'Checked Out';
    if (visitor.check_in_time) return 'Active';
    return 'Expected';
  };
  
  const getStatusColor = (visitor) => {
    if (visitor.check_out_time) return { bg: theme.successLight, text: theme.success };
    if (visitor.check_in_time) return { bg: theme.warningLight, text: theme.warning };
    return { bg: theme.infoLight, text: theme.info };
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, paddingTop: insets.top + 10 }]}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <TouchableOpacity 
              style={[styles.menuButton, { backgroundColor: theme.primary + '15' }]}
              onPress={() => setSidebarVisible(true)}
            >
              <Ionicons name="menu-outline" size={24} color={theme.primary} />
            </TouchableOpacity>
            <View>
              <Text style={[styles.headerTitle, { color: theme.text }]}>
                All Visitors
              </Text>
              <Text style={[styles.headerSubtitle, { color: theme.text + 'CC' }]}>
                {filteredVisitors.length} visitors found
              </Text>
            </View>
          </View>
          <TouchableOpacity 
            style={[styles.refreshButton, { backgroundColor: theme.primary + '15' }]}
            onPress={handleRefresh}
          >
            <Ionicons name="refresh-outline" size={24} color={theme.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search and Filters */}
      <Animated.View 
        style={[
          styles.searchContainer, 
          { 
            backgroundColor: theme.card,
            opacity: fadeAnim,
            transform: [
              { translateY: slideAnim },
              { scale: scaleAnim }
            ]
          }
        ]}
      >
        <View style={[styles.searchBar, { backgroundColor: theme.inputBackground }]}>
          <Ionicons name="search" size={20} color={theme.text + 'CC'} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search visitors..."
            placeholderTextColor={theme.text + '80'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={theme.text + 'CC'} />
            </TouchableOpacity>
          )}
        </View>
        
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filtersScroll}
          contentContainerStyle={styles.filtersContainer}
        >
          <TouchableOpacity
            style={[
              styles.filterButton,
              filterStatus === 'all' && { backgroundColor: theme.primary + '15' }
            ]}
            onPress={() => setFilterStatus('all')}
          >
            <Ionicons 
              name="apps-outline" 
              size={16} 
              color={filterStatus === 'all' ? theme.primary : theme.text + 'CC'} 
              style={styles.filterIcon}
            />
            <Text
              style={[
                styles.filterButtonText,
                { color: filterStatus === 'all' ? theme.primary : theme.text + 'CC' }
              ]}
            >
              All
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.filterButton,
              filterStatus === 'active' && { backgroundColor: theme.warning + '15' }
            ]}
            onPress={() => setFilterStatus('active')}
          >
            <Ionicons 
              name="time-outline" 
              size={16} 
              color={filterStatus === 'active' ? theme.warning : theme.text + 'CC'} 
              style={styles.filterIcon}
            />
            <Text
              style={[
                styles.filterButtonText,
                { color: filterStatus === 'active' ? theme.warning : theme.text + 'CC' }
              ]}
            >
              Active
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.filterButton,
              filterStatus === 'checkedOut' && { backgroundColor: theme.success + '15' }
            ]}
            onPress={() => setFilterStatus('checkedOut')}
          >
            <Ionicons 
              name="checkmark-circle-outline" 
              size={16} 
              color={filterStatus === 'checkedOut' ? theme.success : theme.text + 'CC'} 
              style={styles.filterIcon}
            />
            <Text
              style={[
                styles.filterButtonText,
                { color: filterStatus === 'checkedOut' ? theme.success : theme.text + 'CC' }
              ]}
            >
              Checked Out
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>

      {/* Visitors List */}
      <ScrollView
        style={styles.visitorsList}
        contentContainerStyle={[styles.visitorsListContent, { paddingBottom: bottomTabBarPadding }]}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
      >
        {filteredVisitors.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: theme.card }]}>
            <Ionicons name="people-outline" size={48} color={theme.text + 'CC'} />
            <Text style={[styles.emptyText, { color: theme.text + 'CC' }]}>
              {searchQuery 
                ? 'No visitors match your search' 
                : 'No visitors found'}
            </Text>
          </View>
        ) : (
          filteredVisitors.map(visitor => {
            const statusInfo = getStatusColor(visitor);
            
            return (
              <View 
                key={visitor.id} 
                style={[styles.visitorCard, { 
                  backgroundColor: theme.card,
                  borderColor: theme.border
                }]}
              >
                <View style={styles.visitorHeader}>
                  <View style={styles.visitorInfo}>
                    <View style={[styles.avatarContainer, { backgroundColor: theme.primary + '15' }]}>
                      <Ionicons name="person-outline" size={24} color={theme.primary} />
                    </View>
                    <View>
                      <Text style={[styles.visitorName, { color: theme.text }]}>
                        {visitor.name}
                      </Text>
                      <Text style={[styles.visitorFlat, { color: theme.text + 'CC' }]}>
                        Flat {visitor.flat_number}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                    <Text style={[styles.statusText, { color: statusInfo.text }]}>
                      {getStatusLabel(visitor)}
                    </Text>
                  </View>
                </View>

                <View style={styles.visitorDetails}>
                  {visitor.purpose && (
                    <View style={styles.detailItem}>
                      <Ionicons name="information-circle-outline" size={16} color={theme.text + 'CC'} />
                      <Text style={[styles.detailText, { color: theme.text + 'CC' }]}>
                        {visitor.purpose}
                      </Text>
                    </View>
                  )}
                  
                  {visitor.phone && (
                    <View style={styles.detailItem}>
                      <Ionicons name="call-outline" size={16} color={theme.text + 'CC'} />
                      <Text style={[styles.detailText, { color: theme.text + 'CC' }]}>
                        {visitor.phone}
                      </Text>
                    </View>
                  )}
                  
                  {visitor.check_in_time && (
                    <View style={styles.detailItem}>
                      <Ionicons name="log-in-outline" size={16} color={theme.text + 'CC'} />
                      <Text style={[styles.detailText, { color: theme.text + 'CC' }]}>
                        Checked in: {format(parseISO(visitor.check_in_time), 'PPp')}
                      </Text>
                    </View>
                  )}
                  
                  {visitor.check_out_time && (
                    <View style={styles.detailItem}>
                      <Ionicons name="log-out-outline" size={16} color={theme.text + 'CC'} />
                      <Text style={[styles.detailText, { color: theme.text + 'CC' }]}>
                        Checked out: {format(parseISO(visitor.check_out_time), 'PPp')}
                      </Text>
                    </View>
                  )}
                </View>

                {!visitor.check_out_time && (
                  <TouchableOpacity
                    style={[styles.checkoutButton, { backgroundColor: theme.primary }]}
                    onPress={() => handleCheckOutVisitor(visitor.id)}
                  >
                    <Text style={styles.checkoutButtonText}>Check Out</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Sidebar */}
      <GuardSidebar 
        visible={sidebarVisible} 
        onClose={() => setSidebarVisible(false)} 
        guardData={guardData}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 8,
    padding: 4,
  },
  filtersScroll: {
    marginHorizontal: -16,
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  filterIcon: {
    marginRight: 6,
  },
  filterButtonText: {
    fontWeight: '500',
    fontSize: 14,
  },
  visitorsList: {
    flex: 1,
  },
  visitorsListContent: {
    padding: 16,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    borderRadius: 12,
    marginTop: 16,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
  },
  visitorCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  visitorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  visitorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visitorName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  visitorFlat: {
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  visitorDetails: {
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  detailText: {
    fontSize: 14,
  },
  checkoutButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  checkoutButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
}); 