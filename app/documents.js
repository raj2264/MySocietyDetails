import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Platform, Linking, Share } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import AppLayout from '../components/AppLayout';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import { openFileLocally } from '../utils/file-opener';
import useNoStuckLoading from '../hooks/useNoStuckLoading';

export default function Documents() {
  const { theme, isDarkMode } = useTheme();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  useNoStuckLoading(loading, setLoading);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState({});
  const [sharing, setSharing] = useState({});

  useEffect(() => {
    fetchDocuments();
    // Request permissions for saving files
    (async () => {
      if (Platform.OS === 'android') {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permission Required',
            'Please grant storage permission to download documents.',
            [{ text: 'OK' }]
          );
        }
      }
    })();
  }, []);

  const fetchDocuments = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      const { data, error } = await supabase
        .from('essential_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      Alert.alert('Error', 'Failed to fetch documents');
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDocuments(false);
    setRefreshing(false);
  };

  const getSignedUrl = async (document) => {
    const { data, error } = await supabase.storage
      .from('essential-documents')
      .createSignedUrl(document.file_path, 60);

    if (error) throw error;
    if (!data?.signedUrl) throw new Error('No signed URL available');
    return data.signedUrl;
  };

  const handleViewDocument = async (document) => {
    try {
      const signedUrl = await getSignedUrl(document);
      const fileName = sanitizeFileName(document.name);
      await openFileLocally(signedUrl, { fileName, mimeType: 'application/pdf' });
    } catch (error) {
      console.error('Error viewing document:', error);
      Alert.alert('Error', 'Failed to open document');
    }
  };

  const ensurePdfExtension = (filename) => {
    // Remove any existing extension
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    // Add .pdf extension
    return `${nameWithoutExt}.pdf`;
  };

  const sanitizeFileName = (filename) => {
    // Remove any existing extension and sanitize the name
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    // Replace invalid characters with underscore
    const sanitized = nameWithoutExt.replace(/[^a-zA-Z0-9-_]/g, '_');
    // Add .pdf extension
    return `${sanitized}.pdf`;
  };

  const handleDownload = async (document) => {
    if (downloading[document.id]) return;

    setDownloading(prev => ({ ...prev, [document.id]: true }));
    try {
      const signedUrl = await getSignedUrl(document);
      const fileName = sanitizeFileName(document.name);

      if (Platform.OS === 'android') {
        // For Android, use the native file picker intent
        const intent = await IntentLauncher.startActivityAsync('android.intent.action.CREATE_DOCUMENT', {
          type: 'application/pdf',
          initialUri: fileName,
          // Use numeric flags instead of constants
          flags: [1, 2] // FLAG_GRANT_READ_URI_PERMISSION = 1, FLAG_GRANT_WRITE_URI_PERMISSION = 2
        });

        if (intent.resultCode === IntentLauncher.ActivityResultCode.OK && intent.data) {
          // Download to the selected location
          const downloadResult = await FileSystem.downloadAsync(signedUrl, intent.data);
          
          if (downloadResult.status === 200) {
            Alert.alert(
              'Success',
              'Document downloaded successfully',
              [
                {
                  text: 'Open',
                  onPress: () => handleViewDocument(document)
                },
                { text: 'OK' }
              ]
            );
          } else {
            throw new Error('Download failed');
          }
        } else {
          throw new Error('No location selected');
        }
      } else {
        // For iOS, use document picker to choose save location
        const result = await DocumentPicker.getDocumentAsync({
          type: 'application/pdf',
          copyToCacheDirectory: false,
          multiple: false,
          mode: 'save',
          suggestedFileName: fileName
        });

        if (result.type === 'success') {
          const downloadResult = await FileSystem.downloadAsync(signedUrl, result.uri);
          
          if (downloadResult.status === 200) {
            Alert.alert(
              'Success',
              'Document downloaded successfully',
              [
                {
                  text: 'Open',
                  onPress: () => handleViewDocument(document)
                },
                { text: 'OK' }
              ]
            );
          } else {
            throw new Error('Download failed');
          }
        }
      }
    } catch (error) {
      console.error('Error downloading document:', error);
      Alert.alert(
        'Error',
        'Failed to download document: ' + error.message
      );
    } finally {
      setDownloading(prev => ({ ...prev, [document.id]: false }));
    }
  };

  const handleShare = async (document) => {
    if (sharing[document.id]) return;

    setSharing(prev => ({ ...prev, [document.id]: true }));
    try {
      const signedUrl = await getSignedUrl(document);
      const fileName = sanitizeFileName(document.name);
      
      // Download to temp location first
      const tempUri = FileSystem.cacheDirectory + fileName;
      const downloadResult = await FileSystem.downloadAsync(signedUrl, tempUri);
      
      if (downloadResult.status === 200) {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(tempUri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Share Document',
            UTI: 'com.adobe.pdf'
          });
        } else {
          Alert.alert('Error', 'Sharing is not available on this device');
        }
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      console.error('Error sharing document:', error);
      Alert.alert(
        'Error',
        'Failed to share document: ' + error.message
      );
    } finally {
      setSharing(prev => ({ ...prev, [document.id]: false }));
    }
  };

  const renderDocument = ({ item }) => (
    <View style={[styles.documentCard, { backgroundColor: isDarkMode ? '#1C1C1E' : '#FFFFFF' }]}>
      <TouchableOpacity 
        style={styles.documentMain}
        onPress={() => handleViewDocument(item)}
      >
        <View style={[styles.documentIcon, { backgroundColor: isDarkMode ? '#2C2C2E' : '#F2F2F7' }]}>
          <Ionicons name="document-text-outline" size={24} color={theme.primary} />
        </View>
        <View style={styles.documentInfo}>
          <Text style={[styles.documentName, { color: isDarkMode ? '#FFFFFF' : '#000000' }]}>{item.name}</Text>
          <Text style={[styles.documentDate, { color: isDarkMode ? '#8E8E93' : '#6C6C70' }]}>
            Uploaded on {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={isDarkMode ? '#8E8E93' : '#6C6C70'} />
      </TouchableOpacity>
      
      <View style={[styles.actionButtons, { borderTopColor: isDarkMode ? '#2C2C2E' : '#E5E5EA' }]}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: isDarkMode ? '#2C2C2E' : '#F2F2F7' }]}
          onPress={() => handleViewDocument(item)}
        >
          <Ionicons name="eye-outline" size={18} color={theme.primary} />
          <Text style={[styles.actionButtonText, { color: theme.primary }]}>View</Text>
        </TouchableOpacity>

        <View style={[styles.actionDivider, { backgroundColor: isDarkMode ? '#2C2C2E' : '#E5E5EA' }]} />

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: isDarkMode ? '#2C2C2E' : '#F2F2F7' }]}
          onPress={() => handleShare(item)}
          disabled={sharing[item.id]}
        >
          {sharing[item.id] ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <>
              <Ionicons name="share-outline" size={18} color={theme.primary} />
              <Text style={[styles.actionButtonText, { color: theme.primary }]}>Share</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <AppLayout>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <View style={styles.container}>
        <Text style={[styles.title, { color: theme.text }]}>
          Essential Documents
        </Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Access important society documents
        </Text>

        <FlatList
          data={documents}
          renderItem={renderDocument}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name="document-text-outline"
                size={48}
                color={theme.textSecondary}
              />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No documents available
              </Text>
            </View>
          }
        />
      </View>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
  },
  list: {
    flexGrow: 1,
  },
  documentCard: {
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  documentMain: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  documentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  documentDate: {
    fontSize: 13,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    borderTopWidth: 1,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  actionDivider: {
    width: 1,
    height: '100%',
  },
}); 