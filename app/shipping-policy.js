import React, { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function ShippingPolicyScreen() {
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
        <Text style={styles.title}>Shipping Policy</Text>
      </View>

      <Section title="1. Scope" index={0}>
        <Text style={styles.text}>
          This Shipping Policy applies to physical goods delivered through MySocietyDetails, 
          including resident documents, printed materials, or merchandise ordered through our platform.
        </Text>
      </Section>

      <Section title="2. Shipping Methods" index={1}>
        <Text style={styles.bulletPoint}>• Standard Delivery: 5-7 business days (Included)</Text>
        <Text style={styles.bulletPoint}>• Express Delivery: 2-3 business days (Additional charge)</Text>
        <Text style={styles.bulletPoint}>• Same Day Delivery: Available in select areas (Additional charge)</Text>
        <Text style={styles.bulletPoint}>• In-Society Pickup: Free at reception (where applicable)</Text>
      </Section>

      <Section title="3. Processing Time" index={2}>
        <Text style={styles.text}>
          Orders are processed within 1-2 business days. Processing time does not include 
          shipping time. We do not process orders on weekends and public holidays.
        </Text>
      </Section>

      <Section title="4. Shipping Costs" index={3}>
        <Text style={styles.bulletPoint}>• Mumbai: Free delivery for orders above ₹500</Text>
        <Text style={styles.bulletPoint}>• Across India: Based on weight and distance</Text>
        <Text style={styles.bulletPoint}>• International: Available on request</Text>
        <Text style={styles.bulletPoint}>• Bulk deliveries: Special rates available</Text>
      </Section>

      <Section title="5. Delivery Address" index={4}>
        <Text style={styles.text}>
          Ensure your delivery address is complete and accurate. We deliver to:
        </Text>
        <Text style={styles.bulletPoint}>• Your registered society address</Text>
        <Text style={styles.bulletPoint}>• Alternate addresses within the city (with approval)</Text>
        <Text style={styles.bulletPoint}>• Society reception/office during business hours</Text>
      </Section>

      <Section title="6. Tracking" index={5}>
        <Text style={styles.text}>
          Every shipment comes with a tracking number. You can track your order through:
        </Text>
        <Text style={styles.bulletPoint}>• Your account dashboard</Text>
        <Text style={styles.bulletPoint}>• Email notifications (automatic)</Text>
        <Text style={styles.bulletPoint}>• SMS updates (optional)</Text>
        <Text style={styles.bulletPoint}>• Third-party courier tracking</Text>
      </Section>

      <Section title="7. Delivery Delays" index={6}>
        <Text style={styles.text}>
          We make every effort to deliver on time. However, delays may occur due to weather, 
          courier delays, address issues, or force majeure events.
        </Text>
        <Text style={styles.text}>
          In case of delays exceeding 5 business days, contact us for compensation.
        </Text>
      </Section>

      <Section title="8. Damaged or Lost Items" index={7}>
        <Text style={styles.bulletPoint}>1. Report within 24 hours of receipt</Text>
        <Text style={styles.bulletPoint}>2. Provide photos of damaged packaging/item</Text>
        <Text style={styles.bulletPoint}>3. File a claim with our support team</Text>
        <Text style={styles.bulletPoint}>4. We will replace or refund the item</Text>
      </Section>

      <Section title="9. Signature Requirements" index={8}>
        <Text style={styles.text}>
          High-value items may require signature on delivery. The recipient must be available 
          to sign. If unavailable, provide written authorization for an alternate recipient.
        </Text>
      </Section>

      <Section title="10. Return Shipping" index={9}>
        <Text style={styles.bulletPoint}>• Contact us for return authorization</Text>
        <Text style={styles.bulletPoint}>• Return shipping may be free or paid (depending on reason)</Text>
        <Text style={styles.bulletPoint}>• We provide return label/courier pickup</Text>
        <Text style={styles.bulletPoint}>• Refund issued after inspection (7-10 days)</Text>
      </Section>

      <Section title="11. Special Requests" index={10}>
        <Text style={styles.text}>We accommodate special shipping requests:</Text>
        <Text style={styles.bulletPoint}>• Specific time window delivery</Text>
        <Text style={styles.bulletPoint}>• Weekend/holiday delivery (premium charge)</Text>
        <Text style={styles.bulletPoint}>• White glove service (where available)</Text>
        <Text style={styles.bulletPoint}>• Scheduled recurring deliveries</Text>
        <Text style={styles.text}>Contact billing@mysocietydetails.com for special requests.</Text>
      </Section>

      <Section title="12. Contact Us" index={11}>
        <Text style={styles.text}>For shipping questions, contact:</Text>
        <Text style={styles.bulletPoint}>Email: shipping@mysocietydetails.com</Text>
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
