import { supabase } from './supabase';

// Get all security contacts for a society
export async function getSecurityContacts(societyId) {
  try {
    const { data, error } = await supabase
      .from('security_contacts')
      .select('*')
      .eq('society_id', societyId)
      .order('contact_type');

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching security contacts:', error);
    return { data: null, error };
  }
}

// Get a contact type label
export function getContactTypeLabel(type) {
  const contactTypes = {
    'security': 'Security Guard',
    'emergency': 'Emergency Contact',
    'police': 'Police',
    'fire': 'Fire Department',
    'medical': 'Medical Emergency',
    'other': 'Other'
  };
  
  return contactTypes[type] || type;
} 