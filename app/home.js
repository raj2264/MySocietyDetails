import React, { useEffect, useRef, useState, memo } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  Text, 
  TouchableOpacity, 
  Image,
  Animated,
  Easing,
  Dimensions,
  Platform
} from 'react-native';
import AppLayout from '../components/AppLayout';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';

const { width } = Dimensions.get('window');

const FeatureCard = memo(({ icon, title, description, onPress, color }) => {
  const { theme } = useTheme();
  
  return (
    <TouchableOpacity 
      style={[styles.featureCard, { backgroundColor: theme.card }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon} size={30} color={color} />
      </View>
      <View style={styles.featureContent}>
        <Text style={[styles.featureTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.featureDescription, { color: theme.text + '99' }]}>
          {description}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.text + '80'} />
    </TouchableOpacity>
  );
});

const QuickActionButton = memo(({ icon, label, onPress, color, animValue }) => {
  const { theme } = useTheme();
  
  const buttonScale = animValue ? animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1]
  }) : 1;
  
  return (
    <View style={styles.actionButtonWrapper}>
      <Animated.View style={{
        transform: [{ scale: buttonScale }],
        width: '100%',
      }}>
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: theme.card }]}
          onPress={onPress}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIcon, { backgroundColor: `${color}20` }]}>
            <Ionicons name={icon} size={24} color={color} />
          </View>
          <Text style={[styles.actionText, { color: theme.text }]} numberOfLines={1} ellipsizeMode="tail">
            {label}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
});

