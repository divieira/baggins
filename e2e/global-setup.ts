import { FullConfig } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.test' });

const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'e2e-test@baggins.test';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'TestPassword123!';

async function globalSetup(config: FullConfig) {
  console.log('🔧 Running global setup...');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env.test');
    throw new Error('Missing Supabase credentials');
  }

  if (supabaseUrl.includes('placeholder')) {
    console.log('⚠️  Using placeholder Supabase credentials');
    console.log('⚠️  Tests will fail unless you set real credentials in .env.test');
    console.log('✅ Global setup complete (skipped user creation)');
    return;
  }

  console.log('✅ Supabase credentials found');
  console.log(`📧 Test user email: ${TEST_EMAIL}`);

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Try to sign up test user
    const { error: signupError } = await supabase.auth.signUp({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (signupError) {
      if (signupError.message.includes('already registered')) {
        console.log('✅ Test user already exists');
      } else {
        console.log(`⚠️ Signup: ${signupError.message}`);
      }
    } else {
      console.log('✅ Test user created');
    }

    // Verify authentication
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (loginError) {
      console.log(`⚠️ Login verification: ${loginError.message}`);
    } else {
      console.log('✅ Test user authentication verified');
      await supabase.auth.signOut();
    }
  } catch (e) {
    console.log(`⚠️ Setup error: ${e instanceof Error ? e.message : 'Unknown'}`);
  }

  console.log('✅ Global setup complete');
}

export default globalSetup;
