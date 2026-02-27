import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { Card } from '../components/ui/Card';
import { Ionicons } from '@expo/vector-icons';
import AppLayout from '../components/AppLayout';
import { useFocusEffect } from '@react-navigation/native';

export default function CARequestScreen() {
  const { user, residentData } = useAuth();
  const navigation = useNavigation();
  const { theme, isDarkMode } = useTheme();
  const [activeTab, setActiveTab] = useState('new');
  const [loading, setLoading] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myRequests, setMyRequests] = useState([]);
  const [formData, setFormData] = useState({
    requestType: '',
    name: '',
    email: '',
    phone: '',
  });
  const [errors, setErrors] = useState({});

  // Fetch user's CA requests
  const fetchMyRequests = useCallback(async () => {
    if (!residentData?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('ca_requests')
        .select('*')
        .eq('resident_id', residentData.id)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setMyRequests(data || []);
    } catch (error) {
      console.error('Error fetching CA requests:', error);
      Alert.alert('Error', 'Failed to fetch your CA requests');
    } finally {
      setRequestsLoading(false);
      setRefreshing(false);
    }
  }, [residentData?.id]);

  // Fetch requests when screen is focused
  useFocusEffect(
    useCallback(() => {
      setRequestsLoading(true);
      fetchMyRequests();
    }, [fetchMyRequests])
  );

  // Handle refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMyRequests();
  }, [fetchMyRequests]);

  // Populate user info on mount
  useEffect(() => {
    if (residentData) {
      setFormData((prev) => ({
        ...prev,
        name: residentData.name || '',
        email: residentData.email || '',
        phone: residentData.phone || '',
      }));
    } else if (user) {
      setFormData((prev) => ({
        ...prev,
        name: user.user_metadata?.full_name || '',
        email: user.email || '',
        phone: user.user_metadata?.phone || '',
      }));
    }
  }, [residentData, user]);

  const validate = () => {
    const newErrors = {};
    if (!formData.requestType) newErrors.requestType = 'Please select a service type';
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/^\S+@\S+\.\S+$/.test(formData.email)) newErrors.email = 'Invalid email address';
    if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
    else if (!/^\d{10}$/.test(formData.phone)) newErrors.phone = 'Enter a valid 10-digit phone number';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      // Get resident and society info
      const { data: residentData, error: residentError } = await supabase
        .from('residents')
        .select('id, society_id')
        .eq('user_id', user.id)
        .single();
      if (residentError) throw residentError;
      // Insert CA request
      const { error: insertError } = await supabase
        .from('ca_requests')
        .insert({
          society_id: residentData.society_id,
          resident_id: residentData.id,
          request_type: formData.requestType,
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
        });
      if (insertError) throw insertError;
      Alert.alert(
        'Success',
        'Your CA request has been submitted successfully',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Error submitting CA request:', error);
      Alert.alert('Error', 'Failed to submit CA request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderInput = (label, field, placeholder, keyboardType = 'default') => (
    <View style={styles.formGroup}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          { backgroundColor: theme.inputBg, color: theme.text, borderColor: errors[field] ? theme.error : isDarkMode ? '#555' : '#ddd' },
        ]}
        placeholder={placeholder}
        placeholderTextColor={theme.placeholderText}
        value={formData[field]}
        onChangeText={text => setFormData({ ...formData, [field]: text })}
        keyboardType={keyboardType}
        editable={!loading}
      />
      {errors[field] && <Text style={styles.errorText}>{errors[field]}</Text>}
    </View>
  );

  // Render status badge
  const renderStatusBadge = (status) => {
    let backgroundColor, textColor;
    
    switch (status) {
      case 'pending':
        backgroundColor = isDarkMode ? '#4A3800' : '#FFF9DB';
        textColor = isDarkMode ? '#FFD43B' : '#704700';
        break;
      case 'approved':
        backgroundColor = isDarkMode ? '#134F22' : '#E6FCF0';
        textColor = isDarkMode ? '#40C057' : '#175E2A';
        break;
      case 'rejected':
        backgroundColor = isDarkMode ? '#61171E' : '#FFF0F1';
        textColor = isDarkMode ? '#FA5252' : '#921B26';
        break;
      default:
        backgroundColor = isDarkMode ? '#343A40' : '#F8F9FA';
        textColor = isDarkMode ? '#E9ECEF' : '#495057';
    }
    
    return (
      <View style={[styles.badge, { backgroundColor }]}>
        <Text style={[styles.badgeText, { color: textColor }]}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Text>
      </View>
    );
  };

  // Format date helper
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    });
  };

  // Render request item
  const renderRequestItem = ({ item }) => (
    <Card style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <View style={styles.requestTitleContainer}>
          <Text style={[styles.requestTitle, { color: theme.text }]}>
            {item.request_type.charAt(0).toUpperCase() + item.request_type.slice(1)} Services
          </Text>
          <Text style={[styles.requestDate, { color: theme.textSecondary }]}>
            {formatDate(item.created_at)}
          </Text>
        </View>
        {renderStatusBadge(item.status)}
      </View>
      
      <View style={styles.requestDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="person-outline" size={16} color={theme.textSecondary} />
          <Text style={[styles.detailText, { color: theme.textSecondary }]}>
            {item.name}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="mail-outline" size={16} color={theme.textSecondary} />
          <Text style={[styles.detailText, { color: theme.textSecondary }]}>
            {item.email}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="call-outline" size={16} color={theme.textSecondary} />
          <Text style={[styles.detailText, { color: theme.textSecondary }]}>
            {item.phone}
          </Text>
        </View>
      </View>
    </Card>
  );

  // Empty state component
  const EmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Ionicons
        name="document-text-outline"
        size={60}
        color={theme.textSecondary || theme.text + '80'}
        style={styles.emptyIcon}
      />
      <Text style={[styles.emptyTitle, { color: theme.text }]}>
        No CA Requests Yet
      </Text>
      <Text style={[styles.emptyDescription, { color: theme.textSecondary || theme.text + '99' }]}>
        Submit a new request for accounting or audit services
      </Text>
      <TouchableOpacity
        style={[styles.emptyButton, { backgroundColor: theme.primary }]}
        onPress={() => setActiveTab('new')}
      >
        <Text style={[styles.emptyButtonText, { color: theme.buttonText || '#FFFFFF' }]}>
          New Request
        </Text>
      </TouchableOpacity>
    </View>
  );

  // Loading component
  const LoadingComponent = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={theme.primary} />
      <Text style={[styles.loadingText, { color: theme.text }]}>
        Loading requests...
      </Text>
    </View>
  );

  // Render tabs
  const renderTabs = () => (
    <View style={styles.tabsContainer}>
      <TouchableOpacity
        style={[
          styles.tab,
          activeTab === 'new' && [styles.activeTab, { borderBottomColor: theme.primary }]
        ]}
        onPress={() => setActiveTab('new')}
      >
        <Ionicons
          name="add-circle-outline"
          size={20}
          color={activeTab === 'new' ? theme.primary : theme.textSecondary}
          style={styles.tabIcon}
        />
        <Text
          style={[
            styles.tabText,
            { color: activeTab === 'new' ? theme.primary : theme.textSecondary }
          ]}
        >
          New Request
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[
          styles.tab,
          activeTab === 'my' && [styles.activeTab, { borderBottomColor: theme.primary }]
        ]}
        onPress={() => setActiveTab('my')}
      >
        <Ionicons
          name="list-outline"
          size={20}
          color={activeTab === 'my' ? theme.primary : theme.textSecondary}
          style={styles.tabIcon}
        />
        <Text
          style={[
            styles.tabText,
            { color: activeTab === 'my' ? theme.primary : theme.textSecondary }
          ]}
        >
          My Requests
        </Text>
      </TouchableOpacity>
    </View>
  );

  // Render content based on active tab
  const renderContent = () => {
    if (activeTab === 'new') {
      return (
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: theme.background }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <Card style={{ margin: 16 }}>
              <Text style={[styles.title, { color: theme.text }]}>Request CA Services</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Fill in the details below to request CA services for your society.</Text>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Service Type</Text>
                <View style={styles.typeSelector}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[
                      styles.typeButton,
                      formData.requestType === 'accounting' && [
                        styles.activeTypeButton,
                        { backgroundColor: isDarkMode ? '#4361ee' : 'rgba(67, 97, 238, 0.10)' }
                      ],
                    ]}
                    onPress={() => setFormData({ ...formData, requestType: 'accounting' })}
                    disabled={loading}
                  >
                    <Ionicons
                      name="calculator-outline"
                      size={22}
                      color={formData.requestType === 'accounting' ? theme.primary : isDarkMode ? '#888' : '#666'}
                      style={{ marginRight: 8 }}
                    />
                    <Text
                      style={[
                        styles.typeButtonText,
                        formData.requestType === 'accounting' && {
                          color: isDarkMode ? '#fff' : theme.primary,
                          fontWeight: '700',
                        },
                      ]}
                    >
                      Accounting
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[
                      styles.typeButton,
                      formData.requestType === 'audit' && [
                        styles.activeTypeButton,
                        { backgroundColor: isDarkMode ? '#4361ee' : 'rgba(67, 97, 238, 0.10)' }
                      ],
                    ]}
                    onPress={() => setFormData({ ...formData, requestType: 'audit' })}
                    disabled={loading}
                  >
                    <Ionicons
                      name="document-text-outline"
                      size={22}
                      color={formData.requestType === 'audit' ? theme.primary : isDarkMode ? '#888' : '#666'}
                      style={{ marginRight: 8 }}
                    />
                    <Text
                      style={[
                        styles.typeButtonText,
                        formData.requestType === 'audit' && {
                          color: isDarkMode ? '#fff' : theme.primary,
                          fontWeight: '700',
                        },
                      ]}
                    >
                      Audit
                    </Text>
                  </TouchableOpacity>
                </View>
                {errors.requestType && <Text style={styles.errorText}>{errors.requestType}</Text>}
              </View>

              {renderInput('Name', 'name', 'Enter your name')}
              {renderInput('Email', 'email', 'Enter your email', 'email-address')}
              {renderInput('Phone Number', 'phone', 'Enter your phone number', 'phone-pad')}

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.submitButton, loading && styles.submitButtonDisabled, { backgroundColor: theme.primary }]}
                  onPress={handleSubmit}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitButtonText}>Submit Request</Text>
                  )}
                </TouchableOpacity>
              </View>
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>
      );
    }

    // My Requests tab
    if (requestsLoading && !refreshing) {
      return <LoadingComponent />;
    }

    return (
      <FlatList
        data={myRequests}
        renderItem={renderRequestItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={EmptyComponent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
      />
    );
  };

  return (
    <AppLayout title="CA Services">
      {renderTabs()}
      {renderContent()}
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 13,
    marginTop: 4,
  },
  typeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flex: 1,
    marginHorizontal: 6,
    backgroundColor: 'transparent',
    elevation: 0,
    shadowOpacity: 0,
    transition: 'all 0.15s',
  },
  activeTypeButton: {
    borderColor: '#4361ee',
    borderWidth: 2,
    elevation: 3,
    shadowColor: '#4361ee',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
  },
  typeButtonText: {
    marginLeft: 8,
    fontWeight: '600',
    fontSize: 16,
    letterSpacing: 0.2,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  submitButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#a0a0a0',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderColor: 'transparent',
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  tabIcon: {
    marginRight: 6,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  requestCard: {
    marginBottom: 12,
    padding: 16,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  requestTitleContainer: {
    flex: 1,
    marginRight: 8,
  },
  requestTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  requestDate: {
    fontSize: 12,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  requestDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
}); 