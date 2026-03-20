import React, { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';

export default function ContactUsScreen() {
  const [expandedFAQ, setExpandedFAQ] = useState(null);

  const toggleFAQ = (index) => {
    setExpandedFAQ(expandedFAQ === index ? null : index);
  };

  const FAQItem = ({ question, answer, index }) => (
    <View style={styles.faqItem}>
      <TouchableOpacity
        onPress={() => toggleFAQ(index)}
        style={styles.faqHeader}
      >
        <Text style={styles.faqQuestion}>{question}</Text>
        <Text style={styles.faqIcon}>
          {expandedFAQ === index ? '−' : '+'}
        </Text>
      </TouchableOpacity>
      {expandedFAQ === index && (
        <View style={styles.faqContent}>
          <Text style={styles.faqAnswer}>{answer}</Text>
        </View>
      )}
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Contact Us</Text>
        <Text style={styles.subtitle}>Get in touch with our team</Text>
      </View>

      <View style={styles.contactCard}>
        <Text style={styles.contactTitle}>Support</Text>
        <View style={styles.contactItem}>
          <Text style={styles.label}>Email:</Text>
          <TouchableOpacity onPress={() => Linking.openURL('mailto:mysocietydetails7@gmail.com')}>
            <Text style={styles.link}>mysocietydetails7@gmail.com</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.contactItem}>
          <Text style={styles.label}>Hours:</Text>
          <Text style={styles.value}>Monday - Friday: 9 AM - 6 PM IST</Text>
        </View>
        <View style={styles.contactItem}>
          <Text style={styles.label}>Response:</Text>
          <Text style={styles.value}>Within 24 hours</Text>
        </View>
      </View>

      <View style={styles.contactCard}>
        <Text style={styles.contactTitle}>Billing & Refunds</Text>
        <View style={styles.contactItem}>
          <Text style={styles.label}>Email:</Text>
          <TouchableOpacity onPress={() => Linking.openURL('mailto:mysocietydetails7@gmail.com')}>
            <Text style={styles.link}>billing@mysocietydetails.com</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.contactItem}>
          <Text style={styles.label}>Payment Issues:</Text>
          <TouchableOpacity onPress={() => Linking.openURL('mailto:mysocietydetails7@gmail.com')}>
            <Text style={styles.link}>refunds@mysocietydetails.com</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.contactItem}>
          <Text style={styles.label}>Hours:</Text>
          <Text style={styles.value}>Monday - Friday: 10 AM - 5 PM IST</Text>
        </View>
      </View>

      <View style={styles.contactCard}>
        <Text style={styles.contactTitle}>Technical Support</Text>
        <View style={styles.contactItem}>
          <Text style={styles.label}>Email:</Text>
          <TouchableOpacity onPress={() => Linking.openURL('mailto:mysocietydetails7@gmail.com')}>
            <Text style={styles.link}>tech@mysocietydetails.com</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.contactItem}>
          <Text style={styles.label}>Phone:</Text>
          <TouchableOpacity onPress={() => Linking.openURL('tel:+918454030860')}>
            <Text style={styles.link}>+91 84540 30860</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.contactCard}>
        <Text style={styles.contactTitle}>Contact Persons</Text>
        <View style={styles.contactItem}>
          <Text style={styles.label}>Bhavana</Text>
          <TouchableOpacity onPress={() => Linking.openURL('tel:+918454030860')}>
            <Text style={styles.link}>+91 84540 30860</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.contactItem}>
          <Text style={styles.label}>Nitu</Text>
          <TouchableOpacity onPress={() => Linking.openURL('tel:+917506166244')}>
            <Text style={styles.link}>+91 75061 66244</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.contactCard}>
        <Text style={styles.contactTitle}>Legal & Privacy</Text>
        <View style={styles.contactItem}>
          <Text style={styles.label}>Email:</Text>
          <TouchableOpacity onPress={() => Linking.openURL('mailto:mysocietydetails7@gmail.com')}>
            <Text style={styles.link}>legal@mysocietydetails.com</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.contactItem}>
          <Text style={styles.label}>Privacy:</Text>
          <TouchableOpacity onPress={() => Linking.openURL('mailto:privacy@mysocietydetails.com')}>
            <Text style={styles.link}>privacy@mysocietydetails.com</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Contact Persons</Text>
        <Text style={styles.bulletPoint}>Bhavana Shekhawat - +91 84540 30860</Text>
        <Text style={styles.bulletPoint}>Nitu Nathawat - +91 75061 66244</Text>
        <Text style={styles.infoText}>
          For quickest response, email us first. Phone support available for emergencies. Most issues resolved within 24 hours.
        </Text>
      </View>

      <View style={styles.faqSection}>
        <Text style={styles.faqTitle}>Frequently Asked Questions</Text>
        
        <FAQItem
          question="How long does it take to receive support?"
          answer="Most inquiries are responded to within 24 hours during business hours. Urgent technical issues may be prioritized."
          index={0}
        />
        
        <FAQItem
          question="Is support available on weekends?"
          answer="No, standard support is available Monday-Friday. However, urgent technical issues may be escalated for emergency support on weekends."
          index={1}
        />
        
        <FAQItem
          question="How do I request a refund?"
          answer="Please email refunds@mysocietydetails.com with your transaction ID and reason for the refund. See our Cancellation and Refunds Policy for more details."
          index={2}
        />
        
        <FAQItem
          question="Can I call instead of email?"
          answer="Email is preferred as it creates a documented record. Phone support can be arranged for critical issues - mention in your email."
          index={3}
        />
      </View>

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
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  contactCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  contactItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    flex: 0.35,
  },
  value: {
    fontSize: 13,
    color: '#6b7280',
    flex: 0.65,
    textAlign: 'right',
  },
  link: {
    fontSize: 13,
    color: '#2563eb',
    textDecorationLine: 'underline',
    flex: 0.65,
    textAlign: 'right',
  },
  infoCard: {
    backgroundColor: '#dbeafe',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#2563eb',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#1e40af',
    lineHeight: 20,
  },
  faqSection: {
    marginBottom: 16,
  },
  faqTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  faqItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#f3f4f6',
  },
  faqQuestion: {
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
    flex: 1,
  },
  faqIcon: {
    fontSize: 20,
    color: '#6b7280',
  },
  faqContent: {
    padding: 14,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  faqAnswer: {
    fontSize: 13,
    lineHeight: 20,
    color: '#374151',
  },
  footer: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
});
