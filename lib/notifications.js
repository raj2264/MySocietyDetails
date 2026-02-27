import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Register for push notifications and store the token
export async function registerForPushNotificationsAsync() {
  let token;
  
  if (Constants.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }
    
    token = (await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    })).data;
    
    console.log('Push notification token:', token);

    // Store the token in Supabase
    if (token) {
      const { error } = await supabase
        .from('push_tokens')
        .upsert({
          token,
          device_type: Platform.OS,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,token'
        });

      if (error) {
        console.error('Error storing push token:', error);
      }
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  return token;
}

// Fetch notifications from Supabase
export async function fetchNotifications(userId) {
  try {
    if (!userId) {
      console.log('No user ID provided for fetching notifications');
      return { data: [], error: null };
    }
    
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('Error fetching notifications:', error);
      return { data: [], error };
    }
    
    return { data: data || [], error: null };
  } catch (error) {
    console.error('Exception fetching notifications:', error);
    return { data: [], error };
  }
}

// Mark notification as read
export async function markNotificationAsRead(notificationId) {
  try {
    const { data, error } = await supabase
      .rpc('api_mark_notification_read', {
        notification_id: notificationId
      });
      
    if (error) {
      console.error('Error marking notification as read:', error);
      return { success: false, error };
    }
    
    return { success: data.success, error: null };
  } catch (error) {
    console.error('Exception marking notification as read:', error);
    return { success: false, error };
  }
}

// Mark all notifications as read
export async function markAllNotificationsRead() {
  try {
    const { data, error } = await supabase
      .rpc('api_mark_all_notifications_read');
      
    if (error) {
      console.error('Error marking all notifications as read:', error);
      return { success: false, error };
    }
    
    return { success: data.success, updatedCount: data.updated_count, error: null };
  } catch (error) {
    console.error('Exception marking all notifications as read:', error);
    return { success: false, error };
  }
}

// Delete a notification
export async function deleteNotification(notificationId) {
  try {
    const { data, error } = await supabase
      .rpc('api_delete_notification', {
        notification_id: notificationId
      });
      
    if (error) {
      console.error('Error deleting notification:', error);
      return { success: false, error };
    }
    
    return { success: data.success, error: null };
  } catch (error) {
    console.error('Exception deleting notification:', error);
    return { success: false, error };
  }
}

// Delete all notifications
export async function deleteAllNotifications() {
  try {
    const { data, error } = await supabase
      .rpc('api_delete_all_notifications');
      
    if (error) {
      console.error('Error deleting all notifications:', error);
      return { success: false, error };
    }
    
    return { success: data.success, deletedCount: data.deleted_count, error: null };
  } catch (error) {
    console.error('Exception deleting all notifications:', error);
    return { success: false, error };
  }
}

// Schedule a local notification (for testing)
export async function scheduleLocalNotification(title, body, data = {}) {
  return await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
    },
    trigger: null, // Show immediately
  });
}

// Set up a listener for incoming notifications
export function setupNotificationListener(onNotificationReceived) {
  const subscription = Notifications.addNotificationReceivedListener(notification => {
    // Handle the notification
    onNotificationReceived(notification);

    // If the notification has a bill_id in the data, mark it as read in the database
    if (notification.request.content.data?.bill_id) {
      supabase
        .from('notifications')
        .update({ read: true })
        .eq('resource_id', notification.request.content.data.bill_id)
        .eq('type', 'bill')
        .then(({ error }) => {
          if (error) {
            console.error('Error marking bill notification as read:', error);
          }
        });
    }
  });
  
  return subscription;
}

// Set up a listener for notification interactions
export function setupNotificationResponseListener(onNotificationResponse) {
  const subscription = Notifications.addNotificationResponseReceivedListener(response => {
    onNotificationResponse(response);
  });
  
  return subscription;
} 