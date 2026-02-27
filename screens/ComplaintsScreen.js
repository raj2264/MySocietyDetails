import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Keyboard,
  Platform,
  Animated,
  Alert,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppLayout from '../components/AppLayout';
import { useRouter } from 'expo-router';

const ComplaintsScreen = () => {
  const { theme, isDarkMode } = useTheme();
  const { user, residentData } = useAuth();
  const router = useRouter();
  
  // State for tabs
  const [activeTab, setActiveTab] = useState('personal');
  
  // State for complaints data
  const [personalComplaints, setPersonalComplaints] = useState([]);
  const [communityComplaints, setCommunityComplaints] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  
  // State for animation
  const fadeAnim = useState(new Animated.Value(0))[0];
  const translateY = useState(new Animated.Value(20))[0];
  
  // Format date helper function
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    });
  };
  
  // Animation functions
  const startAnimation = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  };
  
  const resetAnimation = () => {
    fadeAnim.setValue(0);
    translateY.setValue(20);
  };
  
  // Function to fetch complaints data
  const fetchComplaints = async () => {
    try {
      if (!residentData?.society_id) {
        console.log('No society ID found in resident data');
        setPersonalComplaints([]);
        setCommunityComplaints([]);
        setError('Unable to fetch complaints. No society information found.');
        return;
      }
      
      console.log('Fetching complaints for society ID:', residentData.society_id);
      
      // Fetch all complaints for this society
      const { data, error } = await supabase
        .from('complaints')
        .select('*, residents(name, unit_number), complaint_updates(id, user_id, is_admin, comment, created_at)')
        .eq('society_id', residentData.society_id)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching complaints:', error.message);
        setError(`Unable to load complaints: ${error.message}`);
        return;
      }
      
      if (data) {
        console.log(`Successfully fetched ${data.length} complaints`);
        
        // Filter personal and community complaints
        const personal = data.filter(complaint => 
          complaint.type === 'personal' && complaint.resident_id === residentData.id
        );
        
        const community = data.filter(complaint => 
          complaint.type === 'community'
        );
        
        setPersonalComplaints(personal);
        setCommunityComplaints(community);
        
        resetAnimation();
        setTimeout(startAnimation, 150);
      } else {
        setPersonalComplaints([]);
        setCommunityComplaints([]);
      }
    } catch (error) {
      console.error('Exception while fetching complaints:', error);
      setError(`Unable to load complaints: ${error.message}`);
    }
  };
  
  // Fetch complaints when the screen is focused
  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      fetchComplaints().finally(() => setIsLoading(false));
      
      return () => {
        // Clean up when screen loses focus
      };
    }, [residentData?.society_id])
  );
  
  // Pull to refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchComplaints();
    setIsRefreshing(false);
  };
  
  // Navigate to add new complaint
  const handleAddComplaint = () => {
    router.push('/add-complaint');
  };
  
  // Navigate to complaint details
  const handleViewComplaint = (complaint) => {
    router.push({
      pathname: '/complaint-details',
      params: { complaintId: complaint.id }
    });
  };
  
  // Render complaint status badge
  const renderStatusBadge = (status) => {
    let backgroundColor, textColor;
    
    switch (status) {
      case 'pending':
        backgroundColor = isDarkMode ? '#4A3800' : '#FFF9DB';
        textColor = isDarkMode ? '#FFD43B' : '#704700';
        break;
      case 'in_progress':
        backgroundColor = isDarkMode ? '#063461' : '#E6F4FF';
        textColor = isDarkMode ? '#339AF0' : '#1B64A5';
        break;
      case 'resolved':
        backgroundColor = isDarkMode ? '#134F22' : '#E6FCF0';
        textColor = isDarkMode ? '#40C057' : '#175E2A';
        break;
      case 'rejected':
        backgroundColor = isDarkMode ? '#61171E' : '#FFF0F1';
        textColor = isDarkMode ? '#FA5252' : '#921B26';
        break;
      default:
        backgroundColor = isDarkMode ? '#343A40' : '#F8F9FA';
        textColor = isDarkMode ? '#E9ECEF' : '#495057';
    }
    
    return (
      <View style={[styles.badge, { backgroundColor }]}>
        <Text style={[styles.badgeText, { color: textColor }]}>
          {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
        </Text>
      </View>
    );
  };
  
  // Render complaint item in list
  const renderComplaintItem = ({ item }) => {
    return (
      <TouchableOpacity 
        style={[styles.complaintCard, { backgroundColor: theme.card }]}
        onPress={() => handleViewComplaint(item)}
        activeOpacity={0.7}
      >
        <View style={styles.complaintHeader}>
          <View style={styles.complaintTitleContainer}>
            <Text style={[styles.complaintTitle, { color: theme.text }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[styles.complaintDate, { color: theme.textSecondary || theme.text + '99' }]}>
              {formatDate(item.created_at)}
            </Text>
          </View>
          {renderStatusBadge(item.status)}
        </View>
        
        <Text style={[styles.complaintDescription, { color: theme.textSecondary || theme.text + '99' }]} numberOfLines={2}>
          {item.description}
        </Text>
        
        <View style={styles.complaintFooter}>
          <View style={styles.complaintStats}>
            <View style={styles.statItem}>
              <Ionicons name="chatbubble-outline" size={14} color={theme.textSecondary || theme.text + '99'} />
              <Text style={[styles.statText, { color: theme.textSecondary || theme.text + '99' }]}>
                {item.complaint_updates?.length || 0} updates
              </Text>
            </View>
          </View>
          
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary || theme.text + '99'} />
        </View>
      </TouchableOpacity>
    );
  };
  
  // Empty state component
  const EmptyComponent = ({ type }) => (
    <Animated.View 
      style={[
        styles.emptyContainer,
        { 
          opacity: fadeAnim,
          transform: [{ translateY: translateY }]
        }
      ]}
    >
      <Ionicons
        name={type === 'personal' ? 'document-text-outline' : 'people-outline'}
        size={60}
        color={theme.textSecondary || theme.text + '80'}
        style={styles.emptyIcon}
      />
      <Text style={[styles.emptyTitle, { color: theme.text }]}>
        No {type} complaints yet
      </Text>
      <Text style={[styles.emptyDescription, { color: theme.textSecondary || theme.text + '99' }]}>
        {type === 'personal' 
          ? 'Your personal complaints will appear here'
          : 'Community complaints shared with all residents will appear here'}
      </Text>
      <TouchableOpacity
        style={[styles.emptyButton, { backgroundColor: theme.primary }]}
        onPress={handleAddComplaint}
      >
        <Text style={[styles.emptyButtonText, { color: theme.buttonText || '#FFFFFF' }]}>
          Submit a Complaint
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
  
  // Loading component
  const LoadingComponent = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={theme.primary} />
      <Text style={[styles.loadingText, { color: theme.text }]}>
        Loading complaints...
      </Text>
    </View>
  );
  
  // Main content renderer
  const renderContent = () => {
    if (isLoading) {
      return <LoadingComponent />;
    }
    
    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.error} />
          <Text style={[styles.errorText, { color: theme.text }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.primary }]}
            onPress={() => {
              setError(null);
              setIsLoading(true);
              fetchComplaints().finally(() => setIsLoading(false));
            }}
          >
            <Text style={[styles.retryButtonText, { color: theme.buttonText }]}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    const complaintsToShow = activeTab === 'personal' ? personalComplaints : communityComplaints;
    
    return (
      <Animated.View 
        style={[
          styles.contentContainer,
          { 
            opacity: fadeAnim,
            transform: [{ translateY: translateY }]
          }
        ]}
      >
        <FlatList
          data={complaintsToShow}
          keyExtractor={(item) => item.id}
          renderItem={renderComplaintItem}
          ListEmptyComponent={<EmptyComponent type={activeTab} />}
          contentContainerStyle={
            complaintsToShow.length === 0 
              ? styles.emptyListContent 
              : styles.listContent
          }
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[theme.primary]}
              tintColor={theme.primary}
            />
          }
        />
      </Animated.View>
    );
  };
  
  return (
    <AppLayout title="Complaints" showBack={true}>
      <View style={styles.container}>
        <View style={[styles.tabsContainer, { backgroundColor: isDarkMode ? theme.card : theme.card }]}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'personal' && [
                styles.activeTab, 
                { 
                  borderColor: theme.primary,
                  backgroundColor: activeTab === 'personal' && isDarkMode ? theme.primary + '30' : 'transparent'
                }
              ]
            ]}
            onPress={() => setActiveTab('personal')}
          >
            <Ionicons
              name="document-text-outline"
              size={18}
              color={activeTab === 'personal' ? theme.primary : (isDarkMode ? '#CCCCCC' : theme.textSecondary)}
              style={styles.tabIcon}
            />
            <Text
              style={[
                styles.tabText,
                { 
                  color: activeTab === 'personal' ? theme.primary : (isDarkMode ? '#CCCCCC' : theme.textSecondary),
                  fontWeight: activeTab === 'personal' ? '700' : '600'
                }
              ]}
            >
              Personal
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'community' && [
                styles.activeTab, 
                { 
                  borderColor: theme.primary,
                  backgroundColor: activeTab === 'community' && isDarkMode ? theme.primary + '30' : 'transparent'
                }
              ]
            ]}
            onPress={() => setActiveTab('community')}
          >
            <Ionicons
              name="people-outline"
              size={18}
              color={activeTab === 'community' ? theme.primary : (isDarkMode ? '#CCCCCC' : theme.textSecondary)}
              style={styles.tabIcon}
            />
            <Text
              style={[
                styles.tabText,
                { 
                  color: activeTab === 'community' ? theme.primary : (isDarkMode ? '#CCCCCC' : theme.textSecondary),
                  fontWeight: activeTab === 'community' ? '700' : '600'
                }
              ]}
            >
              Community
            </Text>
          </TouchableOpacity>
        </View>
        
        {renderContent()}
        
        <TouchableOpacity
          style={[styles.fabButton, { backgroundColor: theme.primary }]}
          onPress={handleAddComplaint}
        >
          <Ionicons name="add" size={26} color={theme.buttonText || '#FFFFFF'} />
        </TouchableOpacity>
      </View>
    </AppLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderColor: 'transparent',
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  tabIcon: {
    marginRight: 6,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 80, // Space for FAB
  },
  emptyListContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 80, // Space for FAB
    justifyContent: 'center',
  },
  complaintCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  complaintHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  complaintTitleContainer: {
    flex: 1,
    marginRight: 8,
  },
  complaintTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  complaintDate: {
    fontSize: 12,
  },
  complaintDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  complaintFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  complaintStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  statText: {
    fontSize: 12,
    marginLeft: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 24,
  },
  emptyButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '600',
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 16,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  fabButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
});

export default ComplaintsScreen; 