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

    const { userId } = JSON.parse(req.body);

    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing userId' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Delete from Auth
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: deleteAuthError.message }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    // Delete from public.users
    const { error: deleteUserError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId);

    if (deleteUserError) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: deleteUserError.message }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
};