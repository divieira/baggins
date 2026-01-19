-- Auto-create user in public.users table when auth user is created
-- This fixes the foreign key constraint error when creating trips

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create user record
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Backfill existing auth users into public.users table
INSERT INTO public.users (id, email, created_at, updated_at)
SELECT
  id,
  email,
  created_at,
  updated_at
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Add comment
COMMENT ON FUNCTION public.handle_new_user IS 'Automatically creates a user record in public.users when a new auth user is created';
