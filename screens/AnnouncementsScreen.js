import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
  Animated,
  Alert,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase, fetchTable } from '../lib/supabase';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppLayout from '../components/AppLayout';


import useNoStuckLoading from '../hooks/useNoStuckLoading';
const AnnouncementsScreen = () => {
  const { announcementId } = useLocalSearchParams();
  const { theme, isDarkMode } = useTheme();
  const { user, residentData } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  useNoStuckLoading(isLoading, setIsLoading);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const hasLoadedOnceRef = useRef(false);
  
  // Keep track of the latest announcement ID to detect new ones
  const latestAnnouncementRef = useRef(null);
  // Poll interval in ms
  const POLL_INTERVAL = 30000; // 30 seconds
  // Store the polling timer
  const pollingTimerRef = useRef(null);
  
  // Animation values
  const fadeAnim = useState(new Animated.Value(0.95))[0];
  const translateY = useState(new Animated.Value(10))[0];
  
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
  
  // Helper function to format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    });
  };
  
  // Helper function to get time ago
  const getTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    const diffMonth = Math.floor(diffDay / 30);
    const diffYear = Math.floor(diffMonth / 12);

    if (diffYear > 0) {
      return diffYear === 1 ? '1 year ago' : `${diffYear} years ago`;
    } else if (diffMonth > 0) {
      return diffMonth === 1 ? '1 month ago' : `${diffMonth} months ago`;
    } else if (diffDay > 0) {
      return diffDay === 1 ? '1 day ago' : `${diffDay} days ago`;
    } else if (diffHour > 0) {
      return diffHour === 1 ? '1 hour ago' : `${diffHour} hours ago`;
    } else if (diffMin > 0) {
      return diffMin === 1 ? '1 minute ago' : `${diffMin} minutes ago`;
    } else {
      return 'just now';
    }
  };
  
  const fetchAnnouncements = async (isRefresh = false) => {
    try {
      setError(null);
      if (!residentData?.society_id) {
        console.log('No society ID found in resident data');
        // Don't set empty array or error when residentData isn't ready yet - wait for it
        if (residentData !== null && residentData !== undefined) {
          setAnnouncements([]);
        }
        if (!isRefresh) {
          setIsLoading(false);
        }
        setIsRefreshing(false);
        return;
      }
      
      console.log('Fetching announcements for society ID:', residentData.society_id);
      
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('society_id', residentData.society_id)
        .eq('active', true)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching announcements:', error.message);
        setError(`Unable to load announcements: ${error.message}`);
        return;
      }
      
      if (data) {
        console.log(`Successfully fetched ${data.length} announcements`);
        setAnnouncements(data);
        
        // Store the latest announcement ID for later comparison
        if (data.length > 0) {
          latestAnnouncementRef.current = data[0].id;
        }
        
        resetAnimation();
        setTimeout(startAnimation, 150);
      } else {
        setAnnouncements([]);
      }
    } catch (error) {
      console.error('Exception while fetching announcements:', error);
      setError(`Unable to load announcements: ${error.message}`);
    }
  };
  
  // Poll for new announcements
  const pollForNewAnnouncements = async () => {
    try {
      if (!residentData?.society_id || !latestAnnouncementRef.current) return;
      
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('society_id', residentData.society_id)
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) {
        console.error('Error polling for announcements:', error);
        return;
      }
      
      // Check if there are any new announcements
      if (data && data.length > 0 && data[0].id !== latestAnnouncementRef.current) {
        // Find all new announcements (ones that are newer than our latest)
        const newAnnouncements = data.filter(announcement => 
          !announcements.some(existing => existing.id === announcement.id)
        );
        
        // Update latest for next poll
        latestAnnouncementRef.current = data[0].id;
        
        // Notify about new announcements if there are any
        if (newAnnouncements.length > 0) {
          // Show notification for the newest announcement
          const newest = newAnnouncements[0];
          Alert.alert(
            newest.title,
            newest.content.substring(0, 100) + (newest.content.length > 100 ? '...' : ''),
            [{ text: 'View', onPress: () => fetchAnnouncements() }, { text: 'Dismiss' }]
          );
        }
      }
    } catch (err) {
      console.error('Error during announcement polling:', err);
    }
  };
  
  // This effect runs when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (!residentData?.society_id) return;
      const shouldShowLoader = !hasLoadedOnceRef.current;
      if (shouldShowLoader) {
        setIsLoading(true);
      }
      fetchAnnouncements(false).finally(() => {
        setIsLoading(false);
        hasLoadedOnceRef.current = true;
      });
      
      // Set up polling for new announcements
      pollingTimerRef.current = setInterval(pollForNewAnnouncements, POLL_INTERVAL);
      
      return () => {
        // Clean up polling timer when screen loses focus
        if (pollingTimerRef.current) {
          clearInterval(pollingTimerRef.current);
        }
      };
    }, [residentData?.society_id])
  );
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchAnnouncements(true);
    setIsRefreshing(false);
  };
  
  // Effect to handle announcement selection when ID is provided
  useEffect(() => {
    if (announcementId && announcements.length > 0) {
      const announcement = announcements.find(a => a.id === announcementId);
      if (announcement) {
        setSelectedAnnouncement(announcement);
      }
    } else {
      setSelectedAnnouncement(null);
    }
  }, [announcementId, announcements]);
  
  const renderAnnouncementItem = ({ item }) => {
    const formattedDate = formatDate(item.created_at);
    const timeAgo = getTimeAgo(item.created_at);
    const isSelected = selectedAnnouncement?.id === item.id;
    
    return (
      <Animated.View 
        style={[
          styles.announcementItem, 
          { 
            backgroundColor: isDarkMode ? theme.cardDark : theme.card,
            borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            opacity: fadeAnim,
            transform: [{ translateY }],
            borderLeftWidth: isSelected ? 4 : 1,
            borderLeftColor: isSelected ? theme.primary : (isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'),
          }
        ]}
      >
        <View style={styles.announcementHeader}>
          <View style={styles.titleContainer}>
            <Text style={[
              styles.announcementTitle, 
              { 
                color: isDarkMode ? theme.textDark || '#FFFFFF' : theme.text,
                fontWeight: isSelected ? 'bold' : 'normal'
              }
            ]}>
              {item.title}
            </Text>
            {item.is_important && (
              <View style={[styles.importantBadge, { backgroundColor: theme.danger }]}>
                <Text style={[styles.importantText, { color: '#FFFFFF' }]}>Important</Text>
              </View>
            )}
          </View>
          <Text style={[styles.announcementDate, { color: isDarkMode ? theme.textMutedDark || '#CCCCCC' : theme.textMuted }]}>
            {timeAgo}
          </Text>
        </View>
        <Text style={[
          styles.announcementContent, 
          { 
            color: isDarkMode ? theme.textDark || '#FFFFFF' : theme.text,
            fontWeight: isSelected ? '500' : 'normal'
          }
        ]}>
          {item.content}
        </Text>
        <Text style={[styles.announcementFooter, { color: isDarkMode ? theme.textMutedDark || '#CCCCCC' : theme.textMuted }]}>
          Posted on {formattedDate}
        </Text>
      </Animated.View>
    );
  };

  const EmptyComponent = () => (
    <View style={[styles.emptyContainer, 
      { backgroundColor: isDarkMode ? theme.backgroundDark : theme.background }]}>
      <Ionicons 
        name="megaphone-outline" 
        size={80} 
        color={isDarkMode ? theme.primaryDark || theme.primary : theme.primary} 
        style={styles.emptyIcon}
      />
      <Text style={[styles.emptyTitle, { color: isDarkMode ? theme.textDark || '#FFFFFF' : theme.text }]}>
        No Announcements Yet
      </Text>
      <Text style={[styles.emptySubtitle, { color: isDarkMode ? theme.textMutedDark || '#CCCCCC' : theme.textMuted }]}>
        Check back later for updates from your society
      </Text>
    </View>
  );

  // Content to render inside the AppLayout
  const renderContent = () => {
    if (isLoading && !isRefreshing) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDarkMode ? theme.primaryDark || theme.primary : theme.primary} />
          <Text style={[styles.loadingText, { color: isDarkMode ? theme.textMutedDark || '#CCCCCC' : theme.textMuted }]}>
            Loading announcements...
          </Text>
        </View>
      );
    }
    
    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.danger} />
          <Text style={[styles.errorText, { color: isDarkMode ? theme.textDark || '#FFFFFF' : theme.text }]}>{error}</Text>
          
          <TouchableOpacity 
            style={[styles.retryButton, { backgroundColor: theme.primary }]}
            onPress={handleRefresh}
          >
            <Text style={[styles.retryButtonText, { color: '#FFFFFF' }]}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    return (
      <FlatList
        data={announcements}
        keyExtractor={(item) => item.id}
        renderItem={renderAnnouncementItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[isDarkMode ? theme.primaryDark || theme.primary : theme.primary]}
            tintColor={isDarkMode ? theme.primaryDark || theme.primary : theme.primary}
            progressBackgroundColor={isDarkMode ? theme.cardDark || '#1E1E1E' : theme.card}
          />
        }
        ListEmptyComponent={EmptyComponent}
      />
    );
  };

  return (
    <AppLayout title="Announcements">
      <View 
        style={[
          styles.container, 
          { backgroundColor: isDarkMode ? theme.backgroundDark : theme.background }
        ]}
      >
        {renderContent()}
      </View>
    </AppLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  announcementItem: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  announcementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  announcementTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
    flex: 1,
  },
  importantBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 4,
  },
  importantText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  announcementDate: {
    fontSize: 12,
    marginLeft: 8,
  },
  announcementContent: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  announcementFooter: {
    fontSize: 12,
    alignSelf: 'flex-end',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  errorText: {
    textAlign: 'center',
    fontSize: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    marginTop: 60,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
});

export default AnnouncementsScreen; 