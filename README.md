# Baggins - AI-Assisted Travel Planner

Baggins is an intelligent travel planning application that helps you create perfect trip itineraries with AI-powered suggestions for attractions, restaurants, and activities.

## Features

- **Smart Trip Planning**: Input your flight and hotel details, and get AI-generated suggestions
- **Personalized Recommendations**: Tailored suggestions based on your travel companions (family, kids, etc.)
- **Interactive Timeline**: Visual daily timeline with time blocks for activities and meals
- **Real-time Collaboration**: Share trips with family members for collaborative editing
- **AI Assistant**: Chat with AI to modify plans and get specific recommendations
- **Version Control**: Keep track of plan changes with rollback capability
- **Mobile-First Design**: Optimized for planning on-the-go

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Authentication, Real-time)
- **AI**: Claude API (Anthropic)
- **Deployment**: Vercel + Supabase

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account (free tier available)
- Anthropic API key (for Claude AI)

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd baggins
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Once created, go to Settings > API to get your credentials
3. Go to SQL Editor and run the migration file:
   - Copy contents from `supabase/migrations/20260118000000_initial_schema.sql`
   - Paste and execute in SQL Editor

### 4. Get Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an account or sign in
3. Generate an API key from the API Keys section

### 5. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your credentials:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-supabase-anon-key

# AI Configuration (Claude API)
ANTHROPIC_API_KEY=your-anthropic-api-key

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Note for production**: When deploying to Vercel, you don't need to set `NEXT_PUBLIC_APP_URL` - Vercel automatically provides a `VERCEL_URL` environment variable that will be used automatically. Just make sure to configure your Supabase redirect URLs (see deployment guide).

### 6. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage Guide

### Creating Your First Trip

1. **Sign Up/Login**: Create an account or sign in
2. **Create Trip**: Click "Create New Trip" from dashboard
3. **Enter Details**:
   - Destination
   - Travel dates
   - Who's coming (family members, ages)
   - Flight details
   - Hotel information
4. **Generate Plan**: Click "Create Trip & Generate Plan"
5. **Wait for AI**: The AI will generate personalized suggestions (takes ~30 seconds)

### Using the Timeline

- **View Daily Plans**: See each day with flights, hotels, and time blocks
- **Browse Suggestions**: Click on a time block to see AI recommendations
- **Select Activities**: Click on a suggestion to add it to your plan
- **Best Match**: The top suggestion is marked as "Best match" based on:
  - Proximity to hotel
  - Opening hours compatibility
  - Suitability for your travel group

### AI Assistant

- **Ask Questions**: Use the chat to ask for specific types of activities
  - "Find kid-friendly museums"
  - "Suggest romantic restaurants"
  - "Add more outdoor activities"
- **Modify Plans**: Request changes to your itinerary
- **Get Recommendations**: Ask for advice about your destination

### Sharing with Others

*Coming soon: Share your trip with family members for collaborative editing*

## Project Structure

```
baggins/
├── app/                      # Next.js app directory
│   ├── api/                 # API routes
│   │   └── ai/              # AI endpoints
│   ├── auth/                # Authentication
│   └── dashboard/           # Main app pages
├── components/              # React components
│   ├── auth/               # Auth components
│   ├── trip/               # Trip planning components
│   └── ai/                 # AI chat component
├── lib/                     # Utility libraries
│   └── supabase/           # Supabase client config
├── types/                   # TypeScript types
├── utils/                   # Helper functions
├── supabase/               # Database migrations
└── public/                 # Static assets
```

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Add environment variables in Vercel dashboard
5. Deploy

### Environment Variables for Production

Make sure to add all environment variables from `.env.local` to your Vercel project settings, updating URLs as needed:

- `NEXT_PUBLIC_APP_URL` should be your production domain

## Security & Privacy

- **Public Code, Private Data**: The codebase is open source, but all travel data is secured
- **Row-Level Security**: Supabase RLS policies ensure users can only access their own trips
- **Authentication**: Secure email/password authentication via Supabase Auth
- **Environment Variables**: API keys and secrets are never committed to the repository

## Contributing

This is a personal project, but suggestions and feedback are welcome!

## License

MIT

## Support

For issues or questions, please open an issue on GitHub.

---

Built with ❤️ for travelers who want to make the most of their adventures.
