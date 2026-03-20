import React, { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Link } from 'expo-router';

export default function TermsAndConditionsScreen() {
  const [expandedSection, setExpandedSection] = useState(null);

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const Section = ({ title, index, children }) => (
    <View style={styles.section}>
      <TouchableOpacity
        onPress={() => toggleSection(index)}
        style={styles.sectionHeader}
      >
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.expandIcon}>
          {expandedSection === index ? '−' : '+'}
        </Text>
      </TouchableOpacity>
      {expandedSection === index && (
        <View style={styles.sectionContent}>
          {children}
        </View>
      )}
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Terms and Conditions</Text>
      </View>

      <Section title="1. Introduction" index={0}>
        <Text style={styles.text}>
          Welcome to MySocietyDetails. These Terms and Conditions govern your use of our platform, 
          including the web application and mobile application. By accessing and using our service, 
          you accept and agree to be bound by the terms and provision of this agreement.
        </Text>
      </Section>

      <Section title="2. User Accounts" index={1}>
        <Text style={styles.bulletPoint}>• You are responsible for maintaining the confidentiality of your account information</Text>
        <Text style={styles.bulletPoint}>• You agree to accept responsibility for all activities that occur under your account</Text>
        <Text style={styles.bulletPoint}>• You must notify us immediately of any unauthorized use of your account</Text>
        <Text style={styles.bulletPoint}>• You agree not to share your login credentials with anyone</Text>
      </Section>

      <Section title="3. Payment Terms" index={2}>
        <Text style={styles.bulletPoint}>• All payments are processed through Razorpay</Text>
        <Text style={styles.bulletPoint}>• You agree to pay all charges incurred with your account</Text>
        <Text style={styles.bulletPoint}>• Billing occurs on the date specified in your subscription or service agreement</Text>
        <Text style={styles.bulletPoint}>• Prices are subject to change with 30 days notice</Text>
        <Text style={styles.bulletPoint}>• All payments are non-refundable except as expressly stated in our Refund Policy</Text>
      </Section>

      <Section title="4. User Conduct" index={3}>
        <Text style={styles.text}>You agree not to:</Text>
        <Text style={styles.bulletPoint}>• Use the service for any illegal purpose or in violation of any laws</Text>
        <Text style={styles.bulletPoint}>• Harass, abuse, or harm anyone or any property</Text>
        <Text style={styles.bulletPoint}>• Attempt to gain unauthorized access to restricted areas</Text>
        <Text style={styles.bulletPoint}>• Transmit spam, viruses, or any other malicious code</Text>
        <Text style={styles.bulletPoint}>• Interfere with the operation of the service</Text>
        <Text style={styles.bulletPoint}>• Infringe upon intellectual property rights</Text>
      </Section>

      <Section title="5. Intellectual Property Rights" index={4}>
        <Text style={styles.text}>
          All content, features, and functionality of the service are owned by MySocietyDetails, 
          its licensors, or other providers of such material and are protected by international 
          copyright, trademark, and other intellectual property laws.
        </Text>
      </Section>

      <Section title="6. Disclaimer of Warranties" index={5}>
        <Text style={styles.text}>
          The service is provided on an "AS IS" and "AS AVAILABLE" basis. MySocietyDetails makes no 
          warranties, expressed or implied, regarding the service. We disclaim all warranties including 
          implied warranties of merchantability, fitness for a particular purpose, and non-infringement.
        </Text>
      </Section>

      <Section title="7. Limitation of Liability" index={6}>
        <Text style={styles.text}>
          MySocietyDetails shall not be liable for any indirect, incidental, special, consequential, 
          or punitive damages resulting from your use of or inability to use the service.
        </Text>
      </Section>

      <Section title="8. Termination" index={7}>
        <Text style={styles.text}>
          We may terminate your account and access to the service at any time, for any reason, 
          with or without cause. You may terminate your account by contacting us at any time.
        </Text>
      </Section>

      <Section title="9. Governing Law" index={8}>
        <Text style={styles.text}>
          These Terms and Conditions are governed by and construed in accordance with the laws of India, 
          and you irrevocably submit to the exclusive jurisdiction of the courts in India.
        </Text>
      </Section>

      <Section title="10. Contact Us" index={9}>
        <Text style={styles.text}>
          If you have questions about these Terms and Conditions, please contact us at support@mysocietydetails.com
        </Text>
      </Section>

      <Text style={styles.footer}>Last updated: March 20, 2026</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    padding: 16,
  },
  header: {
    marginBottom: 24,
    paddingTop: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f3f4f6',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  expandIcon: {
    fontSize: 24,
    fontWeight: '300',
    color: '#6b7280',
  },
  sectionContent: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  text: {
    fontSize: 14,
    lineHeight: 22,
    color: '#374151',
    marginBottom: 8,
  },
  bulletPoint: {
    fontSize: 14,
    lineHeight: 22,
    color: '#374151',
    marginBottom: 8,
    marginLeft: 8,
  },
  footer: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 24,
  },
});
