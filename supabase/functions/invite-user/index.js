const { createClient } = require('@supabase/supabase-js');

exports.handler = async (req) => {
  try {
    if (req.method !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method not allowed' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    const { email, name, organization_id, role } = JSON.parse(req.body);

    if (!email || !name || !organization_id || !role) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Check if email already exists
    const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
    const emailExists = existing?.users?.some(u => u.email === email);
    if (emailExists) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Email already registered' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-8);

    // Create user in Auth
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { name },
    });

    if (createError) {
      console.error('Auth create error:', createError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: `Failed to create user: ${createError.message}` }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    // Insert into public.users
    const { error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        id: newUser.user.id,
        email,
        name,
        organization_id,
        role,
      });

    if (insertError) {
      // Rollback: delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: `Failed to add user to organization: ${insertError.message}` }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, tempPassword }),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch (err) {
    console.error('Unexpected error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
};