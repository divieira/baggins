import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">Baggins</h1>
        <p className="text-xl text-gray-600 mb-8">
          AI-powered travel planning. Describe your trip in plain English and
          get a complete itinerary with attractions, restaurants, and daily
          schedules.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/auth/signup" className="btn-primary text-lg px-8 py-3">
            Get Started
          </Link>
          <Link href="/auth/signin" className="btn-secondary text-lg px-8 py-3">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
