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
    console.log("FUNCTION STARTED")

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth header' }), {
        status: 401,
        headers: corsHeaders,
      })
    }

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

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

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

    const body = await req.json()
    const userId = body?.userId

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing userId' }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    if (userId === callerId) {
      return new Response(JSON.stringify({ error: 'Cannot delete yourself' }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    console.log("Deleting user:", userId)

    const { error: authDeleteError } =
      await adminClient.auth.admin.deleteUser(userId)

    if (authDeleteError) {
      console.error(authDeleteError)
      return new Response(JSON.stringify({ error: authDeleteError.message }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    const { error: dbError } = await adminClient
      .from('users')
      .delete()
      .eq('id', userId)

    if (dbError) {
      console.error(dbError)
      return new Response(JSON.stringify({ error: dbError.message }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: corsHeaders,
    })

  } catch (err) {
    console.error("EDGE FUNCTION CRASH:", err)

    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})