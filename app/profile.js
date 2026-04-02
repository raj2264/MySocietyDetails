import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import TermsAcceptanceHistory from '../components/TermsAcceptanceHistory';


import useNoStuckLoading from '../hooks/useNoStuckLoading';
export default function ProfileScreen() {
  const { theme, isDarkMode } = useTheme();
  const { user, updateUserProfile, residentData } = useAuth();
  const router = useRouter();
  const defaultAvatarUrl = 'https://xsgames.co/randomusers/avatar.php?g=pixel';

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  useNoStuckLoading(isLoading, setIsLoading);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [profileImage, setProfileImage] = useState(
    residentData?.avatar_url || user?.user_metadata?.avatar_url || defaultAvatarUrl
  );
  const [imageLoadError, setImageLoadError] = useState(false);
  const [imageRefreshKey, setImageRefreshKey] = useState(0);

  // Effect to update profile image when residentData changes
  useEffect(() => {
    if (residentData?.avatar_url) {
      // Add cache buster to force fresh image load
      const urlWithBuster = residentData.avatar_url.includes('?t=')
        ? residentData.avatar_url
        : `${residentData.avatar_url}?t=${Date.now()}`;
      setProfileImage(urlWithBuster);
      setImageLoadError(false);
    }
  }, [residentData?.avatar_url]);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [apartmentNo, setApartmentNo] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Add this after the password fields state declarations
  const [passwordRequirements, setPasswordRequirements] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
  });

  // Initialize form data from resident data when it's available
  useEffect(() => {
    if (residentData) {
      setFullName(residentData.name || '');
      setPhone(residentData.phone || '');
      setApartmentNo(residentData.unit_number || '');
      // Emergency contact is not in resident data, so we use user metadata if available
      setEmergencyContact(user?.user_metadata?.emergency_contact || '');
    } else {
      // Fallback to user metadata
      setFullName(user?.user_metadata?.full_name || '');
      setPhone(user?.user_metadata?.phone || '');
      setApartmentNo(user?.user_metadata?.apartment_no || '');
      setEmergencyContact(user?.user_metadata?.emergency_contact || '');
    }
    // Avatar URL is updated in separate effect below, don't override it here
  }, [residentData, user]);

  // Helper to pick image from gallery
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need camera roll permissions to change your profile picture');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setProfileImage(result.assets[0].uri);
      setImageLoadError(false);
    }
  };

  // Remove profile photo
  const removeProfilePhoto = () => {
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove your profile photo?',
      [
        { text: 'Cancel', onPress: () => {}, style: 'cancel' },
        {
          text: 'Remove',
          onPress: async () => {
            try {
              setIsLoading(true);
              // Remove from database immediately
              const { success, error } = await updateUserProfile({ avatar_url: null });
              if (success) {
                setProfileImage(defaultAvatarUrl);
                setImageLoadError(false);
                Alert.alert('Success', 'Profile photo removed successfully');
              } else {
                Alert.alert('Error', 'Failed to remove photo: ' + error);
              }
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to remove photo');
            } finally {
              setIsLoading(false);
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  // Upload avatar to Supabase Storage and return public URL
  const uploadAvatarToStorage = async (localUri) => {
    try {
      if (!user?.id) throw new Error('User not authenticated');

      let ext = 'jpg';
      if (localUri.includes('.png')) ext = 'png';
      else if (localUri.includes('.webp')) ext = 'webp';

      const fileName = `${user.id}/avatar_${Date.now()}.${ext}`;

      // Prepare file data
      let fileData;
      if (localUri.startsWith('data:')) {
        const response = await fetch(localUri);
        fileData = await response.arrayBuffer();
      } else {
        const response = await fetch(localUri);
        fileData = await response.arrayBuffer();
      }

      // Upload to storage
      const { error, data } = await supabase.storage
        .from('avatars')
        .upload(fileName, fileData, {
          contentType: `image/${ext}`,
          upsert: true,
        });

      if (error) {
        console.error('Supabase upload error:', error);
        throw new Error(`Supabase error: ${error.message}`);
      }

      console.log('Avatar uploaded:', fileName);

      // Get public URL - properly formatted
      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const publicUrl = publicUrlData?.publicUrl;
      console.log('Avatar public URL:', publicUrl);

      if (!publicUrl) {
        throw new Error('Failed to get public URL');
      }

      // Add cache buster with random string to force fresh load
      const cacheBuster = `v=${Math.random().toString(36).substr(2, 9)}`;
      const urlWithBuster = publicUrl.includes('?')
        ? `${publicUrl}&${cacheBuster}`
        : `${publicUrl}?${cacheBuster}`;
      return urlWithBuster;
    } catch (error) {
      console.error('Avatar upload error:', error);
      throw error;
    }
  };

  // Handle form submission
  const handleSaveProfile = async () => {
    setIsLoading(true);
    
    try {
      // Handle avatar: upload new, keep existing, or clear if removed
      let avatarUrl = profileImage;
      
      // If user removed the photo (back to default), clear it
      if (profileImage === defaultAvatarUrl) {
        avatarUrl = null;
        setProfileImage(defaultAvatarUrl);
        setImageLoadError(false);
        setImageRefreshKey(prev => prev + 1);
      }
      // If it's a new local file, upload it
      else if (profileImage && !profileImage.startsWith('http')) {
        let uploadedUrl = null;
        try {
          uploadedUrl = await uploadAvatarToStorage(profileImage);
          // Set immediately with the new URL and force component refresh
          setProfileImage(uploadedUrl);
          setImageLoadError(false);
          setImageRefreshKey(prev => prev + 1);
          avatarUrl = uploadedUrl;
        } catch (uploadErr) {
          console.warn('Avatar upload warning:', uploadErr.message);
          Alert.alert('Note', 'Profile will be saved but photo upload failed. Please check your connection.');
          return;
        }
      }

      // Prepare profile data
      const updatedProfile = {
        full_name: fullName,
        phone,
        apartment_no: apartmentNo,
        emergency_contact: emergencyContact,
      };
      
      // Only add avatar URL if we have one (null clears it)
      if (avatarUrl !== null && avatarUrl && avatarUrl.startsWith('http')) {
        updatedProfile.avatar_url = avatarUrl;
      } else if (avatarUrl === null) {
        // Explicitly set to null to clear avatar
        updatedProfile.avatar_url = null;
      }
      
      // Update profile in Supabase
      const { success, error } = await updateUserProfile(updatedProfile);
      
      if (!success) {
        Alert.alert('Error', 'Failed to update profile: ' + error);
        return;
      }

      // Show success and close edit mode
      Alert.alert('Success', 'Profile updated successfully', [
        {
          text: 'OK',
          onPress: () => setIsEditing(false),
        },
      ]);
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', error.message || 'An unexpected error occurred while saving profile');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle navigation to Vehicles screen
  const navigateToVehicles = () => {
    router.push('/vehicles');
  };

  // Validate password requirements
  const validatePassword = (password) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (password.length < minLength) {
      return 'Password must be at least 8 characters long';
    }
    if (!hasUpperCase) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!hasLowerCase) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!hasNumbers) {
      return 'Password must contain at least one number';
    }
    if (!hasSpecialChar) {
      return 'Password must contain at least one special character';
    }
    return '';
  };

  // Add this after the validatePassword function
  const checkPasswordRequirements = (password) => {
    setPasswordRequirements({
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    });
  };

  // Handle password change
  const handlePasswordChange = async () => {
    try {
      setPasswordError('');
      
      // Validate current password
      if (!currentPassword) {
        setPasswordError('Please enter your current password');
        return;
      }

      // Validate new password
      const passwordValidationError = validatePassword(newPassword);
      if (passwordValidationError) {
        setPasswordError(passwordValidationError);
        return;
      }

      // Check if passwords match
      if (newPassword !== confirmPassword) {
        setPasswordError('New passwords do not match');
        return;
      }

      setIsLoading(true);

      // Verify current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        setPasswordError('Current password is incorrect');
        setIsLoading(false);
        return;
      }

      // Update password and mark as changed in user_metadata
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        data: { password_changed: true },
      });

      if (updateError) {
        throw updateError;
      }

      // Also try updating residents table (best effort)
      if (user?.id) {
        await supabase
          .from('residents')
          .update({ password_changed: true })
          .eq('user_id', user.id)
          .then(() => {})
          .catch(() => {});
      }

      // Clear password fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsChangingPassword(false);
      
      Alert.alert(
        'Success',
        'Your password has been updated successfully',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error updating password:', error);
      setPasswordError(error.message || 'Failed to update password');
    } finally {
      setIsLoading(false);
    }
  };

  // Profile sections data
  const profileSections = [
    {
      title: 'Account Information',
      items: [
        { label: 'Email', value: user?.email || '', icon: 'mail-outline', editable: false },
        { label: 'Full Name', value: fullName, icon: 'person-outline', editable: true, setter: setFullName },
        { label: 'Phone', value: phone, icon: 'call-outline', editable: true, setter: setPhone },
      ],
    },
    {
      title: 'Residence Details',
      items: [
        { label: 'Apartment No.', value: apartmentNo, icon: 'home-outline', editable: true, setter: setApartmentNo },
        { label: 'Emergency Contact', value: emergencyContact, icon: 'alert-circle-outline', editable: true, setter: setEmergencyContact },
      ],
    },
    {
      title: 'Security',
      items: [
        {
          label: 'Change Password',
          value: '',
          icon: 'lock-closed-outline',
          customComponent: (
            <TouchableOpacity
              onPress={() => setIsChangingPassword(!isChangingPassword)}
              style={styles.changePasswordButton}
            >
              <Text style={[styles.changePasswordText, { color: theme.primary }]}>
                {isChangingPassword ? 'Cancel' : 'Change Password'}
              </Text>
            </TouchableOpacity>
          ),
        },
      ],
    },
  ];

  // Toggle edit mode button component
  const EditButton = () => (
    <TouchableOpacity 
      style={[styles.editButton, { backgroundColor: isEditing ? theme.error : theme.primary }]}
      onPress={() => isEditing ? setIsEditing(false) : setIsEditing(true)}
    >
      <Ionicons 
        name={isEditing ? "close-outline" : "create-outline"} 
        size={20} 
        color="#FFF" 
      />
      <Text style={styles.editButtonText}>
        {isEditing ? 'Cancel' : 'Edit'}
      </Text>
    </TouchableOpacity>
  );

  return (
    <AppLayout 
      title="My Profile" 
      rightComponent={<EditButton />}
      showBackButton
      onBackPress={() => router.back()}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header with Image */}
        <View style={styles.profileHeader}>
          <View style={styles.profileImageContainer}>
            {profileImage && !imageLoadError ? (
              <Image
                key={`${profileImage}-${imageRefreshKey}`}
                source={{ uri: profileImage }}
                style={styles.profileImage}
                onError={() => setImageLoadError(true)}
              />
            ) : (
              <View style={[styles.profileImageFallback, { backgroundColor: theme.primary + '20' }]}>
                <Ionicons name="person" size={46} color={theme.primary} />
              </View>
            )}
            
            {isEditing && (
              <View style={styles.photoButtonsContainer}>
                <TouchableOpacity 
                  style={[styles.changePhotoButton, { backgroundColor: theme.primary }]}
                  onPress={pickImage}
                >
                  <Ionicons name="camera-outline" size={22} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.removePhotoButton, { backgroundColor: theme.error }]}
                  onPress={removeProfilePhoto}
                >
                  <Ionicons name="trash-outline" size={22} color="#FFF" />
                </TouchableOpacity>
              </View>
            )}
          </View>
          
          <Text style={[styles.profileName, { color: theme.text }]}>
            {residentData?.name || user?.user_metadata?.full_name || 'User'}
          </Text>
          <Text style={[styles.profileRole, { color: theme.primary, marginBottom: 4 }]}>
            {residentData?.unit_number ? `Unit ${residentData.unit_number}` : ''}
          </Text>
          <Text style={[styles.profileEmail, { color: theme.text + '99' }]}>
            {user?.email}
          </Text>
        </View>

        {/* Profile Information Sections */}
        {profileSections.map((section, sectionIdx) => (
          <View key={sectionIdx} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {section.title}
            </Text>
            
            <View style={[styles.sectionContent, { backgroundColor: theme.card }]}>
              {section.items.map((item, itemIdx) => (
                <View 
                  key={itemIdx} 
                  style={[
                    styles.profileItem,
                    itemIdx !== section.items.length - 1 && styles.borderBottom,
                    { borderBottomColor: theme.border }
                  ]}
                >
                  <View style={styles.profileItemHeader}>
                    <Ionicons name={item.icon} size={20} color={theme.primary} style={styles.itemIcon} />
                    <Text style={[styles.itemLabel, { color: theme.text + '99' }]}>
                      {item.label}
                    </Text>
                  </View>
                  
                  {item.customComponent ? (
                    item.customComponent
                  ) : isEditing && item.editable ? (
                    <TextInput
                      value={item.value}
                      onChangeText={item.setter}
                      style={[
                        styles.input,
                        { 
                          color: theme.text,
                          backgroundColor: theme.input,
                          borderColor: theme.border
                        }
                      ]}
                      placeholderTextColor={theme.text + '60'}
                      placeholder={`Enter ${item.label.toLowerCase()}`}
                    />
                  ) : (
                    <Text style={[styles.itemValue, { color: theme.text }]}>
                      {item.value || `No ${item.label.toLowerCase()} provided`}
                    </Text>
                  )}
                </View>
              ))}
            </View>

            {/* Password Change Form */}
            {isChangingPassword && section.title === 'Security' && (
              <View style={[styles.passwordForm, { backgroundColor: theme.card }]}>
                <Text style={[styles.passwordFormTitle, { color: theme.text }]}>
                  Update Your Password
                </Text>
                
                <View style={styles.passwordInputContainer}>
                  <Text style={[styles.inputLabel, { color: theme.text + '99' }]}>
                    Current Password
                  </Text>
                  <TextInput
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="Enter your current password"
                    secureTextEntry
                    style={[
                      styles.passwordInput,
                      { 
                        color: theme.text,
                        backgroundColor: theme.input,
                        borderColor: theme.border
                      }
                    ]}
                    placeholderTextColor={theme.text + '60'}
                  />
                </View>

                <View style={styles.passwordInputContainer}>
                  <Text style={[styles.inputLabel, { color: theme.text + '99' }]}>
                    New Password
                  </Text>
                  <TextInput
                    value={newPassword}
                    onChangeText={(text) => {
                      setNewPassword(text);
                      checkPasswordRequirements(text);
                    }}
                    placeholder="Enter your new password"
                    secureTextEntry
                    style={[
                      styles.passwordInput,
                      { 
                        color: theme.text,
                        backgroundColor: theme.input,
                        borderColor: theme.border
                      }
                    ]}
                    placeholderTextColor={theme.text + '60'}
                  />
                </View>

                <View style={[styles.passwordRequirements, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
                  <Text style={[styles.requirementsTitle, { color: theme.text }]}>
                    Password Requirements:
                  </Text>
                  <View style={styles.requirementItem}>
                    <Ionicons 
                      name={passwordRequirements.length ? "checkmark-circle" : "ellipse-outline"} 
                      size={16} 
                      color={passwordRequirements.length ? theme.success : theme.text + '60'} 
                    />
                    <Text style={[styles.requirementText, { color: theme.text + '99' }]}>
                      At least 8 characters long
                    </Text>
                  </View>
                  <View style={styles.requirementItem}>
                    <Ionicons 
                      name={passwordRequirements.uppercase ? "checkmark-circle" : "ellipse-outline"} 
                      size={16} 
                      color={passwordRequirements.uppercase ? theme.success : theme.text + '60'} 
                    />
                    <Text style={[styles.requirementText, { color: theme.text + '99' }]}>
                      One uppercase letter
                    </Text>
                  </View>
                  <View style={styles.requirementItem}>
                    <Ionicons 
                      name={passwordRequirements.lowercase ? "checkmark-circle" : "ellipse-outline"} 
                      size={16} 
                      color={passwordRequirements.lowercase ? theme.success : theme.text + '60'} 
                    />
                    <Text style={[styles.requirementText, { color: theme.text + '99' }]}>
                      One lowercase letter
                    </Text>
                  </View>
                  <View style={styles.requirementItem}>
                    <Ionicons 
                      name={passwordRequirements.number ? "checkmark-circle" : "ellipse-outline"} 
                      size={16} 
                      color={passwordRequirements.number ? theme.success : theme.text + '60'} 
                    />
                    <Text style={[styles.requirementText, { color: theme.text + '99' }]}>
                      One number
                    </Text>
                  </View>
                  <View style={styles.requirementItem}>
                    <Ionicons 
                      name={passwordRequirements.special ? "checkmark-circle" : "ellipse-outline"} 
                      size={16} 
                      color={passwordRequirements.special ? theme.success : theme.text + '60'} 
                    />
                    <Text style={[styles.requirementText, { color: theme.text + '99' }]}>
                      One special character
                    </Text>
                  </View>
                </View>

                <View style={styles.passwordInputContainer}>
                  <Text style={[styles.inputLabel, { color: theme.text + '99' }]}>
                    Confirm New Password
                  </Text>
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm your new password"
                    secureTextEntry
                    style={[
                      styles.passwordInput,
                      { 
                        color: theme.text,
                        backgroundColor: theme.input,
                        borderColor: theme.border
                      }
                    ]}
                    placeholderTextColor={theme.text + '60'}
                  />
                </View>

                {passwordError ? (
                  <View style={[styles.errorContainer, { backgroundColor: isDarkMode ? 'rgba(255,0,0,0.1)' : 'rgba(255,0,0,0.05)' }]}>
                    <Ionicons name="alert-circle" size={16} color={theme.error} />
                    <Text style={[styles.errorText, { color: theme.error }]}>
                      {passwordError}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.passwordButtonContainer}>
                  <TouchableOpacity
                    onPress={() => {
                      setIsChangingPassword(false);
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                      setPasswordError('');
                      setPasswordRequirements({
                        length: false,
                        uppercase: false,
                        lowercase: false,
                        number: false,
                        special: false,
                      });
                    }}
                    style={[styles.cancelButton, { borderColor: theme.border }]}
                  >
                    <Text style={[styles.cancelButtonText, { color: theme.text }]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    onPress={handlePasswordChange}
                    disabled={isLoading}
                    style={[
                      styles.updatePasswordButton,
                      { backgroundColor: theme.primary },
                      isLoading && styles.disabledButton
                    ]}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <>
                        <Ionicons name="lock-closed-outline" size={20} color="#FFF" />
                        <Text style={styles.updatePasswordButtonText}>
                          Update Password
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        ))}

        {/* Add Terms & Conditions Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Terms & Conditions
          </Text>
          <View style={[styles.sectionContent, { backgroundColor: theme.card }]}>
            <TermsAcceptanceHistory userType="resident" />
          </View>
        </View>

        {/* Add Vehicle Management Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            My Vehicles
          </Text>
          
          <TouchableOpacity
            style={[styles.vehicleButton, { backgroundColor: theme.card }]}
            onPress={navigateToVehicles}
          >
            <View style={styles.vehicleButtonContent}>
              <Ionicons name="car-outline" size={24} color={theme.primary} style={styles.vehicleIcon} />
              <View style={styles.vehicleTextContainer}>
                <Text style={[styles.vehicleButtonTitle, { color: theme.text }]}>
                  Manage My Vehicles
                </Text>
                <Text style={[styles.vehicleButtonSubtitle, { color: theme.text + '80' }]}>
                  Add, edit or remove your vehicles
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.text + '60'} />
          </TouchableOpacity>
        </View>

        {/* Save Button when Editing */}
        {isEditing && (
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: theme.primary }]}
            onPress={handleSaveProfile}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color="#FFF" />
                <Text style={styles.saveButtonText}>Save Profile</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 32,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 8,
    minHeight: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  profileImageFallback: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoButtonsContainer: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
  },
  changePhotoButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
  removePhotoButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
  profileName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 4,
  },
  profileRole: {
    fontSize: 16,
    fontWeight: '500',
  },
  profileEmail: {
    fontSize: 14,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 20,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  sectionContent: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  profileItem: {
    padding: 16,
  },
  borderBottom: {
    borderBottomWidth: 1,
  },
  profileItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemIcon: {
    marginRight: 8,
  },
  itemLabel: {
    fontSize: 14,
  },
  itemValue: {
    fontSize: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editButtonText: {
    color: '#FFF',
    marginLeft: 4,
    fontWeight: '500',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  vehicleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  vehicleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehicleIcon: {
    marginRight: 12,
  },
  vehicleTextContainer: {
    flex: 1,
  },
  vehicleButtonTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  vehicleButtonSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  changePasswordButton: {
    paddingVertical: 8,
  },
  changePasswordText: {
    fontSize: 16,
    fontWeight: '500',
  },
  passwordForm: {
    padding: 20,
    marginTop: 12,
    borderRadius: 12,
  },
  passwordFormTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
  },
  passwordInputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  passwordInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  passwordRequirements: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  requirementText: {
    fontSize: 14,
    marginLeft: 8,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  passwordButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  updatePasswordButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  updatePasswordButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.7,
  },
}); 