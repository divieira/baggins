import { AuthForm } from '@/components/auth/AuthForm'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Baggins
          </h1>
          <p className="text-xl text-gray-600 mb-2">
            AI-Assisted Travel Planning
          </p>
          <p className="text-lg text-gray-500">
            Plan your perfect trip with intelligent suggestions and real-time collaboration
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-start max-w-6xl mx-auto mb-16">
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold mb-2">Smart Suggestions</h3>
              <p className="text-gray-600">
                Get AI-powered recommendations for attractions, restaurants, and activities based on your preferences and travel companions.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold mb-2">Collaborative Planning</h3>
              <p className="text-gray-600">
                Share your trip with family members and edit together in real-time.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold mb-2">Timeline View</h3>
              <p className="text-gray-600">
                Visualize your entire trip with flights, hotels, and daily activities in an easy-to-follow timeline.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold mb-2">Version Control</h3>
              <p className="text-gray-600">
                Keep track of changes and roll back to previous versions of your plan anytime.
              </p>
            </div>
          </div>

          <div>
            <AuthForm />
          </div>
        </div>
      </div>
    </div>
  )
}
