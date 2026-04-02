import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { createRazorpayAccount } from '../lib/payments'
import { useTheme } from '../context/ThemeContext'

export default function RazorpayAccountsScreen() {
  const { theme, isDarkMode } = useTheme()
  const [societies, setSocieties] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedSociety, setSelectedSociety] = useState(null)
  const [accountId, setAccountId] = useState('')
  const [keyId, setKeyId] = useState('')
  const [keySecret, setKeySecret] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadSocieties()
  }, [])

  const loadSocieties = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('societies')
        .select(`
          *,
          razorpay_accounts (
            id,
            account_id,
            key_id,
            is_active,
            created_at
          )
        `)
        .order('name')

      if (error) throw error

      setSocieties(data)
    } catch (error) {
      console.error('Error loading societies:', error)
      Alert.alert('Error', 'Failed to load societies')
    } finally {
      setLoading(false)
    }
  }

  const handleAddAccount = async () => {
    if (!selectedSociety) {
      Alert.alert('Error', 'Please select a society')
      return
    }

    if (!accountId || !keyId || !keySecret) {
      Alert.alert('Error', 'Please fill in all fields')
      return
    }

    try {
      setSubmitting(true)
      await createRazorpayAccount(
        selectedSociety.id,
        accountId,
        keyId,
        keySecret
      )

      Alert.alert('Success', 'Razorpay account created successfully')
      setModalVisible(false)
      resetForm()
      loadSocieties()
    } catch (error) {
      console.error('Error creating Razorpay account:', error)
      Alert.alert('Error', error.message)
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setSelectedSociety(null)
    setAccountId('')
    setKeyId('')
    setKeySecret('')
  }

  const renderSocietyItem = ({ item }) => {
    const hasAccount = item.razorpay_accounts && item.razorpay_accounts.length > 0
    const account = hasAccount ? item.razorpay_accounts[0] : null

    return (
      <View style={[styles.societyItem, { backgroundColor: theme.cardBackground }]}>
        <View style={styles.societyInfo}>
          <Text style={[styles.societyName, { color: theme.text }]}>
            {item.name}
          </Text>
          <Text style={[styles.societyAddress, { color: theme.textSecondary }]}>
            {item.address}
          </Text>
          {hasAccount && (
            <View style={styles.accountInfo}>
              <Text style={[styles.accountLabel, { color: theme.textSecondary }]}>
                Account ID: {account.account_id}
              </Text>
              <Text style={[styles.accountLabel, { color: theme.textSecondary }]}>
                Key ID: {account.key_id}
              </Text>
              <Text style={[styles.accountLabel, { color: theme.textSecondary }]}>
                Status: {account.is_active ? 'Active' : 'Inactive'}
              </Text>
              <Text style={[styles.accountLabel, { color: theme.textSecondary }]}>
                Created: {new Date(account.created_at).toLocaleDateString()}
              </Text>
            </View>
          )}
        </View>
        {!hasAccount && (
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: theme.primary }]}
            onPress={() => {
              setSelectedSociety(item)
              setModalVisible(true)
            }}
          >
            <Ionicons name="add-circle-outline" size={24} color="white" />
            <Text style={styles.addButtonText}>Add Account</Text>
          </TouchableOpacity>
        )}
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        data={societies}
        renderItem={renderSocietyItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshing={loading}
        onRefresh={loadSocieties}
      />

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setModalVisible(false)
          resetForm()
        }}
      >
        <View style={[styles.modalOverlay, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.02)' }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Add Razorpay Account
            </Text>
            {selectedSociety && (
              <Text style={[styles.selectedSociety, { color: theme.textSecondary }]}>
                Society: {selectedSociety.name}
              </Text>
            )}

            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.inputBackground,
                color: theme.text,
                borderColor: theme.border,
              }]}
              placeholder="Account ID"
              placeholderTextColor={theme.textSecondary}
              value={accountId}
              onChangeText={setAccountId}
            />

            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.inputBackground,
                color: theme.text,
                borderColor: theme.border,
              }]}
              placeholder="Key ID"
              placeholderTextColor={theme.textSecondary}
              value={keyId}
              onChangeText={setKeyId}
            />

            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.inputBackground,
                color: theme.text,
                borderColor: theme.border,
              }]}
              placeholder="Key Secret"
              placeholderTextColor={theme.textSecondary}
              value={keySecret}
              onChangeText={setKeySecret}
              secureTextEntry
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.error }]}
                onPress={() => {
                  setModalVisible(false)
                  resetForm()
                }}
                disabled={submitting}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalButton,
                  { backgroundColor: theme.primary },
                  submitting && styles.disabledButton,
                ]}
                onPress={handleAddAccount}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.modalButtonText}>Add Account</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  societyItem: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  societyInfo: {
    flex: 1,
  },
  societyName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  societyAddress: {
    fontSize: 14,
    marginBottom: 8,
  },
  accountInfo: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  accountLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  addButtonText: {
    color: 'white',
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    borderRadius: 8,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  selectedSociety: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.7,
  },
}) 