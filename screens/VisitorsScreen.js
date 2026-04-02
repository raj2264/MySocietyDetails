import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  Animated,
  Platform,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useFocusEffect } from '@react-navigation/native';
import VisitorForm from '../components/VisitorForm';
import VisitorCard from '../components/VisitorCard';
import useNoStuckLoading from '../hooks/useNoStuckLoading';

export default function VisitorsScreen() {
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  useNoStuckLoading(loading, setLoading);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const hasLoadedOnceRef = useRef(false);
  const isFetchingRef = useRef(false);
  
  const { theme, isDarkMode } = useTheme();
  const { residentData } = useAuth();

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0.95)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;
  const scaleAnim = useRef(new Animated.Value(0.99)).current;

  // Add entrance animation
  useEffect(() => {
    if (!loading && !refreshing) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }),
      ]).start();
    }
  }, [loading, refreshing]);

  // Load visitors when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (!residentData?.id || isFetchingRef.current) return;
      const shouldShowLoader = !hasLoadedOnceRef.current;
      if (shouldShowLoader) {
        setLoading(true);
      }
      isFetchingRef.current = true;
      Promise.resolve(loadVisitors())
        .catch(error => console.error('Error in loadVisitors:', error))
        .finally(() => {
          isFetchingRef.current = false;
          setLoading(false);
          hasLoadedOnceRef.current = true;
        });
      return () => {}; // cleanup function
    }, [residentData?.id])
  );

  const loadVisitors = useCallback(async () => {
    if (!residentData?.id) {
      return;
    }

    try {
      console.log('Loading visitors for resident ID:', residentData.id);
      
      const { data, error } = await supabase
        .from('visitors')
        .select('*')
        .eq('resident_id', residentData.id)
        .order('created_at', { ascending: false });
        
      if (error) {
        throw error;
      }
      
      console.log(`Loaded ${data?.length || 0} visitors`);
      setVisitors(data || []);
    } catch (error) {
      console.error('Error loading visitors:', error);
      Alert.alert('Error', 'Failed to load visitors');
    }
  }, [residentData?.id]);

  const handleRefresh = () => {
    if (isFetchingRef.current) return;
    setRefreshing(true);
    isFetchingRef.current = true;
    Promise.resolve(loadVisitors())
      .catch(error => console.error('Error during refresh:', error))
      .finally(() => {
        isFetchingRef.current = false;
        setRefreshing(false);
      });
  };

  const handleAddVisitor = (newVisitor) => {
    setVisitors([newVisitor, ...visitors]);
    setModalVisible(false);
  };

  const handleDeleteVisitor = async (visitorId) => {
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('visitors')
        .delete()
        .eq('id', visitorId);
        
      if (error) {
        throw error;
      }
      
      // Update local state
      setVisitors(visitors.filter(visitor => visitor.id !== visitorId));
      Alert.alert('Success', 'Visitor deleted successfully');
    } catch (error) {
      console.error('Error deleting visitor:', error);
      Alert.alert('Error', 'Failed to delete visitor');
    } finally {
      setLoading(false);
    }
  };

  // Add function to handle visitor approval status changes
  const handleVisitorApproval = async (visitorId, status) => {
    try {
      // Update local visitors state with the new approval status
      setVisitors(prevVisitors => 
        prevVisitors.map(visitor => 
          visitor.id === visitorId 
            ? { ...visitor, approval_status: status } 
            : visitor
        )
      );
      
      // If a visitor was approved, remember their information for future auto-approvals
      const approvedVisitor = visitors.find(v => v.id === visitorId);
      if (status === 'approved' && approvedVisitor && approvedVisitor.name) {
        console.log(`Visitor ${approvedVisitor.name} was approved, checking for other pending visits`);
        
        // Check for other pending visitors with the same name
        const { data: pendingVisits, error } = await supabase
          .from('visitors')
          .select('id')
          .eq('name', approvedVisitor.name)
          .eq('resident_id', residentData.id)
          .eq('approval_status', 'pending')
          .eq('society_id', residentData.society_id)
          .not('id', 'eq', visitorId); // Exclude the currently approved visit
          
        if (!error && pendingVisits && pendingVisits.length > 0) {
          console.log(`Found ${pendingVisits.length} other pending visits for ${approvedVisitor.name}, auto-approving`);
          
          // Auto-approve the other pending visits
          for (const pendingVisit of pendingVisits) {
            await supabase
              .from('visitors')
              .update({ approval_status: 'approved' })
              .eq('id', pendingVisit.id);
            
            // Update local state
            setVisitors(prevVisitors => 
              prevVisitors.map(visitor => 
                visitor.id === pendingVisit.id 
                  ? { ...visitor, approval_status: 'approved' } 
                  : visitor
              )
            );
          }
          
          // Show notification to the user
          if (pendingVisits.length > 0) {
            Alert.alert(
              'Auto-approved',
              `${pendingVisits.length} other pending visits for ${approvedVisitor.name} were also approved.`,
              [{ text: 'OK' }]
            );
          }
        }
      }
    } catch (error) {
      console.error('Error handling visitor approval:', error);
    }
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <StatusBar barStyle={theme.dark ? 'light-content' : 'dark-content'} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.text + 'CC' }]}>
            Loading visitors...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.dark ? 'light-content' : 'dark-content'} />
      
      {/* Floating Action Button */}
      <TouchableOpacity 
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="add" size={24} color="white" />
      </TouchableOpacity>

      {/* Visitor List */}
      <Animated.View 
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [
              { translateY: slideAnim },
              { scale: scaleAnim }
            ]
          }
        ]}
      >
        <ScrollView 
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={handleRefresh}
              colors={[theme.primary]}
              tintColor={theme.primary}
            />
          }
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header Section */}
          <View style={styles.headerSection}>
            <View>
              <Text style={[styles.headerSubtitle, { color: theme.text + 'CC' }]}>
                {visitors.length} visitor{visitors.length !== 1 ? 's' : ''} registered
              </Text>
            </View>
            <View style={[styles.headerStats, { backgroundColor: theme.card }]}>
              <View style={styles.statItem}>
                <Ionicons name="time-outline" size={20} color={theme.primary} />
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {visitors.filter(v => !v.check_out_time && v.check_in_time).length}
                </Text>
                <Text style={[styles.statLabel, { color: theme.text + 'CC' }]}>Active</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
              <View style={styles.statItem}>
                <Ionicons name="checkmark-circle-outline" size={20} color={theme.success} />
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {visitors.filter(v => v.check_out_time).length}
                </Text>
                <Text style={[styles.statLabel, { color: theme.text + 'CC' }]}>Checked Out</Text>
              </View>
            </View>
          </View>

          {visitors.length === 0 ? (
            <View style={[styles.emptyContainer, { backgroundColor: theme.card }]}>
              <View style={[styles.emptyIconContainer, { backgroundColor: theme.primary + '15' }]}>
                <Ionicons 
                  name="people-outline" 
                  size={48} 
                  color={theme.primary} 
                />
              </View>
              <Text style={[styles.emptyText, { color: theme.text }]}>
                No Visitors Yet
              </Text>
              <Text style={[styles.emptySubtext, { color: theme.text + 'CC' }]}>
                Add your first visitor by tapping the + button
              </Text>
              <TouchableOpacity
                style={[styles.emptyButton, { backgroundColor: theme.primary }]}
                onPress={() => setModalVisible(true)}
              >
                <Ionicons name="add" size={20} color="white" style={styles.emptyButtonIcon} />
                <Text style={styles.emptyButtonText}>Add Visitor</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.visitorList}>
              {visitors.map(visitor => (
                <VisitorCard 
                  key={visitor.id} 
                  visitor={visitor} 
                  onDelete={handleDeleteVisitor}
                  onApproval={handleVisitorApproval}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </Animated.View>

      {/* Add Visitor Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.02)' }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Add New Visitor
              </Text>
              <TouchableOpacity 
                style={[styles.closeButton, { backgroundColor: theme.card }]}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            
            <VisitorForm 
              residentData={residentData} 
              onSuccess={handleAddVisitor} 
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 16,
  },
  headerSection: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    marginBottom: 16,
  },
  headerStats: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    marginHorizontal: 16,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 4,
  },
  statLabel: {
    fontSize: 14,
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
  visitorList: {
    gap: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    borderRadius: 16,
    marginTop: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 32,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  emptyButtonIcon: {
    marginRight: 8,
  },
  emptyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: Platform.OS === 'ios' ? 85 : 65,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    zIndex: 1000,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
  },
  modalContent: {
    flex: 1,
    marginTop: '12%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
}); 