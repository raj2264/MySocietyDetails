import { supabase, safeQuery } from './supabase';
import { Alert } from 'react-native';

// Fetch vendors for a society
export const fetchVendors = async (societyId) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('society_id', societyId)
      .order('name', { ascending: true });

    if (error) throw error;
    return { data, error: null };
  });
};

// Fetch a single vendor by ID
export const fetchVendorById = async (vendorId) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('id', vendorId)
      .single();

    if (error) throw error;
    return { data, error: null };
  });
};

// Add a new vendor
export const addVendor = async (vendorData) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('vendors')
      .insert([vendorData])
      .select();

    if (error) throw error;
    return { data, error: null };
  });
};

// Update a vendor
export const updateVendor = async (vendorId, updates) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('vendors')
      .update(updates)
      .eq('id', vendorId)
      .select();

    if (error) throw error;
    return { data, error: null };
  });
};

// Delete a vendor
export const deleteVendor = async (vendorId) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('vendors')
      .delete()
      .eq('id', vendorId);

    if (error) throw error;
    return { success: true, error: null };
  });
};

// Book a vendor service
export const bookVendorService = async (bookingData) => {
  console.log('🚀 Starting booking process...');
  
  // Validate input data
  if (!bookingData.vendor_id) {
    console.error('❌ Missing vendor_id in booking data');
    return { data: null, error: { message: 'Missing vendor_id in booking data' } };
  }
  
  if (!bookingData.resident_id) {
    console.error('❌ Missing resident_id in booking data');
    return { data: null, error: { message: 'Missing resident_id in booking data' } };
  }
  
  if (!bookingData.service_description) {
    console.error('❌ Missing service_description in booking data');
    return { data: null, error: { message: 'Service description is required' } };
  }
  
  return safeQuery(async () => {
    console.log('Attempting to book service with data:', {
      ...bookingData,
      booking_date: new Date(bookingData.booking_date).toISOString()
    });

    try {
      // Check if user is authenticated first
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        console.error('❌ No active session found. User not authenticated.');
        throw new Error('You must be logged in to book a service');
      }
      
      const { data, error } = await supabase
        .from('vendor_bookings')
        .insert([{
          ...bookingData,
          booking_date: new Date(bookingData.booking_date).toISOString()
        }])
        .select();

      if (error) {
        console.error('Booking service error:', {
          code: error.code,
          message: error.message,
          details: error.details
        });
        throw error;
      }

      console.log('✅ Booking service success:', data);
      return { data, error: null };
    } catch (error) {
      console.error('❌ Unexpected error in bookVendorService:', error);
      throw error;
    }
  });
};

// Fetch bookings for a resident
export const fetchResidentBookings = async (residentId) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('vendor_bookings')
      .select(`
        *,
        vendor:vendors(id, name, category, phone)
      `)
      .eq('resident_id', residentId)
      .order('booking_date', { ascending: false });

    if (error) throw error;
    return { data, error: null };
  });
};

// Fetch bookings for a vendor
export const fetchVendorBookings = async (vendorId) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('vendor_bookings')
      .select(`
        *,
        resident:residents(id, name, unit_number, phone)
      `)
      .eq('vendor_id', vendorId)
      .order('booking_date', { ascending: false });

    if (error) throw error;
    return { data, error: null };
  });
};

// Update booking status
export const updateBookingStatus = async (bookingId, status) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('vendor_bookings')
      .update({ status })
      .eq('id', bookingId)
      .select();

    if (error) throw error;
    return { data, error: null };
  });
};

// Cancel a booking
export const cancelBooking = async (bookingId) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('vendor_bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId)
      .select();

    if (error) throw error;
    return { data, error: null };
  });
};

// Get vendor categories
export const getVendorCategories = () => {
  return [
    'Plumber',
    'Electrician',
    'Carpenter',
    'Painter',
    'Cleaning',
    'Security',
    'Gardening',
    'Pest Control',
    'Laundry',
    'Food Delivery',
    'Grocery Delivery',
    'Maintenance',
    'Other'
  ];
};

// Get booking status options
export const getBookingStatusOptions = () => {
  return [
    'pending',
    'confirmed',
    'in_progress',
    'completed',
    'cancelled',
    'rejected'
  ];
};

// Verify and fix booking table setup
export const verifyBookingSetup = async () => {
  return safeQuery(async () => {
    console.log('Verifying booking setup...');
    
    try {
      // Check if there are any bookings
      const { data: bookings, error: bookingsError } = await supabase
        .from('vendor_bookings')
        .select('count')
        .limit(1);
      
      if (bookingsError) {
        console.error('Error verifying bookings:', bookingsError);
        // Table might not exist or user might not have access
        
        console.log('Trying to set up booking tables...');
        // Try to set up the booking table using the fix-booking endpoint
        const response = await fetch('https://jjgsggmufkpadchkodab.supabase.co/functions/v1/fix-bookings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabase.auth.session()?.access_token || ''}`
          },
          body: JSON.stringify({ setup: true })
        });
        
        if (!response.ok) {
          throw new Error('Failed to set up booking tables');
        }
        
        return { success: true, message: 'Booking setup initialized' };
      }
      
      return { success: true, message: 'Booking system is properly set up' };
    } catch (error) {
      console.error('Error in verifyBookingSetup:', error);
      return { success: false, error };
    }
  });
}; 