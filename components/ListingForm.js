import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ListingForm = ({
  initialData,
  onSubmit,
  onCancel,
  resident,
  isDarkMode,
  theme,
}) => {
  // Form state
  const [formData, setFormData] = useState({
    apartmentNumber: '',
    listingType: 'sale', // 'sale' or 'rent'
    title: '',
    description: '',
    price: '',
    contactPhone: '',
    contactEmail: '',
  });

  // Form validation state
  const [errors, setErrors] = useState({});
  
  // Initialize form with resident data and initial data if editing
  useEffect(() => {
    if (resident) {
      setFormData(prevState => ({
        ...prevState,
        apartmentNumber: resident.unit_number || '',
        contactEmail: resident.email || '',
      }));
    }
    
    if (initialData) {
      setFormData({
        apartmentNumber: initialData.apartment_number || '',
        listingType: initialData.listing_type || 'sale',
        title: initialData.title || '',
        description: initialData.description || '',
        price: initialData.price ? String(initialData.price) : '',
        contactPhone: initialData.contact_phone || '',
        contactEmail: initialData.contact_email || '',
      });
    }
  }, [resident, initialData]);

  // Handle input changes
  const handleChange = (field, value) => {
    setFormData({
      ...formData,
      [field]: value,
    });
    
    // Clear error when field is edited
    if (errors[field]) {
      setErrors({
        ...errors,
        [field]: null,
      });
    }
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.apartmentNumber.trim()) {
      newErrors.apartmentNumber = 'Apartment number is required';
    }
    
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    
    if (!formData.price.trim()) {
      newErrors.price = 'Price is required';
    } else if (isNaN(Number(formData.price)) || Number(formData.price) <= 0) {
      newErrors.price = 'Please enter a valid price';
    }
    
    if (!formData.contactEmail.trim()) {
      newErrors.contactEmail = 'Contact email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.contactEmail)) {
      newErrors.contactEmail = 'Please enter a valid email';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = () => {
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  // Render input field with label and error message
  const renderInput = (label, field, placeholder, keyboardType = 'default', multiline = false) => {
    return (
      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: theme.text }]}>
          {label}
        </Text>
        <TextInput
          style={[
            styles.input,
            multiline && styles.textArea,
            { 
              backgroundColor: theme.input,
              color: theme.text,
              borderColor: errors[field] ? '#e74c3c' : isDarkMode ? '#555' : '#ddd',
            },
          ]}
          value={formData[field]}
          onChangeText={(text) => handleChange(field, text)}
          placeholder={placeholder}
          placeholderTextColor={isDarkMode ? '#888' : '#999'}
          keyboardType={keyboardType}
          multiline={multiline}
          numberOfLines={multiline ? 4 : 1}
        />
        {errors[field] && (
          <Text style={styles.errorText}>{errors[field]}</Text>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.formHeader}>
        <Text style={[styles.formTitle, { color: theme.text }]}>
          {initialData ? 'Edit Listing' : 'Create New Listing'}
        </Text>
      </View>
      
      <ScrollView style={styles.formContainer}>
        {renderInput('Apartment Number', 'apartmentNumber', 'e.g., A-101')}
        
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.text }]}>
            Listing Type
          </Text>
          <View style={styles.typeSelector}>
            <TouchableOpacity
              style={[
                styles.typeButton,
                formData.listingType === 'sale' && styles.activeTypeButton,
                { borderColor: isDarkMode ? '#555' : '#ddd' }
              ]}
              onPress={() => handleChange('listingType', 'sale')}
            >
              <Ionicons 
                name="pricetag" 
                size={18} 
                color={formData.listingType === 'sale' ? theme.primary : isDarkMode ? '#888' : '#666'} 
              />
              <Text 
                style={[
                  styles.typeButtonText,
                  formData.listingType === 'sale' && { color: theme.primary },
                  { color: theme.text }
                ]}
              >
                For Sale
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.typeButton,
                formData.listingType === 'rent' && styles.activeTypeButton,
                { borderColor: isDarkMode ? '#555' : '#ddd' }
              ]}
              onPress={() => handleChange('listingType', 'rent')}
            >
              <Ionicons 
                name="key" 
                size={18} 
                color={formData.listingType === 'rent' ? theme.primary : isDarkMode ? '#888' : '#666'} 
              />
              <Text 
                style={[
                  styles.typeButtonText,
                  formData.listingType === 'rent' && { color: theme.primary },
                  { color: theme.text }
                ]}
              >
                For Rent
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {renderInput('Title', 'title', 'e.g., Beautiful 2BHK Apartment')}
        {renderInput('Description', 'description', 'Describe your apartment...', 'default', true)}
        {renderInput('Price (₹)', 'price', 'e.g., 2500000', 'numeric')}
        
        <View style={styles.contactSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Contact Information
          </Text>
          {renderInput('Phone Number', 'contactPhone', 'e.g., +91 9876543210', 'phone-pad')}
          {renderInput('Email', 'contactEmail', 'e.g., your@email.com', 'email-address')}
        </View>
      </ScrollView>
      
      <View style={styles.formActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.cancelButton]}
          onPress={onCancel}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.submitButton, { backgroundColor: theme.primary }]}
          onPress={handleSubmit}
        >
          <Text style={styles.submitButtonText}>
            {initialData ? 'Update Listing' : 'Create Listing'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginHorizontal: 16,
    marginVertical: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  formHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  formContainer: {
    padding: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 12,
    marginTop: 4,
  },
  typeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flex: 1,
    marginHorizontal: 4,
  },
  activeTypeButton: {
    borderColor: '#3498db',
    borderWidth: 2,
  },
  typeButtonText: {
    marginLeft: 6,
    fontWeight: '500',
  },
  contactSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    marginRight: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  submitButton: {
    marginLeft: 8,
  },
  cancelButtonText: {
    color: '#888',
    fontWeight: '500',
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default ListingForm; 