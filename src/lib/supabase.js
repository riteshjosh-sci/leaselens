import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Check and reset monthly scan counters
export async function checkFreeReset(userId) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('free_scans_used, free_scan_reset_at, monthly_scans_used, monthly_scan_reset_at, plan')
    .eq('id', userId)
    .single()

  if (!profile) return

  const now = new Date()
  const updates = {}

  // Reset free tier monthly
  const freeResetAt = new Date(profile.free_scan_reset_at)
  if (now > freeResetAt) {
    updates.free_scans_used = 0
    updates.free_scan_reset_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  }

  // Reset monthly/annual plan scans
  if (profile.plan === 'monthly' || profile.plan === 'annual') {
    const monthlyResetAt = profile.monthly_scan_reset_at ? new Date(profile.monthly_scan_reset_at) : new Date(0)
    if (now > monthlyResetAt) {
      updates.monthly_scans_used = 0
      updates.monthly_scan_reset_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    }
  }

  if (Object.keys(updates).length > 0) {
    await supabase.from('profiles').update(updates).eq('id', userId)
  }
}