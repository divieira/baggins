#!/bin/bash

# Script to apply the RLS fix and verify it works
# Usage: ./apply-rls-fix.sh

set -e

echo "========================================"
echo "Applying Database Fixes"
echo "========================================"
echo ""
echo "This will apply:"
echo "  1. RLS Recursion Fix"
echo "  2. Auto User Creation"
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

# Apply the migrations
echo "📝 Applying migrations..."
echo ""

supabase db push

echo ""
echo "✅ Migrations applied!"
echo ""

# Run verification tests
echo "🧪 Running verification tests..."
echo ""

echo "Test 1: RLS Recursion Fix"
echo "---"
supabase db execute --file supabase/test-rls-fix.sql

echo ""
echo "Test 2: User Creation"
echo "---"
supabase db execute --file supabase/test-user-creation.sql

echo ""
echo "Test 3: Complete Flow"
echo "---"
supabase db execute --file supabase/test-complete-flow.sql

echo ""
echo "========================================"
echo "✅ All Fixes Applied and Verified!"
echo "========================================"
echo ""
echo "Both issues should now be resolved:"
echo "  ✓ Infinite recursion fixed"
echo "  ✓ Foreign key constraint fixed"
echo ""
echo "Try creating a trip in the app to verify."
