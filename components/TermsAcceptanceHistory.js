import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  TouchableOpacity,
  Modal,
  Pressable
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

export default function TermsAcceptanceHistory({ userType }) {
  const [termsHistory, setTermsHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTerm, setSelectedTerm] = useState(null);
  const [termsContent, setTermsContent] = useState(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const { theme, isDarkMode } = useTheme();

  useEffect(() => {
    console.log('TermsAcceptanceHistory mounted with userType:', userType);
    loadTermsHistory();
  }, [userType]);

  const loadTermsHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get current user
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        throw new Error('Failed to get session: ' + sessionError.message);
      }

      if (!session?.user) {
        console.log('No authenticated user found');
        throw new Error('No authenticated user found');
      }

      console.log('Fetching terms history for user:', session.user.id, 'userType:', userType);

      // First, let's check if the terms_acceptance table exists and has the right structure
      const { data: tableInfo, error: tableError } = await supabase
        .from('terms_acceptance')
        .select('id, user_id, user_type, terms_version, accepted_at, ip_address, device_info')
        .limit(1);

      if (tableError) {
        console.error('Error checking table structure:', tableError);
        throw new Error('Failed to access terms acceptance table: ' + tableError.message);
      }

      console.log('Table structure check successful');

      // Now fetch the actual terms history
      const { data, error: fetchError } = await supabase
        .from('terms_acceptance')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('user_type', userType)
        .order('accepted_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching terms history:', fetchError);
        throw new Error('Failed to fetch terms history: ' + fetchError.message);
      }

      console.log('Terms history data received:', data);
      
      if (!data || data.length === 0) {
        console.log('No terms history found for user');
      } else {
        console.log('Found terms history entries:', data.length);
        data.forEach((term, index) => {
          console.log(`Term ${index + 1}:`, {
            version: term.terms_version,
            accepted_at: term.accepted_at,
            user_type: term.user_type
          });
        });
      }

      setTermsHistory(data || []);
    } catch (error) {
      console.error('Error in loadTermsHistory:', error);
      setError(error.message);
      Alert.alert(
        'Error',
        'Failed to load terms acceptance history: ' + error.message,
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTermPress = async (term) => {
    console.log('Term pressed:', term);
    setSelectedTerm(term);
    setLoadingContent(true);
    setTermsContent(null); // Reset content when selecting new term
    try {
      await loadTermsContent(term.terms_version);
    } catch (error) {
      console.error('Error in handleTermPress:', error);
    }
  };

  const loadTermsContent = async (version) => {
    try {
      console.log('Loading terms content for version:', version);
      setLoadingContent(true);
      setTermsContent(null);

      const { data, error: contentError } = await supabase
        .from('terms_versions')
        .select('content')
        .eq('version', version)
        .single();

      console.log('Terms content query result:', { data, error: contentError });

      if (contentError) {
        console.error('Error fetching terms content:', contentError);
        throw new Error('Failed to load terms content: ' + contentError.message);
      }

      if (!data) {
        console.log('No terms content found for version:', version);
        throw new Error('Terms content not found for version ' + version);
      }

      console.log('Terms content loaded successfully:', data.content);
      setTermsContent(data.content);
    } catch (error) {
      console.error('Error loading terms content:', error);
      Alert.alert('Error', error.message);
      setTermsContent(null);
    } finally {
      setLoadingContent(false);
    }
  };

  const closeModal = () => {
    setSelectedTerm(null);
    setTermsContent(null);
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
          Loading terms history...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.errorContainer}>
          <Ionicons 
            name="alert-circle-outline" 
            size={48} 
            color={theme.error} 
          />
          <Text style={[styles.errorText, { color: theme.error }]}>
            {error}
          </Text>
          <TouchableOpacity 
            style={[styles.retryButton, { backgroundColor: theme.primary }]}
            onPress={loadTermsHistory}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (termsHistory.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.emptyContainer}>
          <Ionicons 
            name="document-text-outline" 
            size={48} 
            color={theme.textSecondary} 
          />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No terms acceptance history found
          </Text>
          <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
            You haven't accepted any terms yet
          </Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <ScrollView 
        style={[styles.container, { backgroundColor: theme.background }]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>
            Terms Acceptance History
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            View your terms and conditions acceptance history
          </Text>
        </View>

        {termsHistory.map((term, index) => (
          <TouchableOpacity 
            key={term.id}
            style={[
              styles.termCard,
              { 
                backgroundColor: theme.card,
                borderColor: theme.border,
                marginTop: index === 0 ? 0 : 12
              }
            ]}
            onPress={() => handleTermPress(term)}
            activeOpacity={0.7}
          >
            <View style={styles.termHeader}>
              <View style={styles.versionContainer}>
                <View style={[styles.versionBadge, { backgroundColor: theme.primary + '20' }]}>
                  <Ionicons name="document-text" size={14} color={theme.primary} />
                  <Text style={[styles.version, { color: theme.primary }]}>
                    v{term.terms_version}
                  </Text>
                </View>
                <Text style={[styles.date, { color: theme.textSecondary }]}>
                  {formatDate(term.accepted_at)}
                </Text>
              </View>
              <Ionicons 
                name="chevron-forward" 
                size={16} 
                color={theme.textSecondary}
                style={styles.chevron}
              />
            </View>

            <View style={styles.detailsContainer}>
              <View style={styles.detailRow}>
                <Ionicons name="globe-outline" size={14} color={theme.textSecondary} />
                <Text style={[styles.detailText, { color: theme.textSecondary }]} numberOfLines={1}>
                  {term.ip_address || 'IP not recorded'}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="phone-portrait-outline" size={14} color={theme.textSecondary} />
                <Text style={[styles.detailText, { color: theme.textSecondary }]} numberOfLines={1}>
                  {term.device_info || 'Device info not recorded'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {selectedTerm && (
        <Modal
          visible={true}
          animationType="slide"
          transparent={true}
          onRequestClose={closeModal}
          statusBarTranslucent
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
              <View style={[styles.modalHeader, { 
                borderBottomColor: theme.border,
                backgroundColor: theme.background 
              }]}>
                <View style={styles.modalTitleContainer}>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>
                    Terms & Conditions
                  </Text>
                  <View style={[styles.versionBadge, { backgroundColor: theme.primary + '20' }]}>
                    <Text style={[styles.modalVersion, { color: theme.primary }]}>
                      v{selectedTerm.terms_version}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity 
                  style={styles.closeButton}
                  onPress={closeModal}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={24} color={theme.text} />
                </TouchableOpacity>
              </View>

              <View style={[styles.modalBody, { backgroundColor: theme.background }]}>
                {loadingContent ? (
                  <View style={styles.contentLoading}>
                    <ActivityIndicator size="large" color={theme.primary} />
                    <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                      Loading terms content...
                    </Text>
                  </View>
                ) : termsContent ? (
                  <ScrollView 
                    style={[styles.modalScroll, { backgroundColor: theme.background }]}
                    contentContainerStyle={styles.modalScrollContent}
                    showsVerticalScrollIndicator={true}
                  >
                    <View style={styles.termsContentContainer}>
                      <Text style={[styles.termsContent, { color: theme.text }]}>
                        {termsContent}
                      </Text>
                    </View>
                  </ScrollView>
                ) : (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle-outline" size={48} color={theme.error} />
                    <Text style={[styles.errorText, { color: theme.error }]}>
                      Failed to load terms content
                    </Text>
                    <TouchableOpacity 
                      style={[styles.retryButton, { backgroundColor: theme.primary }]}
                      onPress={() => loadTermsContent(selectedTerm.terms_version)}
                    >
                      <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  loadingText: {
    marginTop: 12,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    marginTop: 12,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  termCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  termHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  versionContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  versionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  version: {
    fontSize: 13,
    fontWeight: '600',
  },
  date: {
    fontSize: 13,
  },
  chevron: {
    marginLeft: 8,
  },
  detailsContainer: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    width: '100%',
    height: '80%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  modalHeader: {
    padding: 16,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 1,
  },
  modalBody: {
    flex: 1,
    height: '100%',
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 16,
    flexGrow: 1,
  },
  contentLoading: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  termsContentContainer: {
    flex: 1,
    paddingBottom: 24,
  },
  termsContent: {
    fontSize: 15,
    lineHeight: 24,
  },
  modalTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalVersion: {
    fontSize: 13,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
    marginLeft: 8,
  },
}); 