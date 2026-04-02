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
  Switch,
  Modal
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DirectThemeToggle from '../components/DirectThemeToggle';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useNoStuckLoading from '../hooks/useNoStuckLoading';

const { width, height } = Dimensions.get('window');
const RESIDENT_STORAGE_KEY = 'resident_data';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  useNoStuckLoading(isLoading, setIsLoading);
  const [showPassword, setShowPassword] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const { signIn, refreshResidentData, user: authUser } = useAuth();
  const { theme, isDarkMode, animatedColors } = useTheme();
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

  useEffect(() => {
    const checkTermsAcceptance = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: termsData } = await supabase
            .from('terms_acceptance')
            .select('*')
            .eq('user_id', session.user.id)
            .eq('user_type', 'resident')
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

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      console.log('Starting login process...');
      
      // Use AuthContext's signIn — this sets user/session/residentData
      // in context synchronously before we navigate, preventing race conditions
      // where navigation happens before context state is ready.
      const result = await signIn(email.trim().toLowerCase(), password);

      if (!result.success) {
        Alert.alert('Error', result.error || 'Login failed');
        return;
      }

      // Get the current user to check terms and password status
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        Alert.alert('Error', 'Login failed');
        return;
      }

      console.log('Login successful, user ID:', currentUser.id);

      // Check if terms are accepted
      console.log('Checking terms acceptance for user:', currentUser.id);
      const { data: termsData, error: termsError } = await supabase
        .from('terms_acceptance')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('user_type', 'resident')
        .order('accepted_at', { ascending: false })
        .limit(1);

      if (termsError) {
        console.error('Error checking terms:', termsError);
      }

      console.log('Terms acceptance data:', termsData);

      if (!termsData || termsData.length === 0) {
        console.log('Terms not accepted, showing terms modal');
        setShowTerms(true);
        return;
      }

      console.log('Terms already accepted, proceeding...');

      // Check user_metadata for password_changed flag
      if (currentUser.user_metadata?.password_changed === true) {
        console.log('Password already changed, going to home');
        router.replace('/home');
      } else {
        console.log('First login detected, redirecting to password change');
        router.replace('/change-password?first_login=true');
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
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
          user_type: 'resident',
          terms_version: '1.0',
          device_info: Platform.OS + ' ' + Platform.Version
        });

      if (termsError) {
        throw termsError;
      }

      setTermsAccepted(true);
      setShowTerms(false);
      
      // Refresh resident data before navigating
      await refreshResidentData(session.user.id);
      
      // Check user_metadata for password_changed flag
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser?.user_metadata?.password_changed === true) {
        router.replace('/home');
      } else {
        router.replace('/change-password?first_login=true');
      }
    } catch (error) {
      console.error('Error accepting terms:', error);
      Alert.alert('Error', 'Failed to accept terms. Please try again.');
    }
  };

  const handleTermsDecline = () => {
    setShowTerms(false);
    Alert.alert('Terms Required', 'You must accept the terms and conditions to use the app.');
  };

  // Inside the form component, add a link to guard login
  const forgotPasswordButton = (
    <TouchableOpacity 
      style={styles.forgotPasswordButton}
      onPress={() => router.push('/reset-password')}
    >
      <Animated.Text style={[styles.forgotPassword, { color: theme.primary }]}>
        Forgot Password?
      </Animated.Text>
    </TouchableOpacity>
  );

  // Add a new component for guard login link
  const guardLoginButton = (
    <TouchableOpacity 
      style={styles.guardLoginButton}
      onPress={() => router.push('/guard-login')}
    >
      <LinearGradient
        colors={[theme.primary + '20', theme.primary + '10']}
        style={styles.guardLoginGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Ionicons name="shield-outline" size={18} color={theme.primary} style={styles.guardIcon} />
        <Text style={[styles.guardLoginText, { color: theme.text }]}>
          Security Guard? <Text style={{ color: theme.primary, fontWeight: 'bold' }}>Login Here</Text>
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  // Gradient colors based on theme
  const gradientColors = isDarkMode 
    ? ['#1a1a2e', '#16213e', '#0f3460'] 
    : ['#4cc9f0', '#4361ee', '#3a0ca3'];

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
              Terms and Conditions for Residents
            </Text>
            <Text style={[styles.termsText, { color: theme.textSecondary }]}>
              {`
1. Account Usage
   - You agree to use your MySociety account only for legitimate purposes related to your residence in the society.
   - You are responsible for maintaining the confidentiality of your account credentials.
   - You must notify the society admin immediately of any unauthorized access to your account.

2. Privacy and Data Protection
   - Your personal information will be used only for society-related purposes.
   - We implement appropriate security measures to protect your data.
   - You consent to the collection and processing of your data as described in our Privacy Policy.

3. Community Guidelines
   - You agree to use the platform respectfully and responsibly.
   - You will not use the platform for any illegal or unauthorized purposes.
   - You will not post or share inappropriate content.

4. Communication
   - You agree to receive important notifications via the app.
   - You can opt out of non-essential communications.
   - Emergency communications cannot be opted out of.

5. Access and Security
   - You are responsible for the security of your account.
   - You must use strong passwords and enable 2FA if available.
   - Report any security concerns immediately.

6. Updates to Terms
   - These terms may be updated periodically.
   - You will be notified of significant changes.
   - Continued use of the platform implies acceptance of updated terms.

7. Termination
   - The society admin reserves the right to suspend or terminate access for violations.
   - You can request account deletion by contacting the society admin.
   - Upon termination, your data will be handled according to our data retention policy.
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
                <Text style={[styles.title, { color: theme.text }]}>My Society Details</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                  Welcome back to your community
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
                      <Text style={styles.buttonText}>Sign In</Text>
                      <Ionicons name="arrow-forward" size={18} color="#fff" style={styles.buttonIcon} />
                    </>
                  )}
                </TouchableOpacity>
                
                {guardLoginButton}
                
                <View style={styles.infoContainer}>
                  <Ionicons name="information-circle" size={14} color={theme.textSecondary} />
                  <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                    Contact your society administrator to register
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
    maxWidth: 520,
    alignSelf: 'center',
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
    maxWidth: 480,
    alignSelf: 'center',
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
    alignItems: 'center',
    marginTop: 20,
    height: Math.min(54, height * 0.07),
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: Math.min(18, width * 0.045),
    fontWeight: 'bold',
  },
  buttonIcon: {
    marginLeft: 8,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginTop: -6,
    marginBottom: 8,
  },
  forgotPassword: {
    fontSize: 14,
    fontWeight: '600',
  },
  guardLoginButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  guardLoginGradient: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  guardIcon: {
    marginRight: 8,
  },
  guardLoginText: {
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