#!/bin/bash

# Script to apply the RLS fix and verify it works
# Usage: ./apply-rls-fix.sh

set -e

echo "========================================"
echo "Applying Trips RLS Recursion Fix"
echo "========================================"
echo ""

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

echo "✓ Supabase CLI found"
echo ""

# Check if we're linked to a project
if [ ! -f ".supabase/config.toml" ]; then
    echo "❌ Not linked to a Supabase project"
    echo "   Run: supabase link --project-ref your-project-ref"
    exit 1
fi

echo "✓ Linked to Supabase project"
echo ""

# Apply the migration
echo "📝 Applying migration: 20260119000000_fix_trips_recursion.sql"
echo ""

supabase db push

echo ""
echo "✅ Migration applied!"
echo ""

# Run the test script
echo "🧪 Running verification tests..."
echo ""

supabase db execute --file supabase/test-rls-fix.sql

echo ""
echo "========================================"
echo "✅ RLS Fix Applied and Verified!"
echo "========================================"
echo ""
echo "The infinite recursion issue should now be resolved."
echo "Try creating a trip in the app to verify."
