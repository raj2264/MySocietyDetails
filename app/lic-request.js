import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';


import useNoStuckLoading from '../hooks/useNoStuckLoading';
export default function LICRequestScreen() {
  const { theme } = useTheme();
  const { user, residentData } = useAuth();
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  useNoStuckLoading(loading, setLoading);
  const [residentName, setResidentName] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [requestType, setRequestType] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [myRequests, setMyRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Initialize resident name and contact info from auth context
  useEffect(() => {
    if (residentData) {
      setResidentName(residentData.name || '');
      setEmail(residentData.email || '');
      setPhone(residentData.phone || '');
    } else {
      setResidentName(user?.user_metadata?.full_name || '');
      setEmail(user?.email || '');
      setPhone(user?.user_metadata?.phone || '');
    }
    
    // Load previous requests
    fetchMyRequests();
  }, [residentData, user]);

  // Fetch user's previous LIC requests
  const fetchMyRequests = async () => {
    if (!user) return;
    
    setLoadingRequests(true);
    try {
      const { data, error } = await supabase
        .from('lic_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setMyRequests(data || []);
    } catch (error) {
      console.error('Error fetching LIC requests:', error);
    } finally {
      setLoadingRequests(false);
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    // Validation
    if (!residentName || !requestType || !email || !phone) {
      Alert.alert('Error', 'Please fill in all required fields: name, email, phone, and request type.');
      return;
    }

    // Validate email format
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      Alert.alert('Error', 'Please enter a valid email address.');
      return;
    }

    // Validate phone (basic check for minimum length)
    if (phone.length < 10) {
      Alert.alert('Error', 'Please enter a valid phone number.');
      return;
    }

    setLoading(true);

    try {
      // Get society ID from resident data if available
      const societyId = residentData?.society_id;
      
      if (!societyId) {
        Alert.alert('Error', 'Unable to determine your society. Please contact admin.');
        setLoading(false);
        return;
      }

      // Submit LIC request to Supabase
      const { data, error } = await supabase
        .from('lic_requests')
        .insert([
          {
            user_id: user.id,
            society_id: societyId,
            resident_name: residentName,
            policy_number: policyNumber,
            request_type: requestType,
            description: description,
            status: 'pending',
            contact_email: email,
            contact_phone: phone
          }
        ]);

      if (error) throw error;
      
      // Reset form after successful submission
      setPolicyNumber('');
      setRequestType('');
      setDescription('');
      
      Alert.alert(
        'Success', 
        'Your LIC request has been submitted successfully!',
        [{ text: 'OK' }]
      );
      
      // Refresh requests list
      fetchMyRequests();
    } catch (error) {
      console.error('Error submitting LIC request:', error);
      Alert.alert('Error', 'Failed to submit your request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const requestTypes = [
    'New Policy', 
    'Policy Renewal', 
    'Policy Claim', 
    'Policy Modification', 
    'General Inquiry'
  ];

  // Get status badge color based on status
  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return theme.warning;
      case 'approved': return theme.success;
      case 'rejected': return theme.error;
      default: return theme.text;
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  return (
    <AppLayout 
      title="LIC Requests" 
      showBackButton
      onBackPress={() => router.back()}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Submit New LIC Request
          </Text>
          
          <View style={[styles.formContainer, { backgroundColor: theme.card }]}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Full Name *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                value={residentName}
                onChangeText={setResidentName}
                placeholder="Enter your full name"
                placeholderTextColor={theme.placeholderText}
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Email *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email address"
                placeholderTextColor={theme.placeholderText}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Phone Number *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                value={phone}
                onChangeText={setPhone}
                placeholder="Enter your phone number"
                placeholderTextColor={theme.placeholderText}
                keyboardType="phone-pad"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Policy Number (if applicable)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                value={policyNumber}
                onChangeText={setPolicyNumber}
                placeholder="Enter your policy number"
                placeholderTextColor={theme.placeholderText}
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Request Type *</Text>
              <View style={styles.requestTypeContainer}>
                {requestTypes.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.requestTypeButton,
                      { borderColor: theme.border, backgroundColor: theme.inputBg },
                      requestType === type && { backgroundColor: theme.primary, borderColor: theme.primary }
                    ]}
                    onPress={() => setRequestType(type)}
                  >
                    <Text
                      style={[
                        styles.requestTypeText,
                        { color: theme.text },
                        requestType === type && { color: '#fff' }
                      ]}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Description</Text>
              <TextInput
                style={[
                  styles.input, 
                  styles.textArea, 
                  { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }
                ]}
                value={description}
                onChangeText={setDescription}
                placeholder="Please provide additional details about your request"
                placeholderTextColor={theme.placeholderText}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
            
            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: theme.primary }]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Request</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            My Requests
          </Text>
          
          {loadingRequests ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={theme.primary} />
              <Text style={[styles.loadingText, { color: theme.text }]}>Loading your requests...</Text>
            </View>
          ) : myRequests.length === 0 ? (
            <View style={[styles.noRequestsContainer, { backgroundColor: theme.card }]}>
              <Ionicons name="document-outline" size={30} color={theme.textSecondary} />
              <Text style={[styles.noRequestsText, { color: theme.textSecondary }]}>
                You haven't submitted any LIC requests yet
              </Text>
            </View>
          ) : (
            <View>
              {myRequests.map((request) => (
                <View key={request.id} style={[styles.requestCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <View style={styles.requestCardHeader}>
                    <Text style={[styles.requestType, { color: theme.text }]}>{request.request_type}</Text>
                    <View style={[
                      styles.statusBadge, 
                      { 
                        backgroundColor: getStatusColor(request.status) + '20', 
                        borderColor: getStatusColor(request.status) 
                      }
                    ]}>
                      <Text style={[styles.statusText, { color: getStatusColor(request.status) }]}>
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.requestDetailsContainer}>
                    <View style={styles.requestDetail}>
                      <Text style={[styles.requestLabel, { color: theme.textSecondary }]}>Policy Number:</Text>
                      <Text style={[styles.requestValue, { color: theme.text }]}>{request.policy_number || 'N/A'}</Text>
                    </View>

                    {request.contact_email && (
                      <View style={styles.requestDetail}>
                        <Text style={[styles.requestLabel, { color: theme.textSecondary }]}>Email:</Text>
                        <Text style={[styles.requestValue, { color: theme.text }]}>{request.contact_email}</Text>
                      </View>
                    )}

                    {request.contact_phone && (
                      <View style={styles.requestDetail}>
                        <Text style={[styles.requestLabel, { color: theme.textSecondary }]}>Phone:</Text>
                        <Text style={[styles.requestValue, { color: theme.text }]}>{request.contact_phone}</Text>
                      </View>
                    )}
                    
                    {request.description && (
                      <View style={styles.requestDetail}>
                        <Text style={[styles.requestLabel, { color: theme.textSecondary }]}>Description:</Text>
                        <Text style={[styles.requestValue, { color: theme.text }]}>{request.description}</Text>
                      </View>
                    )}
                  </View>
                  
                  <View style={[styles.requestFooter, { borderTopColor: theme.border }]}>
                    <Text style={[styles.requestDate, { color: theme.textSecondary }]}>
                      Submitted on {formatDate(request.created_at)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  formContainer: {
    borderRadius: 12,
    marginHorizontal: 16,
    padding: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  textArea: {
    height: 120,
    paddingTop: 12,
    paddingBottom: 12,
  },
  requestTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  requestTypeButton: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  requestTypeText: {
    fontSize: 14,
  },
  submitButton: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  noRequestsContainer: {
    borderRadius: 12,
    marginHorizontal: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noRequestsText: {
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
  },
  requestCard: {
    borderRadius: 16,
    marginHorizontal: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  requestCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  requestType: {
    fontSize: 17,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  requestDetailsContainer: {
    marginBottom: 12,
    padding: 2,
  },
  requestDetail: {
    marginBottom: 10,
  },
  requestLabel: {
    fontSize: 14,
    marginBottom: 4,
    fontWeight: '500',
  },
  requestValue: {
    fontSize: 15,
    lineHeight: 20,
  },
  requestFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  requestDate: {
    fontSize: 13,
    fontWeight: '400',
  },
}); 