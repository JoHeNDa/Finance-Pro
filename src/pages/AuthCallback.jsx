import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuth = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error(error);
        return;
      }

      if (data?.session) {
        const params = new URLSearchParams(globalThis.location.search);
        const type = params.get('type');

        console.log('Auth type:', type);

        if (type === 'invite' || type === 'recovery') {
          navigate('/set-password');
        } else {
          navigate('/dashboard');
        }
      }
    };

    handleAuth();
  }, [navigate]);

  return (
    <div className="loading-spinner">
      <div className="spinner"></div>
      <p>Authenticating...</p>
    </div>
  );
}