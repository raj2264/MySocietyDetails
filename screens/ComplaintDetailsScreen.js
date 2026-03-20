import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  Linking,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppLayout from '../components/AppLayout';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { openFileLocally } from '../utils/file-opener';

const ComplaintDetailsScreen = () => {
  const { theme, isDarkMode } = useTheme();
  const { user, residentData } = useAuth();
  const router = useRouter();
  const { complaintId } = useLocalSearchParams();
  const scrollViewRef = useRef(null);
  
  // State for complaint data
  const [complaint, setComplaint] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // State for adding comment
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  
  // Format date helper function
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Function to fetch complaint details
  const fetchComplaintDetails = async () => {
    if (!complaintId) {
      setError('No complaint ID provided');
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Fetch complaint with resident info and updates
      const { data, error } = await supabase
        .from('complaints')
        .select('*, residents(name, unit_number), complaint_updates(id, user_id, is_admin, comment, created_at)')
        .eq('id', complaintId)
        .single();
      
      if (error) {
        console.error('Error fetching complaint details:', error);
        setError(`Unable to load complaint: ${error.message}`);
        return;
      }
      
      if (data) {
        console.log('Complaint details fetched:', data);
        setComplaint(data);
        
        // Sort updates by date
        if (data.complaint_updates) {
          const sortedUpdates = [...data.complaint_updates].sort(
            (a, b) => new Date(a.created_at) - new Date(b.created_at)
          );
          setUpdates(sortedUpdates);
        }
      } else {
        setError('Complaint not found');
      }
    } catch (error) {
      console.error('Exception fetching complaint details:', error);
      setError(`An error occurred: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch complaint details on mount
  useEffect(() => {
    fetchComplaintDetails();
  }, [complaintId]);
  
  // Function to add a comment
  const handleAddComment = async () => {
    if (!newComment.trim()) {
      Alert.alert('Error', 'Please enter a comment');
      return;
    }
    
    if (!user?.id || !complaintId) {
      Alert.alert('Error', 'Missing required information');
      return;
    }
    
    try {
      setIsSubmittingComment(true);
      
      // Prepare comment data
      const commentData = {
        complaint_id: complaintId,
        user_id: user.id,
        is_admin: false, // Residents are not admins
        comment: newComment.trim()
      };
      
      // Insert comment
      const { data, error } = await supabase
        .from('complaint_updates')
        .insert(commentData)
        .select();
      
      if (error) {
        console.error('Error adding comment:', error);
        Alert.alert('Error', `Failed to add comment: ${error.message}`);
        return;
      }
      
      console.log('Comment added successfully:', data);
      
      // Clear input and refresh data
      setNewComment('');
      await fetchComplaintDetails();
      
      // Scroll to bottom to show new comment
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 300);
      
    } catch (error) {
      console.error('Exception adding comment:', error);
      Alert.alert('Error', `An unexpected error occurred: ${error.message}`);
    } finally {
      setIsSubmittingComment(false);
    }
  };
  
  // Render status badge
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
  
  // Loading component
  const LoadingComponent = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={theme.primary} />
      <Text style={[styles.loadingText, { color: theme.text }]}>
        Loading complaint details...
      </Text>
    </View>
  );
  
  // Error component
  const ErrorComponent = () => (
    <View style={styles.errorContainer}>
      <Ionicons name="alert-circle-outline" size={48} color={theme.error} />
      <Text style={[styles.errorText, { color: theme.text }]}>{error}</Text>
      <TouchableOpacity
        style={[styles.retryButton, { backgroundColor: theme.primary }]}
        onPress={fetchComplaintDetails}
      >
        <Text style={[styles.retryButtonText, { color: theme.buttonText }]}>
          Retry
        </Text>
      </TouchableOpacity>
    </View>
  );
  
  // Render update item
  const renderUpdate = (update, index) => {
    const isAdmin = update.is_admin;
    
    return (
      <View 
        key={update.id || index}
        style={[
          styles.updateContainer,
          { backgroundColor: theme.card }
        ]}
      >
        <View style={styles.updateHeader}>
          <View style={[
            styles.updateBadge,
            { 
              backgroundColor: isAdmin 
                ? (isDarkMode ? '#4C2889' : '#F3EBFF') 
                : (isDarkMode ? '#343A40' : '#F8F9FA')
            }
          ]}>
            <Text style={[
              styles.updateBadgeText,
              { 
                color: isAdmin 
                  ? (isDarkMode ? '#BE99FF' : '#6741D9') 
                  : (isDarkMode ? '#E9ECEF' : '#495057')
              }
            ]}>
              {isAdmin ? 'Admin' : 'You'}
            </Text>
          </View>
          <Text style={[styles.updateDate, { color: theme.textSecondary || theme.text + '99' }]}>
            {formatDate(update.created_at)}
          </Text>
        </View>
        
        <Text style={[styles.updateText, { color: theme.text }]}>
          {update.comment}
        </Text>
      </View>
    );
  };

  const handleAttachmentPress = async (url) => {
    try {
      await openFileLocally(url);
    } catch (error) {
      console.error('Error opening attachment:', error);
      Alert.alert('Error', 'Failed to open image');
    }
  };

  // Function to handle complaint deletion
  const handleDeleteComplaint = async () => {
    // Show confirmation dialog
    Alert.alert(
      'Delete Complaint',
      'Are you sure you want to delete this complaint? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              console.log('Starting complaint deletion process...');
              console.log('Complaint ID:', complaintId);
              console.log('Resident ID:', residentData?.id);
              console.log('Complaint Resident ID:', complaint?.resident_id);
              console.log('Full complaint data:', JSON.stringify(complaint, null, 2));

              // Verify resident ownership
              if (!complaint?.resident_id || !residentData?.id) {
                console.error('Missing resident information:', {
                  complaintResidentId: complaint?.resident_id,
                  currentResidentId: residentData?.id
                });
                throw new Error('Missing resident information');
              }

              // First check if the complaint exists at all
              const { data: checkData, error: checkError } = await supabase
                .from('complaints')
                .select('*')
                .eq('id', complaintId)
                .single();

              if (checkError) {
                console.error('Error checking complaint:', checkError);
                throw new Error('Failed to verify complaint exists');
              }

              if (!checkData) {
                console.error('Complaint not found in database');
                throw new Error('Complaint not found');
              }

              console.log('Complaint found in database:', JSON.stringify(checkData, null, 2));

              // Verify resident ownership
              if (checkData.resident_id !== residentData.id) {
                console.error('Resident ID mismatch:', {
                  complaintResidentId: checkData.resident_id,
                  currentResidentId: residentData.id,
                  complaintId: complaintId
                });
                throw new Error('You are not authorized to delete this complaint');
              }

              // Delete attachment if exists
              if (complaint.attachment_url) {
                console.log('Deleting attachment...');
                const filePath = complaint.attachment_url.split('/').pop();
                const fullPath = `${user.id}/${filePath}`;
                console.log('Attachment path:', fullPath);

                const { error: storageError } = await supabase.storage
                  .from('complaint-attachments')
                  .remove([fullPath]);
                
                if (storageError) {
                  console.error('Error deleting attachment:', storageError);
                  // Continue with complaint deletion even if attachment deletion fails
                } else {
                  console.log('Attachment deleted successfully');
                }
              }

              // Delete complaint updates first (due to foreign key constraint)
              console.log('Deleting complaint updates...');
              const { data: updatesData, error: updatesError } = await supabase
                .from('complaint_updates')
                .delete()
                .eq('complaint_id', complaintId)
                .select();

              if (updatesError) {
                console.error('Error deleting updates:', updatesError);
                throw new Error(`Failed to delete complaint updates: ${updatesError.message}`);
              }
              console.log('Updates deleted:', updatesData);

              // Delete the complaint using a direct query
              console.log('Deleting complaint...');
              const { error: deleteError } = await supabase.rpc('delete_complaint', {
                p_complaint_id: complaintId,
                p_resident_id: residentData.id
              });

              if (deleteError) {
                console.error('Error deleting complaint:', deleteError);
                throw new Error(`Failed to delete complaint: ${deleteError.message}`);
              }

              console.log('Complaint deleted successfully');

              // Show success message and navigate back
              Alert.alert(
                'Success',
                'Complaint deleted successfully',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      console.log('Navigating back after successful deletion');
                      router.back();
                    }
                  }
                ]
              );
            } catch (error) {
              console.error('Error in delete process:', error);
              Alert.alert(
                'Error',
                error.message || 'Failed to delete complaint. Please try again.'
              );
            } finally {
              setIsDeleting(false);
            }
          }
        }
      ]
    );
  };

  if (isLoading) {
    return (
      <AppLayout title="Complaint Details" showBack={true}>
        <LoadingComponent />
      </AppLayout>
    );
  }
  
  if (error) {
    return (
      <AppLayout title="Complaint Details" showBack={true}>
        <ErrorComponent />
      </AppLayout>
    );
  }
  
  if (!complaint) {
    return (
      <AppLayout title="Complaint Details" showBack={true}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.text }]}>
            Complaint not found
          </Text>
        </View>
      </AppLayout>
    );
  }
  
  return (
    <AppLayout title="Complaint Details" showBack={true}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 80}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
        >
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <Text style={[
                styles.title, 
                { 
                  color: theme.text,
                  fontWeight: '800'
                }
              ]}>
                {complaint.title}
              </Text>
              {renderStatusBadge(complaint.status)}
            </View>
            
            {/* Add delete button for resident's own complaints */}
            {complaint.resident_id === residentData?.id && (
              <TouchableOpacity
                style={[styles.deleteButton, { backgroundColor: isDarkMode ? '#2C1810' : '#FFF0F1' }]}
                onPress={handleDeleteComplaint}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color={isDarkMode ? '#FF6B6B' : '#FA5252'} />
                ) : (
                  <>
                    <Ionicons 
                      name="trash-outline" 
                      size={18} 
                      color={isDarkMode ? '#FF6B6B' : '#FA5252'} 
                    />
                    <Text style={[
                      styles.deleteButtonText,
                      { color: isDarkMode ? '#FF6B6B' : '#FA5252' }
                    ]}>
                      Delete
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
          
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[
              styles.sectionTitle, 
              { 
                color: theme.text,
                fontSize: 18,
                fontWeight: '700'
              }
            ]}>Description</Text>
            <Text style={[styles.description, { color: theme.text }]}>
              {complaint.description}
            </Text>
          </View>
          
          {complaint.attachment_url && (
            <TouchableOpacity
              style={[styles.attachmentContainer, { backgroundColor: isDarkMode ? '#2a2a2a' : '#f5f5f5' }]}
              onPress={() => handleAttachmentPress(complaint.attachment_url)}
            >
              <Image
                source={{ uri: complaint.attachment_url }}
                style={styles.attachmentImage}
                resizeMode="cover"
              />
              <View style={styles.attachmentInfo}>
                <Text style={[styles.attachmentName, { color: theme.text }]} numberOfLines={1}>
                  {complaint.attachment_name}
                </Text>
                <Text style={[styles.attachmentAction, { color: theme.primary }]}>
                  Tap to view full image
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
          
          <View style={styles.updatesSection}>
            <Text style={[
              styles.updatesSectionTitle, 
              { 
                color: theme.text,
                fontSize: 20,
                fontWeight: '700'
              }
            ]}>
              Updates ({updates.length})
            </Text>
            
            {updates.length === 0 ? (
              <View style={[styles.noUpdatesContainer, { backgroundColor: theme.card }]}>
                <Text style={[styles.noUpdatesText, { color: theme.textSecondary }]}>
                  No updates yet. Add a comment below.
                </Text>
              </View>
            ) : (
              updates.map(renderUpdate)
            )}
          </View>
        </ScrollView>
        
        <View style={[styles.commentInputContainer, { backgroundColor: theme.card }]}>
          <TextInput
            style={[
              styles.commentInput,
              { 
                backgroundColor: isDarkMode ? theme.background : '#F1F3F5', 
                color: theme.text,
                borderColor: isDarkMode ? '#444' : 'transparent',
                borderWidth: isDarkMode ? 1 : 0
              }
            ]}
            placeholder="Add a comment..."
            placeholderTextColor={theme.textSecondary || (isDarkMode ? '#AAAAAA' : '#888888')}
            value={newComment}
            onChangeText={setNewComment}
            multiline
            maxLength={500}
          />
          
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: theme.primary },
              (!newComment.trim() || isSubmittingComment) && { opacity: 0.6 }
            ]}
            onPress={handleAddComment}
            disabled={!newComment.trim() || isSubmittingComment}
          >
            {isSubmittingComment ? (
              <ActivityIndicator size="small" color={theme.buttonText || '#FFFFFF'} />
            ) : (
              <Ionicons name="send" size={18} color={theme.buttonText || '#FFFFFF'} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </AppLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  titleContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
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
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
  },
  updatesSection: {
    marginBottom: 16,
  },
  updatesSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  updateContainer: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  updateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  updateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  updateBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  updateDate: {
    fontSize: 12,
  },
  updateText: {
    fontSize: 14,
    lineHeight: 20,
  },
  noUpdatesContainer: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noUpdatesText: {
    fontSize: 14,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  commentInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
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
  attachmentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  attachmentImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  attachmentInfo: {
    flex: 1,
    marginRight: 8,
  },
  attachmentName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  attachmentAction: {
    fontSize: 12,
  },
});

export default ComplaintDetailsScreen; 