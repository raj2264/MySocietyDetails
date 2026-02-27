import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Animated,
  Easing,
  KeyboardAvoidingView
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GuardSidebar from '../components/GuardSidebar';

const GUARD_STORAGE_KEY = 'guard_data';

export default function GuardDashboardScreen() {
  const [guardData, setGuardData] = useState(null);
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [visitorName, setVisitorName] = useState('');
  const [visitorPhone, setVisitorPhone] = useState('');
  const [visitorPurpose, setVisitorPurpose] = useState('');
  const [flatNumber, setFlatNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // New state for resident selection
  const [residents, setResidents] = useState([]);
  const [filteredResidents, setFilteredResidents] = useState([]);
  const [selectedResident, setSelectedResident] = useState(null);
  const [residentSearchText, setResidentSearchText] = useState('');
  const [showResidentDropdown, setShowResidentDropdown] = useState(false);
  const [loadingResidents, setLoadingResidents] = useState(false);
  
  // State for code entry
  const [accessCode, setAccessCode] = useState('');
  const [codeModalVisible, setCodeModalVisible] = useState(false);
  
  // State for sidebar
  const [sidebarVisible, setSidebarVisible] = useState(false);
  
  const { theme, isDarkMode } = useTheme();
  const router = useRouter();

  // Add the missing generateAccessCode function
  const generateAccessCode = () => {
    // Generate a random 6-digit code
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  // Simplified animation values - using only what's necessary
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(10)).current; // Reduced slide distance
  const scaleAnim = useRef(new Animated.Value(0.98)).current; // Single scale for all content

  useEffect(() => {
    loadGuardData();
  }, []);

  // Add function to load residents
  const loadResidents = async (societyId) => {
    if (!societyId) return;
    
    try {
      setLoadingResidents(true);
      
      const { data, error } = await supabase
        .from('residents')
        .select('id, name, unit_number, phone')
        .eq('society_id', societyId)
        .eq('status', 'active')
        .order('name');
        
      if (error) {
        throw error;
      }
      
      setResidents(data || []);
      setFilteredResidents(data || []);
    } catch (error) {
      console.error('Error loading residents:', error);
    } finally {
      setLoadingResidents(false);
    }
  };

  // Load residents once we have guard data
  useEffect(() => {
    if (guardData?.society_id) {
      loadResidents(guardData.society_id);
    }
  }, [guardData]);

  // Filter residents as user types
  useEffect(() => {
    if (residentSearchText) {
      const filtered = residents.filter(resident => 
        resident.name.toLowerCase().includes(residentSearchText.toLowerCase()) ||
        resident.unit_number.toLowerCase().includes(residentSearchText.toLowerCase())
      );
      setFilteredResidents(filtered);
    } else {
      setFilteredResidents(residents);
    }
  }, [residentSearchText, residents]);

  // Add new effect for optimized animations
  useEffect(() => {
    if (!loading && guardData) {
      // Reset animation values
      fadeAnim.setValue(0);
      slideAnim.setValue(10);
      scaleAnim.setValue(0.98);

      // Single, optimized animation sequence
      Animated.parallel([
        // Fade in with faster duration
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300, // Faster fade
          useNativeDriver: true,
          easing: Easing.bezier(0.2, 0, 0.2, 1), // Material Design easing
        }),
        // Slide up with faster duration
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300, // Faster slide
          useNativeDriver: true,
          easing: Easing.bezier(0.2, 0, 0.2, 1), // Material Design easing
        }),
        // Single scale animation for all content
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50, // Reduced tension for smoother spring
          friction: 7, // Reduced friction for faster animation
          velocity: 0.3, // Lower initial velocity
          restDisplacementThreshold: 0.01, // More precise spring end
          restSpeedThreshold: 0.01, // More precise spring end
        }),
      ]).start();
    }
  }, [loading, guardData]);

  const loadGuardData = async () => {
    try {
      setLoading(true);
      
      // Check current session
      const { data: session } = await supabase.auth.getSession();
      
      if (!session?.session) {
        // Not logged in, redirect to login
        router.replace('/guard-login');
        return;
      }
      
      // Always fetch fresh guard data from Supabase
      const { data: guard, error } = await supabase
        .from('guards')
        .select('*')
        .eq('user_id', session.session.user.id)
        .single();
        
      if (error || !guard) {
        console.error('Error loading guard data:', error);
        // Clear any stale data
        await AsyncStorage.removeItem(GUARD_STORAGE_KEY);
        router.replace('/guard-login');
        return;
      }
      
      // Store the fresh guard data
      await AsyncStorage.setItem(GUARD_STORAGE_KEY, JSON.stringify(guard));
      setGuardData(guard);
      
      // Load visitors for this society
      if (guard.society_id) {
        fetchVisitors(guard.society_id);
      }
    } catch (error) {
      console.error('Error loading guard data:', error);
      // Clear any stale data
      await AsyncStorage.removeItem(GUARD_STORAGE_KEY);
      Alert.alert('Error', 'Failed to load guard data. Please login again.', [{ text: 'OK' }]);
      router.replace('/guard-login');
    } finally {
      setLoading(false);
    }
  };

  const fetchVisitors = async (societyId) => {
    try {
      // First, fetch visitors who need check-in (post-approval by resident only)
      // These are visitors that a guard added (with manually_added=true) and residents approved later
      const { data: pendingCheckIns, error: pendingError } = await supabase
        .from('visitors')
        .select('*')
        .eq('society_id', societyId)
        .eq('approval_status', 'approved')
        .is('check_in_time', null)
        .is('is_checked_in', false)
        .not('resident_id', 'is', null) // Must have a resident assigned
        .order('created_at', { ascending: false });
        
      if (pendingError) {
        throw pendingError;
      }
      
      // Fetch pending approval visitors that were manually added by guards
      const { data: pendingApprovalVisitors, error: pendingApprovalError } = await supabase
        .from('visitors')
        .select('*')
        .eq('society_id', societyId)
        .eq('approval_status', 'pending')
        .eq('manually_added', true)
        .is('check_in_time', null)
        .order('created_at', { ascending: false });
        
      if (pendingApprovalError) {
        throw pendingApprovalError;
      }
      
      // Then, fetch recent checked-in visitors
      const { data: recentVisitors, error: recentError } = await supabase
        .from('visitors')
        .select('*')
        .eq('society_id', societyId)
        .not('check_in_time', 'is', null)  // Visitors who have checked in
        .order('check_in_time', { ascending: false })
        .limit(10);
        
      if (recentError) {
        throw recentError;
      }
      
      // Filter pendingCheckIns to only include those originally added by guards
      // (visitors created by residents should use access code flow)
      const postApprovedVisitors = pendingCheckIns?.filter(visitor => {
        // We need to determine if this visitor was added by a guard and later approved
        // Since we don't have a direct field, we'll infer based on available data:
        // 1. It has a resident_id (assigned to a specific resident)
        // 2. It has a creation timestamp earlier than its approval timestamp
        // 3. Specifically check if it has been flagged as manually added by a guard
        
        return visitor.resident_id && 
              (visitor.manually_added === true || visitor.added_by_guard === true);
      }) || [];
      
      // Combine all lists, with pending approval and post-approved visitors at the top
      const allVisitors = [
        ...(pendingApprovalVisitors || []),
        ...postApprovedVisitors, 
        ...(recentVisitors || [])
      ];
      
      setVisitors(allVisitors);
    } catch (error) {
      console.error('Error fetching visitors:', error);
      Alert.alert('Error', 'Failed to load visitors', [{ text: 'OK' }]);
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

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      await AsyncStorage.removeItem(GUARD_STORAGE_KEY);
      router.replace('/guard-login');
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out', [{ text: 'OK' }]);
    }
  };

  // Update handleAddVisitor function to include approval flow and resident_id
  const handleAddVisitor = async () => {
    if (!visitorName) {
      setModalVisible(false); // Close modal first
      setTimeout(() => {
        Alert.alert('Error', 'Visitor name is required', [{ text: 'OK' }]);
      }, 100);
      return;
    }

    if (!selectedResident && !flatNumber) {
      setModalVisible(false); // Close modal first
      setTimeout(() => {
        Alert.alert('Error', 'Please select a resident or enter a flat number', [{ text: 'OK' }]);
      }, 100);
      return;
    }

    try {
      setSubmitting(true);
      
      // Generate a unique access code
      const accessCode = generateAccessCode();
      
      // Use either the selected resident data or just the flat number
      const residentId = selectedResident ? selectedResident.id : null;
      const unitNumber = selectedResident ? selectedResident.unit_number : flatNumber;
      
      // Always set approval status to pending for manual guard entries
      // Residents must approve all visitors entered by guards
      const approvalStatus = 'pending';
      
      // Prepare visitor data
      const visitorData = {
        society_id: guardData.society_id,
        name: visitorName,
        phone: visitorPhone,
        purpose: visitorPurpose,
        flat_number: unitNumber,
        resident_id: residentId,
        access_code: accessCode,
        type: 'guest',
        expected_arrival: new Date().toISOString(),
        expiry_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
        approval_status: approvalStatus, // Always pending for guard entries
        manually_added: true, // Mark that this visitor was manually added by a guard
        added_by_guard: true  // Alternative flag in case the schema uses a different name
      };
      
      // Use our custom RPC function to bypass RLS issues
      let data;
      try {
        // Try using the RPC function first
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('add_visitor_without_notification', {
            visitor_data: visitorData
          });
          
        if (rpcError) {
          throw rpcError;
        }
        
        // Handle the returned data from RPC
        if (typeof rpcData === 'string') {
          try {
            data = JSON.parse(rpcData);
          } catch (e) {
            console.error('Error parsing RPC result:', e);
            data = rpcData; // Use as is, might be an object already
          }
        } else {
          data = rpcData;
        }
        
        console.log('Added visitor using RPC function');
        
        // Try to create a notification manually for the resident if we have a resident ID
        if (residentId) {
          try {
            await supabase.rpc('create_visitor_notification', {
              visitor_id: data.id,
              resident_id: residentId,
              visitor_name: visitorName,
              flat_number: unitNumber
            });
            console.log('Created notification via RPC');
          } catch (notifError) {
            console.warn('Could not create notification via RPC:', notifError);
            // Continue anyway, the visitor is created
          }
        }
      } catch (rpcError) {
        console.warn('RPC function failed, falling back to direct insert:', rpcError);
        
        // If RPC fails, fall back to alternative approach
        try {
          // Add visit_date field to avoid that error
          if (!visitorData.visit_date) {
            visitorData.visit_date = new Date().toISOString();
          }
          
          // Try inserting without auto-triggers using a custom SQL query via RPC
          const { data: insertResult, error: insertError } = await supabase
            .rpc('insert_visitor_directly', {
              society_id: visitorData.society_id,
              name: visitorData.name,
              phone: visitorData.phone || '',
              purpose: visitorData.purpose || '',
              flat_number: visitorData.flat_number,
              resident_id: visitorData.resident_id,
              access_code: visitorData.access_code,
              visitor_type: visitorData.type,
              expected_arrival: visitorData.expected_arrival,
              expiry_time: visitorData.expiry_time,
              approval_status: visitorData.approval_status,
              visit_date: visitorData.visit_date
            });
            
          if (insertError) {
            throw insertError;
          }
          
          // Check if we got a valid result back
          if (insertResult) {
            if (typeof insertResult === 'string') {
              try {
                data = JSON.parse(insertResult);
              } catch (e) {
                data = { id: insertResult, ...visitorData };
              }
            } else {
              data = insertResult;
            }
          } else {
            // If no data returned, use a placeholder with the input data
            data = { ...visitorData, id: 'temporary-' + new Date().getTime() };
          }
          
          console.log('Added visitor using direct insert RPC');
        } catch (finalError) {
          console.error('All insert methods failed:', finalError);
          throw finalError;
        }
      }
      
      // Add to local list if we have data
      if (data) {
        // Ensure data has an ID for the list
        if (!data.id) {
          data.id = 'temp-' + new Date().getTime();
        }
        setVisitors([data, ...visitors]);
      }
      
      // Clear form and close modal first
      setVisitorName('');
      setVisitorPhone('');
      setVisitorPurpose('');
      setFlatNumber('');
      setSelectedResident(null);
      setResidentSearchText('');
      setModalVisible(false);
      
      // Show success alert after modal is closed
      setTimeout(() => {
        Alert.alert(
          'Success', 
          `Visitor added successfully!\nThe resident will be notified for approval. The visitor will appear in your list with 'Pending Approval' status until the resident approves or rejects the request.`,
          [{ text: 'OK' }]
        );
      }, 100);
    } catch (error) {
      console.error('Error adding visitor:', error);
      setModalVisible(false); // Close modal first
      setTimeout(() => {
        Alert.alert('Error', 'Failed to add visitor: ' + (error.message || 'Unknown error'), [{ text: 'OK' }]);
      }, 100);
    } finally {
      setSubmitting(false);
    }
  };
  
  // Function to handle resident selection
  const handleSelectResident = (resident) => {
    setSelectedResident(resident);
    setFlatNumber(resident.unit_number);
    setResidentSearchText(resident.name);
    setShowResidentDropdown(false);
  };

  // Function to reset resident selection
  const clearResidentSelection = () => {
    setSelectedResident(null);
    setResidentSearchText('');
    setFlatNumber('');
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
      
      // Show success alert
      setTimeout(() => {
        Alert.alert('Success', 'Visitor checked out successfully', [{ text: 'OK' }]);
      }, 100);
    } catch (error) {
      console.error('Error checking out visitor:', error);
      setTimeout(() => {
        Alert.alert('Error', 'Failed to check out visitor', [{ text: 'OK' }]);
      }, 100);
    }
  };
  
  // Handle manual access code entry
  const handleSubmitAccessCode = () => {
    if (!accessCode) {
      setCodeModalVisible(false); // Close modal first
      setTimeout(() => {
        Alert.alert('Error', 'Please enter an access code', [{ text: 'OK' }]);
      }, 100);
      return;
    }
    
    setCodeModalVisible(false); // Close modal first
    setTimeout(() => {
      processAccessCode(accessCode);
    }, 100);
  };
  
  // Process an access code
  const processAccessCode = async (code) => {
    if (!code) {
      Alert.alert('Error', 'Please enter an access code', [{ text: 'OK' }]);
      return;
    }
    
    try {
      setLoading(true);
      
      // Find visitor with this code
      const { data, error } = await supabase
        .from('visitors')
        .select('*')
        .eq('access_code', code)
        .eq('society_id', guardData.society_id)
        .maybeSingle();
        
      if (error) {
        throw error;
      }
      
      if (!data) {
        Alert.alert('Error', 'Invalid access code', [{ text: 'OK' }]);
        return;
      }
      
      // Check if the visitor is already checked in
      if (data.check_in_time) {
        Alert.alert('Already Checked In', 'This visitor has already been checked in', [{ text: 'OK' }]);
        return;
      }
      
      // Check if the code is expired
      if (data.expiry_time && new Date(data.expiry_time) < new Date()) {
        Alert.alert('Expired', 'This access code has expired', [{ text: 'OK' }]);
        return;
      }

      // Different handling based on approval status
      if (data.approval_status === 'pending') {
        // Check if this visitor has previously visited this resident and was approved
        if (data.resident_id) {
          const { data: previousVisits, error: prevError } = await supabase
            .from('visitors')
            .select('id')
            .eq('name', data.name)
            .eq('resident_id', data.resident_id)
            .eq('approval_status', 'approved')
            .eq('society_id', guardData.society_id)
            .not('id', 'eq', data.id) // Exclude current visit
            .limit(1);
            
          if (!prevError && previousVisits && previousVisits.length > 0) {
            // This visitor has previously visited this resident and was approved
            // Auto-approve this visit
            const { error: updateError } = await supabase
              .from('visitors')
              .update({ approval_status: 'approved' })
              .eq('id', data.id);
              
            if (!updateError) {
              // Update the data object with the new status
              data.approval_status = 'approved';
              
              console.log('Auto-approved visitor based on previous approved visits');
            }
          } else {
            // No previous approved visits found, still needs approval
            Alert.alert(
              'Pending Approval', 
              'This visitor is waiting for resident approval. They cannot check in yet.', 
              [{ text: 'OK' }]
            );
            return;
          }
        } else {
          // No resident ID, can't check previous visits, still needs approval
          Alert.alert(
            'Pending Approval', 
            'This visitor is waiting for resident approval. They cannot check in yet.', 
            [{ text: 'OK' }]
          );
          return;
        }
      } else if (data.approval_status === 'rejected') {
        Alert.alert(
          'Visitor Rejected', 
          'This visitor has been rejected by the resident and cannot check in.', 
          [{ text: 'OK' }]
        );
        return;
      }
      
      // At this point, visitor is either approved or auto-approved
      // Check in the visitor
      const { error: updateError } = await supabase
        .from('visitors')
        .update({
          check_in_time: new Date().toISOString(),
          checked_in_by: guardData.id,
          is_checked_in: true
        })
        .eq('id', data.id);
        
      if (updateError) {
        throw updateError;
      }
      
      // Update local list
      const updatedVisitor = { ...data, check_in_time: new Date().toISOString(), is_checked_in: true };
      const visitorExists = visitors.some(v => v.id === data.id);
      
      if (visitorExists) {
        setVisitors(prev => prev.map(v => v.id === data.id ? updatedVisitor : v));
      } else {
        setVisitors([updatedVisitor, ...visitors]);
      }
      
      // Show success alert
      Alert.alert('Success', `${data.name} has been checked in`, [{ text: 'OK' }]);
    } catch (error) {
      console.error('Error processing access code:', error);
      Alert.alert('Error', 'Failed to process access code', [{ text: 'OK' }]);
    } finally {
      setLoading(false);
      setAccessCode('');
    }
  };

  // In the getStatusLabel function, add support for pending and rejected visitors:
  const getStatusLabel = (visitor) => {
    if (visitor.approval_status === 'rejected') return 'Rejected';
    if (visitor.approval_status === 'pending') return 'Pending Approval';
    if (visitor.check_out_time) return 'Checked Out';
    if (visitor.check_in_time || visitor.is_checked_in) return 'Active';
    if (visitor.approval_status === 'approved') return 'Ready for Check-in';
    return 'Expected';
  };

  // In the getStatusColor function, add colors for the new status values:
  const getStatusColor = (visitor) => {
    if (visitor.approval_status === 'rejected') {
      return { bg: theme.errorLight, text: theme.error };
    }
    if (visitor.approval_status === 'pending') {
      return { bg: theme.warningLight, text: theme.warning };
    }
    if (visitor.check_out_time) {
      return { bg: theme.successLight, text: theme.success };
    }
    if (visitor.check_in_time || visitor.is_checked_in) {
      return { bg: theme.primaryLight, text: theme.primary };
    }
    if (visitor.approval_status === 'approved') {
      return { bg: '#e6fff2', text: theme.success }; // Light green background for ready for check-in
    }
    return { bg: theme.infoLight, text: theme.info };
  };

  // Function to handle check-in for approved visitors
  const processApprovedVisitorCheckIn = async (visitor) => {
    if (!visitor || !visitor.id) {
      Alert.alert('Error', 'Invalid visitor data', [{ text: 'OK' }]);
      return;
    }
    
    try {
      setLoading(true);
      
      // Check in the visitor
      const { error: updateError } = await supabase
        .from('visitors')
        .update({
          check_in_time: new Date().toISOString(),
          checked_in_by: guardData.id,
          is_checked_in: true
        })
        .eq('id', visitor.id);
        
      if (updateError) {
        throw updateError;
      }
      
      // Update local list
      const updatedVisitor = { 
        ...visitor, 
        check_in_time: new Date().toISOString(), 
        is_checked_in: true 
      };
      
      setVisitors(prev => prev.map(v => 
        v.id === visitor.id ? updatedVisitor : v
      ));
      
      // Show success alert
      Alert.alert('Success', `${visitor.name} has been checked in`, [{ text: 'OK' }]);
      
    } catch (error) {
      console.error('Error checking in visitor:', error);
      Alert.alert('Error', 'Failed to check in visitor', [{ text: 'OK' }]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <Animated.View 
      style={[
        styles.container, 
        { 
          backgroundColor: theme.background,
          opacity: fadeAnim,
          transform: [
            { translateY: slideAnim },
            { scale: scaleAnim }
          ]
        }
      ]}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card }]}>
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
                Guard Dashboard
              </Text>
              <Text style={[styles.headerSubtitle, { color: theme.text + 'CC' }]}>
                {guardData?.name || 'Security Guard'}
              </Text>
            </View>
          </View>
          <TouchableOpacity 
            style={[styles.headerButton, { backgroundColor: theme.primary + '15' }]}
            onPress={handleSignOut}
          >
            <Ionicons name="log-out-outline" size={24} color={theme.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={[styles.quickActionsContainer, { backgroundColor: theme.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          <TouchableOpacity 
            style={[styles.quickActionButton, { backgroundColor: theme.primary }]}
            onPress={() => setCodeModalVisible(true)}
          >
            <Ionicons name="keypad-outline" size={24} color="white" />
            <Text style={styles.quickActionText}>Enter Access Code</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.quickActionButton, { backgroundColor: theme.secondary }]}
            onPress={() => setModalVisible(true)}
          >
            <Ionicons name="person-add-outline" size={24} color="white" />
            <Text style={styles.quickActionText}>Manual Entry</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Visitors */}
      <View style={[styles.content, { paddingBottom: Platform.OS === 'ios' ? 85 : 65 }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Recent Visitors
          </Text>
          <TouchableOpacity 
            style={[styles.refreshButton, { backgroundColor: theme.primaryLight }]}
            onPress={handleRefresh}
          >
            <Ionicons name="refresh-outline" size={20} color={theme.primary} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.text + 'CC' }]}>
              Loading visitors...
            </Text>
          </View>
        ) : visitors.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: theme.card }]}>
            <Ionicons name="people-outline" size={48} color={theme.text + 'CC'} />
            <Text style={[styles.emptyText, { color: theme.text + 'CC' }]}>
              No visitors registered yet
            </Text>
          </View>
        ) : (
          <ScrollView 
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={handleRefresh}
                colors={[theme.primary]}
                tintColor={theme.primary}
              />
            }
          >
            {visitors.map(visitor => (
              <View 
                key={visitor.id} 
                style={[styles.visitorCard, { 
                  backgroundColor: theme.card,
                  borderColor: theme.border
                }]}
              >
                <View style={styles.visitorHeader}>
                  <View style={styles.visitorInfo}>
                    <View style={[styles.avatarContainer, { backgroundColor: theme.primaryLight }]}>
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
                  <View style={[
                    styles.statusBadge, 
                    { 
                      backgroundColor: getStatusColor(visitor).bg
                    }
                  ]}>
                    <Text style={[
                      styles.statusText, 
                      { 
                        color: getStatusColor(visitor).text
                      }
                    ]}>
                      {getStatusLabel(visitor)}
                    </Text>
                  </View>
                </View>

                <View style={styles.visitorDetails}>
                  {visitor.phone && (
                    <View style={styles.detailItem}>
                      <Ionicons name="call-outline" size={16} color={theme.text + 'CC'} />
                      <Text style={[styles.detailText, { color: theme.text }]}>
                        {visitor.phone}
                      </Text>
                    </View>
                  )}
                  
                  {visitor.purpose && (
                    <View style={styles.detailItem}>
                      <Ionicons name="information-circle-outline" size={16} color={theme.text + 'CC'} />
                      <Text style={[styles.detailText, { color: theme.text }]}>
                        {visitor.purpose}
                      </Text>
                    </View>
                  )}
                  
                  {visitor.check_in_time ? (
                    <View style={styles.detailItem}>
                      <Ionicons name="time-outline" size={16} color={theme.text + 'CC'} />
                      <Text style={[styles.detailText, { color: theme.text }]}>
                        In: {new Date(visitor.check_in_time).toLocaleTimeString('en-US', { 
                          hour: '2-digit', 
                          minute: '2-digit',
                          hour12: true 
                        })}
                      </Text>
                    </View>
                  ) : visitor.approval_status === 'approved' && (visitor.manually_added || visitor.added_by_guard) ? (
                    <View style={styles.detailItem}>
                      <Ionicons name="checkmark-circle-outline" size={16} color={theme.success} />
                      <Text style={[styles.detailText, { color: theme.success }]}>
                        Approved by resident - Ready for direct check-in
                      </Text>
                    </View>
                  ) : visitor.approval_status === 'approved' ? (
                    <View style={styles.detailItem}>
                      <Ionicons name="key-outline" size={16} color={theme.primary} />
                      <Text style={[styles.detailText, { color: theme.primary }]}>
                        Pre-approved - Use access code to check in
                      </Text>
                    </View>
                  ) : visitor.approval_status === 'pending' && (visitor.manually_added || visitor.added_by_guard) ? (
                    <View style={styles.detailItem}>
                      <Ionicons name="time-outline" size={16} color={theme.warning} />
                      <Text style={[styles.detailText, { color: theme.warning }]}>
                        Waiting for resident approval - Cannot check in yet
                      </Text>
                    </View>
                  ) : visitor.approval_status === 'rejected' ? (
                    <View style={styles.detailItem}>
                      <Ionicons name="close-circle-outline" size={16} color={theme.error} />
                      <Text style={[styles.detailText, { color: theme.error }]}>
                        Rejected by resident - Cannot check in
                      </Text>
                    </View>
                  ) : null}
                  
                  {visitor.check_out_time && (
                    <View style={styles.detailItem}>
                      <Ionicons name="exit-outline" size={16} color={theme.text + 'CC'} />
                      <Text style={[styles.detailText, { color: theme.text }]}>
                        Out: {new Date(visitor.check_out_time).toLocaleTimeString('en-US', { 
                          hour: '2-digit', 
                          minute: '2-digit', 
                          hour12: true 
                        })}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Show check-in button ONLY for post-approved visitors (added by guard, approved by resident) */}
                {visitor.approval_status === 'approved' && !visitor.check_in_time && !visitor.is_checked_in && 
                 (visitor.manually_added === true || visitor.added_by_guard === true) && (
                  <TouchableOpacity
                    style={[styles.checkInButton, { backgroundColor: theme.success }]}
                    onPress={() => processApprovedVisitorCheckIn(visitor)}
                  >
                    <Ionicons name="log-in-outline" size={20} color="white" />
                    <Text style={styles.checkInButtonText}>Check In</Text>
                  </TouchableOpacity>
                )}

                {/* Show checkout button for checked-in visitors */}
                {!visitor.check_out_time && visitor.check_in_time && (
                  <TouchableOpacity
                    style={[styles.checkoutButton, { backgroundColor: theme.primary }]}
                    onPress={() => handleCheckOutVisitor(visitor.id)}
                  >
                    <Ionicons name="exit-outline" size={20} color="white" />
                    <Text style={styles.checkoutButtonText}>Check Out</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Manual Code Entry Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={codeModalVisible}
        onRequestClose={() => setCodeModalVisible(false)}
      >
        <View style={[{ 
          flex: 1, 
          backgroundColor: isDarkMode ? theme.background : 'white',
          paddingTop: Platform.OS === 'ios' ? 60 : 40,
          justifyContent: 'flex-start',
          alignItems: 'center'
        }]}>
          <View style={[styles.modalHeader, { width: '100%' }]}>
            <TouchableOpacity
              style={{ padding: 8 }}
              onPress={() => setCodeModalVisible(false)}
            >
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>
            
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Enter Access Code
            </Text>
            
            <View style={{ width: 40 }} />
          </View>
          
          <View style={[styles.codeEntryContainer, { marginTop: 40 }]}>
            <TextInput
              style={[styles.codeInput, { 
                backgroundColor: isDarkMode ? '#3F3F3F' : theme.inputBackground,
                color: isDarkMode ? '#FFFFFF' : theme.text,
                borderColor: theme.border,
                width: '80%',
                maxWidth: 300
              }]}
              value={accessCode}
              onChangeText={setAccessCode}
              placeholder="Enter 6-digit code"
              placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.6)' : theme.textSecondary}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
            
            <TouchableOpacity
              style={[styles.codeSubmitButton, { 
                backgroundColor: theme.primary,
                width: '80%',
                maxWidth: 300,
                marginTop: 20
              }]}
              onPress={handleSubmitAccessCode}
            >
              <Text style={styles.codeModalButtonText}>Submit Code</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Manual Visitor Entry Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={modalVisible}
        onRequestClose={() => {
          setModalVisible(false);
          clearResidentSelection();
        }}
      >
        <View style={[{ 
          flex: 1, 
          backgroundColor: isDarkMode ? theme.background : 'white',
          paddingTop: Platform.OS === 'ios' ? 60 : 40
        }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={{ padding: 8 }}
              onPress={() => {
                setModalVisible(false);
                clearResidentSelection();
              }}
            >
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>
            
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Register New Visitor
            </Text>
            
            <View style={{ width: 40 }} />
          </View>

          <ScrollView 
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.formContainer}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Visitor Name *</Text>
                <TextInput
                  style={[styles.textInput, { 
                    color: isDarkMode ? '#FFFFFF' : theme.text,
                    backgroundColor: isDarkMode ? '#3F3F3F' : theme.input,
                    borderColor: theme.border
                  }]}
                  placeholder="Enter visitor name"
                  placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.6)' : theme.textSecondary}
                  value={visitorName}
                  onChangeText={setVisitorName}
                  returnKeyType="next"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Phone Number</Text>
                <TextInput
                  style={[styles.textInput, { 
                    color: isDarkMode ? '#FFFFFF' : theme.text,
                    backgroundColor: isDarkMode ? '#3F3F3F' : theme.input,
                    borderColor: theme.border
                  }]}
                  placeholder="Enter phone number"
                  placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.6)' : theme.textSecondary}
                  value={visitorPhone}
                  onChangeText={setVisitorPhone}
                  keyboardType="phone-pad"
                  returnKeyType="next"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Purpose of Visit</Text>
                <TextInput
                  style={[styles.textInput, { 
                    color: isDarkMode ? '#FFFFFF' : theme.text,
                    backgroundColor: isDarkMode ? '#3F3F3F' : theme.input,
                    borderColor: theme.border
                  }]}
                  placeholder="Delivery, Maintenance, etc."
                  placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.6)' : theme.textSecondary}
                  value={visitorPurpose}
                  onChangeText={setVisitorPurpose}
                  returnKeyType="next"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Select Resident *</Text>
                <View style={styles.residentSearchContainer}>
                  <View style={[styles.residentSearchInputContainer, { 
                    backgroundColor: isDarkMode ? '#3F3F3F' : theme.input,
                    borderColor: theme.border
                  }]}>
                    <TextInput
                      style={[styles.residentSearchInput, { color: isDarkMode ? '#FFFFFF' : theme.text }]}
                      placeholder="Search resident by name or unit"
                      placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.6)' : theme.textSecondary}
                      value={residentSearchText}
                      onChangeText={(text) => {
                        setResidentSearchText(text);
                        setShowResidentDropdown(true);
                        if (!text) {
                          setSelectedResident(null);
                          setFlatNumber('');
                        }
                      }}
                      onFocus={() => setShowResidentDropdown(true)}
                      returnKeyType="next"
                    />
                    {residentSearchText ? (
                      <TouchableOpacity onPress={clearResidentSelection}>
                        <Ionicons name="close-circle" size={20} color={isDarkMode ? 'rgba(255,255,255,0.7)' : theme.textSecondary} />
                      </TouchableOpacity>
                    ) : (
                      <Ionicons name="search" size={20} color={isDarkMode ? 'rgba(255,255,255,0.7)' : theme.textSecondary} />
                    )}
                  </View>
                  
                  {/* Add helper text explaining the approval workflow */}
                  <Text style={[styles.helperText, { color: isDarkMode ? 'rgba(255,255,255,0.7)' : theme.textSecondary }]}>
                    {selectedResident ? 
                      "Resident selected. Visitor will require approval." : 
                      "Search for resident by name or enter flat number manually. All visitors require approval."}
                  </Text>
                  
                  {showResidentDropdown && (
                    <View style={[styles.residentDropdown, { 
                      backgroundColor: theme.card,
                      borderColor: theme.border,
                      display: showResidentDropdown ? 'flex' : 'none'
                    }]}>
                      {loadingResidents ? (
                        <ActivityIndicator size="small" color={theme.primary} style={styles.dropdownLoader} />
                      ) : filteredResidents.length > 0 ? (
                        <ScrollView style={styles.residentList} keyboardShouldPersistTaps="handled">
                          {filteredResidents.map(resident => (
                            <TouchableOpacity
                              key={resident.id}
                              style={[styles.residentItem, { 
                                backgroundColor: selectedResident?.id === resident.id ? 
                                  theme.primary + '20' : 'transparent' 
                              }]}
                              onPress={() => handleSelectResident(resident)}
                            >
                              <Text style={[styles.residentName, { color: theme.text }]}>
                                {resident.name}
                              </Text>
                              <Text style={[styles.residentUnit, { color: isDarkMode ? 'rgba(255,255,255,0.7)' : theme.textSecondary }]}>
                                Unit: {resident.unit_number}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      ) : (
                        <Text style={[styles.noResultsText, { color: isDarkMode ? 'rgba(255,255,255,0.7)' : theme.textSecondary }]}>
                          No residents found
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Flat Number *</Text>
                <TextInput
                  style={[styles.textInput, { 
                    color: isDarkMode ? '#FFFFFF' : theme.text,
                    backgroundColor: isDarkMode ? '#3F3F3F' : theme.input,
                    borderColor: theme.border
                  }]}
                  placeholder="Enter flat number/ID"
                  placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.6)' : theme.textSecondary}
                  value={flatNumber}
                  onChangeText={setFlatNumber}
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    if (visitorName && (selectedResident || flatNumber)) {
                      handleAddVisitor();
                    } else {
                      Alert.alert('Error', 'Please fill in all required fields', [{ text: 'OK' }]);
                    }
                  }}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.submitButton, 
                  { 
                    backgroundColor: theme.primary,
                    opacity: submitting ? 0.7 : 1,
                    marginTop: 24,
                    marginBottom: 40
                  }
                ]}
                onPress={() => {
                  if (!submitting) {
                    handleAddVisitor();
                  }
                }}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>Register Visitor</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Display the Sidebar component */}
      <GuardSidebar 
        visible={sidebarVisible} 
        onClose={() => setSidebarVisible(false)} 
        guardData={guardData}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
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
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionsContainer: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  quickActionText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  refreshButton: {
    padding: 8,
    borderRadius: 20,
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
    opacity: 0.8,
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
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
  checkoutButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    paddingBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  formContainer: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  submitButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  codeModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
  },
  codeModalContent: {
    width: '100%',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    maxWidth: 400,
  },
  codeModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  codeInput: {
    height: 60,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 20,
  },
  codeModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  codeModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  codeModalButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  residentSearchContainer: {
    position: 'relative',
    zIndex: 1000,
  },
  residentSearchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  residentSearchInput: {
    flex: 1,
    fontSize: 16,
  },
  residentDropdown: {
    position: 'absolute',
    top: 46,
    left: 0,
    right: 0,
    maxHeight: 200,
    borderWidth: 1,
    borderRadius: 6,
    zIndex: 1001,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  residentList: {
    maxHeight: 200,
  },
  residentItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  residentName: {
    fontSize: 16,
    fontWeight: '500',
  },
  residentUnit: {
    fontSize: 14,
    marginTop: 2,
  },
  noResultsText: {
    padding: 12,
    textAlign: 'center',
  },
  dropdownLoader: {
    padding: 16,
  },
  helperText: {
    marginBottom: 8,
    fontSize: 12,
  },
  checkInButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
  checkInButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  buttonIcon: {
    marginRight: 8,
  },
  formScrollContainer: {
    height: 400,
  },
  formScrollContent: {
    paddingVertical: 10,
  },
  codeEntryContainer: {
    padding: 20,
    alignItems: 'center',
  },
  codeSubmitButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
}); 