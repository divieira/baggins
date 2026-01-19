# Baggins - AI-Assisted Travel Planner

Plan perfect trips with AI-powered suggestions for attractions, restaurants, and activities based on your travel companions and preferences.

**Tech Stack**: Next.js 14 • Supabase • Claude AI • Tailwind CSS

## Quick Start

### Prerequisites
- Node.js 18+
- [Supabase account](https://supabase.com) (free tier)
- [Anthropic API key](https://console.anthropic.com)

### Setup

1. **Install dependencies**
```bash
npm install
```

2. **Set up Supabase**
   - Create a new project at [supabase.com](https://supabase.com)
   - Go to Settings > API and copy your credentials
   - In SQL Editor, run the migration from `supabase/migrations/20260118000000_initial_schema.sql`

3. **Configure environment**

Create `.env.local`:
```bash
cp .env.example .env.local
```

Add your credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-publishable-key
ANTHROPIC_API_KEY=your-anthropic-api-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. **Run locally**
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Key Features

- **Smart Planning**: AI generates personalized attraction and restaurant suggestions
- **Interactive Timeline**: Daily view with time blocks for activities and meals
- **Dynamic Recommendations**: Updates based on proximity, opening hours, and your travel group
- **AI Chat**: Ask for specific suggestions or modify plans on the fly
- **Collaborative**: Share trips with family (database ready, UI coming soon)
- **Mobile-First**: Optimized for planning on-the-go

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete Vercel deployment guide including:
- Environment variable configuration
- Supabase redirect URL setup
- Production checklist

**Quick version**: Deploy to Vercel, add the 3 environment variables above (skip `NEXT_PUBLIC_APP_URL` - Vercel provides `VERCEL_URL` automatically), then configure Supabase redirect URLs.

## Security

- Row-Level Security (RLS) policies protect all user data
- Environment variables keep API keys secure
- Public code, private data

## License

MIT

---

Built for travelers who want to make the most of their adventures.
