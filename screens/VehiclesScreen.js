import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';
import { getResidentVehicles, setPrimaryVehicle, deleteVehicle } from '../lib/vehicles';
import VehicleForm from '../components/VehicleForm';
import VehicleCard from '../components/VehicleCard';
import { useFocusEffect } from '@react-navigation/native';


import useNoStuckLoading from '../hooks/useNoStuckLoading';
export default function VehiclesScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { residentData } = useAuth();
  const params = useLocalSearchParams();
  
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  useNoStuckLoading(loading, setLoading);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddVehicleForm, setShowAddVehicleForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const hasLoadedOnceRef = useRef(false);
  const isFetchingRef = useRef(false);
  
  // Load vehicles when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (!residentData?.id) {
        setVehicles([]);
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
      Promise.resolve(loadVehicles())
        .catch(error => console.error('Error in loadVehicles:', error))
        .finally(() => {
          isFetchingRef.current = false;
          setLoading(false);
          hasLoadedOnceRef.current = true;
        });
    }, [residentData?.id])
  );

  // Check if we need to refresh after vehicle update
  useEffect(() => {
    if (params.refresh === 'true' && !isFetchingRef.current) {
      loadVehicles();
    }
  }, [params.refresh, loadVehicles]);

  const loadVehicles = useCallback(async () => {
    if (!residentData?.id) {
      setVehicles([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    
    try {
      const result = await getResidentVehicles(residentData.id);
      if (result.success) {
        setVehicles(result.data || []);
      } else {
        console.error('Failed to load vehicles:', result.error);
        Alert.alert('Error', 'Failed to load your vehicles. Please try again.');
      }
    } catch (error) {
      console.error('Exception loading vehicles:', error);
    }
  }, [residentData?.id]);

  const handleRefresh = () => {
    if (!residentData?.id) {
      setVehicles([]);
      setRefreshing(false);
      return;
    }

    if (isFetchingRef.current) return;
    setRefreshing(true);
    isFetchingRef.current = true;
    Promise.resolve(loadVehicles())
      .catch(error => console.error('Error during refresh:', error))
      .finally(() => {
        isFetchingRef.current = false;
        setRefreshing(false);
      });
  };

  const handleAddVehicle = () => {
    setEditingVehicle(null);
    setShowAddVehicleForm(true);
  };

  const handleEditVehicle = (vehicle) => {
    setEditingVehicle(vehicle);
    setShowAddVehicleForm(true);
  };

  const handleDeleteVehicle = (vehicleId) => {
    Alert.alert(
      'Delete Vehicle',
      'Are you sure you want to delete this vehicle?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const result = await deleteVehicle(vehicleId, residentData.id);
              if (result.success) {
                loadVehicles();
              } else {
                Alert.alert('Error', result.error || 'Failed to delete vehicle');
              }
            } catch (error) {
              console.error('Exception deleting vehicle:', error);
              Alert.alert('Error', 'An unexpected error occurred');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleSetPrimary = async (vehicleId) => {
    try {
      setLoading(true);
      const result = await setPrimaryVehicle(vehicleId, residentData.id);
      if (result.success) {
        loadVehicles();
      } else {
        Alert.alert('Error', result.error || 'Failed to set primary vehicle');
      }
    } catch (error) {
      console.error('Exception setting primary vehicle:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleFormClose = (shouldRefresh = false) => {
    setShowAddVehicleForm(false);
    setEditingVehicle(null);
    if (shouldRefresh) {
      loadVehicles();
    }
  };

  // Add button component for header
  const AddButton = () => (
    <TouchableOpacity
      style={[styles.addButton, { backgroundColor: theme.primary }]}
      onPress={handleAddVehicle}
    >
      <Ionicons name="add" size={24} color="#FFF" />
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="car-outline" size={80} color={theme.text + '40'} />
      <Text style={[styles.emptyTitle, { color: theme.text }]}>No Vehicles Added</Text>
      <Text style={[styles.emptySubtitle, { color: theme.text + '80' }]}>
        Add your vehicles for easy management and access
      </Text>
      <TouchableOpacity
        style={[styles.emptyAddButton, { backgroundColor: theme.primary }]}
        onPress={handleAddVehicle}
      >
        <Ionicons name="add-outline" size={24} color="#FFF" style={styles.emptyAddIcon} />
        <Text style={styles.emptyAddText}>Add Vehicle</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <AppLayout
      title="My Vehicles"
      rightComponent={vehicles.length > 0 ? <AddButton /> : null}
      showBackButton
      onBackPress={() => router.back()}
    >
      {loading && !refreshing ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <View style={styles.container}>
          {vehicles.length === 0 ? (
            renderEmptyState()
          ) : (
            <FlatList
              data={vehicles}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <VehicleCard
                  vehicle={item}
                  onEdit={() => handleEditVehicle(item)}
                  onDelete={() => handleDeleteVehicle(item.id)}
                  onSetPrimary={() => handleSetPrimary(item.id)}
                />
              )}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  colors={[theme.primary]}
                  tintColor={theme.primary}
                />
              }
            />
          )}

          {/* Vehicle Form Modal */}
          {showAddVehicleForm && (
            <VehicleForm
              visible={showAddVehicleForm}
              onClose={handleFormClose}
              vehicle={editingVehicle}
              residentId={residentData?.id}
            />
          )}
        </View>
      )}
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100, // Extra padding at bottom for better scrolling
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  emptyAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyAddText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyAddIcon: {
    marginRight: 8,
  },
}); 