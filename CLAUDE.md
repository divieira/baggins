# Baggins - Developer Guide

AI-assisted travel planning application built with Next.js, Supabase, and Claude API.

## Project Overview

Baggins helps users plan trips by:
1. Collecting travel details (flights, hotels, travelers with ages)
2. Generating AI-powered suggestions for attractions and restaurants
3. Presenting a daily timeline with time blocks (morning, lunch, afternoon, dinner, evening)
4. Dynamically updating recommendations based on selections (proximity, availability, suitability)
5. Providing an AI chat interface for plan modifications

## Core Features

### Implemented ✅
- **Authentication**: Email/password with Supabase Auth, password reset flow
- **Trip Creation**: Multi-step form for destination, dates, travelers, flights, hotels
- **AI Suggestions**: Claude generates ~10 attractions and ~10 restaurants per destination
- **Daily Timeline**: Visual timeline showing flights/hotels at top, time blocks below
- **Time Block System**: Morning activity → Lunch → Afternoon activity → Dinner → Evening
- **Smart Recommendations**:
  - Filters suggestions by opening hours
  - Sorts by proximity to hotel
  - Considers traveler ages (kid-friendly filtering)
  - Marks "best match" based on distance and suitability
- **Dynamic Updates**: When user selects an activity, it's removed from other time blocks
- **AI Chat**: Ask for modifications, specific suggestions, or destination advice
- **Version Control**: Database schema supports plan rollback (UI pending)
- **Collaboration**: Database schema supports shared trips with role-based access (UI pending)
- **Mobile-First**: Responsive design with Tailwind CSS

### In Progress 🚧
- Real-time collaboration UI (database ready)
- Version history UI with rollback
- Travel time calculations between locations
- More sophisticated recommendation algorithm

### Planned 📋
- Map view integration
- Calendar export (iCal)
- Budget tracking
- Photo uploads for places
- Reviews and ratings
- Social sharing features
- Multi-destination trips

## Architecture

### Tech Stack
- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, RLS, Real-time subscriptions)
- **AI**: Claude API (Anthropic) via REST
- **Deployment**: Vercel (automatically uses VERCEL_URL)

### Key Patterns
- **Server Components**: For data fetching (dashboard, trip pages)
- **Client Components**: For interactivity (forms, timeline, chat)
- **Dynamic Routes**: Force server-rendered for authenticated pages
- **RLS Policies**: All database access secured by Supabase Row-Level Security
- **API Routes**: AI endpoints for suggestions and chat

### Database Schema
See `supabase/migrations/20260118000000_initial_schema.sql` for complete schema.

**Core tables**:
- `trips`: Trip metadata
- `trip_collaborators`: Sharing and roles
- `travelers`: Family members with ages
- `flights`, `hotels`: Trip logistics
- `attractions`, `restaurants`: AI-generated suggestions pool
- `time_blocks`: Daily schedule with selections
- `plan_versions`: Version control (full plan snapshots)
- `ai_interactions`: Chat history

## Development Workflow

### Branch Strategy

**Main Branch**: Production-ready code
**Feature Branches**: Use `claude/<feature-name>-<session-id>` format

### Working with Branches

**Always rebase when syncing from main**:
```bash
# Update feature branch with main changes
git fetch origin
git checkout claude/your-feature-branch
git rebase origin/main

# If conflicts, resolve and continue
git rebase --continue

# Force push rebased branch (safe for feature branches)
git push -f origin claude/your-feature-branch
```

**Why rebase?**
- Keeps linear history
- Makes pull requests cleaner
- Easier to review changes
- Avoids merge commit noise

### Testing Requirements

**For every code change**:

1. **Write tests first** (TDD preferred)
2. **Run tests locally** before committing
3. **Ensure all tests pass** before pushing

**Test commands**:
```bash
# Run all tests
npm test

# Run tests in watch mode (during development)
npm test -- --watch

# Run specific test file
npm test -- path/to/test.test.ts

# Run tests with coverage
npm test -- --coverage
```

**Test coverage expectations**:
- New features: 80%+ coverage
- Bug fixes: Add regression test
- Refactoring: Maintain existing coverage

**Testing guidelines**:
- Unit tests for utilities, helpers, business logic
- Integration tests for API routes
- Component tests for React components
- E2E tests for critical user flows (auth, trip creation)

### Code Quality

**Before committing**:
```bash
# Run linter
npm run lint

# Fix auto-fixable issues
npm run lint -- --fix

# Build check (catches type errors)
npm run build
```

**Type safety**:
- Use TypeScript strict mode
- No `any` types (use `unknown` if needed)
- Define proper interfaces for database types

## Common Development Tasks

### Adding a New Feature

1. Create feature branch: `claude/<feature-name>-<session-id>`
2. Write tests for the feature
3. Implement the feature
4. Run tests: `npm test`
5. Run build: `npm run build`
6. Commit with descriptive message
7. Push and create PR

### Adding AI Functionality

AI endpoints are in `app/api/ai/`:
- `generate-suggestions/route.ts`: Generate attractions/restaurants
- `chat/route.ts`: Chat interface

**Pattern**:
1. Get user context (trip, travelers, preferences)
2. Build structured prompt with clear JSON schema
3. Parse response with error handling
4. Store results in database
5. Return success/error to client

### Database Changes

1. Create new migration file in `supabase/migrations/`
2. Use timestamp naming: `YYYYMMDDHHMMSS_description.sql`
3. Include:
   - Table/column changes
   - RLS policies for new tables
   - Indexes for performance
4. Test migration locally in Supabase dashboard
5. Document in commit message

### Environment Variables

**Required**:
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`: Supabase anon key
- `ANTHROPIC_API_KEY`: Claude API key

**Optional**:
- `NEXT_PUBLIC_APP_URL`: Override URL (dev only, Vercel provides VERCEL_URL)

**Never commit**:
- `.env.local` (local development)
- `.env` (any environment)

## Troubleshooting

### Build Fails
- Check TypeScript errors: `npm run build`
- Verify all imports are correct
- Ensure environment variables are set

### Auth Redirects to Localhost
- Check Supabase redirect URLs are configured
- Verify both `/auth/callback` and `/auth/reset-password` are added

### AI Suggestions Not Generating
- Check Anthropic API key is valid
- Verify API has available credits
- Check API response parsing (JSON structure)

### Database Access Denied
- Verify RLS policies allow the operation
- Check user is authenticated
- Confirm trip access permissions

## Performance Considerations

- Use `dynamic = 'force-dynamic'` for auth-protected pages
- Implement pagination for large lists
- Cache AI suggestions (don't regenerate on every load)
- Optimize images (use Next.js Image component)
- Minimize bundle size (check with `npm run build`)

## Security Checklist

- [ ] All API keys in environment variables
- [ ] RLS policies on all tables
- [ ] Input validation on forms
- [ ] CSRF protection (Next.js handles this)
- [ ] No sensitive data in client-side code
- [ ] Proper error messages (don't leak info)

## Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Claude API Docs](https://docs.anthropic.com)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)

---

**Remember**: Always rebase, always test, always commit with clear messages.
