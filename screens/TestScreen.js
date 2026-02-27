import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share
} from 'react-native';
import { supabase, getCurrentUserInfo } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';
import * as diagnostics from '../lib/diagnostics';
import { Ionicons } from '@expo/vector-icons';

const TestScreen = () => {
  const { user, residentData, refreshResidentData, restoreSession } = useAuth();
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [credentials, setCredentials] = useState({
    email: '',
    password: ''
  });
  
  // Initialize diagnostics when the screen loads
  useEffect(() => {
    diagnostics.initDiagnostics();
    loadLogs();
  }, []);
  
  const loadLogs = async () => {
    const appLogs = await diagnostics.getLogs();
    setLogs(appLogs);
  };
  
  // Refresh resident data
  const handleRefreshResidentData = async () => {
    setLoading(true);
    try {
      diagnostics.logInfo('Attempting to refresh resident data');
      
      const success = await refreshResidentData();
      
      if (success) {
        diagnostics.logInfo('Resident data refreshed successfully', { 
          society_id: residentData?.society_id 
        });
        Alert.alert('Success', 'Resident data refreshed successfully');
      } else {
        diagnostics.logWarn('Failed to refresh resident data');
        Alert.alert('Warning', 'Could not refresh resident data');
      }
    } catch (error) {
      diagnostics.logError('Error refreshing resident data', { error: error.message });
      Alert.alert('Error', `Error refreshing data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Test RLS policies directly
  const testRlsPolicies = async () => {
    setLoading(true);
    try {
      diagnostics.logInfo('Testing RLS policies directly');
      
      // First get session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !sessionData?.session) {
        throw new Error('No authenticated session found');
      }
      
      diagnostics.logInfo('Session found', { 
        user_id: sessionData.session.user.id 
      });
      
      const results = {};
      
      // Test RLS policy on announcements table
      const { data: rlsData, error: rlsError } = await supabase
        .from('announcements')
        .select('count')
        .limit(1)
        .single();
      
      results.rlsTest = {
        status: rlsError ? 'Failed' : 'Success',
        error: rlsError?.message,
        code: rlsError?.code,
        data: rlsData
      };
      
      if (rlsError) {
        diagnostics.logError('RLS policy test failed', { 
          error: rlsError.message,
          code: rlsError.code
        });
      } else {
        diagnostics.logInfo('RLS policy test passed', { count: rlsData?.count });
      }
      
      // Direct test for society_id
      if (residentData?.society_id) {
        const { data: societyData, error: societyError } = await supabase
          .from('societies')
          .select('name')
          .eq('id', residentData.society_id)
          .single();
        
        results.societyAccess = {
          status: societyError ? 'Failed' : 'Success',
          error: societyError?.message,
          data: societyData
        };
        
        if (societyData) {
          diagnostics.logInfo('Successfully accessed society info', { 
            name: societyData.name,
            id: residentData.society_id
          });
        }
      }
      
      Alert.alert(
        'RLS Test Results', 
        results.rlsTest.status === 'Success' ? 
          'RLS policies are working correctly' : 
          `RLS policy issue detected: ${results.rlsTest.error}`
      );
      
      loadLogs();
      
    } catch (error) {
      diagnostics.logError('Error testing RLS policies', { error: error.message });
      Alert.alert('Error', `RLS test failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Test database connection and permissions
  const testConnection = async () => {
    setLoading(true);
    setResults({});
    const results = {};
    
    try {
      diagnostics.logInfo('Starting TestScreen connection tests');
      
      // 1. Test basic connection
      diagnostics.logInfo('Testing Supabase connection...');
      results.connection = { status: 'Testing...' };
      setResults({...results});
      
      const connectionTest = await diagnostics.testSupabaseConnection();
      results.connection = {
        status: connectionTest.success ? 'Success' : 'Failed',
        error: connectionTest.error,
        elapsed: connectionTest.elapsed
      };
      setResults({...results});
      
      // 2. Test user authentication
      diagnostics.logInfo('Testing user authentication...');
      results.auth = { status: 'Testing...' };
      setResults({...results});
      
      const authTest = await diagnostics.testUserAuth();
      
      results.auth = {
        status: authTest.success ? 'Success' : 'Failed',
        error: authTest.error,
        user: authTest.session?.user ? {
          id: authTest.session.user.id,
          email: authTest.session.user.email
        } : null
      };
      setResults({...results});
      
      // 3. Test announcements table access
      diagnostics.logInfo('Testing announcements table access...');
      results.announcements = { status: 'Testing...' };
      setResults({...results});
      
      const { data: anncData, error: anncError } = await supabase
        .from('announcements')
        .select('count')
        .limit(1)
        .single();
      
      results.announcements = {
        status: anncError ? 'Failed' : 'Success',
        error: anncError?.message,
        code: anncError?.code,
        count: anncData?.count
      };
      
      diagnostics.logInfo('Announcements table access test', results.announcements);
      setResults({...results});
      
      // 4. Try to get actual announcements for society
      if (residentData?.society_id) {
        diagnostics.logInfo('Testing announcements for society...');
        results.societyAnnouncements = { status: 'Testing...' };
        setResults({...results});
        
        const { data: societyAnncData, error: societyAnncError } = await supabase
          .from('announcements')
          .select('*')
          .eq('society_id', residentData.society_id)
          .eq('active', true);
        
        results.societyAnnouncements = {
          status: societyAnncError ? 'Failed' : 'Success',
          error: societyAnncError?.message,
          code: societyAnncError?.code,
          count: societyAnncData?.length || 0,
          data: societyAnncData
        };
        
        diagnostics.logInfo('Society announcements test', {
          society_id: residentData.society_id,
          count: societyAnncData?.length || 0,
          error: societyAnncError?.message
        });
        
        setResults({...results});
      } else {
        results.societyAnnouncements = { 
          status: 'Skipped', 
          error: 'No society_id in resident data' 
        };
        diagnostics.logWarn('Skipped society announcements test - no society_id');
        setResults({...results});
      }
      
      // 5. Directly query societies table
      diagnostics.logInfo('Testing societies table access...');
      results.societies = { status: 'Testing...' };
      setResults({...results});
      
      const { data: societiesData, error: societiesError } = await supabase
        .from('societies')
        .select('count')
        .limit(1)
        .single();
      
      results.societies = {
        status: societiesError ? 'Failed' : 'Success',
        error: societiesError?.message,
        code: societiesError?.code,
        count: societiesData?.count
      };
      
      diagnostics.logInfo('Societies table access test', results.societies);
      setResults({...results});
      
      // Load latest logs
      loadLogs();
      
    } catch (error) {
      diagnostics.logError('Test encountered an exception:', error);
      console.error('Test encountered an exception:', error);
      results.exception = {
        message: error.message,
        stack: error.stack
      };
      setResults({...results});
    } finally {
      setLoading(false);
    }
  };
  
  // Create a test announcement for debugging purposes
  const createTestAnnouncement = async () => {
    if (!residentData?.society_id) {
      Alert.alert('Error', 'No society ID found in resident data');
      return;
    }
    
    setLoading(true);
    try {
      diagnostics.logInfo('Creating a test announcement');
      
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || '';
      
      console.log('Using auth token for API request:', token ? `${token.substring(0, 10)}...` : 'No token!');
      diagnostics.logInfo('Auth token available', { hasToken: !!token });
      
      const { data: societyAdmins, error: adminsError } = await supabase
        .from('society_admins')
        .select('*')
        .eq('society_id', residentData.society_id)
        .limit(1);
      
      if (adminsError || !societyAdmins || societyAdmins.length === 0) {
        const errorMsg = 'Could not find society admin to attribute announcement to';
        diagnostics.logError(errorMsg, { error: adminsError?.message });
        throw new Error(errorMsg);
      }
      
      const adminId = societyAdmins[0].user_id;
      diagnostics.logInfo('Found society admin', { adminId });
      
      // Insert directly using REST API (most reliable method)
      const url = 'https://jjgsggmufkpadchkodab.supabase.co/rest/v1/announcements';
      diagnostics.logInfo('Making direct API request to create announcement', { url });
      
      const title = `Test Announcement ${new Date().toLocaleTimeString()}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqZ3NnZ211ZmtwYWRjaGtvZGFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ0Njg3MTAsImV4cCI6MjA2MDA0NDcxMH0.V6VxViTuJJdivrKKp51VcLyezeUmFNjLFb4wkVacQOk',
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          society_id: residentData.society_id,
          title: title,
          content: 'This is a test announcement created from the mobile app for debugging purposes.',
          created_by: adminId,
          is_important: false,
          active: true
        })
      });
      
      diagnostics.logInfo('API response status', { status: response.status });
      
      if (!response.ok) {
        const errorText = await response.text();
        diagnostics.logError('Failed to create test announcement', { 
          status: response.status, 
          error: errorText 
        });
        throw new Error(`Failed to create test announcement: ${errorText}`);
      }
      
      const newAnnouncement = await response.json();
      diagnostics.logInfo('Created test announcement successfully', { 
        id: newAnnouncement.id,
        title: newAnnouncement.title 
      });
      
      Alert.alert('Success', 'Test announcement created successfully!');
      console.log('Created test announcement:', newAnnouncement);
      
      // Reload logs
      loadLogs();
      
    } catch (error) {
      console.error('Error creating test announcement:', error);
      diagnostics.logError('Error creating test announcement', { error: error.message });
      Alert.alert('Error', `Failed to create test announcement: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Export logs for sharing
  const shareLogs = async () => {
    try {
      const allLogs = await diagnostics.getLogs();
      const logText = JSON.stringify(allLogs, null, 2);
      
      await Share.share({
        message: logText,
        title: 'MySociety App Diagnostic Logs'
      });
    } catch (error) {
      console.error('Error sharing logs:', error);
      Alert.alert('Error', `Failed to share logs: ${error.message}`);
    }
  };
  
  const clearAllLogs = async () => {
    await diagnostics.clearLogs();
    loadLogs();
    Alert.alert('Success', 'Logs cleared successfully');
  };
  
  // Direct sign in function to force re-authentication
  const forceReauthenticate = async () => {
    setLoading(true);
    try {
      diagnostics.logInfo('Attempting direct re-authentication');
      
      // Since Alert.prompt isn't universally available, use a simpler approach
      Alert.alert(
        'Authentication Required',
        'Please use your society admin provided account.\n\nTip: You might need to logout and login again with the correct society credentials.',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setLoading(false) },
          { 
            text: 'Try Sample Credentials', 
            onPress: async () => {
              // This would be replaced with proper input in a real app
              // For testing, we'll use sample credentials that might work
              const email = 'society_user@example.com';
              const password = 'society_password';
              
              try {
                diagnostics.logInfo('Attempting authentication with sample credentials');
                
                const { data, error } = await supabase.auth.signInWithPassword({
                  email: email,
                  password: password
                });
                
                if (error) {
                  diagnostics.logError('Direct authentication failed', { error: error.message });
                  Alert.alert(
                    'Authentication Failed', 
                    'The sample credentials failed. You need to use the exact credentials provided by your society admin.\n\n' +
                    'Please logout from the app and login with correct credentials.'
                  );
                } else {
                  diagnostics.logInfo('Direct authentication succeeded', { 
                    user_id: data.user?.id 
                  });
                  
                  // Success - refresh resident data
                  const success = await refreshResidentData();
                  
                  if (success) {
                    diagnostics.logInfo('Resident data refreshed after authentication');
                    Alert.alert('Success', 'Authentication and data refresh successful');
                  } else {
                    diagnostics.logWarn('Authentication succeeded but resident data refresh failed');
                    Alert.alert('Partial Success', 
                      'Authentication successful but could not refresh resident data. ' +
                      'Make sure this user has a resident record in the database.');
                  }
                }
              } catch (error) {
                diagnostics.logError('Exception during authentication', { error: error.message });
                Alert.alert('Error', `Authentication failed: ${error.message}`);
              } finally {
                setLoading(false);
              }
            }
          },
          {
            text: 'Go to Login Page',
            onPress: () => {
              diagnostics.logInfo('User directed to login page');
              // Navigate to login - replace with your actual navigation logic
              Alert.alert('Info', 'Please logout from the app and login again with the correct credentials');
              setLoading(false);
            }
          }
        ]
      );
      
    } catch (error) {
      diagnostics.logError('Exception during authentication flow', { error: error.message });
      Alert.alert('Error', `Authentication flow failed: ${error.message}`);
      setLoading(false);
    }
  };
  
  // Function to check and display current user information
  const checkCurrentUser = async () => {
    setLoading(true);
    try {
      diagnostics.logInfo('Getting current user information');
      
      const userInfo = await getCurrentUserInfo();
      
      if (!userInfo.success) {
        diagnostics.logWarn('No current user found', { error: userInfo.error });
        Alert.alert('Authentication Status', 'No active user session found. Please log in.');
        setLoading(false);
        return;
      }
      
      // Create a user info message
      let message = `User: ${userInfo.user.email}\n`;
      message += `ID: ${userInfo.user.id}\n`;
      message += `Token Expires: ${userInfo.token.expiresIn > 0 ? 
        `in ${Math.floor(userInfo.token.expiresIn / 60)} minutes` : 
        'EXPIRED'}\n\n`;
      
      if (userInfo.resident) {
        message += `Resident Info:\n`;
        message += `Society ID: ${userInfo.resident.society_id || 'Not set'}\n`;
        message += `Unit: ${userInfo.resident.unit_number || 'Not set'}\n`;
        message += `Name: ${userInfo.resident.name || 'Not set'}\n`;
      } else {
        message += `No resident record found for this user.\n`;
        message += `This may explain why you can't see announcements.\n`;
      }
      
      diagnostics.logInfo('User info retrieved', { 
        user_id: userInfo.user.id,
        has_resident: !!userInfo.resident,
        token_expires_in: userInfo.token.expiresIn
      });
      
      // Display the information
      Alert.alert(
        'Current User Information',
        message,
        [
          { text: 'OK' },
          { 
            text: 'Share Details', 
            onPress: () => {
              Share.share({
                message: `My Society Details App Diagnostics\n\n${message}`,
                title: 'My Society Details App User Info'
              });
            }
          }
        ]
      );
      
    } catch (error) {
      diagnostics.logError('Error checking current user', { error: error.message });
      Alert.alert('Error', `Failed to get user information: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Function to restore session
  const handleRestoreSession = async () => {
    setLoading(true);
    try {
      diagnostics.logInfo('Attempting to restore session');
      
      const success = await restoreSession();
      
      if (success) {
        diagnostics.logInfo('Session restored successfully');
        Alert.alert('Success', 'Session has been restored successfully');
      } else {
        diagnostics.logWarn('Failed to restore session');
        Alert.alert('Session Restoration Failed', 
          'Could not restore the session. You may need to login again with your society credentials.');
      }
    } catch (error) {
      diagnostics.logError('Error restoring session', { error: error.message });
      Alert.alert('Error', `Failed to restore session: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const renderResults = () => {
    return Object.keys(results).map(key => (
      <View key={key} style={styles.resultCard}>
        <Text style={styles.resultTitle}>{key}</Text>
        <Text style={[
          styles.resultStatus, 
          results[key].status === 'Success' ? styles.success : 
          results[key].status === 'Testing...' ? styles.testing :
          styles.failure
        ]}>
          {results[key].status}
        </Text>
        
        {results[key].error && (
          <Text style={styles.resultError}>Error: {results[key].error}</Text>
        )}
        
        {results[key].code && (
          <Text style={styles.resultDetail}>Code: {results[key].code}</Text>
        )}
        
        {results[key].count !== undefined && (
          <Text style={styles.resultDetail}>Count: {results[key].count}</Text>
        )}
        
        {results[key].user && (
          <View style={styles.userInfo}>
            <Text style={styles.resultDetail}>User ID: {results[key].user.id}</Text>
            <Text style={styles.resultDetail}>Email: {results[key].user.email}</Text>
            <Text style={styles.resultDetail}>Role: {results[key].user.role}</Text>
          </View>
        )}
        
        {results[key].data && results[key].data.length > 0 && (
          <View style={styles.dataPreview}>
            <Text style={styles.previewTitle}>Data Preview:</Text>
            {results[key].data.map((item, index) => (
              <View key={index} style={styles.dataItem}>
                <Text style={styles.dataId}>ID: {item.id}</Text>
                <Text style={styles.dataTitle}>Title: {item.title}</Text>
                <Text style={styles.dataDate}>Created: {new Date(item.created_at).toLocaleString()}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    ));
  };
  
  return (
    <AppLayout>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.heading}>Supabase Connection Test</Text>
        
        <TouchableOpacity 
          style={[styles.fullWidthButton, { backgroundColor: '#6366f1', marginBottom: 16 }]} 
          onPress={handleRestoreSession}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            <Ionicons name="refresh-circle-outline" size={16} /> Restore Session
          </Text>
        </TouchableOpacity>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.button} 
            onPress={testConnection}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Testing...' : 'Run Tests'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: '#22c55e' }]} 
            onPress={createTestAnnouncement}
            disabled={loading || !residentData?.society_id}
          >
            <Text style={styles.buttonText}>
              Create Test Announcement
            </Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: '#3b82f6' }]} 
            onPress={handleRefreshResidentData}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              <Ionicons name="refresh-outline" size={16} /> Refresh Resident Data
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: '#f59e0b' }]} 
            onPress={testRlsPolicies}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              <Ionicons name="shield-outline" size={16} /> Test RLS Policies
            </Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity 
          style={[styles.fullWidthButton, { backgroundColor: '#10b981' }]} 
          onPress={checkCurrentUser}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            <Ionicons name="person-outline" size={16} /> Check Current User
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.fullWidthButton, { backgroundColor: '#ef4444' }]} 
          onPress={forceReauthenticate}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            <Ionicons name="key-outline" size={16} /> Force Re-Authentication
          </Text>
        </TouchableOpacity>
        
        <View style={styles.logButtonContainer}>
          <TouchableOpacity 
            style={[styles.smallButton, { backgroundColor: '#3b82f6' }]} 
            onPress={shareLogs}
          >
            <Text style={styles.buttonText}>
              <Ionicons name="share-outline" size={14} /> Share Logs
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.smallButton, { backgroundColor: '#ef4444' }]} 
            onPress={clearAllLogs}
          >
            <Text style={styles.buttonText}>
              <Ionicons name="trash-outline" size={14} /> Clear Logs
            </Text>
          </TouchableOpacity>
        </View>
        
        {loading && (
          <ActivityIndicator size="large" color="#4361ee" style={styles.loader} />
        )}
        
        {Object.keys(results).length > 0 && (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsHeading}>Test Results</Text>
            {renderResults()}
          </View>
        )}
        
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Debug Information</Text>
          <Text style={styles.infoText}>User ID: {user?.id || 'Not logged in'}</Text>
          <Text style={styles.infoText}>Email: {user?.email || 'N/A'}</Text>
          <Text style={styles.infoText}>Society ID: {residentData?.society_id || 'N/A'}</Text>
          <Text style={styles.infoText}>Resident Name: {residentData?.name || 'N/A'}</Text>
          <Text style={styles.infoText}>Unit: {residentData?.unit_number || 'N/A'}</Text>
        </View>
        
        {logs.length > 0 && (
          <View style={styles.logsContainer}>
            <Text style={styles.logsHeading}>Diagnostics Logs ({logs.length})</Text>
            {logs.slice(0, 10).map((log, index) => (
              <View key={index} style={[
                styles.logEntry,
                log.level === 'ERROR' ? styles.errorLog :
                log.level === 'WARN' ? styles.warnLog :
                log.level === 'INFO' ? styles.infoLog :
                styles.debugLog
              ]}>
                <Text style={styles.logTimestamp}>{new Date(log.timestamp).toLocaleTimeString()}</Text>
                <Text style={styles.logLevel}>{log.level}</Text>
                <Text style={styles.logMessage}>{log.message}</Text>
                {log.data && (
                  <Text style={styles.logData}>{log.data}</Text>
                )}
              </View>
            ))}
            {logs.length > 10 && (
              <Text style={styles.moreLogsText}>... and {logs.length - 10} more logs</Text>
            )}
          </View>
        )}
      </ScrollView>
    </AppLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#4361ee',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
  },
  smallButton: {
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  logButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  loader: {
    marginVertical: 16,
  },
  resultsContainer: {
    marginTop: 16,
  },
  resultsHeading: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  resultCard: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4361ee',
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  resultStatus: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  success: {
    color: 'green',
  },
  failure: {
    color: 'red',
  },
  testing: {
    color: 'orange',
  },
  resultError: {
    color: 'red',
    marginBottom: 4,
  },
  resultDetail: {
    fontSize: 14,
    marginBottom: 2,
  },
  userInfo: {
    marginTop: 8,
    backgroundColor: '#e9ecef',
    padding: 8,
    borderRadius: 4,
  },
  dataPreview: {
    marginTop: 8,
  },
  previewTitle: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  dataItem: {
    backgroundColor: '#e9ecef',
    padding: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  dataId: {
    fontSize: 12,
    color: '#555',
  },
  dataTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  dataDate: {
    fontSize: 12,
    color: '#555',
  },
  infoCard: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 8,
    marginTop: 24,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    marginBottom: 4,
  },
  logsContainer: {
    marginTop: 16,
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
  },
  logsHeading: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  logEntry: {
    padding: 8,
    borderRadius: 4,
    marginBottom: 4,
    borderLeftWidth: 4,
  },
  errorLog: {
    backgroundColor: '#fee2e2',
    borderLeftColor: '#ef4444',
  },
  warnLog: {
    backgroundColor: '#fef3c7',
    borderLeftColor: '#f59e0b',
  },
  infoLog: {
    backgroundColor: '#dbeafe',
    borderLeftColor: '#3b82f6',
  },
  debugLog: {
    backgroundColor: '#f3f4f6',
    borderLeftColor: '#9ca3af',
  },
  logTimestamp: {
    fontSize: 10,
    color: '#555',
  },
  logLevel: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  logMessage: {
    fontSize: 12,
  },
  logData: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  moreLogsText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  fullWidthButton: {
    backgroundColor: '#ef4444',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
});

export default TestScreen; 