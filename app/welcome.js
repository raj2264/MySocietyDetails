import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  Animated,
  Platform,
  Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const welcomeSlides = [
  {
    id: '1',
    title: 'Welcome to\nMy Society Details',
    description: 'Experience the future of community living with our all-in-one society management solution',
    icon: 'home',
    iconSize: 140,
    gradient: ['#FF6B6B', '#FF8E53'],
    accentColor: '#FF6B6B',
    pattern: 'M0,0 L100,0 L100,100 L0,100 Z',
  },
  {
    id: '2',
    title: 'Stay Connected\nAlways',
    description: 'Real-time updates, instant notifications, and seamless communication with your community',
    icon: 'notifications',
    iconSize: 130,
    gradient: ['#4FACFE', '#00F2FE'],
    accentColor: '#4FACFE',
    pattern: 'M0,50 Q50,0 100,50 T200,50',
  },
  {
    id: '3',
    title: 'Smart Living\nMade Simple',
    description: 'Manage bills, visitors, and community services with just a few taps',
    icon: 'settings',
    iconSize: 135,
    gradient: ['#43E97B', '#38F9D7'],
    accentColor: '#43E97B',
    pattern: 'M0,0 L100,100 M100,0 L0,100',
  },
];

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

const Pagination = ({ scrollX }) => {
  return (
    <View style={styles.paginationContainer}>
      {welcomeSlides.map((_, index) => {
        const inputRange = [
          (index - 1) * SCREEN_WIDTH,
          index * SCREEN_WIDTH,
          (index + 1) * SCREEN_WIDTH,
        ];

        const dotScale = scrollX.interpolate({
          inputRange,
          outputRange: [1, 1.5, 1],
          extrapolate: 'clamp',
        });

        const dotOpacity = scrollX.interpolate({
          inputRange,
          outputRange: [0.3, 1, 0.3],
          extrapolate: 'clamp',
        });

        return (
          <Animated.View
            key={index}
            style={[
              styles.dot,
              {
                opacity: dotOpacity,
                transform: [
                  { scale: dotScale },
                  { translateX: scrollX.interpolate({
                    inputRange,
                    outputRange: [0, 8, 0],
                    extrapolate: 'clamp',
                  })}
                ],
                backgroundColor: welcomeSlides[index].accentColor,
              },
            ]}
          />
        );
      })}
    </View>
  );
};

export default function WelcomeScreen() {
  const router = useRouter();
  const { theme, isDarkMode } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const slidesRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const viewableItemsChanged = useRef(({ viewableItems }) => {
    setCurrentIndex(viewableItems[0]?.index ?? 0);
  }).current;

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const scrollTo = () => {
    if (currentIndex < welcomeSlides.length - 1) {
      slidesRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      router.replace('/login');
    }
  };

  const renderItem = ({ item, index }) => {
    const inputRange = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ];

    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.8, 1, 0.8],
      extrapolate: 'clamp',
    });

    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.4, 1, 0.4],
      extrapolate: 'clamp',
    });

    const translateX = scrollX.interpolate({
      inputRange,
      outputRange: [SCREEN_WIDTH * 0.2, 0, -SCREEN_WIDTH * 0.2],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View 
        style={[
          styles.slide, 
          { 
            width: SCREEN_WIDTH,
            opacity,
            transform: [
              { scale },
              { translateX }
            ],
          }
        ]}
      >
        <View style={styles.contentContainer}>
          <Animated.View 
            style={[
              styles.iconContainer,
              {
                transform: [
                  { scale: scaleAnim },
                  { translateY: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [50, 0],
                  })},
                ],
              },
            ]}
          >
            <LinearGradient
              colors={item.gradient}
              style={styles.iconGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.iconInner}>
                <Ionicons 
                  name={item.icon} 
                  size={item.iconSize} 
                  color="#FFFFFF" 
                  style={styles.icon}
                />
              </View>
            </LinearGradient>
          </Animated.View>

          <Animated.View 
            style={[
              styles.textContainer,
              {
                opacity: fadeAnim,
                transform: [
                  { translateY: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  })},
                ],
              },
            ]}
          >
            <Text style={[styles.title, { color: theme.text }]}>
              {item.title}
            </Text>
            <Text style={[styles.description, { color: theme.text + '99' }]}>
              {item.description}
            </Text>
          </Animated.View>
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={isDarkMode 
          ? ['#1a1a1a', '#121212', '#0a0a0a'] 
          : ['#ffffff', '#f8f9fa', '#f1f3f5']}
        style={StyleSheet.absoluteFill}
      />
      
      <BlurView intensity={20} style={styles.skipContainer}>
        <TouchableOpacity
          onPress={() => router.replace('/login')}
          style={styles.skipButton}
        >
          <Text style={[styles.skipText, { color: theme.text + '99' }]}>
            Skip
          </Text>
        </TouchableOpacity>
      </BlurView>

      <AnimatedFlatList
        data={welcomeSlides}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        pagingEnabled
        bounces={false}
        keyExtractor={(item) => item.id}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true }
        )}
        onViewableItemsChanged={viewableItemsChanged}
        viewabilityConfig={viewConfig}
        ref={slidesRef}
        scrollEventThrottle={16}
      />

      <Pagination scrollX={scrollX} />

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.button,
            { 
              backgroundColor: welcomeSlides[currentIndex].accentColor,
              transform: [{ scale: scaleAnim }],
            }
          ]}
          onPress={scrollTo}
        >
          <Text style={styles.buttonText}>
            {currentIndex === welcomeSlides.length - 1 ? 'Get Started' : 'Next'}
          </Text>
          <Ionicons 
            name={currentIndex === welcomeSlides.length - 1 ? 'arrow-forward' : 'chevron-forward'} 
            size={20} 
            color="#FFF" 
            style={styles.buttonIcon}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skipContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    zIndex: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  skipButton: {
    padding: 12,
    paddingHorizontal: 20,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '600',
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  iconContainer: {
    width: SCREEN_WIDTH * 0.7,
    height: SCREEN_WIDTH * 0.7,
    marginBottom: 40,
  },
  iconGradient: {
    width: '100%',
    height: '100%',
    borderRadius: SCREEN_WIDTH * 0.35,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  iconInner: {
    width: '90%',
    height: '90%',
    borderRadius: SCREEN_WIDTH * 0.315,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  icon: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  textContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 17,
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  paginationContainer: {
    flexDirection: 'row',
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  dot: {
    height: 8,
    width: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    width: '100%',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  buttonIcon: {
    marginLeft: 8,
  },
}); 