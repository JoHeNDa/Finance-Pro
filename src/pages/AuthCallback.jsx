useEffect(() => {
  const handleAuth = async () => {
    const { data, error } = await supabase.auth.getSession()

    if (error) {
      console.error(error)
      return
    }

    if (data?.session) {
      const params = new URLSearchParams(window.location.search)
      const type = params.get('type')

      console.log("Auth type:", type)

      if (type === 'invite' || type === 'recovery') {
        navigate('/set-password')   // ✅ ALWAYS go here
      } else {
        navigate('/dashboard')
      }
    }
  }

  handleAuth()
}, [])