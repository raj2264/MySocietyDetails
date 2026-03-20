import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { EventRegister } from 'react-native-event-listeners';
import { useAuth } from '../context/AuthContext';
import {
  registerForPushNotificationsAsync,
  setupNotificationListener,
  setupNotificationResponseListener,
} from '../lib/notifications';

// Keep this event name local to avoid importing heavy UI modules during app bootstrap.
const NOTIFICATION_COUNT_CHANGED = 'NOTIFICATION_COUNT_CHANGED';

// Map notification type → screen path
const NOTIFICATION_ROUTES = {
  announcement: '/announcements',
  bill: '/bills',
  visitor_approval: '/visitors',
  visitor_approved: '/visitors',
  visitor_rejected: '/visitors',
  complaint: '/complaint-details',
  complaint_update: '/complaint-details',
  poll: '/polls',
  maintenance: '/bills',
  event: '/meetings',
  payment: '/payments',
  emergency: '/security-contacts',
  meeting: '/meetings',
  document: '/documents',
};

// Map notification type → the param key for resource_id
const PARAM_KEY_MAP = {
  announcement: 'announcementId',
  bill: 'billId',
  visitor_approval: 'visitorId',
  visitor_approved: 'visitorId',
  visitor_rejected: 'visitorId',
  complaint: 'complaintId',
  complaint_update: 'complaintId',
  poll: 'pollId',
  maintenance: 'maintenanceId',
  event: 'eventId',
  payment: 'paymentId',
  emergency: 'emergencyId',
  meeting: 'meetingId',
  document: 'documentId',
};

export default function useNotifications() {
  const { user } = useAuth();
  const router = useRouter();
  const hasRegistered = useRef(false);

  // Register for push notifications when user logs in
  useEffect(() => {
    if (!user?.id || hasRegistered.current) return;

    hasRegistered.current = true;
    registerForPushNotificationsAsync(user.id).catch((err) => {
      console.error('Push notification registration failed:', err);
      hasRegistered.current = false; // allow retry
    });
  }, [user?.id]);

  // Reset registration flag on logout
  useEffect(() => {
    if (!user) {
      hasRegistered.current = false;
    }
  }, [user]);

  // Set up foreground + tap listeners
  useEffect(() => {
    let notifSub = null;
    let responseSub = null;

    try {
      // Foreground: notification arrives while app is open
      notifSub = setupNotificationListener(() => {
        EventRegister.emit(NOTIFICATION_COUNT_CHANGED);
      });

      // Tap: user taps a push notification
      responseSub = setupNotificationResponseListener((response) => {
        const data = response?.notification?.request?.content?.data;
        if (!data) return;

        const type = data.type;
        const resourceId = data.resource_id;
        const path = NOTIFICATION_ROUTES[type];

        if (path && resourceId) {
          const paramKey = PARAM_KEY_MAP[type];
          router.push({ pathname: path, params: paramKey ? { [paramKey]: resourceId } : {} });
        } else if (path) {
          router.push(path);
        } else {
          // Fallback: open notifications screen
          router.push('/notifications');
        }

        EventRegister.emit(NOTIFICATION_COUNT_CHANGED);
      });
    } catch (error) {
      // Notification setup should never crash app startup.
      console.error('Notification listeners setup failed:', error);
    }

    return () => {
      notifSub?.remove?.();
      responseSub?.remove?.();
    };
  }, [router]);
}
