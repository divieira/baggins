/**
 * Sync all auth.users to public.users
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.test' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
})

async function main() {
  console.log('Syncing auth.users to public.users...\n')

  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()

  if (usersError) {
    console.log('Error listing users:', usersError.message)
    return
  }

  for (const user of users || []) {
    const { error: upsertError } = await supabase
      .from('users')
      .upsert({ id: user.id, email: user.email })

    if (upsertError) {
      console.log(`Error syncing ${user.email}:`, upsertError.message)
    } else {
      console.log(`Synced: ${user.email}`)
    }
  }

  console.log('\n✅ Done!')
}

main().catch(console.error)
