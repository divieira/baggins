# Deployment Guide

This guide will walk you through deploying Baggins to production using Vercel and Supabase.

## Prerequisites

- GitHub account
- Vercel account (free tier available)
- Supabase account (free tier available)
- Anthropic API key

## Step 1: Prepare Your Repository

### 1.1 Push to GitHub

```bash
git add .
git commit -m "Initial Baggins implementation"
git push origin main
```

### 1.2 Verify .gitignore

Make sure these are in your `.gitignore`:

```
.env
.env.local
.env*.local
```

## Step 2: Set Up Supabase (Production)

### 2.1 Create a New Project

1. Go to [app.supabase.com](https://app.supabase.com)
2. Click "New Project"
3. Choose a name, database password, and region
4. Wait for the project to be created (~2 minutes)

### 2.2 Run Database Migration

1. Go to SQL Editor in your Supabase dashboard
2. Click "New Query"
3. Copy the entire contents of `supabase/migrations/20260118000000_initial_schema.sql`
4. Paste and click "Run"
5. Verify all tables were created (check Table Editor)

### 2.3 Get API Credentials

1. Go to Settings > API
2. Copy these values (you'll need them for Vercel):
   - Project URL (NEXT_PUBLIC_SUPABASE_URL)
   - anon/public key (NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY)

### 2.4 Configure Authentication

1. Go to Authentication > Providers
2. Enable "Email" provider
3. Configure email templates if desired
4. Set up email provider (SMTP) or use Supabase's default

### 2.5 Configure Redirect URLs (IMPORTANT!)

**You must configure this after deploying to Vercel, but note it now:**

1. Go to Authentication > URL Configuration
2. Add to **Redirect URLs**:
   - `https://your-app.vercel.app/auth/callback` (replace with your actual Vercel URL)
   - `http://localhost:3000/auth/callback` (for local development)
3. Set **Site URL** to: `https://your-app.vercel.app`

**Note**: Vercel provides your URL automatically via the `VERCEL_URL` environment variable, so the app will work across different deployments (production and preview). Just make sure to add your production URL to Supabase's allowed redirect URLs.

## Step 3: Get Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign in or create an account
3. Navigate to API Keys
4. Create a new API key
5. Copy the key (you won't be able to see it again)

**Important**: Monitor your API usage to avoid unexpected charges. The free tier includes credits but paid usage can add up.

## Step 4: Deploy to Vercel

### 4.1 Import Repository

1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository
4. Vercel will auto-detect Next.js

### 4.2 Configure Environment Variables

In the Vercel project settings, add these environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-supabase-anon-key
ANTHROPIC_API_KEY=your-anthropic-api-key
```

**Important**:
- Don't add quotes around the values
- You don't need to set `NEXT_PUBLIC_APP_URL` - Vercel automatically provides `VERCEL_URL` which the app will use
- For local development, set `NEXT_PUBLIC_APP_URL=http://localhost:3000` in your `.env.local` file

### 4.3 Deploy

1. Click "Deploy"
2. Wait for the build to complete (~2-3 minutes)
3. Copy your deployment URL (e.g., `https://baggins-abc123.vercel.app`)

### 4.4 Configure Supabase Auth Redirect

**Critical step** - Without this, authentication will redirect to localhost:

1. Go to your Supabase project
2. Navigate to Authentication > URL Configuration
3. Add your Vercel URL to "Site URL": `https://your-app.vercel.app`
4. Add to "Redirect URLs":
   - `https://your-app.vercel.app/auth/callback`
   - `http://localhost:3000/auth/callback` (for local development)

The app automatically uses Vercel's `VERCEL_URL` environment variable, so it will work correctly across all deployments (production and preview branches).

## Step 5: Verify Deployment

### 5.1 Test Authentication

1. Visit your deployed app
2. Try signing up with a new account
3. Check your email for confirmation
4. Verify you can log in

### 5.2 Test Trip Creation

1. Create a test trip
2. Verify AI suggestions are generated
3. Test the timeline and selection features
4. Test the AI chat

### 5.3 Check Database

1. Go to Supabase Table Editor
2. Verify data is being created in:
   - `trips`
   - `travelers`
   - `flights`
   - `hotels`
   - `plan_versions`
   - `time_blocks`

## Step 6: Custom Domain (Optional)

### 6.1 Add Domain in Vercel

1. Go to your Vercel project settings
2. Click "Domains"
3. Add your custom domain
4. Follow DNS configuration instructions

### 6.2 Update Supabase Redirect URLs

1. Go to Supabase Authentication > URL Configuration
2. Update "Site URL" to your custom domain
3. Add your custom domain to "Redirect URLs": `https://yourdomain.com/auth/callback`

No need to update `NEXT_PUBLIC_APP_URL` - Vercel's `VERCEL_URL` automatically updates to match your custom domain.

## Monitoring & Maintenance

### Monitor API Usage

1. **Anthropic Console**: Check API usage and costs
2. **Supabase Dashboard**: Monitor database size and API calls
3. **Vercel Analytics**: Track function execution and bandwidth

### Estimated Costs (Low Usage)

- Supabase: Free (up to 500MB database, 2GB bandwidth)
- Vercel: Free (for personal projects)
- Anthropic: ~$0.003 per suggestion generation, ~$0.001 per chat message

For a family using it for 2-3 trips per year, expect < $5/year in AI costs.

### Backup Your Data

Supabase free tier doesn't include automatic backups. Consider:

1. Manual exports via Supabase dashboard
2. Setting up scheduled backups using cron jobs
3. Upgrading to Pro plan ($25/month) for automated backups

## Troubleshooting

### Build Failures

**Error**: Missing environment variables
- **Solution**: Double-check all env vars are set in Vercel

**Error**: TypeScript errors
- **Solution**: Run `npm run build` locally first to catch errors

### Runtime Errors

**Error**: "Failed to generate suggestions"
- **Check**: Anthropic API key is valid
- **Check**: API key has credits available

**Error**: "Unauthorized" when accessing trips
- **Check**: Supabase RLS policies are set up (run migration again)
- **Check**: User is logged in

**Error**: Auth callback fails or redirects to localhost
- **Check**: Your Vercel URL is added to Supabase's allowed redirect URLs
- **Check**: Supabase "Site URL" is set to your production domain
- **Check**: You've added `https://your-app.vercel.app/auth/callback` to redirect URLs

## Security Checklist

- [ ] All API keys are stored in environment variables
- [ ] `.env` files are in `.gitignore`
- [ ] Supabase RLS policies are enabled
- [ ] Service role key is only used server-side
- [ ] CORS is properly configured in Supabase

## Scaling Considerations

If you plan to open this to more users:

1. **Database**: Upgrade Supabase plan for more storage/bandwidth
2. **AI Costs**: Implement rate limiting on AI endpoints
3. **Caching**: Add caching for AI suggestions
4. **CDN**: Use Vercel's CDN for static assets (automatic)
5. **Monitoring**: Set up error tracking (Sentry, etc.)

## Next Steps

Once deployed, you can:

1. Share the app with your wife
2. Create your first real trip
3. Start planning your next adventure!

For issues or questions, check the main README or open an issue on GitHub.
