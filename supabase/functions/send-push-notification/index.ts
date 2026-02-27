import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN')
const EXPO_API_URL = 'https://exp.host/--/api/v2/push/send'

serve(async (req) => {
  try {
    // Get the request body
    const { token, title, body, data } = await req.json()

    // Validate required fields
    if (!token || !title || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Prepare the notification payload
    const message = {
      to: token,
      sound: 'default',
      title,
      body,
      data: data || {},
      priority: 'high',
    }

    // Send the push notification
    const response = await fetch(EXPO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${EXPO_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(message),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(`Expo API error: ${JSON.stringify(result)}`)
    }

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error sending push notification:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to send push notification',
        details: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}) 