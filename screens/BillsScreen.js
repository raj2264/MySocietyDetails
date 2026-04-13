import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useWindowDimensions } from 'react-native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Animated,
  Platform,
  Modal,
  TextInput,
  Alert,
  Image,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { createPaymentOrder, verifyPayment, getPaymentHistory, getPaymentReceipt } from '../lib/payments';
import RazorpayCheckout from 'react-native-razorpay';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { openFileLocally } from '../utils/file-opener';
import useNoStuckLoading from '../hooks/useNoStuckLoading';

const SUPABASE_STORAGE_BASE = 'https://jjgsggmufkpadchkodab.supabase.co/storage/v1/object/public';

function resolveBillUrl(pdfUrl) {
  if (!pdfUrl) return null;
  if (pdfUrl.startsWith('http')) return pdfUrl;
  // Convert admin panel proxy URLs like /api/storage/maintenance-bills/bills/{id}.pdf
  const match = pdfUrl.match(/^\/api\/storage\/(.+)$/);
  if (match) return `${SUPABASE_STORAGE_BASE}/${match[1]}`;
  return pdfUrl;
}

const BillsScreen = () => {
  const { width } = useWindowDimensions();
  const { theme, isDarkMode } = useTheme();
  const { user, residentData } = useAuth();
  const insets = useSafeAreaInsets();
  const [bills, setBills] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  useNoStuckLoading(loading, setLoading);
  const [refreshing, setRefreshing] = useState(false);
  useNoStuckLoading(refreshing, setRefreshing, 10000); // Safety: never let pull-to-refresh spinner hang
  const hasLoadedOnceRef = useRef(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [refundModalVisible, setRefundModalVisible] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sharing, setSharing] = useState({});
  const [downloadingReceiptId, setDownloadingReceiptId] = useState(null);
  const [completedPayments, setCompletedPayments] = useState([]);

  // Animation values
  const modalOpacity = useRef(new Animated.Value(0)).current;
  const modalTranslateY = useRef(new Animated.Value(100)).current;
  const cardAnimations = useRef([]).current;

  const fetchBills = useCallback(async () => {
    try {
      if (!residentData?.id) {
        setBills([]);
        setCompletedPayments([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const { data, error } = await supabase
        .from('maintenance_bills')
        .select(`
          *,
          template:bill_templates (
            name,
            header_text,
            footer_text,
            bank_details
          )
        `)
        .eq('resident_id', residentData.id)
        .order('bill_date', { ascending: false });

      if (error) throw error;
      setBills(data || []);
      
      // Fetch completed payments for receipt download
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('id, bill_id, society_id, status, razorpay_payment_id, completed_at, amount')
        .eq('resident_id', residentData.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false });
      
      if (!paymentsError && paymentsData) {
        setCompletedPayments(paymentsData);
      }
    } catch (error) {
      console.error('Error fetching bills:', error);
    }
  }, [residentData?.id]);

  const handleDownloadReceipt = async (payment) => {
    try {
      setDownloadingReceiptId(payment.id);
      
      const receipt = await getPaymentReceipt(payment.id, payment.society_id);
      
      // Generate HTML receipt for PDF
      const receiptHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Payment Receipt - ${receipt.receipt_number}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 30px; max-width: 600px; margin: 0 auto; }
    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 25px; }
    .header h1 { margin: 0; color: #333; font-size: 22px; }
    .header h2 { margin: 15px 0 0; font-size: 16px; color: #555; }
    .section { margin-bottom: 20px; }
    .section-title { font-weight: bold; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 8px; margin-bottom: 12px; font-size: 14px; }
    .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
    .amount-section { background: #f0f8ff; padding: 15px; border-radius: 8px; margin-top: 20px; border: 1px solid #4CAF50; }
    .total-row { font-size: 18px; font-weight: bold; color: #2E7D32; }
    .footer { text-align: center; margin-top: 30px; font-size: 11px; color: #888; border-top: 1px solid #eee; padding-top: 15px; }
    .status-badge { background: #4CAF50; color: white; padding: 3px 10px; border-radius: 4px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${receipt.society?.name || 'Society'}</h1>
    <p style="font-size: 12px; color: #666; margin: 8px 0;">${receipt.society?.address || ''}</p>
    <h2>PAYMENT RECEIPT</h2>
  </div>
  
  <div class="section">
    <div class="row"><span><strong>Receipt No:</strong></span><span>${receipt.receipt_number}</span></div>
    <div class="row"><span><strong>Date:</strong></span><span>${receipt.payment_date ? new Date(receipt.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A'}</span></div>
    <div class="row"><span><strong>Status:</strong></span><span class="status-badge">${receipt.status?.toUpperCase()}</span></div>
  </div>
  
  <div class="section">
    <div class="section-title">Resident Details</div>
    <div class="row"><span>Name:</span><span>${receipt.resident?.name || 'N/A'}</span></div>
    <div class="row"><span>Unit/Flat:</span><span>${receipt.resident?.unit_number || 'N/A'}</span></div>
    <div class="row"><span>Email:</span><span>${receipt.resident?.email || 'N/A'}</span></div>
    ${receipt.resident?.phone ? `<div class="row"><span>Phone:</span><span>${receipt.resident.phone}</span></div>` : ''}
  </div>
  
  <div class="section">
    <div class="section-title">Payment Details</div>
    <div class="row"><span>Bill Month:</span><span>${receipt.bill?.month_year ? new Date(receipt.bill.month_year).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : 'N/A'}</span></div>
    <div class="row"><span>Payment Method:</span><span>${receipt.payment_method?.toUpperCase() || 'Online'}</span></div>
    ${receipt.razorpay_payment_id ? `<div class="row"><span>Transaction ID:</span><span style="font-family: monospace;">${receipt.razorpay_payment_id}</span></div>` : ''}
    ${receipt.razorpay_order_id ? `<div class="row"><span>Order ID:</span><span style="font-family: monospace;">${receipt.razorpay_order_id}</span></div>` : ''}
    ${receipt.payment_details?.transaction_id ? `<div class="row"><span>Reference No:</span><span style="font-family: monospace;">${receipt.payment_details.transaction_id}</span></div>` : ''}
  </div>
  
  <div class="amount-section">
    <div class="row total-row">
      <span>AMOUNT PAID</span>
      <span>₹${receipt.amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}</span>
    </div>
  </div>
  
  <div class="footer">
    <p>This is a computer-generated receipt and does not require a signature.</p>
    <p>Thank you for your payment!</p>
  </div>
</body>
</html>`;

      // Generate PDF from HTML
      const { uri } = await Print.printToFileAsync({
        html: receiptHTML,
        base64: false,
      });

      // Open the locally generated PDF directly (no download needed)
      await openFileLocally(uri, {
        fileName: `receipt_${receipt.receipt_number}.pdf`,
        mimeType: 'application/pdf',
      });
    } catch (error) {
      console.error('Error downloading receipt:', error);
      Alert.alert('Error', error.message || 'Failed to download receipt');
    } finally {
      setDownloadingReceiptId(null);
    }
  };

  // Get completed payment for a specific bill
  const getCompletedPaymentForBill = (billId) => {
    return completedPayments.find(p => p.bill_id === billId);
  };

  useFocusEffect(
    useCallback(() => {
      if (!residentData?.id) {
        setLoading(false);
        setRefreshing(false);
        setBills([]);
        setCompletedPayments([]);
        return;
      }
      
      const shouldShowLoader = !hasLoadedOnceRef.current;
      if (shouldShowLoader) {
        setLoading(true);
      }
      
      fetchBills()
        .catch(error => console.error('Error in fetchBills:', error))
        .finally(() => {
          setLoading(false);
          hasLoadedOnceRef.current = true;
        });
    }, [residentData?.id])
  );

  useEffect(() => {
    // Clear previous animations
    cardAnimations.current = [];
    
    // Create new animation values for each bill
    bills.forEach(() => {
      cardAnimations.current.push(new Animated.Value(0));
    });
    
    // Animate cards in sequence
    if (cardAnimations.current.length > 0) {
      Animated.stagger(
        50,
        cardAnimations.current.map(anim =>
          Animated.spring(anim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 50,
            friction: 7,
          })
        )
      ).start();
    }
  }, [bills]);

  useEffect(() => {
    if (selectedBill) {
      // Animate modal in
      Animated.parallel([
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(modalTranslateY, {
          toValue: 0,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate modal out
      Animated.parallel([
        Animated.timing(modalOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(modalTranslateY, {
          toValue: 100,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [selectedBill]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (!residentData?.id) {
        setBills([]);
        setCompletedPayments([]);
        return;
      }
      await fetchBills();
    } catch (error) {
      console.error('Error during refresh:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid':
        return theme.success;
      case 'overdue':
        return theme.error;
      case 'partially_paid':
        return theme.warning;
      default:
        return theme.text;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'paid':
        return 'check-circle';
      case 'overdue':
        return 'alert-circle';
      case 'partially_paid':
        return 'clock-outline';
      default:
        return 'clock';
    }
  };

  const handleViewBill = async (bill) => {
    const resolvedUrl = resolveBillUrl(bill.pdf_url);
    if (resolvedUrl) {
      try {
        const fileName = `bill_${bill.bill_number || Date.now()}.pdf`;
        await openFileLocally(resolvedUrl, { fileName, mimeType: 'application/pdf' });
      } catch (error) {
        console.error('Error opening PDF:', error);
      }
    }
  };

  const handlePayBill = async (bill) => {
    try {
      setSubmitting(true);

      // Create payment order
      const orderData = await createPaymentOrder(bill.id);

      // Initialize Razorpay payment
      const options = {
        description: `Maintenance Bill - ${format(new Date(bill.month_year), 'MMM yyyy')}`,
        image: Image.resolveAssetSource(require('../assets/images/msd-logo.jpeg')).uri,
        currency: 'INR',
        key: orderData.key_id,
        amount: orderData.amount * 100, // Convert to paise
        name: 'Society Maintenance',
        order_id: orderData.order_id,
        prefill: {
          email: (await supabase.auth.getUser()).data.user.email,
        },
        theme: { color: theme.primary },
      };

      const paymentData = await RazorpayCheckout.open(options);

      // Verify payment
      await verifyPayment(orderData.payment_id, orderData.society_id, paymentData);

      Alert.alert('Success', 'Payment completed successfully');
      await fetchBills({ showLoader: false });
    } catch (error) {
      console.error('Error processing payment:', error);
      if (error.code !== 'PAYMENT_CANCELLED') {
        Alert.alert('Error', error.message || 'Payment failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefund = async () => {
    if (!selectedPayment) return;

    if (!refundAmount || !refundReason) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      setSubmitting(true);
      await initiateRefund(
        selectedPayment.id,
        parseFloat(refundAmount),
        refundReason
      );

      Alert.alert('Success', 'Refund initiated successfully');
      setRefundModalVisible(false);
      resetRefundForm();
      await fetchBills({ showLoader: false });
    } catch (error) {
      console.error('Error initiating refund:', error);
      Alert.alert('Error', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetRefundForm = () => {
    setSelectedPayment(null);
    setRefundAmount('');
    setRefundReason('');
  };

  const handleShareBill = async (bill) => {
    if (sharing[bill.id]) return;

    setSharing(prev => ({ ...prev, [bill.id]: true }));
    try {
      const resolvedUrl = resolveBillUrl(bill.pdf_url);
      if (!resolvedUrl) {
        throw new Error('No PDF available for this bill');
      }

      // Download to temp location first
      const fileName = `bill_${format(new Date(bill.month_year), 'MMM_yyyy')}.pdf`;
      const tempUri = FileSystem.cacheDirectory + fileName;
      
      const downloadResult = await FileSystem.downloadAsync(resolvedUrl, tempUri);
      
      if (downloadResult.status === 200) {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(tempUri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Share Bill',
            UTI: 'com.adobe.pdf'
          });
        } else {
          Alert.alert('Error', 'Sharing is not available on this device');
        }
      } else {
        throw new Error('Failed to download bill');
      }
    } catch (error) {
      console.error('Error sharing bill:', error);
      Alert.alert(
        'Error',
        'Failed to share bill: ' + error.message
      );
    } finally {
      setSharing(prev => ({ ...prev, [bill.id]: false }));
    }
  };

  const renderBillCard = (bill, index) => {
    const totalPaid = bill.payment_history?.reduce((sum, payment) => sum + payment.amount, 0) || 0;
    const remainingAmount = bill.total_amount - totalPaid;
    const statusColor = getStatusColor(bill.status);
    const statusIcon = getStatusIcon(bill.status);
    const canPay = bill.status !== 'paid' && remainingAmount > 0;
    const paymentProgress = (totalPaid / bill.total_amount) * 100;
    
    // Safely get animation value
    const animation = cardAnimations.current[index] || new Animated.Value(1);
    
    const cardScale = animation.interpolate({
      inputRange: [0, 1],
      outputRange: [0.95, 1],
    });
    const cardOpacity = animation.interpolate({
      inputRange: [0, 1],
      outputRange: [0.95, 1],
    });
    // Responsive card width for tablet/phone
    const cardWidth = width > 700 ? width * 0.6 : '100%';
    return (
      <Animated.View
        key={bill.id}
        style={[
          styles.billCard,
          {
            backgroundColor: isDarkMode ? theme.card : '#fff',
            transform: [{ scale: cardScale }],
            opacity: cardOpacity,
            width: cardWidth,
            alignSelf: 'center',
          },
        ]}
      >
        <TouchableOpacity
          style={styles.billCardContent}
          onPress={() => setSelectedBill(bill)}
          activeOpacity={0.7}
        >
          {/* Header Section */}
          <View style={styles.billHeader}>
            <View style={styles.billInfo}>
              <View style={styles.billTitleRow}>
                <Text style={[styles.billNumber, { color: theme.text }]}>Bill #{bill.bill_number}</Text>
                <View style={[styles.statusBadge, { backgroundColor: `${statusColor}15` }]}> 
                  <MaterialCommunityIcons name={statusIcon} size={14} color={statusColor} />
                  <Text style={[styles.statusText, { color: statusColor }]}>{bill.status.replace('_', ' ')}</Text>
                </View>
              </View>
              <Text style={[styles.billDate, { color: theme.textSecondary }]}>{format(new Date(bill.bill_date), 'MMMM yyyy')}</Text>
            </View>
          </View>

          {/* Amount Section */}
          <View style={styles.amountSection}>
            <View style={styles.amountContainer}>
              <Text style={[styles.amountLabel, { color: theme.textSecondary }]}>Total Amount</Text>
              <Text style={[styles.amount, { color: theme.text }]}>{formatCurrency(bill.total_amount)}</Text>
            </View>

            {bill.status !== 'paid' && (
              <View style={styles.paymentProgressContainer}>
                <View style={styles.paymentProgressHeader}>
                  <Text style={[styles.paymentProgressLabel, { color: theme.textSecondary }]}>Payment Progress</Text>
                  <Text style={[styles.paymentProgressPercentage, { color: theme.primary }]}>{paymentProgress.toFixed(0)}%</Text>
                </View>
                <View style={[
                  styles.paymentProgress,
                  { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }
                ]}>
                  <View 
                    style={[
                      styles.paymentProgressBar,
                      { 
                        width: `${paymentProgress}%`,
                        backgroundColor: theme.primary,
                      }
                    ]} 
                  />
                </View>
                <View style={[
                  styles.paymentDetails,
                  { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }
                ]}>
                  <View style={styles.paymentRow}>
                    <Text style={[styles.paymentLabel, { color: theme.textSecondary }]}>Paid</Text>
                    <Text style={[styles.paymentAmount, { color: theme.success }]}>{formatCurrency(totalPaid)}</Text>
                  </View>
                  <View style={styles.paymentRow}>
                    <Text style={[styles.paymentLabel, { color: theme.textSecondary }]}>Remaining</Text>
                    <Text style={[styles.paymentAmount, { color: theme.error }]}>{formatCurrency(remainingAmount)}</Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Actions Section */}
          <View style={styles.billActions}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.primary }]}
              onPress={() => handleViewBill(bill)}
            >
              <Ionicons name="eye" size={20} color="white" />
              <Text style={styles.actionButtonText}>View Bill PDF</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.primary }]}
              onPress={() => handleShareBill(bill)}
              disabled={sharing[bill.id]}
            >
              {sharing[bill.id] ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Ionicons name="share" size={20} color="white" />
                  <Text style={styles.actionButtonText}>Share Bill</Text>
                </>
              )}
            </TouchableOpacity>

            {canPay && (
              <TouchableOpacity
                style={[
                  styles.payButton,
                  { backgroundColor: theme.primary },
                  submitting && styles.disabledButton,
                ]}
                onPress={() => handlePayBill(bill)}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Ionicons name="card" size={20} color="white" />
                    <Text style={styles.actionButtonText}>Pay Now</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Download Receipt for Completed Razorpay Payment */}
          {getCompletedPaymentForBill(bill.id) && (
            <View style={[styles.receiptSection, { borderTopColor: theme.border }]}> 
              <TouchableOpacity
                style={[styles.downloadReceiptBtnFull, { backgroundColor: theme.success }]}
                onPress={() => handleDownloadReceipt(getCompletedPaymentForBill(bill.id))}
                disabled={downloadingReceiptId === getCompletedPaymentForBill(bill.id)?.id}
              >
                {downloadingReceiptId === getCompletedPaymentForBill(bill.id)?.id ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Ionicons name="receipt-outline" size={18} color="white" />
                    <Text style={styles.downloadReceiptBtnFullText}>Download Receipt PDF</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Payment History Section */}
          {bill.payment_history?.length > 0 && (
            <View style={[styles.paymentHistorySection, { borderTopColor: theme.border }]}> 
              <View style={styles.paymentHistoryHeader}>
                <Text style={[styles.paymentHistoryTitle, { color: theme.textSecondary }]}>Payment History</Text>
              </View>
              {bill.payment_history.map((payment, idx) => (
                <View key={idx} style={styles.paymentHistoryItem}>
                  <View style={styles.paymentHistoryInfo}>
                    <Text style={[styles.paymentDate, { color: theme.text }]}>{format(new Date(payment.date), 'dd MMM yyyy')}</Text>
                    <Text style={[styles.paymentMode, { color: theme.textSecondary }]}>{payment.mode}{payment.transaction_id ? ` - ${payment.transaction_id}` : ''}</Text>
                  </View>
                  <Text style={[styles.paymentAmount, { color: theme.success }]}>{formatCurrency(payment.amount)}</Text>
                </View>
              ))}
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderBillDetails = () => {
    if (!selectedBill) return null;

    const totalPaid = selectedBill.payment_history?.reduce((sum, payment) => sum + payment.amount, 0) || 0;
    const remainingAmount = selectedBill.total_amount - totalPaid;

    return (
      <Animated.View
        style={[
          styles.modalOverlay,
          {
            opacity: modalOpacity,
            backgroundColor: isDarkMode ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.02)',
          },
        ]}
      >
        <TouchableOpacity
          style={styles.modalOverlayTouchable}
          activeOpacity={1}
          onPress={() => setSelectedBill(null)}
        >
          <Animated.View
            style={[
              styles.modalContainer,
              {
                backgroundColor: isDarkMode ? theme.card : '#fff',
                transform: [{ translateY: modalTranslateY }],
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Bill Details</Text>
              <TouchableOpacity
                onPress={() => setSelectedBill(null)}
                style={[styles.closeButton, { backgroundColor: theme.border + '40' }]}
              >
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <View style={styles.detailSection}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Bill Information</Text>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Bill Number</Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>{selectedBill.bill_number}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Bill Date</Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>
                    {format(new Date(selectedBill.bill_date), 'dd MMM yyyy')}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Due Date</Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>
                    {format(new Date(selectedBill.due_date), 'dd MMM yyyy')}
                  </Text>
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Amount Details</Text>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Total Amount</Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>
                    {formatCurrency(selectedBill.total_amount)}
                  </Text>
                </View>
                {selectedBill.status !== 'paid' && (
                  <>
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Amount Paid</Text>
                      <Text style={[styles.detailValue, { color: theme.text }]}>
                        {formatCurrency(totalPaid)}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Remaining Amount</Text>
                      <Text style={[styles.detailValue, { color: theme.text }]}>
                        {formatCurrency(remainingAmount)}
                      </Text>
                    </View>
                  </>
                )}
              </View>

              {selectedBill.bill_components && (
                <View style={styles.detailSection}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Bill Components</Text>
                  {Object.entries(selectedBill.bill_components).map(([id, component]) => (
                    <View key={id} style={styles.componentRow}>
                      <Text style={[styles.componentName, { color: theme.text }]}>{component.name}</Text>
                      <Text style={[styles.componentAmount, { color: theme.text }]}>
                        {formatCurrency(component.amount)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {selectedBill.payment_history?.length > 0 && (
                <View style={styles.detailSection}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Payment History</Text>
                  {selectedBill.payment_history.map((payment, index) => (
                    <View key={index} style={styles.paymentHistoryRow}>
                      <View style={styles.paymentHistoryInfo}>
                        <Text style={[styles.paymentDate, { color: theme.text }]}>
                          {format(new Date(payment.date), 'dd MMM yyyy')}
                        </Text>
                        <Text style={[styles.paymentMode, { color: theme.textSecondary }]}>
                          {payment.mode}
                          {payment.transaction_id ? ` - ${payment.transaction_id}` : ''}
                        </Text>
                      </View>
                      <Text style={[styles.paymentAmount, { color: theme.text }]}>
                        {formatCurrency(payment.amount)}
                      </Text>
                    </View>
                  ))}
                  {getCompletedPaymentForBill(selectedBill.id) && (
                    <TouchableOpacity
                      style={[styles.downloadReceiptBtnLarge, { backgroundColor: theme.success, marginTop: 10 }]}
                      onPress={() => handleDownloadReceipt(getCompletedPaymentForBill(selectedBill.id))}
                      disabled={downloadingReceiptId === getCompletedPaymentForBill(selectedBill.id)?.id}
                    >
                      {downloadingReceiptId === getCompletedPaymentForBill(selectedBill.id)?.id ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <>
                          <Ionicons name="download-outline" size={18} color="white" />
                          <Text style={styles.downloadReceiptBtnText}>Download Payment Receipt</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {selectedBill.template?.bank_details && (
                <View style={styles.detailSection}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Bank Details</Text>
                  <View style={[styles.bankDetails, { backgroundColor: theme.card }]}>
                    <Text style={[styles.bankDetail, { color: theme.text }]}>
                      Bank: {selectedBill.template.bank_details.bank_name}
                    </Text>
                    <Text style={[styles.bankDetail, { color: theme.text }]}>
                      Account: {selectedBill.template.bank_details.account_name}
                    </Text>
                    <Text style={[styles.bankDetail, { color: theme.text }]}>
                      A/C No: {selectedBill.template.bank_details.account_number}
                    </Text>
                    <Text style={[styles.bankDetail, { color: theme.text }]}>
                      IFSC: {selectedBill.template.bank_details.ifsc_code}
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: theme.border }]}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.primary }]}
                onPress={() => handleViewBill(selectedBill)}
              >
                <Ionicons name="document-text-outline" size={20} color="#fff" />
                <Text style={styles.modalButtonText}>View PDF</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderContent = () => {
    if (loading && !refreshing) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading bills...
          </Text>
        </View>
      );
    }

    if (bills.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={[styles.emptyStateIcon, { backgroundColor: theme.primary + '20' }]}>
            <Ionicons name="document-text-outline" size={48} color={theme.primary} />
          </View>
          <Text style={[styles.emptyStateTitle, { color: theme.text }]}>
            No Bills Found
          </Text>
          <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>
            You don't have any maintenance bills yet.
          </Text>
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
      >
        <View style={styles.billsList}>
          {bills.map((bill, index) => renderBillCard(bill, index))}
        </View>
      </ScrollView>
    );
  };

  const styles = StyleSheet.create({
    actionButtonText: {
      color: 'white',
      fontSize: 13,
      fontWeight: '600',
      marginTop: 4,
      textAlign: 'center',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 20,
    },
    billsList: {
      padding: 16,
      maxWidth: 720,
      width: '100%',
      alignSelf: 'center',
    },
    billCard: {
      borderRadius: 16,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
      overflow: 'hidden',
    },
    billCardContent: {
      padding: 16,
    },
    billHeader: {
      marginBottom: 16,
    },
    billInfo: {
      flex: 1,
    },
    billTitleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    billNumber: {
      fontSize: 18,
      fontWeight: '700',
    },
    billDate: {
      fontSize: 14,
      marginTop: 2,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
      marginLeft: 4,
      textTransform: 'capitalize',
    },
    amountSection: {
      marginBottom: 16,
    },
    amountContainer: {
      marginBottom: 16,
    },
    amountLabel: {
      fontSize: 13,
      marginBottom: 4,
    },
    amount: {
      fontSize: 28,
      fontWeight: '700',
    },
    paymentProgressContainer: {
      marginTop: 8,
    },
    paymentProgressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    paymentProgressLabel: {
      fontSize: 13,
      fontWeight: '500',
    },
    paymentProgressPercentage: {
      fontSize: 13,
      fontWeight: '600',
    },
    paymentProgress: {
      height: 6,
      borderRadius: 3,
      overflow: 'hidden',
      marginBottom: 12,
    },
    paymentProgressBar: {
      height: '100%',
      borderRadius: 3,
    },
    paymentDetails: {
      borderRadius: 8,
      padding: 12,
    },
    paymentRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    paymentLabel: {
      fontSize: 13,
    },
    paymentAmount: {
      fontSize: 15,
      fontWeight: '600',
    },
    billActions: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      gap: 8,
    },
    actionButton: {
      padding: 10,
      borderRadius: 12,
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    payButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingVertical: 10,
      borderRadius: 10,
      flex: 1,
    },
    disabledButton: {
      opacity: 0.7,
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    emptyStateIcon: {
      width: 96,
      height: 96,
      borderRadius: 48,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    emptyStateTitle: {
      fontSize: 20,
      fontWeight: '600',
      marginBottom: 8,
    },
    emptyStateText: {
      fontSize: 16,
      textAlign: 'center',
    },
    modalOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalOverlayTouchable: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      maxHeight: '90%',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 8,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(0,0,0,0.1)',
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '600',
    },
    closeButton: {
      padding: 8,
      borderRadius: 12,
    },
    modalContent: {
      padding: 20,
      maxHeight: '80%',
    },
    modalFooter: {
      padding: 20,
      borderTopWidth: 1,
    },
    modalButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 14,
      borderRadius: 12,
    },
    modalButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
    },
    detailSection: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 12,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    detailLabel: {
      fontSize: 14,
    },
    detailValue: {
      fontSize: 14,
      fontWeight: '500',
    },
    componentRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(0,0,0,0.1)',
    },
    componentName: {
      fontSize: 14,
    },
    componentAmount: {
      fontSize: 14,
      fontWeight: '500',
    },
    paymentHistorySection: {
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
    },
    paymentHistoryHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    paymentHistoryTitle: {
      fontSize: 14,
      fontWeight: '600',
    },
    downloadReceiptBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      gap: 4,
    },
    downloadReceiptText: {
      color: 'white',
      fontSize: 12,
      fontWeight: '600',
    },
    downloadReceiptBtnLarge: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
      gap: 8,
    },
    downloadReceiptBtnText: {
      color: 'white',
      fontSize: 14,
      fontWeight: '600',
    },
    receiptSection: {
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
    },
    downloadReceiptBtnFull: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 10,
      gap: 10,
    },
    downloadReceiptBtnFullText: {
      color: 'white',
      fontSize: 15,
      fontWeight: '600',
    },
    paymentHistoryItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
    },
    paymentHistoryInfo: {
      flex: 1,
    },
    paymentDate: {
      fontSize: 14,
      fontWeight: '500',
    },
    paymentMode: {
      fontSize: 12,
      marginTop: 2,
    },
    bankDetails: {
      padding: 12,
      borderRadius: 8,
    },
    bankDetail: {
      fontSize: 14,
      marginBottom: 4,
    },
    input: {
      height: 48,
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 16,
      marginBottom: 16,
      fontSize: 16,
    },
    modalButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 16,
    },
    refundKeyboardContainer: {
      width: '100%',
      alignItems: 'center',
    },
    refundScrollContent: {
      paddingBottom: 8,
    },
  });

  return (
    <AppLayout title="My Bills">
      {renderContent()}
      {renderBillDetails()}

      <Modal
        visible={refundModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setRefundModalVisible(false);
          resetRefundForm();
        }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={[styles.modalOverlay, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.02)' }]}> 
            <KeyboardAvoidingView
              style={styles.refundKeyboardContainer}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
            >
              <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}> 
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                  contentContainerStyle={styles.refundScrollContent}
                >
                  <Text style={[styles.modalTitle, { color: theme.text }]}> 
                    Request Refund
                  </Text>

                  <TextInput
                    style={[styles.input, { 
                      backgroundColor: theme.inputBackground,
                      color: theme.text,
                      borderColor: theme.border,
                    }]}
                    placeholder="Refund Amount"
                    placeholderTextColor={theme.textSecondary}
                    value={refundAmount}
                    onChangeText={setRefundAmount}
                    keyboardType="numeric"
                  />

                  <TextInput
                    style={[styles.input, { 
                      backgroundColor: theme.inputBackground,
                      color: theme.text,
                      borderColor: theme.border,
                      height: 100,
                    }]}
                    placeholder="Refund Reason"
                    placeholderTextColor={theme.textSecondary}
                    value={refundReason}
                    onChangeText={setRefundReason}
                    multiline
                    numberOfLines={4}
                  />

                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      style={[styles.modalButton, { backgroundColor: theme.error }]}
                      onPress={() => {
                        setRefundModalVisible(false);
                        resetRefundForm();
                      }}
                      disabled={submitting}
                    >
                      <Text style={styles.modalButtonText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.modalButton,
                        { backgroundColor: theme.primary },
                        submitting && styles.disabledButton,
                      ]}
                      onPress={handleRefund}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <ActivityIndicator color="white" />
                      ) : (
                        <Text style={styles.modalButtonText}>Request Refund</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </AppLayout>
  );
};

export default BillsScreen; 