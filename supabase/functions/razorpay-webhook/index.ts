// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import crypto from 'https://esm.sh/crypto@1.0.1'

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

    const body = await req.json()
    const { event, payload } = body

    // Get webhook secret from environment
    const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')

    if (!webhookSecret) {
      console.warn('Webhook secret not configured')
    }

    console.log(`Received webhook event: ${event}`)

    switch (event) {
      case 'payment.authorized': {
        // Payment has been successfully authorized/captured
        const paymentId = payload.payment?.id
        const orderId = payload.payment?.order_id
        const amount = payload.payment?.amount

        console.log(`Payment authorized: ${paymentId}`)

        // Update payment status in database
        const { error: updateError } = await supabaseClient
          .from('payments')
          .update({
            status: 'completed',
            razorpay_payment_id: paymentId,
            razorpay_order_id: orderId,
            completed_at: new Date().toISOString(),
          })
          .eq('razorpay_order_id', orderId)

        if (updateError) {
          throw new Error(`Failed to update payment: ${updateError.message}`)
        }

        // Fetch the updated payment to get bill_id
        const { data: payment, error: fetchError } = await supabaseClient
          .from('payments')
          .select('bill_id, resident_id, amount')
          .eq('razorpay_payment_id', paymentId)
          .single()

        if (fetchError || !payment) {
          throw new Error('Payment record not found')
        }

        // Update bill status
        const { data: bill, error: billError } = await supabaseClient
          .from('maintenance_bills')
          .select('total_amount, payment_history')
          .eq('id', payment.bill_id)
          .single()

        if (billError || !bill) {
          throw new Error('Bill record not found')
        }

        // Calculate new bill status
        const totalPaid = (bill.payment_history || []).reduce((sum, p) => sum + p.amount, 0) + payment.amount

        let billStatus = 'pending'
        if (totalPaid >= bill.total_amount) {
          billStatus = 'paid'
        } else if (totalPaid > 0) {
          billStatus = 'partially_paid'
        }

        // Add to payment history
        const paymentHistory = [
          ...(bill.payment_history || []),
          {
            amount: payment.amount,
            date: new Date().toISOString(),
            mode: 'razorpay',
            transaction_id: paymentId,
          },
        ]

        const { error: billUpdateError } = await supabaseClient
          .from('maintenance_bills')
          .update({
            status: billStatus,
            payment_history: paymentHistory,
          })
          .eq('id', payment.bill_id)

        if (billUpdateError) {
          throw new Error(`Failed to update bill: ${billUpdateError.message}`)
        }

        // Send notification to resident
        // TODO: Implement push notification service
        console.log(`Bill ${payment.bill_id} updated with status: ${billStatus}`)

        return new Response(
          JSON.stringify({ success: true, message: 'Payment processed' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      case 'payment.failed': {
        // Payment failed
        const paymentId = payload.payment?.id
        const orderId = payload.payment?.order_id

        console.log(`Payment failed: ${paymentId}`)

        // Update payment status in database
        const { error: updateError } = await supabaseClient
          .from('payments')
          .update({
            status: 'failed',
            razorpay_payment_id: paymentId,
            razorpay_order_id: orderId,
          })
          .eq('razorpay_order_id', orderId)

        if (updateError) {
          throw new Error(`Failed to update payment: ${updateError.message}`)
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Payment failure recorded' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      case 'refund.created': {
        // Refund has been created
        const refundId = payload.refund?.id
        const paymentId = payload.refund?.payment_id
        const refundAmount = payload.refund?.amount

        console.log(`Refund created: ${refundId}`)

        // Update payment status in database
        const { error: updateError } = await supabaseClient
          .from('payments')
          .update({
            status: 'refunded',
            refund_amount: refundAmount / 100, // Convert from paise to rupees
            refunded_at: new Date().toISOString(),
          })
          .eq('razorpay_payment_id', paymentId)

        if (updateError) {
          throw new Error(`Failed to update payment: ${updateError.message}`)
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Refund recorded' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      case 'refund.failed': {
        // Refund failed
        const refundId = payload.refund?.id
        const paymentId = payload.refund?.payment_id

        console.warn(`Refund failed: ${refundId}`)

        // Log the failure but don't change payment status
        console.log(`Error processing refund for payment: ${paymentId}`)

        return new Response(
          JSON.stringify({ success: true, message: 'Refund failure logged' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      default: {
        console.log(`Unhandled webhook event: ${event}`)

        return new Response(
          JSON.stringify({ success: false, message: 'Unknown event type' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        )
      }
    }
  } catch (error) {
    console.error(`Webhook error: ${error.message}`)

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
