import React, { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function CancellationRefundsScreen() {
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
        <Text style={styles.title}>Cancellation and Refunds</Text>
      </View>

      <Section title="1. Cancellation Policy" index={0}>
        <Text style={styles.text}>
          You can cancel your subscription or membership at any time. Cancellation can be done 
          through your account settings or by contacting our support team.
        </Text>
        <Text style={styles.bulletPoint}>• Cancellation takes effect at the end of the current billing cycle</Text>
        <Text style={styles.bulletPoint}>• You will retain access to paid features until the end of your billing period</Text>
        <Text style={styles.bulletPoint}>• Immediate termination is available upon request</Text>
      </Section>

      <Section title="2. Refund Eligibility" index={1}>
        <Text style={styles.text}>Refunds are provided in these circumstances:</Text>
        <Text style={styles.bulletPoint}>• Within 7 Days: Full refund if request is made within 7 days of payment</Text>
        <Text style={styles.bulletPoint}>• Duplicate Charges: Full refund for accidental duplicate charges</Text>
        <Text style={styles.bulletPoint}>• Service Failure: Partial refund if service is unavailable</Text>
        <Text style={styles.bulletPoint}>• Technical Issues: Full refund if we cannot deliver the service</Text>
      </Section>

      <Section title="3. Non-Refundable Cases" index={2}>
        <Text style={styles.text}>Not eligible for refunds:</Text>
        <Text style={styles.bulletPoint}>• Purchases older than 7 days</Text>
        <Text style={styles.bulletPoint}>• Refunds requested after subscription actively used</Text>
        <Text style={styles.bulletPoint}>• Purchases made in error</Text>
        <Text style={styles.bulletPoint}>• Refunds for services accessed and used</Text>
      </Section>

      <Section title="4. Refund Process" index={3}>
        <Text style={styles.bulletPoint}>1. Contact our support team with your refund request</Text>
        <Text style={styles.bulletPoint}>2. Provide transaction ID and reason for refund</Text>
        <Text style={styles.bulletPoint}>3. We will review within 5-7 business days</Text>
        <Text style={styles.bulletPoint}>4. If approved, refund within 7-10 business days</Text>
        <Text style={styles.bulletPoint}>5. Credited to original payment method</Text>
      </Section>

      <Section title="5. Partial Refunds" index={4}>
        <Text style={styles.text}>
          Partial refunds are calculated based on remaining days of service at the time of cancellation. 
          Pro-rata refunds will be applied to your account as credit only.
        </Text>
      </Section>

      <Section title="6. Failed Payments" index={5}>
        <Text style={styles.text}>
          If a payment fails, we will make up to 3 attempts to process the payment. After 3 failed 
          attempts, your account may be suspended.
        </Text>
      </Section>

      <Section title="7. Service Interruption Refund" index={6}>
        <Text style={styles.text}>
          If our service is unavailable for more than 24 consecutive hours due to our fault, you are 
          entitled to a prorated refund for that period.
        </Text>
      </Section>

      <Section title="8. Currency & Exchange" index={7}>
        <Text style={styles.text}>
          Refunds will be issued in the same currency as the original purchase. Exchange rate 
          fluctuations are not our responsibility.
        </Text>
      </Section>

      <Section title="9. Dispute Resolution" index={8}>
        <Text style={styles.text}>
          If you dispute a charge without contacting us first, we may suspend your account 
          pending resolution.
        </Text>
      </Section>

      <Section title="10. Contact Us" index={9}>
        <Text style={styles.text}>
          For refund requests, please contact us at:
        </Text>
        <Text style={styles.bulletPoint}>Email: refunds@mysocietydetails.com</Text>
        <Text style={styles.bulletPoint}>Hours: Monday - Friday, 9 AM - 6 PM IST</Text>
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
