import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppLayout from '../components/AppLayout';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

const AddComplaintScreen = () => {
  const { theme, isDarkMode } = useTheme();
  const { user, residentData } = useAuth();
  const router = useRouter();
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [complaintType, setComplaintType] = useState('personal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Handle image selection
  const handleSelectImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      
      if (result.canceled) {
        return;
      }
      
      const asset = result.assets[0];
      
      // Check file size (max 5MB)
      if (asset.fileSize > 5 * 1024 * 1024) {
        Alert.alert('Error', 'Image size should be less than 5MB');
        return;
      }
      
      setAttachment({
        uri: asset.uri,
        name: asset.uri.split('/').pop(),
        type: 'image/jpeg',
        size: asset.fileSize,
      });
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };
  
  // Remove attachment
  const handleRemoveAttachment = () => {
    setAttachment(null);
  };
  
  // Handle form submission
  const handleSubmit = async () => {
    // Form validation
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title for your complaint');
      return;
    }
    
    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a description for your complaint');
      return;
    }
    
    if (!residentData?.id || !residentData?.society_id) {
      Alert.alert('Error', 'Missing user information. Please log in again.');
      return;
    }
    
    try {
      setIsSubmitting(true);
      let attachmentUrl = null;
      let attachmentName = null;
      
      // Upload attachment if exists
      if (attachment) {
        setIsUploading(true);
        try {
          // First, check if we can access the file
          const fileInfo = await FileSystem.getInfoAsync(attachment.uri);
          if (!fileInfo.exists) {
            throw new Error('File not found');
          }

          const fileExt = attachment.name.split('.').pop();
          const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
          const filePath = `${user.id}/${fileName}`;

          // Create form data
          const formData = new FormData();
          formData.append('file', {
            uri: attachment.uri,
            name: fileName,
            type: attachment.type,
          });

          // Upload with retry logic
          let uploadError = null;
          let retryCount = 0;
          const maxRetries = 3;

          while (retryCount < maxRetries) {
            try {
              const { error } = await supabase.storage
                .from('complaint-attachments')
                .upload(filePath, formData, {
                  contentType: attachment.type,
                  cacheControl: '3600',
                  upsert: false
                });
              
              if (error) throw error;
              uploadError = null;
              break;
            } catch (error) {
              console.error(`Upload attempt ${retryCount + 1} failed:`, error);
              uploadError = error;
              retryCount++;
              if (retryCount < maxRetries) {
                // Wait for 1 second before retrying
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
          }

          if (uploadError) {
            throw new Error(`Failed to upload after ${maxRetries} attempts: ${uploadError.message}`);
          }
          
          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('complaint-attachments')
            .getPublicUrl(filePath);
          
          attachmentUrl = publicUrl;
          attachmentName = attachment.name;
        } catch (error) {
          console.error('Error uploading attachment:', error);
          Alert.alert(
            'Upload Failed',
            'Failed to upload attachment. Please check your internet connection and try again.',
            [{ text: 'OK' }]
          );
          return;
        } finally {
          setIsUploading(false);
        }
      }
      
      // Prepare complaint data
      const complaintData = {
        society_id: residentData.society_id,
        resident_id: residentData.id,
        title: title.trim(),
        description: description.trim(),
        type: complaintType,
        status: 'pending',
        attachment_url: attachmentUrl,
        attachment_name: attachmentName,
      };
      
      // Insert complaint into the database
      const { data, error } = await supabase
        .from('complaints')
        .insert(complaintData)
        .select()
        .single();
      
      if (error) {
        console.error('Error submitting complaint:', error);
        Alert.alert('Error', `Failed to submit complaint: ${error.message}`);
        return;
      }
      
      console.log('Complaint submitted successfully:', data);
      
      // Success message
      Alert.alert(
        'Success',
        'Your complaint has been submitted successfully',
        [
          {
            text: 'OK',
            onPress: () => router.back()
          }
        ]
      );
    } catch (error) {
      console.error('Exception submitting complaint:', error);
      Alert.alert('Error', `An unexpected error occurred: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Get file icon based on type
  const getFileIcon = (fileName) => {
    const ext = fileName?.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf':
        return 'picture-as-pdf';
      case 'doc':
      case 'docx':
        return 'description';
      case 'jpg':
      case 'jpeg':
      case 'png':
        return 'image';
      default:
        return 'insert-drive-file';
    }
  };
  
  return (
    <AppLayout title="Submit Complaint" showBack={true}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 120 : 0}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formGroup}>
            <Text style={[
              styles.label, 
              { 
                color: theme.text,
                fontSize: 18,
                fontWeight: '700'
              }
            ]}>Title</Text>
            <TextInput
              style={[
                styles.input,
                { 
                  backgroundColor: theme.card, 
                  color: theme.text, 
                  borderColor: isDarkMode ? '#444' : theme.border 
                }
              ]}
              placeholderTextColor={theme.textSecondary || (isDarkMode ? '#AAAAAA' : '#888888')}
              placeholder="Brief title for your complaint"
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />
          </View>
          
          <View style={styles.formGroup}>
            <Text style={[
              styles.label, 
              { 
                color: theme.text,
                fontSize: 18,
                fontWeight: '700'
              }
            ]}>Description</Text>
            <TextInput
              style={[
                styles.textArea,
                { 
                  backgroundColor: theme.card, 
                  color: theme.text, 
                  borderColor: isDarkMode ? '#444' : theme.border 
                }
              ]}
              placeholderTextColor={theme.textSecondary || (isDarkMode ? '#AAAAAA' : '#888888')}
              placeholder="Detailed description of your complaint"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
          </View>
          
          <View style={styles.formGroup}>
            <Text style={[
              styles.label, 
              { 
                color: theme.text,
                fontSize: 18,
                fontWeight: '700'
              }
            ]}>Complaint Type</Text>
            
            <View style={styles.radioGroup}>
              <TouchableOpacity
                style={[
                  styles.radioOption,
                  { backgroundColor: complaintType === 'personal' ? theme.primary + '20' : 'transparent' }
                ]}
                onPress={() => setComplaintType('personal')}
              >
                <View style={[
                  styles.radioButton,
                  { borderColor: theme.primary }
                ]}>
                  {complaintType === 'personal' && (
                    <View style={[styles.radioButtonSelected, { backgroundColor: theme.primary }]} />
                  )}
                </View>
                <View style={styles.radioContent}>
                  <Text style={[
                    styles.radioLabel, 
                    { 
                      color: theme.text,
                      fontWeight: complaintType === 'personal' ? '700' : '600',
                      fontSize: 17
                    }
                  ]}>
                    Personal
                  </Text>
                  <Text style={[styles.radioDescription, { color: theme.textSecondary || theme.text + '99' }]}>
                    Visible only to you and society admin
                  </Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.radioOption,
                  { backgroundColor: complaintType === 'community' ? theme.primary + '20' : 'transparent' }
                ]}
                onPress={() => setComplaintType('community')}
              >
                <View style={[
                  styles.radioButton,
                  { borderColor: theme.primary }
                ]}>
                  {complaintType === 'community' && (
                    <View style={[styles.radioButtonSelected, { backgroundColor: theme.primary }]} />
                  )}
                </View>
                <View style={styles.radioContent}>
                  <Text style={[
                    styles.radioLabel, 
                    { 
                      color: theme.text,
                      fontWeight: complaintType === 'community' ? '700' : '600',
                      fontSize: 17
                    }
                  ]}>
                    Community
                  </Text>
                  <Text style={[styles.radioDescription, { color: theme.textSecondary || theme.text + '99' }]}>
                    Visible to all residents and society admin
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: theme.text }]}>Attachment (Optional)</Text>
            <Text style={[styles.attachmentInfo, { color: theme.textSecondary }]}>
              You can attach an image up to 5MB
            </Text>
            
            {attachment ? (
              <View style={[styles.attachmentPreview, { backgroundColor: theme.card }]}>
                <Image
                  source={{ uri: attachment.uri }}
                  style={styles.attachmentImage}
                  resizeMode="cover"
                />
                <Text style={[styles.attachmentName, { color: theme.text }]} numberOfLines={1}>
                  {attachment.name}
                </Text>
                <TouchableOpacity
                  onPress={handleRemoveAttachment}
                  style={styles.removeButton}
                >
                  <Ionicons name="close-circle" size={24} color={theme.text} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.attachmentButton, { backgroundColor: theme.card }]}
                onPress={handleSelectImage}
              >
                <Ionicons name="image-outline" size={24} color={theme.text} />
                <Text style={[styles.attachmentButtonText, { color: theme.text }]}>
                  Add Image
                </Text>
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.formActions}>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: theme.border }]}
              onPress={() => router.back()}
              disabled={isSubmitting || isUploading}
            >
              <Text style={[styles.cancelButtonText, { color: theme.text }]}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: theme.primary },
                (isSubmitting || isUploading) && styles.submitButtonDisabled
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting || isUploading}
            >
              {isSubmitting || isUploading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Complaint</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
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
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 120,
  },
  radioGroup: {
    marginTop: 8,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  radioButtonSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  radioContent: {
    marginLeft: 10,
    flex: 1,
  },
  radioLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  radioDescription: {
    fontSize: 14,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 2,
    borderRadius: 8,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  attachmentInfo: {
    fontSize: 12,
    marginBottom: 8,
  },
  attachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    gap: 8,
  },
  attachmentButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  attachmentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginTop: 8,
  },
  attachmentImage: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginRight: 12,
  },
  attachmentName: {
    flex: 1,
    fontSize: 14,
    marginRight: 8,
  },
  removeButton: {
    padding: 4,
  },
});

export default AddComplaintScreen; 