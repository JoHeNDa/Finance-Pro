import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const { email, name, organization_id, role } = await req.json()

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // 1. Create auth user + send invite email
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 })
  }

  const userId = data.user?.id

  // 2. Insert into users table
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
    return new Response(JSON.stringify({ error: dbError.message }), { status: 400 })
  }

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})