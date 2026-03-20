import React, { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';

export default function PrivacyPolicyScreen() {
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
        <Text style={styles.title}>Privacy Policy</Text>
      </View>

      <Section title="1. Introduction" index={0}>
        <Text style={styles.text}>
          MySocietyDetails ("we" or "us" or "our") operates the website and mobile application. 
          This page informs you of our policies regarding the collection, use, and disclosure of 
          personal data when you use our service.
        </Text>
      </Section>

      <Section title="2. Information Collection" index={1}>
        <Text style={styles.text}>We collect several different types of information:</Text>
        <Text style={styles.bulletPoint}>• Personal Data: Name, email, phone number, address</Text>
        <Text style={styles.bulletPoint}>• Payment Information: Processed through Razorpay</Text>
        <Text style={styles.bulletPoint}>• Usage Data: Pages visited, time spent, features used</Text>
        <Text style={styles.bulletPoint}>• Device Information: Device type, IP address, browser</Text>
        <Text style={styles.bulletPoint}>• Location Data: Approximate location (if permitted)</Text>
      </Section>

      <Section title="3. Use of Data" index={2}>
        <Text style={styles.text}>We use collected data to:</Text>
        <Text style={styles.bulletPoint}>• Provide and maintain our service</Text>
        <Text style={styles.bulletPoint}>• Notify you about changes to our service</Text>
        <Text style={styles.bulletPoint}>• Provide customer care and support</Text>
        <Text style={styles.bulletPoint}>• Analyze usage patterns and improve service</Text>
        <Text style={styles.bulletPoint}>• Monitor security and detect fraud</Text>
        <Text style={styles.bulletPoint}>• Comply with legal obligations</Text>
      </Section>

      <Section title="4. Security of Data" index={3}>
        <Text style={styles.text}>
          The security of your data is important to us. While we strive to use commercially 
          acceptable means to protect your Personal Data, we cannot guarantee its absolute security.
        </Text>
      </Section>

      <Section title="5. Data Retention" index={4}>
        <Text style={styles.text}>
          We will retain your Personal Data only for as long as necessary for the purposes set out in 
          this Privacy Policy.
        </Text>
      </Section>

      <Section title="6. Your Rights" index={5}>
        <Text style={styles.text}>You have the right to:</Text>
        <Text style={styles.bulletPoint}>• Access the Personal Data we keep about you</Text>
        <Text style={styles.bulletPoint}>• Request correction of inaccurate data</Text>
        <Text style={styles.bulletPoint}>• Request deletion of your data</Text>
        <Text style={styles.bulletPoint}>• Object to processing of your data</Text>
        <Text style={styles.bulletPoint}>• Request restriction of processing</Text>
        <Text style={styles.bulletPoint}>• Data portability</Text>
      </Section>

      <Section title="7. Third-Party Services" index={6}>
        <Text style={styles.text}>
          We use third-party services like Supabase and Razorpay. These services may collect and 
          process your personal data according to their own privacy policies.
        </Text>
      </Section>

      <Section title="8. Cookies" index={7}>
        <Text style={styles.text}>
          We use cookies to enhance your experience. You can choose to disable cookies through your 
          device settings.
        </Text>
      </Section>

      <Section title="9. Changes to Policy" index={8}>
        <Text style={styles.text}>
          We may update our Privacy Policy from time to time. We will notify you of any changes by 
          posting the new Privacy Policy on this page.
        </Text>
      </Section>

      <Section title="10. Contact Us" index={9}>
        <Text style={styles.text}>
          If you have any questions about this Privacy Policy, please contact us at privacy@mysocietydetails.com
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
