import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  // Handle preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, name, organization_id, role } = await req.json()

    if (!email || !name || !organization_id || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Create Supabase admin client (CRITICAL: service role key)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Invite user via Supabase Auth Admin API
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email)

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: corsHeaders }
      )
    }

    const userId = data.user?.id

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Failed to retrieve invited user ID' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Insert into your app users table
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .insert({
        id: userId,
        email,
        name,
        organization_id,
        role,
      })

    if (dbError) {
      return new Response(
        JSON.stringify({ error: dbError.message }),
        { status: 400, headers: corsHeaders }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'User invited successfully',
      }),
      { headers: corsHeaders }
    )

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)

    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: corsHeaders }
    )
  }
})