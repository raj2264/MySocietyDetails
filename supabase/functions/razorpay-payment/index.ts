import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// We'll call Razorpay REST API directly to avoid runtime SDK issues

// Helper function for HMAC SHA256 and Razorpay order creation
async function createHmacSignature(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse request body with better error handling
    let body
    try {
      body = await req.json()
      console.log('FULL REQUEST BODY:', JSON.stringify(body), 'TYPES:', Object.fromEntries(Object.entries(body).map(([k,v])=>[k,typeof v])))
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError)
      throw new Error('Invalid JSON in request body')
    }

    // Force amount to integer and log
    if (body && body.amount !== undefined) {
      const originalAmount = body.amount;
      let coercedAmount = Number(originalAmount);
      if (!Number.isFinite(coercedAmount)) {
        console.error('Amount is not a number:', originalAmount);
        return new Response(JSON.stringify({ success: false, error: 'Amount is not a number', received: originalAmount }), { status: 400, headers: corsHeaders });
      }
      coercedAmount = Math.round(coercedAmount * 100);
      console.log('Coerced amountPaise:', coercedAmount, 'from original:', originalAmount);
      if (!Number.isInteger(coercedAmount) || coercedAmount <= 0) {
        console.error('Amount must be a positive integer (paise):', coercedAmount);
        return new Response(JSON.stringify({ success: false, error: 'Amount must be a positive integer (paise)', received: originalAmount, coerced: coercedAmount }), { status: 400, headers: corsHeaders });
      }
      body.amount = coercedAmount;
    }

    const { action, payment_id, society_id, amount, currency = 'INR', refund_amount, refund_reason } = body

    if (!action) {
      throw new Error('Missing action parameter')
    }
    if (!society_id) {
      throw new Error('Missing society_id parameter')
    }

    console.log(`Processing action: ${action} for society: ${society_id}`)

    // Get Razorpay account details for the society
    const { data: razorpayAccount, error: accountError } = await supabaseClient
      .from('razorpay_accounts')
      .select('*')
      .eq('society_id', society_id)
      .eq('is_active', true)
      .single()

    if (accountError || !razorpayAccount) {
      console.error('Account error:', accountError)
      throw new Error('Razorpay account not found for society')
    }

    // Prepare Razorpay auth helper
    const rpAuth = 'Basic ' + btoa(`${razorpayAccount.key_id}:${razorpayAccount.key_secret}`)

    async function createRazorpayOrder(amountValue: number, currencyValue: string, receipt: string) {
      const res = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: rpAuth,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount: amountValue, currency: currencyValue, receipt }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error('Razorpay API error: ' + (json?.error?.description || JSON.stringify(json)))
      }
      return json
    }

    async function fetchRazorpayPayment(paymentId: string) {
      const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
        method: 'GET',
        headers: { Authorization: rpAuth },
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error('Razorpay API error: ' + JSON.stringify(json))
      }
      return json
    }

    async function refundRazorpayPayment(paymentId: string, amountValue: number, notes?: Record<string, string>) {
      const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
        method: 'POST',
        headers: {
          Authorization: rpAuth,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount: amountValue, notes }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error('Razorpay API error: ' + JSON.stringify(json))
      }
      return json
    }

    switch (action) {
      case 'create_order': {
        // Validate inputs
        console.log('create_order input:', { payment_id, amount, currency })
        if (!payment_id) {
          throw new Error('Missing payment_id for create_order')
        }
        if (typeof amount !== 'number') {
          throw new Error('Invalid or missing amount for create_order')
        }

        // amount is already converted to paise at the top of the function
        const amountPaise = amount;
        console.log('Sending amountPaise to Razorpay:', amountPaise);

        // Create Razorpay order using REST API (positional args: amount, currency, receipt)
        let order
        try {
          order = await createRazorpayOrder(amountPaise, currency, payment_id)
        } catch (rpErr) {
          console.error('Razorpay order creation failed:', rpErr)
          throw new Error('Razorpay order creation failed: ' + (rpErr?.message || String(rpErr)))
        }

        // Update payment record with order ID
        const { error: updateError } = await supabaseClient
          .from('payments')
          .update({ razorpay_order_id: order.id })
          .eq('id', payment_id)

        if (updateError) {
          throw new Error('Failed to update payment record')
        }

        return new Response(
          JSON.stringify({
            success: true,
            order_id: order.id,
            amount: order.amount,
            currency: order.currency,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      case 'verify_payment': {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = body

        // Verify payment signature
        const signaturePayload = razorpay_order_id + '|' + razorpay_payment_id
        const expectedSignature = await createHmacSignature(signaturePayload, razorpayAccount.key_secret)

        if (expectedSignature !== razorpay_signature) {
          throw new Error('Invalid payment signature')
        }

        // Verify payment status with Razorpay
        const payment = await fetchRazorpayPayment(razorpay_payment_id)
        if (payment.status !== 'captured') {
          throw new Error('Payment not captured')
        }

        // Update payment record
        const { error: updateError } = await supabaseClient
          .from('payments')
          .update({
            razorpay_payment_id,
            razorpay_order_id,
            razorpay_signature,
            status: 'completed',
            completed_at: new Date().toISOString(),
            payment_method: 'razorpay',
            payment_details: {
              razorpay_payment_id,
              razorpay_order_id,
            },
          })
          .eq('id', payment_id)

        if (updateError) {
          throw new Error('Failed to update payment record')
        }

        // Update bill status
        const { data: paymentData } = await supabaseClient
          .from('payments')
          .select('bill_id')
          .eq('id', payment_id)
          .single()

        if (paymentData) {
          const { error: billError } = await supabaseClient
            .from('maintenance_bills')
            .update({ status: 'paid' })
            .eq('id', paymentData.bill_id)

          if (billError) {
            throw new Error('Failed to update bill status')
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Payment verified successfully',
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      case 'refund': {
        // Get payment details
        const { data: payment, error: paymentError } = await supabaseClient
          .from('payments')
          .select('*')
          .eq('id', payment_id)
          .single()

        if (paymentError || !payment) {
          throw new Error('Payment not found')
        }

        // Process refund through Razorpay
        const refund = await refundRazorpayPayment(payment.razorpay_payment_id, Math.round(refund_amount * 100), {
          reason: refund_reason,
        })

        // Update payment record
        const { error: updateError } = await supabaseClient
          .from('payments')
          .update({
            status: 'refunded',
            refunded_at: new Date().toISOString(),
            refund_amount: refund_amount,
            refund_reason: refund_reason,
            payment_details: {
              ...payment.payment_details,
              refund_id: refund.id,
            },
          })
          .eq('id', payment_id)

        if (updateError) {
          throw new Error('Failed to update payment record')
        }

        // Update bill status
        const { error: billError } = await supabaseClient
          .from('maintenance_bills')
          .update({ status: 'refunded' })
          .eq('id', payment.bill_id)

        if (billError) {
          throw new Error('Failed to update bill status')
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Refund processed successfully',
            refund_id: refund.id,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      case 'get_receipt': {
        // Get payment details from database with joins
        const { data: paymentData, error: paymentError } = await supabaseClient
          .from('payments')
          .select(`
            *,
            residents (
              id,
              name,
              email,
              phone,
              unit_number
            ),
            maintenance_bills (
              id,
              month_year,
              total_amount,
              status,
              due_date
            ),
            societies (
              id,
              name,
              address
            )
          `)
          .eq('id', payment_id)
          .eq('society_id', society_id)
          .single()

        if (paymentError || !paymentData) {
          console.error('Payment not found:', paymentError)
          throw new Error('Payment not found')
        }

        if (paymentData.status !== 'completed') {
          throw new Error('Receipt available only for completed payments')
        }

        // Fetch payment details from Razorpay for additional info
        let razorpayDetails = null
        if (paymentData.razorpay_payment_id) {
          try {
            razorpayDetails = await fetchRazorpayPayment(paymentData.razorpay_payment_id)
          } catch (rpErr) {
            console.warn('Could not fetch Razorpay details:', rpErr)
          }
        }

        // Format receipt data
        const receiptData = {
          receipt_number: `RCP-${paymentData.id.slice(0, 8).toUpperCase()}`,
          payment_id: paymentData.id,
          razorpay_payment_id: paymentData.razorpay_payment_id,
          razorpay_order_id: paymentData.razorpay_order_id,
          
          // Payment info
          amount: paymentData.amount,
          currency: paymentData.currency || 'INR',
          status: paymentData.status,
          payment_method: razorpayDetails?.method || paymentData.payment_method || 'Online',
          payment_date: paymentData.completed_at,
          payment_details: paymentData.payment_details, // Include manual payment details (transaction_id, notes)
          
          // Razorpay additional details
          card_last4: razorpayDetails?.card?.last4 || null,
          card_network: razorpayDetails?.card?.network || null,
          bank: razorpayDetails?.bank || null,
          wallet: razorpayDetails?.wallet || null,
          vpa: razorpayDetails?.vpa || null,
          
          // Resident info
          resident: {
            name: paymentData.residents?.name,
            email: paymentData.residents?.email,
            phone: paymentData.residents?.phone,
            unit_number: paymentData.residents?.unit_number,
          },
          
          // Bill info
          bill: {
            month_year: paymentData.maintenance_bills?.month_year,
            total_amount: paymentData.maintenance_bills?.total_amount,
            due_date: paymentData.maintenance_bills?.due_date,
          },
          
          // Society info  
          society: {
            name: paymentData.societies?.name,
            address: paymentData.societies?.address,
          },
        }

        return new Response(
          JSON.stringify({
            success: true,
            receipt: receiptData,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      default:
        throw new Error('Invalid action')
    }
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
}) 