import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Animated,
  Alert,
} from 'react-native';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AppLayout, { NOTIFICATION_COUNT_CHANGED } from '../components/AppLayout';
import { EventRegister } from 'react-native-event-listeners';
import { useRouter } from 'expo-router';

import useNoStuckLoading from '../hooks/useNoStuckLoading';
import { 
  fetchNotifications, 
  markNotificationAsRead, 
  markAllNotificationsRead,
  deleteNotification,
  deleteAllNotifications 
} from '../lib/notifications';

const NotificationsScreen = () => {
  const router = useRouter();
  const { theme, isDarkMode } = useTheme();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  useNoStuckLoading(isLoading, setIsLoading);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const hasLoadedOnceRef = useRef(false);
  
  // Animation values
  const fadeAnim = useState(new Animated.Value(0.95))[0];
  const translateY = useState(new Animated.Value(10))[0];
  
  // Create a map of refs for swipeable items
  const swipeableRefs = useRef(new Map()).current;
  
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
  
  const loadNotifications = async (isRefresh = false) => {
    try {
      if (!user?.id) {
        console.log('No user ID found');
        setNotifications([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }
      
      setError(null);
      const { data, error } = await fetchNotifications(user.id);
      
      if (error) {
        console.error('Error fetching notifications:', error);
        setError('Failed to load notifications');
        return;
      }
      
      setNotifications(data);
      resetAnimation();
      setTimeout(startAnimation, 150);
    } catch (error) {
      console.error('Exception while fetching notifications:', error);
      setError('An unexpected error occurred');
    }
  };
  
  useFocusEffect(
    useCallback(() => {
      if (!user?.id) {
        setNotifications([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }
      const shouldShowLoader = !hasLoadedOnceRef.current;
      if (shouldShowLoader) {
        setIsLoading(true);
      }

      loadNotifications(false).finally(() => {
        setIsLoading(false);
        hasLoadedOnceRef.current = true;
      });
      
      return () => {
        // Cleanup if needed
      };
    }, [user?.id])
  );
  
  const handleRefresh = async () => {
    if (!user?.id) {
      setNotifications([]);
      setIsRefreshing(false);
      return;
    }

    setIsRefreshing(true);
    await loadNotifications(true);
    setIsRefreshing(false);
  };
  
  // Clear all notifications
  const clearAllNotifications = async () => {
    try {
      if (!user?.id || notifications.length === 0) return;
      
      Alert.alert(
        "Clear Notifications",
        "Are you sure you want to clear all notifications?",
        [
          { 
            text: "Cancel", 
            style: "cancel" 
          },
          {
            text: "Clear All",
            style: "destructive",
            onPress: async () => {
              setIsLoading(true);
              
              const { success, error, deletedCount } = await deleteAllNotifications();
              
              if (error) {
                console.error('Error clearing notifications:', error);
                Alert.alert('Error', 'Failed to clear notifications. Please try again.');
                setIsLoading(false);
                return;
              }

              if (!success) {
                console.error('Failed to clear notifications');
                Alert.alert('Error', 'Failed to clear notifications. Please try again.');
                setIsLoading(false);
                return;
              }
              
              // Animate all notifications away with a stagger effect
              Animated.stagger(50, 
                notifications.map(n => 
                  Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                  })
                )
              ).start(() => {
                // Clear local state after animations complete
                setNotifications([]);
                setIsLoading(false);
                
                // Emit event to update notification count
                EventRegister.emit(NOTIFICATION_COUNT_CHANGED);
                
                // Show empty state with animation
                setTimeout(() => {
                  resetAnimation();
                  startAnimation();
                }, 100);
              });
            }
          }
        ]
      );
    } catch (error) {
      console.error('Exception in clearAllNotifications:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };
  
  const handleNotificationPress = async (notification) => {
    try {
      // Mark as read if not already read
      if (!notification.read) {
        const { success, error } = await markNotificationAsRead(notification.id);
        if (error) {
          console.error('Error marking notification as read:', error);
        }
        
        // Update the local state to mark this notification as read
        setNotifications(prev => 
          prev.map(item => 
            item.id === notification.id ? { ...item, read: true } : item
          )
        );

        // Emit event to update notification count
        EventRegister.emit(NOTIFICATION_COUNT_CHANGED);
      }
      
      // Navigate based on notification type and data
      switch (notification.type) {
        case 'announcement':
          router.push({
            pathname: '/announcements',
            params: { announcementId: notification.resource_id }
          });
          break;

        case 'bill':
          router.push({
            pathname: '/bills',
            params: { billId: notification.resource_id }
          });
          break;

        case 'visitor_approval':
        case 'visitor_approved':
        case 'visitor_rejected':
          router.push({
            pathname: '/visitors',
            params: { visitorId: notification.resource_id }
          });
          break;

        case 'complaint':
        case 'complaint_update':
          router.push({
            pathname: '/complaint-details',
            params: { complaintId: notification.resource_id }
          });
          break;

        case 'poll':
          router.push({
            pathname: '/polls',
            params: { pollId: notification.resource_id }
          });
          break;

        case 'maintenance':
          router.push({
            pathname: '/bills',
            params: { maintenanceId: notification.resource_id }
          });
          break;

        case 'event':
          router.push({
            pathname: '/events',
            params: { eventId: notification.resource_id }
          });
          break;

        case 'payment':
          router.push({
            pathname: '/payments',
            params: { paymentId: notification.resource_id }
          });
          break;

        case 'emergency':
          router.push({
            pathname: '/security-contacts',
            params: { emergencyId: notification.resource_id }
          });
          break;

        case 'meeting':
          router.push({
            pathname: '/meetings',
            params: { meetingId: notification.resource_id }
          });
          break;

        case 'document':
          router.push({
            pathname: '/documents',
            params: { documentId: notification.resource_id }
          });
          break;

        default:
          console.log('Unknown notification type:', notification.type);
          // For unknown types, navigate to the main screen of that type
          const screenMap = {
            'announcement': '/announcements',
            'bill': '/bills',
            'visitor': '/visitors',
            'complaint': '/complaints',
            'poll': '/polls',
            'maintenance': '/bills',
            'event': '/events',
            'payment': '/payments',
            'emergency': '/security-contacts',
            'meeting': '/meetings',
            'document': '/documents'
          };

          const path = screenMap[notification.type?.split('_')[0]] || '/';
          router.push(path);
          break;
      }
    } catch (error) {
      console.error('Error handling notification press:', error);
      Alert.alert(
        'Error',
        'Failed to open notification. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };
  
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'announcement':
        return 'megaphone-outline';
      case 'maintenance':
        return 'hammer-outline';
      case 'event':
        return 'calendar-outline';
      case 'payment':
        return 'cash-outline';
      case 'bill':
        return 'document-text-outline';
      case 'visitor_approval':
      case 'visitor_approved':
      case 'visitor_rejected':
        return 'people-outline';
      case 'complaint':
      case 'complaint_update':
        return 'chatbox-ellipses-outline';
      case 'poll':
        return 'bar-chart-outline';
      default:
        return 'notifications-outline';
    }
  };
  
  const renderRightActions = (progress, dragX, notification, onDelete) => {
    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });

    return (
      <View style={[
        styles.deleteActionContainer,
        { 
          backgroundColor: isDarkMode ? '#1a1a1a' : '#f8f8f8',
          borderRadius: 12,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: isDarkMode ? '#333' : '#ddd',
        }
      ]}>
        <Animated.View 
          style={[
            styles.deleteAction,
            { 
              backgroundColor: '#FF3B30',
              transform: [{ scale }],
              borderRadius: 12,
            }
          ]}
        >
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => onDelete(notification)}
          >
            <Ionicons name="trash-outline" size={24} color="white" />
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };
  
  const handleDelete = async (notification) => {
    Alert.alert(
      "Delete Notification",
      "Are you sure you want to delete this notification?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const { success, error } = await deleteNotification(notification.id);
            if (success) {
              // Close the swipeable
              const swipeableRef = swipeableRefs.get(notification.id);
              swipeableRef?.close();
              // Remove the notification from the local state
              setNotifications(prev => prev.filter(n => n.id !== notification.id));
              // Clean up the ref
              swipeableRefs.delete(notification.id);
              // Emit event to update notification count
              EventRegister.emit(NOTIFICATION_COUNT_CHANGED);
            } else {
              Alert.alert('Error', 'Failed to delete notification. Please try again.');
            }
          }
        }
      ]
    );
  };
  
  const renderNotificationItem = ({ item }) => {
    const timeAgo = getTimeAgo(item.created_at);
    
    return (
      <Swipeable
        ref={ref => {
          if (ref) {
            swipeableRefs.set(item.id, ref);
          } else {
            swipeableRefs.delete(item.id);
          }
        }}
        renderRightActions={(progress, dragX) => 
          renderRightActions(progress, dragX, item, handleDelete)
        }
        rightThreshold={40}
        friction={2}
        overshootRight={false}
        enableTrackpadTwoFingerGesture
      >
        <View 
          style={[
            styles.notificationItem, 
            { 
              backgroundColor: theme.card,
              borderColor: isDarkMode ? '#333' : '#ddd',
              borderLeftColor: item.read 
                ? (isDarkMode ? '#333' : '#ddd')
                : theme.primary,
            }
          ]}
        >
          <TouchableOpacity 
            style={styles.notificationContent}
            onPress={() => handleNotificationPress(item)}
            activeOpacity={0.7}
          >
            <View style={styles.notificationIconContainer}>
              <Ionicons 
                name={getNotificationIcon(item.type)} 
                size={24}
                color={theme.primary}
              />
            </View>
            <View style={styles.notificationTextContainer}>
              <View style={styles.notificationHeader}>
                <Text 
                  style={[
                    styles.notificationTitle, 
                    { 
                      color: theme.text,
                      fontWeight: item.read ? '400' : '700'
                    }
                  ]}
                >
                  {item.title}
                </Text>
                <Text style={[styles.notificationTime, { color: isDarkMode ? '#999' : '#666' }]}>
                  {timeAgo}
                </Text>
              </View>
              <Text 
                style={[
                  styles.notificationMessage, 
                  { 
                    color: isDarkMode ? '#ddd' : '#444',
                    fontWeight: item.read ? '400' : '500'
                  }
                ]}
                numberOfLines={2}
              >
                {item.content}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </Swipeable>
    );
  };

  const EmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Ionicons 
        name="notifications-outline" 
        size={80} 
        color={isDarkMode ? '#555' : '#ccc'} 
        style={styles.emptyIcon}
      />
      <Text style={[styles.emptyTitle, { color: theme.text }]}>
        No Notifications
      </Text>
      <Text style={[styles.emptySubtitle, { color: isDarkMode ? '#999' : '#666' }]}>
        You're all caught up! Check back later for updates
      </Text>
    </View>
  );

  const ClearButton = () => (
    <TouchableOpacity
      style={[styles.clearButton, { backgroundColor: isDarkMode ? '#333' : '#f0f0f0' }]}
      onPress={clearAllNotifications}
      disabled={notifications.length === 0}
    >
      <Ionicons 
        name="trash-outline" 
        size={18} 
        color={notifications.length === 0 
          ? (isDarkMode ? '#555' : '#ccc') 
          : theme.primary
        } 
      />
      <Text 
        style={[
          styles.clearButtonText, 
          { 
            color: notifications.length === 0 
              ? (isDarkMode ? '#555' : '#ccc') 
              : theme.primary
          }
        ]}
      >
        Clear All
      </Text>
    </TouchableOpacity>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppLayout 
        title="Notifications"
        rightComponent={<ClearButton />}
      >
        <View style={[styles.container, { backgroundColor: theme.background }]}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.loadingText, { color: isDarkMode ? '#ddd' : '#666' }]}>
                Loading notifications...
              </Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={48} color={theme.danger} />
              <Text style={[styles.errorText, { color: theme.text }]}>{error}</Text>
              <TouchableOpacity 
                style={[styles.retryButton, { backgroundColor: theme.primary }]}
                onPress={handleRefresh}
              >
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={(item) => item.id}
              renderItem={renderNotificationItem}
              contentContainerStyle={[
                styles.listContent,
                { backgroundColor: theme.background }
              ]}
              ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={handleRefresh}
                  colors={[theme.primary]}
                  tintColor={theme.primary}
                />
              }
              ListEmptyComponent={EmptyComponent}
            />
          )}
        </View>
      </AppLayout>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerIcon: {
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  notificationItem: {
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    overflow: 'hidden',
    backgroundColor: 'white',
  },
  notificationContent: {
    flexDirection: 'row',
    padding: 16,
  },
  notificationIconContainer: {
    marginRight: 12,
    alignSelf: 'center',
  },
  notificationTextContainer: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 16,
    flex: 1,
    marginRight: 8,
  },
  notificationTime: {
    fontSize: 12,
  },
  notificationMessage: {
    fontSize: 14,
    lineHeight: 20,
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
    color: 'white',
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
  clearButton: {
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
  },
  clearButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: 'bold',
  },
  deleteActionContainer: {
    width: 100,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  deleteAction: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FF3B30',
  },
  deleteButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 10,
  },
  deleteText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 5,
  },
});

export default NotificationsScreen; 