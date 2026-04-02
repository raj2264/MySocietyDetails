import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, useWindowDimensions, Linking, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import AppLayout from '../components/AppLayout';
import { Ionicons } from '@expo/vector-icons';
import appJson from '../app.json';

export default function AboutUs() {
  const { theme, isDarkMode } = useTheme();
  const { width } = useWindowDimensions();
  const appVersion = appJson.expo.version;
  const buildNumber = appJson.expo.android.versionCode;

  const handleEmailPress = () => {
    Linking.openURL('mailto:support@mysocietydetails.com');
  };

  const handlePhonePress = () => {
    Linking.openURL('tel:+15551234567');
  };

  const features = [
    {
      icon: 'shield-checkmark-outline',
      title: 'Secure & Private',
      description: 'Your data is encrypted and protected with enterprise-grade security measures.'
    },
    {
      icon: 'people-outline',
      title: 'Community First',
      description: 'Built to strengthen community bonds and make society living more convenient.'
    },
    {
      icon: 'flash-outline',
      title: 'Modern & Fast',
      description: 'Experience a seamless, modern interface designed for the best user experience.'
    },
    {
      icon: 'sync-outline',
      title: 'Always Updated',
      description: 'Regular updates and improvements to keep your society management up to date.'
    }
  ];

  return (
    <AppLayout title="About Us">
      <ScrollView 
        style={[styles.container, { backgroundColor: theme.background }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={[styles.logoContainer, { backgroundColor: theme.primary + '15' }]}>
            <Ionicons name="home" size={40} color={theme.primary} />
          </View>
          <Text style={[styles.appName, { color: theme.text }]}>MySocietyDetails</Text>
          <Text style={[styles.tagline, { color: theme.text + 'CC' }]}>
            Making Society Living Better
          </Text>
          <Text style={[styles.version, { color: theme.text + '99' }]}>
            Version {appVersion} (Build {buildNumber})
          </Text>
        </View>

        {/* Description Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Our Mission
          </Text>
          <Text style={[styles.description, { color: theme.text + 'CC' }]}>
            MySocietyDetails is dedicated to transforming the way residents interact with their society. 
            We believe in creating a seamless, secure, and efficient platform that brings communities 
            closer together while simplifying everyday society management tasks.
          </Text>
        </View>

        {/* Features Grid */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Why Choose MySocietyDetails?
          </Text>
          <View style={styles.featuresGrid}>
            {features.map((feature, index) => (
              <View 
                key={index} 
                style={[
                  styles.featureCard,
                  { 
                    backgroundColor: isDarkMode ? theme.card + '40' : theme.card,
                    borderColor: theme.border,
                    width: width > 600 ? (width - 48) / 2 : width - 32
                  }
                ]}
              >
                <View style={[styles.featureIcon, { backgroundColor: theme.primary + '15' }]}>
                  <Ionicons name={feature.icon} size={24} color={theme.primary} />
                </View>
                <Text style={[styles.featureTitle, { color: theme.text }]}>
                  {feature.title}
                </Text>
                <Text style={[styles.featureDescription, { color: theme.text + 'CC' }]}>
                  {feature.description}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Contact Section */}
        <View style={[styles.section, styles.contactSection]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Get in Touch
          </Text>
          <Text style={[styles.contactText, { color: theme.text + 'CC' }]}>
            Have questions or suggestions? We'd love to hear from you!
          </Text>
          <View style={styles.contactButtons}>
            <TouchableOpacity 
              style={[styles.contactButton, { backgroundColor: theme.primary + '15' }]}
              onPress={handleEmailPress}
              activeOpacity={0.7}
            >
              <Ionicons name="mail-outline" size={20} color={theme.primary} />
              <Text style={[styles.contactButtonText, { color: theme.primary }]}>
                support@mysocietydetails.com
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.contactButton, { backgroundColor: theme.primary + '15' }]}
              onPress={handlePhonePress}
              activeOpacity={0.7}
            >
              <Ionicons name="call-outline" size={20} color={theme.primary} />
              <Text style={[styles.contactButtonText, { color: theme.primary }]}>
                +1 (555) 123-4567
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 18,
    marginBottom: 8,
  },
  version: {
    fontSize: 14,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  featureCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  featureDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  contactSection: {
    paddingBottom: 40,
  },
  contactText: {
    fontSize: 16,
    marginBottom: 20,
  },
  contactButtons: {
    gap: 12,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  contactButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
}); 