import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  Linking,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import AppLayout from '../../components/AppLayout';

const { width } = Dimensions.get('window');

const features = [
  {
    icon: 'shield-checkmark-outline',
    title: 'Enhanced Security',
    description: 'Advanced tools for managing visitor access and monitoring society security.'
  },
  {
    icon: 'people-outline',
    title: 'Visitor Management',
    description: 'Streamlined process for registering and tracking visitors in real-time.'
  },
  {
    icon: 'notifications-outline',
    title: 'Instant Alerts',
    description: 'Quick communication system for emergency situations and important updates.'
  },
  {
    icon: 'document-text-outline',
    title: 'Digital Records',
    description: 'Maintain comprehensive digital logs of all security-related activities.'
  }
];

export default function GuardAboutScreen() {
  const { theme, isDarkMode } = useTheme();
  const { guardData } = useAuth();

  const handleContact = async (type) => {
    let url;
    switch (type) {
      case 'email':
        url = 'mailto:support@mysocietydetails.com';
        break;
      case 'phone':
        url = 'tel:+1234567890';
        break;
      case 'website':
        url = 'https://mysocietydetails.com';
        break;
    }
    
    if (url) {
      try {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
        }
      } catch (error) {
        console.error('Error opening URL:', error);
      }
    }
  };

  return (
    <AppLayout title="About Us">
      <ScrollView 
        style={[styles.container, { backgroundColor: theme.background }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={[styles.logoContainer, { backgroundColor: theme.primary + '15' }]}>
            <Ionicons name="shield" size={40} color={theme.primary} />
          </View>
          <Text style={[styles.appName, { color: theme.text }]}>MySociety Guard</Text>
          <Text style={[styles.tagline, { color: theme.text + 'CC' }]}>
            Empowering Security Personnel
          </Text>
          <Text style={[styles.version, { color: theme.text + '99' }]}>
            Version 1.0.0
          </Text>
        </View>

        {/* Description Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Our Mission
          </Text>
          <Text style={[styles.description, { color: theme.text + 'CC' }]}>
            MySociety Guard is dedicated to empowering security personnel with modern tools 
            and technology. We believe in creating a secure, efficient, and user-friendly 
            platform that helps guards manage their responsibilities effectively while 
            maintaining the highest standards of security for the society.
          </Text>
        </View>

        {/* Features Grid */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Why Choose MySociety Guard?
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
            Contact Support
          </Text>
          <Text style={[styles.contactText, { color: theme.text + 'CC' }]}>
            Need help or have questions? Our support team is here to assist you.
          </Text>
          <View style={styles.contactButtons}>
            <TouchableOpacity
              style={[styles.contactButton, { backgroundColor: theme.primary + '15' }]}
              onPress={() => handleContact('email')}
            >
              <Ionicons name="mail-outline" size={24} color={theme.primary} />
              <Text style={[styles.contactButtonText, { color: theme.primary }]}>
                Email Support
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.contactButton, { backgroundColor: theme.primary + '15' }]}
              onPress={() => handleContact('phone')}
            >
              <Ionicons name="call-outline" size={24} color={theme.primary} />
              <Text style={[styles.contactButtonText, { color: theme.primary }]}>
                Call Support
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.contactButton, { backgroundColor: theme.primary + '15' }]}
              onPress={() => handleContact('website')}
            >
              <Ionicons name="globe-outline" size={24} color={theme.primary} />
              <Text style={[styles.contactButtonText, { color: theme.primary }]}>
                Visit Website
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