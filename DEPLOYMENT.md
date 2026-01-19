# Production Deployment Guide

Deploy Baggins to Vercel with Supabase backend.

## Prerequisites

- GitHub account
- [Vercel account](https://vercel.com) (free tier)
- [Supabase account](https://supabase.com) (free tier)
- [Anthropic API key](https://console.anthropic.com)

## 1. Set Up Supabase

### Create Project
1. Go to [app.supabase.com](https://app.supabase.com)
2. Click "New Project" → choose name, password, region
3. Wait ~2 minutes for creation

### Run Migration
1. Go to SQL Editor → "New Query"
2. Copy/paste contents from `supabase/migrations/20260118000000_initial_schema.sql`
3. Click "Run"
4. Verify tables created in Table Editor

### Get Credentials
Settings > API → Copy:
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon/public key** → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`

### Enable Email Auth
Authentication > Providers → Enable "Email" provider

## 2. Get Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Navigate to API Keys → Create new key
3. Copy key (won't be shown again)

## 3. Deploy to Vercel

### Import & Configure
1. Go to [vercel.com](https://vercel.com) → "New Project"
2. Import your GitHub repository
3. Add environment variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=<from step 1>
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=<from step 1>
   ANTHROPIC_API_KEY=<from step 2>
   ```
   > Note: Don't set `NEXT_PUBLIC_APP_URL` - Vercel provides `VERCEL_URL` automatically

4. Click "Deploy"
5. Copy your deployment URL (e.g., `https://baggins-abc123.vercel.app`)

## 4. Configure Supabase Redirect URLs

**Critical** - Without this, auth will redirect to localhost.

In Supabase: Authentication > URL Configuration

### Site URL
```
https://your-app.vercel.app
```

### Redirect URLs (add all 4)
```
https://your-app.vercel.app/auth/callback
https://your-app.vercel.app/auth/reset-password
http://localhost:3000/auth/callback
http://localhost:3000/auth/reset-password
```

## 5. Verify Deployment

Test these flows:
- [ ] Sign up (check email confirmation)
- [ ] Sign in
- [ ] Password reset
- [ ] Create trip
- [ ] AI suggestions generate
- [ ] AI chat works

## Custom Domain (Optional)

1. Vercel: Settings > Domains → Add your domain
2. Follow DNS configuration
3. Update Supabase redirect URLs to use your domain

## Troubleshooting

**Auth redirects to localhost**
→ Check Supabase redirect URLs are configured (Step 4)

**Build fails**
→ Ensure all 3 environment variables are set in Vercel

**AI suggestions fail**
→ Verify Anthropic API key has available credits

**Database errors**
→ Confirm migration ran successfully in SQL Editor

## Cost Estimates (Light Usage)

- **Supabase**: Free (500MB DB, 2GB bandwidth)
- **Vercel**: Free (personal projects)
- **Anthropic**: ~$0.003 per suggestion, ~$0.001 per chat message
  - For 2-3 trips/year: < $5/year

## Monitoring

- **Supabase Dashboard**: Database size, API calls, active users
- **Vercel Analytics**: Performance, function execution
- **Anthropic Console**: API usage and costs

---

Need help? Open an issue on GitHub.