export default function HomeScreen() {
  const { theme, isDarkMode } = useTheme();
  const { user, residentData } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  
  // Animation state
  const [hasAnimated, setHasAnimated] = useState(false);
  
  // Native-driver animation values - must ONLY be used with useNativeDriver: true
  const entranceAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const welcomeCardAnim = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useRef(new Animated.Value(-width)).current;
  const textRevealAnim = useRef(new Animated.Value(0)).current;
  
  // JS-only animation values - must ONLY be used with useNativeDriver: false
  const jsGlowAnim = useRef(new Animated.Value(0)).current;
  const jsGradientPosAnim = useRef(new Animated.Value(0)).current;
  
  // Create animation arrays for staggered animations - native driver only
  const createAnimationArray = (size) => {
    return Array(size).fill(0).map(() => new Animated.Value(1));
  };
  
  // Native-driver animations
  const actionButtonsAnim = useRef(createAnimationArray(4)).current;
  const featureAnimations = useRef(createAnimationArray(7)).current;
  const titleAnim1 = useRef(new Animated.Value(0)).current;
  const titleAnim2 = useRef(new Animated.Value(0)).current;
  
  // Debug features - set to false to hide debug options
  const [showDebugOptions, setShowDebugOptions] = useState(false);
  
  // Function to run JS-only animations separately from native driver animations
  const runJsAnimations = () => {
    // JS animations for glow - slower to reduce JS thread pressure
    Animated.loop(
      Animated.sequence([
        Animated.timing(jsGlowAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false
        }),
        Animated.timing(jsGlowAnim, {
          toValue: 0,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false
        })
      ])
    ).start();
    
    Animated.loop(
      Animated.timing(jsGradientPosAnim, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: false
      })
    ).start();
  };
  
  // Loop shimmer effect - this is a separate native driver animation
  const loopShimmerEffect = () => {
    shimmerAnim.setValue(-width * 2);
    
    Animated.timing(shimmerAnim, {
      toValue: width * 2,
      duration: 1500,
      easing: Easing.ease,
      useNativeDriver: true
    }).start(() => {
      // Loop with longer interval to reduce CPU usage
      setTimeout(loopShimmerEffect, 6000);
    });
  };
  
  // Initialize all animations
  useEffect(() => {
    // No entrance animation - start effects directly
    runJsAnimations();
    loopShimmerEffect();
    setHasAnimated(true);
    
    // Cleanup
    return () => {
      shimmerAnim.stopAnimation();
      jsGlowAnim.stopAnimation();
      jsGradientPosAnim.stopAnimation();
    };
  }, []);
  
  const features = [
    {
      icon: 'person-outline',
      title: 'Profile',
      description: 'View and manage your profile',
      route: '/profile',
      color: '#8E44AD'
    },
    {
      icon: 'construct-outline',
      title: 'Services',
      description: 'Book and manage society services',
      route: '/services',
      color: '#4361EE'
    },
    {
      icon: 'people-outline',
      title: 'Visitors',
      description: 'Manage visitor access and approvals',
      route: '/visitors',
      color: '#7209B7'
    },
    {
      icon: 'car-outline',
      title: 'My Vehicles',
      description: 'Manage your vehicles and parking',
      route: '/vehicles',
      color: '#FF6B6B'
    },
    {
      icon: 'chatbox-ellipses-outline',
      title: 'Complaints',
      description: 'Submit and track personal or community complaints',
      route: '/complaints',
      color: '#4CAF50'
    },
    {
      icon: 'document-text-outline',
      title: 'Bills & Payments',
      description: 'View and manage your bills',
      route: '/bills',
      color: '#F9C74F'
    },
    {
      icon: 'document-text-outline',
      title: 'LIC Requests',
      description: 'Submit and manage your LIC requests',
      route: '/lic-request',
      color: '#2A9D8F'
    },
    {
      icon: 'business-outline',
      title: 'Apartment Listings',
      description: 'List your apartment for sale or rent',
      route: '/apartment-listings',
      color: '#FB8500'
    },
    {
      icon: 'cash-outline',
      title: 'Payments',
      description: 'View & pay maintenance bills',
      route: '/payments',
      color: '#4CC9F0'
    },
    {
      icon: 'calendar-outline',
      title: 'Meetings',
      description: 'View and manage society meetings',
      route: '/meetings',
      color: '#3B82F6'
    },
    {
      icon: 'calendar-number-outline',
      title: 'Bookings',
      description: 'Book society amenities and services',
      route: '/bookings',
      color: '#F59E0B'
    },
    {
      icon: 'notifications-outline',
      title: 'Notifications',
      description: 'View your notifications',
      route: '/notifications',
      color: '#E63946'
    },
    {
      icon: 'megaphone-outline',
      title: 'Announcements',
      description: 'View important announcements from your society',
      route: '/announcements',
      color: '#4361EE'
    },
    {
      icon: 'bar-chart-outline',
      title: 'Polls',
      description: 'Vote on community polls and see results',
      route: '/polls',
      color: '#7209B7'
    },
    {
      icon: 'shield-checkmark-outline',
      title: 'Emergency Contacts',
      description: 'View emergency contact information',
      route: '/security-contacts',
      color: '#E63946'
    }
  ];
  
  const quickActions = [
    { icon: 'people-outline', label: 'Visitors', route: '/visitors', color: '#8E44AD' },
    { icon: 'document-text-outline', label: 'Bills', route: '/bills', color: '#4361EE' },
    { icon: 'chatbox-ellipses-outline', label: 'Complaints', route: '/complaints', color: '#FF6B6B' },
    { icon: 'megaphone-outline', label: 'Announcements', route: '/announcements', color: '#4CC9F0' }
  ];
  
  const handleLongPressTitle = () => {
    setShowDebugOptions(!showDebugOptions);
    console.log('Debug options toggled:', !showDebugOptions);
  };
  
  const goToTestScreen = () => {
    router.push('/test');
  };
  
  // Navigation handlers with better transitions
  const handleNavigate = (route) => {
    // Don't animate if already on this route
    if (pathname === route) return;
    
    // Apply anti-flicker measures for transitions
    if (Platform.OS === 'android') {
      // On Android, simpler and faster transition works best
      router.push(route);
      return;
    }
    
    // For iOS, use minimal animation
    Animated.timing(scaleAnim, {
      toValue: 0.98,
      duration: 50, // Ultra fast
      useNativeDriver: true
    }).start();

    // Pre-animate with minimal values
    Animated.timing(entranceAnim, {
      toValue: 0.98,
      duration: 50,
      useNativeDriver: true
    }).start(() => {
      // No delay - immediate transition is smoother
      router.push(route);
    });
  };
  
  // Gradient background for welcome card - JS-only
  const welcomeGradient = jsGlowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [isDarkMode ? '#2A3A4E' : '#4361EE', isDarkMode ? '#3D5166' : '#4F70FF']
  });
  
  // Welcome card border glow - JS-only
  const cardBorderGlow = jsGlowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 4]
  });
  
  return (
    <AppLayout title="Home">
      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Main content container */}
        <Animated.View style={[
          styles.mainContent,
          {
            opacity: entranceAnim,
            transform: [
              { translateY: slideAnim },
              { scale: scaleAnim }
            ]
          }
        ]}>
          {/* Welcome Card - Split into two elements: outer (JS animations) and inner (native animations) */}
          <Animated.View style={[
            styles.welcomeCard,
            { 
              backgroundColor: welcomeGradient,
              elevation: 5,
              shadowColor: isDarkMode ? '#1A2535' : '#3351DE',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: cardBorderGlow,
            }
          ]}>
            {/* Inner content with native-driver animations */}
            <Animated.View style={{
              width: '100%',
              transform: [{ scale: welcomeCardAnim }],
            }}>
              {/* Shimmer effect */}
              <Animated.View style={[
                styles.shimmer,
                {
                  transform: [{ translateX: shimmerAnim }]
                }
              ]} />
              
              {/* Card pattern overlay */}
              <View style={styles.cardPattern} />
              
              {/* Content container with proper layout */}
              <View style={styles.welcomeContentWrapper}>
                {/* Welcome text section */}
                <View style={styles.welcomeContent}>
                  <Animated.Text style={[
                    styles.welcomeTitle,
                    { 
                      color: '#FFFFFF',
                      transform: [{ translateY: textRevealAnim }]
                    }
                  ]}>
                    Welcome back, {residentData?.name || user?.user_metadata?.full_name || 'Resident'}!
                  </Animated.Text>
                  
                  <Animated.Text style={[
                    styles.welcomeSubtitle,
                    { 
                      color: '#FFFFFF',
                      opacity: textRevealAnim.interpolate({
                        inputRange: [0, 20],
                        outputRange: [0.9, 0]
                      }),
                      transform: [{ translateY: textRevealAnim }]
                    }
                  ]}>
                    {residentData?.unit_number 
                      ? `Unit ${residentData.unit_number}` 
                      : 'Resident Portal'}
                  </Animated.Text>
                </View>
                
                {/* Date badge */}
                <View style={styles.dateBadge}>
                  <Text style={styles.dateText}>
                    {new Date().toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}
                  </Text>
                </View>
              </View>
            </Animated.View>
          </Animated.View>
          
          {/* Quick Actions Section */}
          <Animated.Text style={[
            styles.sectionTitle,
            { 
              color: theme.text,
              opacity: titleAnim1.interpolate({
                inputRange: [-20, 0],
                outputRange: [0, 1]
              }),
              transform: [{ translateX: titleAnim1 }]
            }
          ]}>
            Quick Actions
          </Animated.Text>
          
          <View style={styles.quickActionsContainer}>
            {quickActions.map((action, index) => (
              <QuickActionButton 
                key={index}
                icon={action.icon} 
                label={action.label} 
                color={action.color} 
                onPress={() => handleNavigate(action.route)}
                animValue={actionButtonsAnim[index]}
              />
            ))}
          </View>
          
          {/* Features Section */}
          <Animated.Text style={[
            styles.sectionTitle,
            { 
              color: theme.text,
              opacity: titleAnim2.interpolate({
                inputRange: [-20, 0],
                outputRange: [0, 1]
              }),
              transform: [{ translateX: titleAnim2 }]
            }
          ]}
            onLongPress={handleLongPressTitle}
          >
            Features
          </Animated.Text>
          
          <View style={styles.featuresContainer}>
            {features.map((feature, index) => (
              <Animated.View
                key={index}
                style={{ 
                  opacity: featureAnimations[index] ? featureAnimations[index].interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1]
                  }) : 1,
                  transform: [
                    { 
                      translateX: featureAnimations[index] ? featureAnimations[index].interpolate({
                        inputRange: [0, 1],
                        outputRange: [50, 0]
                      }) : 0 
                    },
                    { 
                      scale: featureAnimations[index] ? featureAnimations[index].interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.9, 1]
                      }) : 1 
                    }
                  ]
                }}
              >
                <FeatureCard 
                  icon={feature.icon}
                  title={feature.title}
                  description={feature.description}
                  color={feature.color}
                  onPress={() => handleNavigate(feature.route)}
                />
              </Animated.View>
            ))}
          </View>
          
          {/* Debug section (hidden by default) */}
          {showDebugOptions && (
            <View style={styles.debugContainer}>
              <Text style={[styles.debugTitle, { color: theme.text }]}>
                Debug Options
              </Text>
              <TouchableOpacity 
                style={[styles.debugButton, { backgroundColor: '#F72585' }]}
                onPress={goToTestScreen}
              >
                <Text style={styles.debugButtonText}>Test Screen</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </Animated.ScrollView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 32,
  },
  mainContent: {
    flex: 1,
  },
  welcomeCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    position: 'relative',
  },
  welcomeContentWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
    zIndex: 2,
  },
  welcomeContent: {
    flex: 1,
    paddingVertical: 0,
    paddingRight: 20,
    zIndex: 2,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
    lineHeight: 30,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.9,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 14,
    marginLeft: 4,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  featuresContainer: {
    marginBottom: 12,
  },
  debugContainer: {
    backgroundColor: '#FF6B6B20',
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  debugTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  debugButton: {
    backgroundColor: '#F72585',
    padding: 10,
    borderRadius: 5,
  },
  debugButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  shimmer: {
    position: 'absolute',
    top: -100,
    left: -width,
    right: -width,
    bottom: -100,
    width: width * 3,
    height: '300%',
    backgroundColor: 'rgba(255,255,255,0.3)',
    transform: [{ skewX: '-20deg' }],
    zIndex: 1,
  },
  cardPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.07,
    zIndex: 0,
    backgroundColor: 'transparent',
    backgroundImage: 'radial-gradient(circle at 30px 30px, rgba(255,255,255,0.15) 2px, transparent 0)',
    backgroundSize: '10px 10px',
  },
  dateBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    zIndex: 2,
    alignSelf: 'flex-start',
  },
  dateText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  actionButtonWrapper: {
    width: '23%',
    alignItems: 'center',
  },
  actionButton: {
    width: '100%',
    height: 100,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
  },
  featureCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
  },
}); 