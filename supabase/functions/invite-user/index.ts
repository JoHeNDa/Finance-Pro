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
    console.log('INVITE FUNCTION STARTED')

    // ✅ 1. AUTH HEADER
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth header' }), {
        status: 401,
        headers: corsHeaders,
      })
    }

    // ✅ 2. USER CLIENT (verify caller)
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: { headers: { Authorization: authHeader } },
      }
    )

    const { data: userData, error: userError } = await userClient.auth.getUser()

    if (userError || !userData?.user?.id) {
      console.log('AUTH ERROR:', userError)
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: corsHeaders,
      })
    }

    const callerId = userData.user.id

    // ✅ 3. ADMIN CLIENT
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // ✅ 4. GET CALLER ROLE
    const { data: caller, error: callerError } = await adminClient
      .from('users')
      .select('role, organization_id')
      .eq('id', callerId)
      .single()

    if (callerError || !caller) {
      console.log('CALLER ERROR:', callerError)
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

    // ✅ 5. PARSE BODY
    let body
    try {
      body = await req.json()
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    const { email, name, role } = body

    if (!email || !name || !role) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    const organization_id = caller.organization_id // ✅ NEVER trust client

    console.log('Inviting:', email)

    // ✅ 6. INVITE USER
    const { data: inviteData, error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(email)

    if (inviteError) {
      console.log('INVITE ERROR:', inviteError)

      // handle duplicate user gracefully
      if (inviteError.message.includes('already')) {
        return new Response(JSON.stringify({ error: 'User already invited or exists' }), {
          status: 400,
          headers: corsHeaders,
        })
      }

      return new Response(JSON.stringify({ error: inviteError.message }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    const userId = inviteData?.user?.id

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Invite failed (no user id)' }), {
        status: 500,
        headers: corsHeaders,
      })
    }

    // ✅ 7. CHECK IF USER ALREADY IN TABLE
    const { data: existingUser } = await adminClient
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (existingUser) {
      console.log('User already exists in DB')
      return new Response(JSON.stringify({ success: true, userId }), {
        status: 200,
        headers: corsHeaders,
      })
    }

    // ✅ 8. INSERT INTO USERS TABLE
    const { error: dbError } = await adminClient.from('users').insert({
      id: userId,
      email,
      name,
      organization_id,
      role,
    })

    if (dbError) {
      console.log('DB ERROR:', dbError)
      return new Response(JSON.stringify({ error: dbError.message }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    // ✅ SUCCESS
    return new Response(
      JSON.stringify({ success: true, userId }),
      {
        status: 200,
        headers: corsHeaders,
      }
    )

  } catch (err) {
    console.log('FATAL ERROR:', err)

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