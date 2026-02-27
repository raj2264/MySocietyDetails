import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    // Create a Supabase client with the Auth context of the function
    const supabaseClient = createClient(
      // Supabase API URL - env var exposed by default when deployed
      Deno.env.get('SUPABASE_URL') ?? '',
      // Supabase API ANON KEY - env var exposed by default when deployed
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      // Create client with Auth context of the user that called the function
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Get request data
    const { email, fullName, otp } = await req.json()

    // Validate data
    if (!email || !otp) {
      return new Response(
        JSON.stringify({ error: 'Email and OTP are required' }),
        { headers: { 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Create email content
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">MySociety App Email Verification</h2>
        <p>Hello ${fullName || 'User'},</p>
        <p>Your verification code is:</p>
        <div style="background-color: #f4f4f4; padding: 15px; border-radius: 8px; text-align: center; font-size: 24px; letter-spacing: 8px; font-weight: bold;">
          ${otp}
        </div>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this code, please ignore this email.</p>
        <p>Thanks,<br>MySociety App Team</p>
      </div>
    `

    // Store the OTP in the database
    const { error: dbError } = await supabaseClient
      .from('verification_codes')
      .insert({
        email,
        code: otp,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes from now
      })

    if (dbError) {
      console.error('Error storing OTP in database:', dbError)
      // Continue anyway, as we'll still try to send the email
    }

    // Send the email
    // Note: This uses Supabase's email service, which must be configured
    const { error } = await supabaseClient.auth.admin.sendEmail(
      email,
      'OTP_EMAIL',
      {
        otp: otp,
        user_name: fullName || 'User'
      }
    )

    if (error) {
      throw error
    }

    // Return a success response
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    // Log and return the error
    console.error('Error sending email:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    )
  }
}) 