import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Animated,
  useColorScheme,
  Dimensions,
  Image,
  Modal
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DirectThemeToggle from '../components/DirectThemeToggle';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';


import useNoStuckLoading from '../hooks/useNoStuckLoading';
const { width, height } = Dimensions.get('window');

// Key for storing guard data in AsyncStorage
const GUARD_STORAGE_KEY = 'guard_data';

export default function GuardLoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  useNoStuckLoading(isLoading, setIsLoading);
  const [showPassword, setShowPassword] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const { theme, isDarkMode } = useTheme();
  const router = useRouter();
  
  // Animation values
  const formOpacity = useRef(new Animated.Value(0)).current;
  const formTranslate = useRef(new Animated.Value(50)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  
  // Get device color scheme directly to prevent flash
  const colorScheme = useColorScheme();
  const systemIsDark = colorScheme === 'dark';
  
  // Set immediate background color
  const immediateBackground = systemIsDark ? '#121212' : '#FFFFFF';

  useEffect(() => {
    // Animate the form and logo when component mounts
    Animated.stagger(150, [
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 7,
        tension: 40,
        useNativeDriver: true
      }),
      Animated.parallel([
        Animated.timing(formOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true
        }),
        Animated.spring(formTranslate, {
          toValue: 0,
          friction: 8,
          tension: 40,
          useNativeDriver: true
        })
      ])
    ]).start();
  }, []);

  // Check if terms are already accepted
  useEffect(() => {
    const checkTermsAcceptance = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: termsData } = await supabase
            .from('terms_acceptance')
            .select('*')
            .eq('user_id', session.user.id)
            .eq('user_type', 'guard')
            .single();
          
          if (termsData) {
            setTermsAccepted(true);
          }
        }
      } catch (error) {
        console.error('Error checking terms acceptance:', error);
      }
    };
    
    checkTermsAcceptance();
  }, []);

  const storeGuardData = async (guardData) => {
    try {
      if (guardData) {
        await AsyncStorage.setItem(GUARD_STORAGE_KEY, JSON.stringify(guardData));
      }
    } catch (error) {
      console.error('Error storing guard data:', error);
    }
  };

  const handleTermsAccept = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert('Error', 'Please login first to accept terms');
        return;
      }

      const { error: termsError } = await supabase
        .from('terms_acceptance')
        .insert({
          user_id: session.user.id,
          user_type: 'guard',
          terms_version: '1.0',
          device_info: Platform.OS + ' ' + Platform.Version
        });

      if (termsError) {
        throw termsError;
      }

      setTermsAccepted(true);
      setShowTerms(false);
      router.replace('/guard-dashboard');
    } catch (error) {
      console.error('Error accepting terms:', error);
      Alert.alert('Error', 'Failed to accept terms. Please try again.');
    }
  };

  const handleTermsDecline = () => {
    setShowTerms(false);
    Alert.alert('Terms Required', 'You must accept the terms and conditions to use the app.');
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    setIsLoading(true);
    try {
      // Sign in with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password
      });

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      if (!data?.user) {
        Alert.alert('Error', 'Login failed');
        return;
      }

      // Check if user is a guard
      const { data: guardData, error: guardError } = await supabase
        .from('guards')
        .select('*')
        .eq('user_id', data.user.id)
        .single();

      if (guardError || !guardData) {
        // Sign out if user is not a guard
        await supabase.auth.signOut();
        Alert.alert('Error', 'You are not registered as a guard. Please check your credentials or contact your society admin.');
        return;
      }

      // Check if terms are accepted
      console.log('Checking terms acceptance for guard:', data.user.id);
      const { data: termsData, error: termsError } = await supabase
        .from('terms_acceptance')
        .select('*')
        .eq('user_id', data.user.id)
        .eq('user_type', 'guard')
        .order('accepted_at', { ascending: false })  // Get the most recent acceptance
        .limit(1)  // Only get one record
        .single();

      if (termsError) {
        console.error('Error checking terms:', termsError);
        // If there are multiple records, we'll still consider terms as accepted
        // since the user has accepted terms at least once
        if (termsError.code === 'PGRST116') {  // This is the error code for multiple rows
          console.log('Multiple terms acceptance records found, using most recent');
          // Try to get the most recent record without using single()
          const { data: recentTerms } = await supabase
            .from('terms_acceptance')
            .select('*')
            .eq('user_id', data.user.id)
            .eq('user_type', 'guard')
            .order('accepted_at', { ascending: false })
            .limit(1);
          
          if (recentTerms && recentTerms.length > 0) {
            console.log('Using most recent terms acceptance:', recentTerms[0]);
            // Store guard data and proceed with login
            await storeGuardData(guardData);
            router.replace('/guard-dashboard');
            return;
          }
        }
      }

      console.log('Terms acceptance data:', termsData);

      if (!termsData) {
        console.log('Terms not accepted, showing terms modal');
        setShowTerms(true);
        return;
      }

      console.log('Terms already accepted, proceeding to guard dashboard');

      // Store guard data in AsyncStorage
      await storeGuardData(guardData);

      // Navigate to guard dashboard
      router.replace('/guard-dashboard');
    } catch (error) {
      console.error('Login exception:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToResidentLogin = () => {
    router.replace('/login');
  };

  // Gradient colors based on theme - using security-focused colors
  const gradientColors = isDarkMode 
    ? ['#1e3a5f', '#2d3142', '#090446'] 
    : ['#5e60ce', '#5390d9', '#4ea8de'];

  const TermsModal = () => (
    <Modal
      visible={showTerms}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowTerms(false)}
    >
        <View style={[styles.modalContainer, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.9)' : 'rgba(0,0,0,0.02)' }]}>
        <View style={[styles.modalContent, { backgroundColor: isDarkMode ? theme.background : '#fff' }]}>
          <ScrollView style={styles.termsScroll}>
            <Text style={[styles.termsTitle, { color: theme.text }]}>
              Terms and Conditions for Guards
            </Text>
            <Text style={[styles.termsText, { color: theme.textSecondary }]}>
              {`
1. Professional Conduct
   - You agree to maintain professional conduct while using the MySociety platform.
   - You must verify visitor identities and maintain proper records.
   - You are responsible for the security of your guard account.

2. Data Privacy and Security
   - You will handle resident and visitor data with utmost confidentiality.
   - You must not share or misuse any information accessed through the platform.
   - Report any data breaches or security concerns immediately.

3. Access Control
   - You are authorized to manage visitor access as per society guidelines.
   - You must verify visitor credentials before granting access.
   - Maintain accurate records of all entries and exits.

4. Communication
   - You agree to respond promptly to resident requests.
   - Use the platform's communication features professionally.
   - Report any suspicious activities to the society admin.

5. Account Security
   - You must use strong passwords and enable 2FA if available.
   - Do not share your account credentials with anyone.
   - Log out after each session on shared devices.

6. Updates to Terms
   - These terms may be updated periodically.
   - You will be notified of significant changes.
   - Continued use implies acceptance of updated terms.

7. Termination
   - The society admin can suspend or terminate access for violations.
   - Upon termination, you must return all society property and access devices.
   - Your access will be revoked immediately upon termination.
              `}
            </Text>
          </ScrollView>
          <View style={styles.termsButtons}>
            <TouchableOpacity
              style={[styles.termsButton, styles.declineButton]}
              onPress={handleTermsDecline}
            >
              <Text style={styles.declineButtonText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.termsButton, styles.acceptButton]}
              onPress={handleTermsAccept}
            >
              <Text style={styles.acceptButtonText}>Accept</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <LinearGradient
      colors={gradientColors}
      style={styles.backgroundGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <LinearGradient
        colors={isDarkMode 
          ? ['rgba(18, 18, 18, 0.3)', 'rgba(18, 18, 18, 0.8)'] 
          : ['rgba(255, 255, 255, 0.3)', 'rgba(255, 255, 255, 0.8)']}
        style={styles.gradientOverlay}
      >
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
        
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          >
            <View style={styles.formContainer}>
              {/* Logo & Title Section */}
              <Animated.View style={[
                styles.logoContainer,
                { transform: [{ scale: logoScale }] }
              ]}>
                <View style={[styles.logoCircle, { backgroundColor: theme.primary + '30' }]}>
                  <Image source={require('../assets/images/msd-logo.jpeg')} style={styles.logoImage} />
                </View>
                <Text style={[styles.title, { color: theme.text }]}>Security Guard</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                  Login to manage society security
                </Text>
              </Animated.View>

              {/* Form Section */}
              <Animated.View 
                style={[
                  styles.formCard, 
                  { 
                    backgroundColor: theme.card, 
                    borderColor: theme.border,
                    opacity: formOpacity,
                    transform: [{ translateY: formTranslate }]
                  }
                ]}
              >
                <View style={styles.inputContainer}>
                  <View style={styles.labelContainer}>
                    <Ionicons name="mail" size={16} color={theme.primary} style={styles.labelIcon} />
                    <Text style={[styles.label, { color: theme.text }]}>Email Address</Text>
                  </View>
                  <View style={[
                    styles.inputWrapper, 
                    { 
                      backgroundColor: theme.input,
                      borderColor: email ? theme.primary : theme.border
                    }
                  ]}>
                    <TextInput
                      style={[styles.input, { color: theme.text }]}
                      placeholder="Enter your email"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      placeholderTextColor={isDarkMode ? '#777' : '#999'}
                    />
                  </View>
                </View>

                <View style={styles.inputContainer}>
                  <View style={styles.labelContainer}>
                    <Ionicons name="lock-closed" size={16} color={theme.primary} style={styles.labelIcon} />
                    <Text style={[styles.label, { color: theme.text }]}>Password</Text>
                  </View>
                  <View style={[
                    styles.inputWrapper, 
                    { 
                      backgroundColor: theme.input,
                      borderColor: password ? theme.primary : theme.border
                    }
                  ]}>
                    <TextInput
                      style={[styles.input, { paddingRight: 40, color: theme.text }]}
                      placeholder="Enter your password"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      placeholderTextColor={isDarkMode ? '#777' : '#999'}
                    />
                    <TouchableOpacity 
                      style={styles.showPasswordButton}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Ionicons 
                        name={showPassword ? "eye-off" : "eye"} 
                        size={20} 
                        color={theme.primary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.button, { backgroundColor: isLoading ? theme.primary + '80' : theme.primary }]}
                  onPress={handleLogin}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Text style={styles.buttonText}>Guard Login</Text>
                      <Ionicons name="shield-checkmark" size={18} color="#fff" style={styles.buttonIcon} />
                    </>
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.switchLoginButton}
                  onPress={navigateToResidentLogin}
                >
                  <LinearGradient
                    colors={[theme.primary + '20', theme.primary + '10']}
                    style={styles.switchLoginGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Ionicons name="home-outline" size={18} color={theme.primary} style={styles.switchIcon} />
                    <Text style={[styles.switchLoginText, { color: theme.text }]}>
                      Resident? <Text style={{ color: theme.primary, fontWeight: 'bold' }}>Login Here</Text>
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
                
                <View style={styles.infoContainer}>
                  <Ionicons name="information-circle" size={14} color={theme.textSecondary} />
                  <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                    Login with credentials provided by your society admin
                  </Text>
                </View>
                
                <View style={styles.themeToggleWrapper}>
                  <DirectThemeToggle style={styles.themeToggle} showLabel={true} />
                </View>
              </Animated.View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
      <TermsModal />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  backgroundGradient: {
    flex: 1,
    width: '100%',
  },
  gradientOverlay: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: Math.max(20, height * 0.02),
  },
  formContainer: {
    padding: Math.min(24, width * 0.05),
    justifyContent: 'center',
    width: '100%',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: Math.min(32, height * 0.04),
  },
  logoCircle: {
    width: Math.min(80, width * 0.18),
    height: Math.min(80, width * 0.18),
    borderRadius: Math.min(40, width * 0.09),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: Math.min(32, width * 0.08),
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Math.min(16, width * 0.04),
    textAlign: 'center',
    marginBottom: 16,
  },
  formCard: {
    borderRadius: 20,
    padding: Math.min(24, width * 0.06),
    borderWidth: 1,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    width: '100%',
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  labelIcon: {
    marginRight: 8,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputWrapper: {
    borderRadius: 12,
    borderWidth: 1.5,
    height: Math.min(55, height * 0.07),
    position: 'relative',
    overflow: 'hidden',
  },
  label: {
    fontSize: Math.min(16, width * 0.04),
    fontWeight: '600',
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: Math.min(16, width * 0.04),
    fontWeight: '500',
  },
  showPasswordButton: {
    position: 'absolute',
    right: 16,
    height: '100%',
    justifyContent: 'center',
  },
  button: {
    padding: 14,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    height: Math.min(54, height * 0.07),
  },
  buttonText: {
    color: '#fff',
    fontSize: Math.min(18, width * 0.045),
    fontWeight: 'bold',
  },
  buttonIcon: {
    marginLeft: 8,
  },
  switchLoginButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  switchLoginGradient: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  switchIcon: {
    marginRight: 8,
  },
  switchLoginText: {
    fontSize: 14,
    fontWeight: '500',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  infoText: {
    fontSize: 12,
    marginLeft: 4,
  },
  themeToggleWrapper: {
    alignItems: 'center',
    marginTop: 16,
  },
  themeToggle: {
    marginVertical: 0,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxHeight: '80%',
    borderRadius: 20,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  termsScroll: {
    maxHeight: '80%',
  },
  termsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  termsText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  termsButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  termsButton: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
    marginHorizontal: 8,
  },
  declineButton: {
    backgroundColor: '#f3f4f6',
  },
  acceptButton: {
    backgroundColor: '#3b82f6',
  },
  declineButtonText: {
    color: '#4b5563',
    textAlign: 'center',
    fontWeight: '600',
  },
  acceptButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
  },
}); 