import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Check and reset free scan if monthly period has passed
export async function checkFreeReset(userId) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('free_scans_used, free_scan_reset_at')
    .eq('id', userId)
    .single()

  if (!profile) return

  const resetAt = new Date(profile.free_scan_reset_at)
  if (new Date() > resetAt) {
    await supabase.from('profiles').update({
      free_scans_used: 0,
      free_scan_reset_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    }).eq('id', userId)
  }
}
