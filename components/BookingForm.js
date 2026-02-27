import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { bookVendorService } from '../lib/vendors';
import DateTimePicker from '@react-native-community/datetimepicker';

const BookingForm = ({ vendor, onSuccess, onCancel }) => {
  const { theme } = useTheme();
  const { residentData } = useAuth();
  
  console.log('BookingForm rendering with vendor:', vendor?.id);
  console.log('Current resident data:', residentData);
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    vendor_id: vendor?.id || '',
    resident_id: residentData?.id || '',
    service_description: '',
    booking_date: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    notes: ''
  });
  
  // Update form data when vendor or resident data changes
  useEffect(() => {
    console.log('Updating form data with vendor/resident changes');
    setFormData(prev => ({
      ...prev,
      vendor_id: vendor?.id || prev.vendor_id,
      resident_id: residentData?.id || prev.resident_id
    }));
  }, [vendor, residentData]);
  
  const [errors, setErrors] = useState({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const validate = () => {
    console.log('Validating form data:', formData);
    const newErrors = {};
    if (!formData.vendor_id) newErrors.vendor_id = 'Vendor ID is required';
    if (!formData.resident_id) newErrors.resident_id = 'Resident ID is required';
    if (!formData.service_description.trim()) newErrors.service_description = 'Service description is required';
    if (!formData.booking_date) newErrors.booking_date = 'Booking date is required';
    
    setErrors(newErrors);
    const isValid = Object.keys(newErrors).length === 0;
    console.log('Form validation result:', isValid ? 'Valid' : 'Invalid', newErrors);
    return isValid;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    
    setLoading(true);
    try {
      // Ensure all required fields are present
      if (!formData.vendor_id || !formData.resident_id) {
        throw new Error('Missing required user data. Please try logging out and back in.');
      }

      const { data, error } = await bookVendorService(formData);
      if (error) {
        // Handle specific error cases
        if (error.code === '23505') {
          throw new Error('A booking already exists for this time slot');
        } else if (error.code === '23503') {
          throw new Error('Invalid vendor or resident information');
        } else if (error.code === '42501') {
          throw new Error('You do not have permission to create bookings');
        }
        throw error;
      }
      
      Alert.alert('Success', 'Service booked successfully');
      onSuccess(data[0]);
    } catch (error) {
      console.error('Error booking service:', error);
      Alert.alert(
        'Booking Failed',
        error.message || 'Failed to book service. Please try again later.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when field is edited
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || formData.booking_date;
    setShowDatePicker(Platform.OS === 'ios');
    
    // Keep the time part from the existing date
    if (selectedDate) {
      const newDate = new Date(currentDate);
      const oldDate = new Date(formData.booking_date);
      newDate.setHours(oldDate.getHours(), oldDate.getMinutes(), 0, 0);
      handleChange('booking_date', newDate);
    }
  };

  const handleTimeChange = (event, selectedTime) => {
    const currentTime = selectedTime || formData.booking_date;
    setShowTimePicker(Platform.OS === 'ios');
    
    if (selectedTime) {
      const newDate = new Date(formData.booking_date);
      newDate.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
      handleChange('booking_date', newDate);
    }
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={true}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.vendorInfo}>
        <Text style={[styles.vendorName, { color: theme.text }]}>{vendor?.name}</Text>
        <Text style={[styles.vendorCategory, { color: theme.text + 'CC' }]}>{vendor?.category}</Text>
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: theme.text }]}>Service Description *</Text>
        <TextInput
          style={[
            styles.textArea,
            { backgroundColor: theme.card, color: theme.text },
            errors.service_description && styles.inputError
          ]}
          value={formData.service_description}
          onChangeText={(text) => handleChange('service_description', text)}
          placeholder="Describe the service you need"
          placeholderTextColor={theme.text + '80'}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
        {errors.service_description && (
          <Text style={styles.errorText}>{errors.service_description}</Text>
        )}
      </View>

      <View style={styles.dateTimeContainer}>
        <View style={[styles.formGroup, styles.dateGroup]}>
          <Text style={[styles.label, { color: theme.text }]}>Date *</Text>
          <TouchableOpacity
            style={[
              styles.dateTimeButton,
              { backgroundColor: theme.card },
              errors.booking_date && styles.inputError
            ]}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={{ color: theme.text }}>
              {formatDate(formData.booking_date)}
            </Text>
            <Ionicons name="calendar" size={20} color={theme.text + '80'} />
          </TouchableOpacity>
          {errors.booking_date && (
            <Text style={styles.errorText}>{errors.booking_date}</Text>
          )}
        </View>

        <View style={[styles.formGroup, styles.timeGroup]}>
          <Text style={[styles.label, { color: theme.text }]}>Time *</Text>
          <TouchableOpacity
            style={[
              styles.dateTimeButton,
              { backgroundColor: theme.card },
              errors.booking_date && styles.inputError
            ]}
            onPress={() => setShowTimePicker(true)}
          >
            <Text style={{ color: theme.text }}>
              {formatTime(formData.booking_date)}
            </Text>
            <Ionicons name="time" size={20} color={theme.text + '80'} />
          </TouchableOpacity>
        </View>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={formData.booking_date}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
          minimumDate={new Date()}
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={formData.booking_date}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleTimeChange}
        />
      )}

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: theme.text }]}>Additional Notes</Text>
        <TextInput
          style={[
            styles.textArea,
            { backgroundColor: theme.card, color: theme.text }
          ]}
          value={formData.notes}
          onChangeText={(text) => handleChange('notes', text)}
          placeholder="Any additional information for the vendor"
          placeholderTextColor={theme.text + '80'}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={onCancel}
          disabled={loading}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, styles.bookButton]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.bookButtonText}>Book Service</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    maxHeight: '100%',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40, // Add extra padding at bottom
  },
  vendorInfo: {
    marginBottom: 24,
  },
  vendorName: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  vendorCategory: {
    fontSize: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  dateTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dateGroup: {
    flex: 3,
    marginRight: 8,
  },
  timeGroup: {
    flex: 2,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  textArea: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    minHeight: 100,
  },
  inputError: {
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  button: {
    flex: 1,
    height: 50,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  cancelButton: {
    backgroundColor: '#E0E0E0',
  },
  bookButton: {
    backgroundColor: '#4361EE',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  bookButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default BookingForm; 