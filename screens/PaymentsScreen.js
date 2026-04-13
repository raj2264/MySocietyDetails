import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';
import { getPaymentHistory } from '../lib/payments';
import { formatCurrency } from '../utils/formatters';
import { useFocusEffect } from '@react-navigation/native';


import useNoStuckLoading from '../hooks/useNoStuckLoading';
export default function PaymentsScreen() {
  const { theme, isDarkMode } = useTheme();
  const { residentData } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  useNoStuckLoading(loading, setLoading);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedOnceRef = useRef(false);
  const isFetchingRef = useRef(false);

  const loadPayments = useCallback(async () => {
    try {
      if (!residentData?.id) {
        console.log('No resident data available');
        setPayments([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const history = await getPaymentHistory(residentData.id);
      setPayments(history);
    } catch (error) {
      console.error('Error loading payments:', error);
      Alert.alert('Error', 'Failed to load payment history');
    }
  }, [residentData?.id]);

  useFocusEffect(
    useCallback(() => {
      if (!residentData?.id) {
        setPayments([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (isFetchingRef.current) return;
      const shouldShowLoader = !hasLoadedOnceRef.current;
      if (shouldShowLoader) {
        setLoading(true);
      }
      isFetchingRef.current = true;
      Promise.resolve(loadPayments())
        .catch(error => console.error('Error in loadPayments:', error))
        .finally(() => {
          isFetchingRef.current = false;
          setLoading(false);
          hasLoadedOnceRef.current = true;
        });
    }, [residentData?.id])
  );

  const onRefresh = () => {
    if (!residentData?.id) {
      setPayments([]);
      setRefreshing(false);
      return;
    }

    if (isFetchingRef.current) return;
    setRefreshing(true);
    isFetchingRef.current = true;
    Promise.resolve(loadPayments())
      .catch(error => console.error('Error during refresh:', error))
      .finally(() => {
        isFetchingRef.current = false;
        setRefreshing(false);
      });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return '#4CAF50';
      case 'pending':
        return '#FFC107';
      case 'failed':
        return '#F44336';
      case 'refunded':
        return '#9C27B0';
      default:
        return theme.text;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return 'checkmark-circle';
      case 'pending':
        return 'time';
      case 'failed':
        return 'close-circle';
      case 'refunded':
        return 'refresh-circle';
      default:
        return 'help-circle';
    }
  };

  const renderPaymentItem = ({ item }) => (
    <View style={[styles.paymentCard, { backgroundColor: theme.card }]}>
      <View style={styles.paymentHeader}>
        <View style={styles.paymentInfo}>
          <Text style={[styles.paymentTitle, { color: theme.text }]}>
            {item.bill?.description || 'Maintenance Payment'}
          </Text>
          <Text style={[styles.paymentDate, { color: theme.text + '80' }]}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Ionicons name={getStatusIcon(item.status)} size={16} color={getStatusColor(item.status)} />
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
      </View>

      <View style={styles.paymentDetails}>
        <View style={styles.amountContainer}>
          <Text style={[styles.amountLabel, { color: theme.text + '80' }]}>Amount</Text>
          <Text style={[styles.amount, { color: theme.text }]}>
            {formatCurrency(item.amount)}
          </Text>
        </View>

        {item.payment_method && (
          <View style={styles.methodContainer}>
            <Text style={[styles.methodLabel, { color: theme.text + '80' }]}>Method</Text>
            <Text style={[styles.method, { color: theme.text }]}>
              {item.payment_method.charAt(0).toUpperCase() + item.payment_method.slice(1)}
            </Text>
          </View>
        )}

        {item.refund_amount && (
          <View style={styles.refundContainer}>
            <Text style={[styles.refundLabel, { color: theme.text + '80' }]}>Refund Amount</Text>
            <Text style={[styles.refundAmount, { color: '#F44336' }]}>
              {formatCurrency(item.refund_amount)}
            </Text>
          </View>
        )}
      </View>

      {item.refund_reason && (
        <View style={styles.refundReason}>
          <Text style={[styles.refundReasonText, { color: theme.text + '80' }]}>
            Reason: {item.refund_reason}
          </Text>
        </View>
      )}
    </View>
  );

  if (loading && !refreshing) {
    return (
      <AppLayout title="Payments">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Payments">
      <FlatList
        data={payments}
        renderItem={renderPaymentItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={48} color={theme.text + '40'} />
            <Text style={[styles.emptyText, { color: theme.text + '80' }]}>
              No payment history found
            </Text>
          </View>
        }
      />
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 16,
  },
  paymentCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  paymentInfo: {
    flex: 1,
    marginRight: 12,
  },
  paymentTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  paymentDate: {
    fontSize: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  paymentDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  amountContainer: {
    marginRight: 24,
    marginBottom: 8,
  },
  amountLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  amount: {
    fontSize: 16,
    fontWeight: '600',
  },
  methodContainer: {
    marginRight: 24,
    marginBottom: 8,
  },
  methodLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  method: {
    fontSize: 14,
  },
  refundContainer: {
    marginBottom: 8,
  },
  refundLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  refundAmount: {
    fontSize: 14,
    fontWeight: '500',
  },
  refundReason: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  refundReasonText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
}); 