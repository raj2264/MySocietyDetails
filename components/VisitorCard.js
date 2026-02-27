import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  Share,
  Modal,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { format, isAfter, isBefore } from 'date-fns';
import { supabase } from '../lib/supabase';
// Temporary comment out QRCode import
// import QRCode from 'react-native-qrcode-svg';

export default function VisitorCard({ visitor, onDelete, onApproval }) {
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { theme } = useTheme();

  // Check if access code is expired
  const isExpired = visitor.expiry_time && isBefore(new Date(visitor.expiry_time), new Date());
  
  // Check if visitor has checked in
  const hasCheckedIn = visitor.is_checked_in || (visitor.check_in_time && !visitor.check_out_time);
  
  // Check if visitor has checked out
  const hasCheckedOut = visitor.check_out_time;
  
  // Check if visitor is expected (not arrived yet)
  const isExpected = !visitor.check_in_time;

  // Check if visitor is pending approval
  const isPending = visitor.approval_status === 'pending';
  
  // Check if visitor was rejected
  const isRejected = visitor.approval_status === 'rejected';

  const handleShare = async () => {
    try {
      const message = `
Visitor Pass for ${visitor.name}
---------------------------
Access Code: ${visitor.access_code}
Purpose: ${visitor.purpose || 'Not specified'}
Expected Arrival: ${visitor.expected_arrival ? format(new Date(visitor.expected_arrival), 'PPpp') : 'Not specified'}
Valid Until: ${visitor.expiry_time ? format(new Date(visitor.expiry_time), 'PPpp') : 'Not specified'}
Flat Number: ${visitor.flat_number}

Please show this code to the security guard at the gate.
      `;
      
      await Share.share({
        message,
        title: 'Visitor Pass',
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share visitor pass');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this visitor pass?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(visitor.id) }
      ]
    );
  };

  const handleApprove = async () => {
    try {
      setSubmitting(true);
      
      const { error } = await supabase
        .from('visitors')
        .update({ approval_status: 'approved' })
        .eq('id', visitor.id);
        
      if (error) {
        throw error;
      }
      
      // Update local state via parent component
      if (onApproval) {
        onApproval(visitor.id, 'approved');
      }
      
      Alert.alert('Success', 'Visitor has been approved');
    } catch (error) {
      console.error('Error approving visitor:', error);
      Alert.alert('Error', 'Failed to approve visitor');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    try {
      setSubmitting(true);
      
      const { error } = await supabase
        .from('visitors')
        .update({ approval_status: 'rejected' })
        .eq('id', visitor.id);
        
      if (error) {
        throw error;
      }
      
      // Update local state via parent component
      if (onApproval) {
        onApproval(visitor.id, 'rejected');
      }
      
      Alert.alert('Success', 'Visitor has been rejected');
    } catch (error) {
      console.error('Error rejecting visitor:', error);
      Alert.alert('Error', 'Failed to reject visitor');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusLabel = () => {
    if (isRejected) return 'Rejected';
    if (isPending) return 'Pending Approval';
    if (isExpired) return 'Expired';
    if (hasCheckedOut) return 'Checked Out';
    if (hasCheckedIn) return 'Checked In';
    if (isExpected) return 'Expected';
    return 'Approved';
  };

  const getStatusColor = () => {
    if (isRejected) return '#e74c3c'; // Red
    if (isPending) return '#f39c12'; // Orange
    if (isExpired) return '#888'; // Gray
    if (hasCheckedOut) return '#4caf50'; // Green
    if (hasCheckedIn) return '#2196f3'; // Blue
    if (isExpected) return '#ff9800'; // Orange
    return '#4361ee'; // Default blue
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.card }]}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={[styles.visitorName, { color: theme.text }]}>
            {visitor.name}
          </Text>
          <Text style={[styles.visitorPurpose, { color: theme.text + 'CC' }]}>
            {visitor.purpose || 'No purpose specified'}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
          <Text style={styles.statusText}>{getStatusLabel()}</Text>
        </View>
      </View>
      
      <View style={styles.cardInfo}>
        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={16} color={theme.text + 'CC'} />
          <Text style={[styles.infoText, { color: theme.text + 'CC' }]}>
            Expected: {visitor.expected_arrival 
              ? format(new Date(visitor.expected_arrival), 'PPpp') 
              : 'Not specified'}
          </Text>
        </View>
        
        <View style={styles.infoRow}>
          <Ionicons name="key-outline" size={16} color={theme.text + 'CC'} />
          <Text style={[styles.infoText, { color: theme.text + 'CC' }]}>
            Code: {visitor.access_code}
          </Text>
        </View>
        
        {visitor.expiry_time && (
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={16} color={theme.text + 'CC'} />
            <Text style={[styles.infoText, { color: theme.text + 'CC' }]}>
              Valid until: {format(new Date(visitor.expiry_time), 'PPpp')}
            </Text>
          </View>
        )}
        
        {visitor.check_in_time && (
          <View style={styles.infoRow}>
            <Ionicons name="log-in-outline" size={16} color={theme.text + 'CC'} />
            <Text style={[styles.infoText, { color: theme.text + 'CC' }]}>
              Checked in: {format(new Date(visitor.check_in_time), 'PPpp')}
            </Text>
          </View>
        )}
        
        {visitor.check_out_time && (
          <View style={styles.infoRow}>
            <Ionicons name="log-out-outline" size={16} color={theme.text + 'CC'} />
            <Text style={[styles.infoText, { color: theme.text + 'CC' }]}>
              Checked out: {format(new Date(visitor.check_out_time), 'PPpp')}
            </Text>
          </View>
        )}
      </View>
      
      {/* Show approval actions if the visitor is pending approval */}
      {isPending && (
        <View style={styles.approvalActions}>
          <TouchableOpacity 
            style={[styles.approvalButton, { backgroundColor: theme.success }]} 
            onPress={handleApprove}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color="white" />
                <Text style={styles.approvalButtonText}>Approve</Text>
              </>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.approvalButton, { backgroundColor: theme.error }]} 
            onPress={handleReject}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="close" size={20} color="white" />
                <Text style={styles.approvalButtonText}>Reject</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
      
      <View style={styles.cardActions}>
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: theme.primaryLight }]} 
          onPress={() => setModalVisible(true)}
          disabled={isExpired || isRejected}
        >
          <Ionicons 
            name="key-outline" 
            size={20} 
            color={(isExpired || isRejected) ? theme.text + 'CC' : theme.primary} 
          />
          <Text 
            style={[
              styles.actionText, 
              { color: (isExpired || isRejected) ? theme.text + 'CC' : theme.primary }
            ]}
          >
            View Pass
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: theme.primaryLight }]} 
          onPress={handleShare}
          disabled={isExpired || isPending || isRejected}
        >
          <Ionicons 
            name="share-social-outline" 
            size={20} 
            color={(isExpired || isPending || isRejected) ? theme.text + 'CC' : theme.primary} 
          />
          <Text 
            style={[
              styles.actionText, 
              { color: (isExpired || isPending || isRejected) ? theme.text + 'CC' : theme.primary }
            ]}
          >
            Share
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: theme.errorLight }]} 
          onPress={handleDelete}
        >
          <Ionicons name="trash-outline" size={20} color={theme.error} />
          <Text style={[styles.actionText, { color: theme.error }]}>
            Delete
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Visitor Pass Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Visitor Pass for {visitor.name}
            </Text>
            
            <View style={[styles.accessCodeContainer, { backgroundColor: theme.primary }]}>
              <Text style={styles.accessCodeLabel}>ACCESS CODE</Text>
              <Text style={styles.accessCodeValue}>{visitor.access_code}</Text>
              <Ionicons name="key" size={24} color="white" style={styles.accessCodeIcon} />
            </View>
            
            <View style={styles.visitorDetails}>
              <Text style={[styles.detailText, { color: theme.text + 'CC' }]}>
                Purpose: {visitor.purpose || 'Not specified'}
              </Text>
              <Text style={[styles.detailText, { color: theme.text + 'CC' }]}>
                Expected: {visitor.expected_arrival 
                  ? format(new Date(visitor.expected_arrival), 'PPpp') 
                  : 'Not specified'}
              </Text>
              <Text style={[styles.detailText, { color: theme.text + 'CC' }]}>
                Valid until: {visitor.expiry_time 
                  ? format(new Date(visitor.expiry_time), 'PPpp') 
                  : 'Not specified'}
              </Text>
              <Text style={[styles.detailText, { color: theme.text + 'CC' }]}>
                Flat Number: {visitor.flat_number}
              </Text>
              <Text style={[styles.detailText, { color: theme.text + 'CC' }]}>
                Status: {getStatusLabel()}
              </Text>
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: theme.primary }]} 
                onPress={handleShare}
                disabled={isPending || isRejected}
              >
                <Ionicons name="share-social-outline" size={20} color="white" />
                <Text style={styles.modalButtonText}>Share</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: theme.secondaryBackground }]} 
                onPress={() => setModalVisible(false)}
              >
                <Text style={[styles.modalButtonText, { color: theme.text }]}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  visitorName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  visitorPurpose: {
    fontSize: 14,
  },
  cardInfo: {
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 14,
    marginLeft: 8,
  },
  approvalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  approvalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  approvalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    marginHorizontal: 4,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '90%',
    maxWidth: 350,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  
  // New styles for the access code display
  accessCodeContainer: {
    width: '100%',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  accessCodeLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 8,
  },
  accessCodeValue: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 32,
    letterSpacing: 2,
  },
  accessCodeIcon: {
    position: 'absolute',
    top: 10,
    right: 10,
    opacity: 0.5,
  },
  
  visitorDetails: {
    width: '100%',
    marginBottom: 20,
  },
  detailText: {
    fontSize: 14,
    marginBottom: 6,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 4,
  },
}); 