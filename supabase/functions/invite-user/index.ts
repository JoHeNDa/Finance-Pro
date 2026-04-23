import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { email, name, organization_id, role } = body

    if (!email || !name || !organization_id || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing fields' }),
        { status: 400, headers: corsHeaders }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // STEP 1: Create auth user (NOT invite yet - simpler & more reliable)
    const { data: authUser, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
      })

    if (authError) {
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: corsHeaders }
      )
    }

    const userId = authUser.user?.id

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User creation failed' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // STEP 2: Insert into your app users table
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
        userId,
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})