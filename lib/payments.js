import { supabase } from './supabase'
import { Alert } from 'react-native'

// Function to create a payment order
export const createPaymentOrder = async (billId) => {
  try {
    // Create payment record in database
    const { data, error } = await supabase.rpc('api_create_payment_order', {
      bill_id: billId,
    })

    if (error) throw error

    if (!data.success) {
      throw new Error(data.message)
    }

    // Create Razorpay order through Edge Function
    const functionUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/razorpay-payment`;
    console.log('Calling Edge Function URL:', functionUrl);
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        action: 'create_order',
        payment_id: data.payment_id,
        society_id: data.society_id,
        amount: data.amount,
        currency: data.currency,
      }),
    })

    const orderData = await response.json()

    if (!orderData.success) {
      throw new Error(orderData.error)
    }

    return {
      ...data,
      order_id: orderData.order_id,
    }
  } catch (error) {
    console.error('Error creating payment order:', error)
    Alert.alert('Error', error.message)
    throw error
  }
}

// Function to verify payment
export const verifyPayment = async (paymentId, societyId, razorpayResponse) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = razorpayResponse

    // Verify payment through Edge Function
    const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/razorpay-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        action: 'verify_payment',
        payment_id: paymentId,
        society_id: societyId,
        razorpay_payment_id,
        razorpay_order_id,
        razorpay_signature,
      }),
    })

    const verifyData = await response.json()

    if (!verifyData.success) {
      throw new Error(verifyData.error)
    }

    // Update payment status in database
    const { data, error } = await supabase.rpc('api_verify_payment', {
      payment_id: paymentId,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
    })

    if (error) throw error

    if (!data.success) {
      throw new Error(data.message)
    }

    return data
  } catch (error) {
    console.error('Error verifying payment:', error)
    Alert.alert('Error', error.message)
    throw error
  }
}

// Function to initiate refund
export const initiateRefund = async (paymentId, refundAmount, refundReason) => {
  try {
    // Get payment details
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('society_id')
      .eq('id', paymentId)
      .single()

    if (paymentError) throw paymentError

    // Process refund through Edge Function
    const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/razorpay-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        action: 'refund',
        payment_id: paymentId,
        society_id: payment.society_id,
        refund_amount: refundAmount,
        refund_reason: refundReason,
      }),
    })

    const refundData = await response.json()

    if (!refundData.success) {
      throw new Error(refundData.error)
    }

    // Update payment status in database
    const { data, error } = await supabase.rpc('api_initiate_refund', {
      payment_id: paymentId,
      refund_amount: refundAmount,
      refund_reason: refundReason,
    })

    if (error) throw error

    if (!data.success) {
      throw new Error(data.message)
    }

    return data
  } catch (error) {
    console.error('Error initiating refund:', error)
    Alert.alert('Error', error.message)
    throw error
  }
}

// Function to get payment history for a resident
export const getPaymentHistory = async (residentId) => {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        maintenance_bills (
          id,
          month_year,
          total_amount,
          status
        )
      `)
      .eq('resident_id', residentId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return data
  } catch (error) {
    console.error('Error fetching payment history:', error)
    Alert.alert('Error', 'Failed to fetch payment history')
    throw error
  }
}

// Function to get payment history for a society (admin view)
export const getSocietyPayments = async (societyId) => {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        residents (
          id,
          flat_number,
          user:user_id (
            id,
            email,
            full_name
          )
        ),
        maintenance_bills (
          id,
          month_year,
          total_amount,
          status
        )
      `)
      .eq('society_id', societyId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return data
  } catch (error) {
    console.error('Error fetching society payments:', error)
    Alert.alert('Error', 'Failed to fetch payment history')
    throw error
  }
}

// Function to create Razorpay account for a society (superadmin only)
export const createRazorpayAccount = async (societyId, accountId, keyId, keySecret) => {
  try {
    const { data, error } = await supabase.rpc('api_create_razorpay_account', {
      society_id: societyId,
      account_id: accountId,
      key_id: keyId,
      key_secret: keySecret,
    })

    if (error) throw error

    if (!data.success) {
      throw new Error(data.message)
    }

    return data
  } catch (error) {
    console.error('Error creating Razorpay account:', error)
    Alert.alert('Error', error.message)
    throw error
  }
}

// Function to get payment receipt from Razorpay
export const getPaymentReceipt = async (paymentId, societyId) => {
  try {
    const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/razorpay-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        action: 'get_receipt',
        payment_id: paymentId,
        society_id: societyId,
      }),
    })

    const receiptData = await response.json()

    if (!receiptData.success) {
      throw new Error(receiptData.error)
    }

    return receiptData.receipt
  } catch (error) {
    console.error('Error fetching payment receipt:', error)
    Alert.alert('Error', error.message || 'Failed to get receipt')
    throw error
  }
} 