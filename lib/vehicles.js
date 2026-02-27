import { supabase } from './supabase';

/**
 * Get all vehicles for the current resident
 * @param {string} residentId - The resident's ID
 * @returns {Promise<Object>} - The result object with success status and data or error
 */
export const getResidentVehicles = async (residentId) => {
  try {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('resident_id', residentId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching vehicles:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Exception fetching vehicles:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
};

/**
 * Add a new vehicle for the resident
 * @param {string} residentId - The resident's ID
 * @param {Object} vehicleData - The vehicle data
 * @returns {Promise<Object>} - The result object with success status and data or error
 */
export const addVehicle = async (residentId, vehicleData) => {
  try {
    // Check if this is the first vehicle being added, to mark it as primary
    const { data: existingVehicles } = await supabase
      .from('vehicles')
      .select('id')
      .eq('resident_id', residentId)
      .limit(1);

    const isPrimary = existingVehicles?.length === 0;

    const { data, error } = await supabase
      .from('vehicles')
      .insert({
        resident_id: residentId,
        vehicle_type: vehicleData.vehicleType,
        make: vehicleData.make,
        model: vehicleData.model,
        color: vehicleData.color || null,
        license_plate: vehicleData.licensePlate,
        parking_spot: vehicleData.parkingSpot || null,
        is_primary: isPrimary,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding vehicle:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Exception adding vehicle:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
};

/**
 * Update an existing vehicle
 * @param {string} vehicleId - The vehicle ID
 * @param {Object} vehicleData - The updated vehicle data
 * @returns {Promise<Object>} - The result object with success status and data or error
 */
export const updateVehicle = async (vehicleId, vehicleData) => {
  try {
    const { data, error } = await supabase
      .from('vehicles')
      .update({
        vehicle_type: vehicleData.vehicleType,
        make: vehicleData.make,
        model: vehicleData.model,
        color: vehicleData.color || null,
        license_plate: vehicleData.licensePlate,
        parking_spot: vehicleData.parkingSpot || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', vehicleId)
      .select()
      .single();

    if (error) {
      console.error('Error updating vehicle:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Exception updating vehicle:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
};

/**
 * Delete a vehicle
 * @param {string} vehicleId - The vehicle ID
 * @param {string} residentId - The resident ID
 * @returns {Promise<Object>} - The result object with success status or error
 */
export const deleteVehicle = async (vehicleId, residentId) => {
  try {
    // Check if the vehicle to be deleted is marked as primary
    const { data: vehicleToDelete, error: fetchError } = await supabase
      .from('vehicles')
      .select('is_primary')
      .eq('id', vehicleId)
      .single();

    if (fetchError) {
      console.error('Error fetching vehicle details:', fetchError);
      return { success: false, error: fetchError.message };
    }

    // Delete the vehicle
    const { error: deleteError } = await supabase
      .from('vehicles')
      .delete()
      .eq('id', vehicleId);

    if (deleteError) {
      console.error('Error deleting vehicle:', deleteError);
      return { success: false, error: deleteError.message };
    }

    // If the deleted vehicle was primary, set another vehicle as primary
    if (vehicleToDelete?.is_primary) {
      const { data: otherVehicles, error: otherVehiclesError } = await supabase
        .from('vehicles')
        .select('id')
        .eq('resident_id', residentId)
        .limit(1);

      if (!otherVehiclesError && otherVehicles?.length > 0) {
        const { error: updateError } = await supabase
          .from('vehicles')
          .update({ is_primary: true })
          .eq('id', otherVehicles[0].id);

        if (updateError) {
          console.error('Error setting new primary vehicle:', updateError);
        }
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Exception deleting vehicle:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
};

/**
 * Set a vehicle as primary
 * @param {string} vehicleId - The vehicle ID to set as primary
 * @param {string} residentId - The resident ID
 * @returns {Promise<Object>} - The result object with success status or error
 */
export const setPrimaryVehicle = async (vehicleId, residentId) => {
  try {
    // First, unset primary flag for all vehicles
    const { error: updateAllError } = await supabase
      .from('vehicles')
      .update({ is_primary: false })
      .eq('resident_id', residentId);

    if (updateAllError) {
      console.error('Error unsetting primary vehicles:', updateAllError);
      return { success: false, error: updateAllError.message };
    }

    // Then, set the selected vehicle as primary
    const { error } = await supabase
      .from('vehicles')
      .update({ is_primary: true })
      .eq('id', vehicleId);

    if (error) {
      console.error('Error setting primary vehicle:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Exception setting primary vehicle:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}; 