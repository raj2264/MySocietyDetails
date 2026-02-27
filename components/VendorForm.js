import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { addVendor, updateVendor, getVendorCategories } from '../lib/vendors';

const VendorForm = ({ vendor, onSuccess, onCancel }) => {
  const { theme } = useTheme();
  const { residentData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    contact_person: '',
    phone: '',
    email: '',
    description: '',
    address: '',
    service_hours: '',
    is_available: true,
    society_id: residentData?.society_id || ''
  });
  const [errors, setErrors] = useState({});
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  
  const categories = getVendorCategories();

  useEffect(() => {
    if (vendor) {
      setFormData({
        name: vendor.name || '',
        category: vendor.category || '',
        contact_person: vendor.contact_person || '',
        phone: vendor.phone || '',
        email: vendor.email || '',
        description: vendor.description || '',
        address: vendor.address || '',
        service_hours: vendor.service_hours || '',
        is_available: vendor.is_available !== false,
        society_id: vendor.society_id || residentData?.society_id || ''
      });
    }
  }, [vendor, residentData]);

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.category) newErrors.category = 'Category is required';
    if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
    if (formData.email && !formData.email.includes('@')) newErrors.email = 'Invalid email format';
    if (!formData.society_id) newErrors.society_id = 'Society ID is required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    
    setLoading(true);
    try {
      if (vendor?.id) {
        // Update existing vendor
        const { data, error } = await updateVendor(vendor.id, formData);
        if (error) throw error;
        Alert.alert('Success', 'Vendor updated successfully');
        onSuccess(data[0]);
      } else {
        // Add new vendor
        const { data, error } = await addVendor(formData);
        if (error) throw error;
        Alert.alert('Success', 'Vendor added successfully');
        onSuccess(data[0]);
      }
    } catch (error) {
      console.error('Error saving vendor:', error);
      Alert.alert('Error', 'Failed to save vendor information');
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

  const selectCategory = (category) => {
    handleChange('category', category);
    setShowCategoryDropdown(false);
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: theme.text }]}>Vendor Name *</Text>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: theme.card, color: theme.text },
            errors.name && styles.inputError
          ]}
          value={formData.name}
          onChangeText={(text) => handleChange('name', text)}
          placeholder="Enter vendor name"
          placeholderTextColor={theme.text + '80'}
        />
        {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: theme.text }]}>Category *</Text>
        <TouchableOpacity
          style={[
            styles.input,
            { backgroundColor: theme.card, color: theme.text },
            errors.category && styles.inputError
          ]}
          onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
        >
          <View style={styles.dropdownToggle}>
            <Text style={{ color: formData.category ? theme.text : theme.text + '80' }}>
              {formData.category || 'Select a category'}
            </Text>
            <Ionicons
              name={showCategoryDropdown ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={theme.text}
            />
          </View>
        </TouchableOpacity>
        {errors.category && <Text style={styles.errorText}>{errors.category}</Text>}
        
        {showCategoryDropdown && (
          <View style={[styles.dropdown, { backgroundColor: theme.card }]}>
            <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.dropdownItem,
                    formData.category === category && styles.selectedItem
                  ]}
                  onPress={() => selectCategory(category)}
                >
                  <Text
                    style={[
                      styles.dropdownText,
                      { color: theme.text },
                      formData.category === category && styles.selectedText
                    ]}
                  >
                    {category}
                  </Text>
                  {formData.category === category && (
                    <Ionicons name="checkmark" size={18} color="#4CAF50" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: theme.text }]}>Contact Person</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.card, color: theme.text }]}
          value={formData.contact_person}
          onChangeText={(text) => handleChange('contact_person', text)}
          placeholder="Enter contact person name"
          placeholderTextColor={theme.text + '80'}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: theme.text }]}>Phone Number *</Text>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: theme.card, color: theme.text },
            errors.phone && styles.inputError
          ]}
          value={formData.phone}
          onChangeText={(text) => handleChange('phone', text)}
          placeholder="Enter phone number"
          placeholderTextColor={theme.text + '80'}
          keyboardType="phone-pad"
        />
        {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: theme.text }]}>Email</Text>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: theme.card, color: theme.text },
            errors.email && styles.inputError
          ]}
          value={formData.email}
          onChangeText={(text) => handleChange('email', text)}
          placeholder="Enter email address"
          placeholderTextColor={theme.text + '80'}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: theme.text }]}>Description</Text>
        <TextInput
          style={[
            styles.textArea,
            { backgroundColor: theme.card, color: theme.text }
          ]}
          value={formData.description}
          onChangeText={(text) => handleChange('description', text)}
          placeholder="Enter service description"
          placeholderTextColor={theme.text + '80'}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: theme.text }]}>Address</Text>
        <TextInput
          style={[
            styles.textArea,
            { backgroundColor: theme.card, color: theme.text }
          ]}
          value={formData.address}
          onChangeText={(text) => handleChange('address', text)}
          placeholder="Enter address"
          placeholderTextColor={theme.text + '80'}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: theme.text }]}>Service Hours</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.card, color: theme.text }]}
          value={formData.service_hours}
          onChangeText={(text) => handleChange('service_hours', text)}
          placeholder="e.g. Mon-Fri: 9am-5pm"
          placeholderTextColor={theme.text + '80'}
        />
      </View>

      <View style={styles.formGroup}>
        <View style={styles.switchContainer}>
          <Text style={[styles.label, { color: theme.text }]}>Available for Booking</Text>
          <Switch
            value={formData.is_available}
            onValueChange={(value) => handleChange('is_available', value)}
            trackColor={{ false: '#767577', true: '#4CAF50' }}
            thumbColor={formData.is_available ? '#fff' : '#f4f3f4'}
          />
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={onCancel}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Cancel</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, styles.submitButton]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {vendor?.id ? 'Update Vendor' : 'Add Vendor'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
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
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  submitButton: {
    backgroundColor: '#4361EE',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  dropdownToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '100%',
  },
  dropdown: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    zIndex: 10,
    borderRadius: 8,
    maxHeight: 200,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  selectedItem: {
    backgroundColor: 'rgba(67, 97, 238, 0.1)',
  },
  dropdownText: {
    fontSize: 16,
  },
  selectedText: {
    fontWeight: '600',
  },
});

export default VendorForm; 