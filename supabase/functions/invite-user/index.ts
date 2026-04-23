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

    console.log("URL:", Deno.env.get('SUPABASE_URL'))
console.log("SERVICE ROLE:", Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
    const { email, name, organization_id, role } = await req.json()

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // STEP 1: create auth user safely
    const { data: userData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
      })

    if (authError) {
      return new Response(JSON.stringify(authError), {
        status: 400,
        headers: corsHeaders,
      })
    }

    const userId = userData.user?.id

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User creation failed' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // STEP 2: insert into users table (this is where most failures happen)
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
        JSON.stringify(dbError),
        { status: 400, headers: corsHeaders }
      )
    }

    return new Response(
      JSON.stringify({ success: true, userId }),
      { headers: corsHeaders }
    )

  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500,
        headers: corsHeaders
      }
    )
  }
})