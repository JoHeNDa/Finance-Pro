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
    console.log("INVITE FUNCTION STARTED")

    const authHeader = req.headers.get('Authorization')

    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth header' }), {
        status: 401,
        headers: corsHeaders,
      })
    }

    // 🔐 Verify caller
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: { headers: { Authorization: authHeader } },
      }
    )

    const { data: userData, error: userError } =
      await userClient.auth.getUser()

    if (userError || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: corsHeaders,
      })
    }

    const callerId = userData.user.id

    // 🔑 Admin client
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 👤 Get caller role
    const { data: caller, error: callerError } = await adminClient
      .from('users')
      .select('role, organization_id')
      .eq('id', callerId)
      .maybeSingle()

    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: 'Caller not found' }), {
        status: 403,
        headers: corsHeaders,
      })
    }

    if (!['admin', 'owner'].includes(caller.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: corsHeaders,
      })
    }

    // 📦 Request body
    const body = await req.json()
    const { email, name, organization_id, role } = body

    if (!email || !name || !organization_id || !role) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    console.log("Generating invite link for:", email)

    // 🔗 Generate invite link manually (IMPORTANT CHANGE)
    const { data: linkData, error: linkError } =
      await adminClient.auth.admin.generateLink({
        type: 'invite',
        email,
        options: {
          redirectTo: 'https://www.iusfinancepro.com/auth/callback',
        },
      })

    if (linkError) {
      console.error(linkError)
      return new Response(JSON.stringify({ error: linkError.message }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    const inviteLink = linkData?.properties?.action_link
    const userId = linkData?.user?.id

    if (!inviteLink || !userId) {
      return new Response(JSON.stringify({ error: 'Failed to generate invite link' }), {
        status: 500,
        headers: corsHeaders,
      })
    }

    console.log("Invite link generated")

    // 🧾 Insert into your users table
    const { error: dbError } = await adminClient
      .from('users')
      .insert({
        id: userId,
        email,
        name,
        organization_id,
        role,
      })

    if (dbError) {
      console.error(dbError)
      return new Response(JSON.stringify({ error: dbError.message }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    // 🚀 RETURN LINK (you can email it later)
    return new Response(
      JSON.stringify({
        success: true,
        inviteLink,
      }),
      {
        status: 200,
        headers: corsHeaders,
      }
    )

  } catch (err) {
    console.error("INVITE FUNCTION CRASH:", err)

    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 500,
        headers: corsHeaders,
      }
    )
  }
})