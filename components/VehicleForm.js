import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { addVehicle, updateVehicle } from '../lib/vehicles';

// Vehicle types for the picker
const VEHICLE_TYPES = [
  { id: 'car', label: 'Car', icon: 'car-outline' },
  { id: 'bike', label: 'Bike', icon: 'bicycle-outline' },
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal-circle-outline' },
];

const VehicleForm = ({ visible, onClose, vehicle, residentId }) => {
  const { theme, isDarkMode } = useTheme();
  const textSecondary = theme.text + '80';
  const isEditMode = !!vehicle;

  // Form state
  const [vehicleType, setVehicleType] = useState('car');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [parkingSpot, setParkingSpot] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Initialize form with vehicle data if in edit mode
  useEffect(() => {
    if (vehicle) {
      setVehicleType(vehicle.vehicle_type);
      setMake(vehicle.make);
      setModel(vehicle.model);
      setColor(vehicle.color || '');
      setLicensePlate(vehicle.license_plate);
      setParkingSpot(vehicle.parking_spot || '');
    } else {
      // Reset form when adding new vehicle
      setVehicleType('car');
      setMake('');
      setModel('');
      setColor('');
      setLicensePlate('');
      setParkingSpot('');
      setErrors({});
    }
  }, [vehicle, visible]);

  // Validate form
  const validateForm = () => {
    const newErrors = {};
    
    if (!make.trim()) newErrors.make = 'Make is required';
    if (!model.trim()) newErrors.model = 'Model is required';
    if (!licensePlate.trim()) newErrors.licensePlate = 'License plate is required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    try {
      setLoading(true);
      
      const vehicleData = {
        vehicleType,
        make,
        model,
        color: color.trim(),
        licensePlate: licensePlate.trim(),
        parkingSpot: parkingSpot.trim(),
      };
      
      let result;
      
      if (isEditMode) {
        result = await updateVehicle(vehicle.id, vehicleData);
      } else {
        result = await addVehicle(residentId, vehicleData);
      }
      
      if (result.success) {
        onClose(true); // Close with refresh flag
      } else {
        Alert.alert('Error', result.error || 'Failed to save vehicle');
      }
    } catch (error) {
      console.error('Exception saving vehicle:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Reset form and close
  const handleCancel = () => {
    onClose(false);
  };

  // Render type selector
  const renderTypeSelector = () => (
    <View style={styles.typeSelector}>
      {VEHICLE_TYPES.map((type) => (
        <TouchableOpacity
          key={type.id}
          style={[
            styles.typeOption,
            { 
              backgroundColor: vehicleType === type.id ? '#4361EE20' : 'transparent',
              borderColor: vehicleType === type.id ? '#4361EE' : theme.border,
            }
          ]}
          onPress={() => setVehicleType(type.id)}
        >
          <Ionicons 
            name={type.icon} 
            size={28} 
            color={vehicleType === type.id ? '#4361EE' : textSecondary} 
          />
          <Text 
            style={[
              styles.typeLabel, 
              { 
                color: vehicleType === type.id ? '#4361EE' : theme.text,
                fontWeight: vehicleType === type.id ? '600' : '400'
              }
            ]}
          >
            {type.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: theme.card }]}>
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Text style={[styles.title, { color: theme.text }]}>{isEditMode ? 'Edit Vehicle' : 'Add New Vehicle'}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={handleCancel}>
              <Ionicons name="close-circle" size={28} color={textSecondary} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Vehicle Type</Text>
            {renderTypeSelector()}
            
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Vehicle Details</Text>
            
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Make <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={[
                  styles.input, 
                  errors.make && styles.inputError,
                  { 
                    backgroundColor: theme.input,
                    borderColor: errors.make ? '#E53935' : theme.border,
                    color: theme.text
                  }
                ]}
                placeholder="Enter vehicle make (e.g. Toyota, Honda)"
                placeholderTextColor={textSecondary}
                value={make}
                onChangeText={(text) => {
                  setMake(text);
                  if (errors.make) {
                    const newErrors = {...errors};
                    delete newErrors.make;
                    setErrors(newErrors);
                  }
                }}
              />
              {errors.make && <Text style={styles.errorText}>{errors.make}</Text>}
            </View>
            
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Model <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={[
                  styles.input, 
                  errors.model && styles.inputError,
                  { 
                    backgroundColor: theme.input,
                    borderColor: errors.model ? '#E53935' : theme.border,
                    color: theme.text
                  }
                ]}
                placeholder="Enter vehicle model (e.g. Civic, Corolla)"
                placeholderTextColor={textSecondary}
                value={model}
                onChangeText={(text) => {
                  setModel(text);
                  if (errors.model) {
                    const newErrors = {...errors};
                    delete newErrors.model;
                    setErrors(newErrors);
                  }
                }}
              />
              {errors.model && <Text style={styles.errorText}>{errors.model}</Text>}
            </View>
            
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Color</Text>
              <TextInput
                style={[
                  styles.input,
                  { 
                    backgroundColor: theme.input,
                    borderColor: theme.border,
                    color: theme.text
                  }
                ]}
                placeholder="Enter vehicle color (e.g. Blue, Silver)"
                placeholderTextColor={textSecondary}
                value={color}
                onChangeText={setColor}
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: theme.text }]}>License Plate <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={[
                  styles.input, 
                  errors.licensePlate && styles.inputError,
                  { 
                    backgroundColor: theme.input,
                    borderColor: errors.licensePlate ? '#E53935' : theme.border,
                    color: theme.text
                  }
                ]}
                placeholder="Enter license plate number"
                placeholderTextColor={textSecondary}
                value={licensePlate}
                autoCapitalize="characters"
                onChangeText={(text) => {
                  setLicensePlate(text);
                  if (errors.licensePlate) {
                    const newErrors = {...errors};
                    delete newErrors.licensePlate;
                    setErrors(newErrors);
                  }
                }}
              />
              {errors.licensePlate && <Text style={styles.errorText}>{errors.licensePlate}</Text>}
            </View>
            
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Parking Spot</Text>
              <TextInput
                style={[
                  styles.input,
                  { 
                    backgroundColor: theme.input,
                    borderColor: theme.border,
                    color: theme.text
                  }
                ]}
                placeholder="Enter assigned parking spot number"
                placeholderTextColor={textSecondary}
                value={parkingSpot}
                onChangeText={setParkingSpot}
                keyboardType="number-pad"
              />
            </View>
            
            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={[styles.cancelButton, { borderColor: theme.border }]} 
                onPress={handleCancel}
                disabled={loading}
              >
                <Text style={[styles.cancelButtonText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.submitButton} 
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name={isEditMode ? "save-outline" : "add-circle-outline"} size={20} color="#FFFFFF" style={styles.buttonIcon} />
                    <Text style={styles.submitButtonText}>
                      {isEditMode ? 'Update' : 'Add'} Vehicle
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
  },
  container: {
    width: '100%',
    maxHeight: '90%',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  scrollContent: {
    padding: 18,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 15,
  },
  typeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  typeOption: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 5,
  },
  typeLabel: {
    marginTop: 8,
    fontSize: 15,
  },
  formGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 15,
    marginBottom: 8,
    fontWeight: '500',
  },
  required: {
    color: '#E53935',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
  },
  inputError: {
    borderColor: '#E53935',
    borderWidth: 1.5,
  },
  errorText: {
    color: '#E53935',
    fontSize: 13,
    marginTop: 5,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
    marginBottom: 25,
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButton: {
    flex: 2,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#4361EE',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  cancelButtonText: {
    fontWeight: '600',
    fontSize: 15,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  buttonIcon: {
    marginRight: 8,
  },
});

export default VehicleForm; 