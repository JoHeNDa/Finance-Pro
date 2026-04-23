import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useNavigate } from 'react-router-dom'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const handleAuth = async () => {
      // Supabase automatically reads token from URL
      const { data, error } = await supabase.auth.getSession()

      if (error) {
        console.error(error)
        return
      }

      if (data?.session) {
        // user is logged in via invite link
        navigate('/set-password')
      } else {
        console.error("No session found")
      }

      setLoading(false)
    }

    handleAuth()
  }, [])

  return <p>Setting up your account...</p>
}