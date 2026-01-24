import { useState } from 'react';

// ============ LANDING PAGE ============
function LandingPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 relative overflow-hidden">
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap" rel="stylesheet" />
      
      {/* Floating decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-8 w-20 h-20 border-4 border-orange-200 rounded-full flex items-center justify-center rotate-12 opacity-40">
          <span className="text-orange-300 text-xs font-bold text-center leading-tight">PARIS<br/>2024</span>
        </div>
        <div className="absolute top-40 right-6 w-16 h-16 border-4 border-rose-200 rounded-lg flex items-center justify-center -rotate-6 opacity-40">
          <span className="text-rose-300 text-xs font-bold">東京</span>
        </div>
        <div className="absolute bottom-32 left-12 w-24 h-12 border-4 border-amber-200 rounded flex items-center justify-center rotate-3 opacity-40">
          <span className="text-amber-300 text-xs font-bold">SANTIAGO</span>
        </div>
        <div className="absolute bottom-48 right-10 w-14 h-14 border-4 border-orange-200 rounded-full flex items-center justify-center -rotate-12 opacity-30">
          <span className="text-orange-300 text-xs font-bold">NYC</span>
        </div>
        
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 800">
          <path 
            d="M 50 100 Q 200 200 100 350 Q 0 500 150 600 Q 300 700 250 800" 
            fill="none" 
            stroke="rgba(251, 146, 60, 0.2)" 
            strokeWidth="3" 
            strokeDasharray="8 12"
          />
          <circle cx="50" cy="100" r="6" fill="rgba(251, 146, 60, 0.3)" />
          <circle cx="100" cy="350" r="6" fill="rgba(251, 146, 60, 0.3)" />
          <circle cx="150" cy="600" r="6" fill="rgba(251, 146, 60, 0.3)" />
        </svg>
        
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-gradient-to-br from-orange-200 to-rose-200 rounded-full blur-3xl opacity-40" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-gradient-to-tr from-amber-200 to-orange-200 rounded-full blur-3xl opacity-30" />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-orange-400 to-rose-400 rounded-3xl shadow-xl shadow-orange-200 mb-6 rotate-3 hover:rotate-0 transition-transform duration-300">
            <span className="text-4xl">🎒</span>
          </div>
          
          <h1 
            className="text-5xl font-bold text-stone-800 mb-3"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Baggins
          </h1>
          
          <p className="text-stone-500 text-lg" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            There and back again
          </p>
          
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-stone-400">
            <span className="inline-block animate-bounce" style={{ animationDelay: '0ms' }}>🏠</span>
            <span>→</span>
            <span className="inline-block animate-bounce" style={{ animationDelay: '100ms' }}>🏔️</span>
            <span>→</span>
            <span className="inline-block animate-bounce" style={{ animationDelay: '200ms' }}>🏖️</span>
            <span>→</span>
            <span className="inline-block animate-bounce" style={{ animationDelay: '300ms' }}>🏠</span>
          </div>
        </div>

        <div className="w-full max-w-sm bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-xl shadow-orange-100/50 border border-white">
          <div className="space-y-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full px-4 py-3.5 bg-stone-50 border-2 border-stone-100 rounded-2xl focus:border-orange-300 focus:bg-white outline-none transition-all placeholder-stone-300"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3.5 bg-stone-50 border-2 border-stone-100 rounded-2xl focus:border-orange-300 focus:bg-white outline-none transition-all placeholder-stone-300"
              />
            </div>
            
            <button 
              onClick={onLogin}
              className="w-full bg-gradient-to-r from-orange-400 to-rose-400 hover:from-orange-500 hover:to-rose-500 text-white font-semibold py-4 rounded-2xl shadow-lg shadow-orange-200 transition-all hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 mt-2"
            >
              I'm going on an adventure! →
            </button>
          </div>
          
          <p className="text-center text-sm text-stone-400 mt-6">
            Don't have an account?{' '}
            <a href="#" className="font-semibold text-orange-500 hover:text-orange-600">
              Sign up
            </a>
          </p>
        </div>

        <p className="mt-8 text-stone-400 text-sm text-center italic max-w-xs">
          "Not all those who wander are lost"
        </p>
      </div>
    </div>
  );
}

// ============ TRIPS PAGE ============
function TripsPage({ onSelectTrip, onCreateTrip }) {
  const trips = [
    { id: 1, destination: "Santiago & Pucón", country: "Chile", dates: "Jan 25 - Feb 1, 2026", emoji: "🏔️", color: "from-emerald-400 to-teal-500", status: "upcoming", progress: 85 },
    { id: 2, destination: "Santiago and Pucón", country: "Chile", dates: "Jan 25 - Feb 1, 2026", emoji: "🌋", color: "from-orange-400 to-rose-500", status: "planning", progress: 40 },
    { id: 3, destination: "Pomerode", country: "Brazil", dates: "Jan 20 - Jan 22, 2026", emoji: "🏡", color: "from-violet-400 to-purple-500", status: "completed", progress: 100 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50">
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap" rel="stylesheet" />
      
      <div className="px-5 pt-14 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 
              className="text-3xl font-bold text-stone-800"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Baggins
            </h1>
            <p className="text-stone-400 text-sm mt-1" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              The road goes ever on 🗺️
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-rose-400 rounded-full flex items-center justify-center text-white font-bold shadow-lg shadow-orange-200">
              D
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 mb-6">
        <div className="flex gap-3">
          <div className="flex-1 bg-white/60 backdrop-blur rounded-2xl p-4 border border-white">
            <div className="text-3xl mb-1">3</div>
            <div className="text-stone-500 text-sm">Adventures</div>
          </div>
          <div className="flex-1 bg-white/60 backdrop-blur rounded-2xl p-4 border border-white">
            <div className="text-3xl mb-1">2</div>
            <div className="text-stone-500 text-sm">Countries</div>
          </div>
          <div className="flex-1 bg-white/60 backdrop-blur rounded-2xl p-4 border border-white">
            <div className="text-3xl mb-1">12</div>
            <div className="text-stone-500 text-sm">Days planned</div>
          </div>
        </div>
      </div>

      <div className="px-5 mb-6">
        <button 
          onClick={onCreateTrip}
          className="w-full bg-white/80 backdrop-blur border-2 border-dashed border-orange-300 rounded-2xl p-5 flex items-center justify-center gap-3 hover:bg-orange-50 hover:border-orange-400 transition-all group"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-rose-400 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-200 group-hover:scale-110 transition-transform">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div className="text-left">
            <div className="font-semibold text-stone-700">Plan a new adventure</div>
            <div className="text-stone-400 text-sm">AI will help you every step ✨</div>
          </div>
        </button>
      </div>

      <div className="px-5 pb-8">
        <h2 className="text-lg font-semibold text-stone-700 mb-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          Your Trips
        </h2>
        
        <div className="space-y-4">
          {trips.map((trip) => (
            <button
              key={trip.id}
              onClick={() => onSelectTrip(trip)}
              className="w-full bg-white rounded-3xl p-5 shadow-lg shadow-stone-100 hover:shadow-xl transition-all hover:-translate-y-1 text-left group relative overflow-hidden"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              <div className={`absolute top-0 left-0 w-2 h-full bg-gradient-to-b ${trip.color}`} />
              
              <div className="flex items-start gap-4 pl-2">
                <div className={`w-14 h-14 bg-gradient-to-br ${trip.color} rounded-2xl flex items-center justify-center text-2xl shadow-lg`}>
                  {trip.emoji}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-stone-800 text-lg group-hover:text-orange-600 transition-colors">
                        {trip.destination}
                      </h3>
                      <p className="text-stone-400 text-sm">{trip.country}</p>
                    </div>
                    {trip.status === 'upcoming' && (
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-600 text-xs font-semibold rounded-full">
                        Upcoming
                      </span>
                    )}
                    {trip.status === 'planning' && (
                      <span className="px-3 py-1 bg-orange-100 text-orange-600 text-xs font-semibold rounded-full">
                        Planning
                      </span>
                    )}
                    {trip.status === 'completed' && (
                      <span className="px-3 py-1 bg-stone-100 text-stone-500 text-xs font-semibold rounded-full">
                        Completed ✓
                      </span>
                    )}
                  </div>
                  
                  <p className="text-stone-500 text-sm mt-2">{trip.dates}</p>
                  
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full bg-gradient-to-r ${trip.color} rounded-full transition-all`}
                        style={{ width: `${trip.progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-stone-400 font-medium">{trip.progress}%</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============ CREATE TRIP PAGE ============
function CreateTripPage({ onBack, onCreateTrip }) {
  const [description, setDescription] = useState('');

  const examples = [
    { text: "Family trip to Tokyo, April 10-17 with my wife and 2 kids", icon: "🗼" },
    { text: "Romantic getaway to Santorini for our anniversary", icon: "💑" },
    { text: "Solo backpacking through Portugal for 2 weeks", icon: "🎒" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50">
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap" rel="stylesheet" />
      
      <div className="px-5 pt-14 pb-4">
        <button onClick={onBack} className="flex items-center gap-2 text-stone-500 hover:text-stone-700 transition-colors mb-4">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span style={{ fontFamily: "'DM Sans', sans-serif" }}>Back</span>
        </button>
        
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-rose-400 rounded-3xl flex items-center justify-center shadow-xl shadow-orange-200">
            <span className="text-3xl">✨</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-stone-800" style={{ fontFamily: "'Playfair Display', serif" }}>
              New Adventure
            </h1>
            <p className="text-stone-500" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Tell us about your dream trip
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 py-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-3xl p-5 mb-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🪄</span>
              <span className="font-semibold">AI-Powered Planning</span>
            </div>
            <p className="text-violet-100 text-sm">
              Describe your trip naturally and our AI will extract dates, destinations, and travelers to craft your perfect itinerary.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-lg shadow-stone-100 mb-6">
          <label className="block text-sm font-medium text-stone-600 mb-3">
            Describe your trip
          </label>
          <div className="relative">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="I want to explore Chile for a week with my family. We love hiking, great food, and maybe visit a volcano..."
              className="w-full bg-stone-50 border-2 border-stone-100 focus:border-orange-300 focus:bg-white rounded-2xl p-4 min-h-[140px] text-stone-700 placeholder-stone-400 outline-none transition-all resize-none"
            />
            <div className="absolute bottom-3 right-3 flex gap-2">
              <button className="w-10 h-10 bg-stone-100 hover:bg-stone-200 rounded-xl flex items-center justify-center transition-colors">
                <span className="text-lg">🎤</span>
              </button>
              <button className="w-10 h-10 bg-stone-100 hover:bg-stone-200 rounded-xl flex items-center justify-center transition-colors">
                <span className="text-lg">📎</span>
              </button>
            </div>
          </div>
          
          <button 
            onClick={onCreateTrip}
            className="w-full mt-4 bg-gradient-to-r from-orange-400 to-rose-400 hover:from-orange-500 hover:to-rose-500 text-white font-semibold py-4 rounded-2xl shadow-lg shadow-orange-200 transition-all hover:shadow-xl flex items-center justify-center gap-2"
          >
            <span>Create Trip</span>
            <span>→</span>
          </button>
        </div>

        <div>
          <h3 className="text-sm font-medium text-stone-500 mb-3">Try an example</h3>
          <div className="space-y-2">
            {examples.map((example, i) => (
              <button
                key={i}
                onClick={() => setDescription(example.text)}
                className="w-full bg-white/60 hover:bg-white border border-white hover:border-orange-200 rounded-2xl p-4 text-left transition-all flex items-center gap-3"
              >
                <span className="text-2xl">{example.icon}</span>
                <span className="text-stone-600 text-sm">{example.text}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 bg-amber-50 rounded-2xl p-4 border border-amber-100">
          <h4 className="font-medium text-amber-800 mb-2 flex items-center gap-2">
            <span>💡</span> Tips for best results
          </h4>
          <ul className="text-sm text-amber-700 space-y-1">
            <li>• Include who's traveling (names and ages)</li>
            <li>• Mention your interests and must-sees</li>
            <li>• Add flight/hotel info if you have it</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ============ ACTIVITY CARD COMPONENT ============
function ActivityCard({ activity, isExpanded, onToggle }) {
  const suggestions = [
    { name: 'Sky Costanera', subtitle: 'Tallest building in South America', image: '🏙️', rating: 4.8, match: true },
    { name: 'Cerro Santa Lucía', subtitle: 'Historic hilltop park', image: '⛰️', rating: 4.6 },
    { name: 'La Chascona', subtitle: "Pablo Neruda's house museum", image: '🏠', rating: 4.7 },
    { name: 'Mercado Central', subtitle: 'Famous seafood market', image: '🦞', rating: 4.5 },
  ];

  if (activity.confirmed) {
    return (
      <div className="bg-white rounded-2xl overflow-hidden shadow-md">
        {/* Photo header */}
        <div className="h-32 bg-gradient-to-br from-orange-300 via-rose-300 to-amber-300 relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-5xl">{activity.icon}</span>
          </div>
          <div className="absolute top-3 right-3 px-2 py-1 bg-white/90 backdrop-blur rounded-lg text-xs font-medium text-stone-600">
            {activity.time}
          </div>
          {activity.badge && (
            <div className="absolute top-3 left-3 px-2 py-1 bg-green-500 text-white rounded-lg text-xs font-semibold">
              {activity.badge}
            </div>
          )}
        </div>
        
        {/* Content */}
        <div className="p-4">
          <h3 className="font-semibold text-stone-800 text-lg">{activity.title}</h3>
          <p className="text-stone-500 text-sm mt-1">{activity.subtitle}</p>
          
          {/* Expandable details */}
          <button 
            onClick={onToggle}
            className="mt-3 flex items-center gap-1 text-orange-500 text-sm font-medium"
          >
            {isExpanded ? 'Hide details' : 'Show details'}
            <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {isExpanded && (
            <div className="mt-3 pt-3 border-t border-stone-100 text-sm text-stone-600 space-y-2">
              <p>📍 Costanera Center, Providencia, Santiago</p>
              <p>⏱️ Recommended visit: 1-2 hours</p>
              <p>💰 Entry: $15 USD per person</p>
              <p className="text-stone-500 italic">360° views of Santiago and the Andes mountains from floors 61-62. Best visited on clear days.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Unconfirmed - show suggestions
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-md">
      <div className="p-4 border-b border-stone-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center text-xl border-2 border-dashed border-stone-300">
              {activity.icon}
            </div>
            <div>
              <h3 className="font-medium text-stone-700">{activity.title}</h3>
              <p className="text-stone-400 text-sm">{activity.time}</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Horizontal scrolling suggestions */}
      <div className="p-4">
        <p className="text-sm text-stone-500 mb-3">Suggestions for you</p>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {suggestions.map((suggestion, i) => (
            <button
              key={i}
              className="flex-shrink-0 w-40 bg-stone-50 hover:bg-orange-50 rounded-xl overflow-hidden border border-stone-100 hover:border-orange-200 transition-all text-left"
            >
              <div className="h-20 bg-gradient-to-br from-stone-200 to-stone-300 flex items-center justify-center relative">
                <span className="text-3xl">{suggestion.image}</span>
                {suggestion.match && (
                  <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-green-500 text-white text-xs font-medium rounded">
                    Best
                  </span>
                )}
              </div>
              <div className="p-3">
                <h4 className="font-medium text-stone-800 text-sm truncate">{suggestion.name}</h4>
                <p className="text-stone-400 text-xs truncate">{suggestion.subtitle}</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-amber-500 text-xs">★</span>
                  <span className="text-xs text-stone-500">{suggestion.rating}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============ TRIP DETAIL PAGE ============
function TripDetailPage({ trip, onBack }) {
  const [selectedDay, setSelectedDay] = useState(2);
  const [chatMessage, setChatMessage] = useState('');
  const [version, setVersion] = useState(1);
  const totalVersions = 3;
  const [expandedActivity, setExpandedActivity] = useState(null);
  
  const travelers = [
    { name: 'Diego', avatar: '👨‍💼', color: 'from-blue-400 to-cyan-400' },
    { name: 'Stephanie', avatar: '👩', color: 'from-pink-400 to-rose-400' },
    { name: 'Oliver', avatar: '👦', color: 'from-green-400 to-emerald-400' },
    { name: 'Thomas', avatar: '👦', color: 'from-orange-400 to-amber-400' },
  ];

  const days = [
    { day: 1, date: 'Sat, Jan 24', label: 'Arrival' },
    { day: 2, date: 'Sun, Jan 25', label: 'Santiago' },
    { day: 3, date: 'Mon, Jan 26', label: 'Santiago' },
    { day: 4, date: 'Tue, Jan 27', label: 'Pucón' },
    { day: 5, date: 'Wed, Jan 28', label: 'Pucón' },
  ];

  const activities = {
    1: [
      { id: 1, time: '3:00 PM', title: 'Arrive at Santiago Airport', icon: '✈️', confirmed: true, subtitle: 'SCL International Terminal' },
      { id: 2, time: '5:00 PM', title: 'APT Serviced Apartments', icon: '🏨', confirmed: true, subtitle: 'Las Condes, Santiago • Check-in' },
      { id: 3, time: '7:30 PM', title: 'Dinner', icon: '🍽️', confirmed: false, subtitle: 'Find a restaurant' },
    ],
    2: [
      { id: 4, time: '9:00 AM', title: 'Sky Costanera', icon: '🏙️', confirmed: true, subtitle: "Latin America's tallest observation deck", badge: 'Best match' },
      { id: 5, time: '12:30 PM', title: 'Lunch at Mestizo', icon: '🍽️', confirmed: true, subtitle: 'Elegant lakeside Chilean cuisine' },
      { id: 6, time: '3:00 PM', title: 'Afternoon Activity', icon: '🎯', confirmed: false, subtitle: 'Choose an activity' },
      { id: 7, time: '7:00 PM', title: 'Dinner', icon: '🌮', confirmed: false, subtitle: 'Find a restaurant' },
    ],
  };

  const currentActivities = activities[selectedDay] || activities[1];

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 flex flex-col">
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap" rel="stylesheet" />
      
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto pb-24">
        {/* Header */}
        <div className="relative">
          <div className="h-48 bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-500 relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-8xl opacity-30">🏔️</span>
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            
            <button 
              onClick={onBack}
              className="absolute top-12 left-4 w-10 h-10 bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <button className="absolute top-12 right-4 w-10 h-10 bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </button>
            
            <div className="absolute bottom-4 left-5 right-5">
              <h1 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
                Santiago & Pucón
              </h1>
              <p className="text-white/80 text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                Jan 25 - Feb 1, 2026 • 8 days
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 -mt-4 relative z-10" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          {/* Travelers */}
          <div className="bg-white rounded-2xl p-4 shadow-lg shadow-stone-100 mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-stone-500">Travelers</span>
              <button className="text-orange-500 text-sm font-medium">+ Add</button>
            </div>
            <div className="flex gap-3">
              {travelers.map((t) => (
                <div key={t.name} className="text-center">
                  <div className={`w-12 h-12 bg-gradient-to-br ${t.color} rounded-full flex items-center justify-center text-xl shadow-md mb-1`}>
                    {t.avatar}
                  </div>
                  <span className="text-xs text-stone-500">{t.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Version Selector */}
          <div className="bg-white rounded-2xl p-4 shadow-lg shadow-stone-100 mb-4">
            <div className="flex items-center justify-between">
              <button 
                onClick={() => setVersion(Math.max(1, version - 1))}
                disabled={version === 1}
                className="w-10 h-10 rounded-xl bg-stone-100 hover:bg-stone-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
              >
                <svg className="w-5 h-5 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              <div className="text-center">
                <p className="text-sm font-medium text-stone-700">Version {version} of {totalVersions}</p>
                <p className="text-xs text-stone-400">AI-generated itinerary</p>
              </div>
              
              <button 
                onClick={() => setVersion(Math.min(totalVersions, version + 1))}
                disabled={version === totalVersions}
                className="w-10 h-10 rounded-xl bg-stone-100 hover:bg-stone-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
              >
                <svg className="w-5 h-5 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Day Selector */}
          <div className="mb-4 -mx-5 px-5">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {days.map((d) => (
                <button
                  key={d.day}
                  onClick={() => setSelectedDay(d.day)}
                  className={`flex-shrink-0 px-4 py-3 rounded-2xl transition-all ${
                    selectedDay === d.day
                      ? 'bg-gradient-to-r from-orange-400 to-rose-400 text-white shadow-lg shadow-orange-200'
                      : 'bg-white text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  <div className="text-xs opacity-80">Day {d.day}</div>
                  <div className="font-semibold text-sm">{d.label}</div>
                  <div className={`text-xs ${selectedDay === d.day ? 'text-white/80' : 'text-stone-400'}`}>
                    {d.date}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Activities */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-stone-800">
                {days.find(d => d.day === selectedDay)?.date}
              </h2>
              <span className="text-sm text-stone-400">
                {currentActivities.filter(a => a.confirmed).length}/{currentActivities.length} planned
              </span>
            </div>

            {currentActivities.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                isExpanded={expandedActivity === activity.id}
                onToggle={() => setExpandedActivity(expandedActivity === activity.id ? null : activity.id)}
              />
            ))}
            
            <button className="w-full py-3 border-2 border-dashed border-stone-200 rounded-2xl text-stone-400 hover:border-orange-300 hover:text-orange-500 transition-all flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add activity
            </button>
          </div>

          {/* Quick actions */}
          <div className="mt-4 flex gap-3 mb-6">
            <button className="flex-1 bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 hover:shadow-md transition-all">
              <span className="text-xl">🗺️</span>
              <span className="text-sm font-medium text-stone-600">View Map</span>
            </button>
            <button className="flex-1 bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 hover:shadow-md transition-all">
              <span className="text-xl">📤</span>
              <span className="text-sm font-medium text-stone-600">Share Trip</span>
            </button>
          </div>
        </div>
      </div>

      {/* Fixed AI Chat Input */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 p-4 shadow-lg" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder="Ask AI to update your itinerary..."
                className="w-full px-4 py-3 bg-stone-100 rounded-2xl border-2 border-transparent focus:border-orange-300 focus:bg-white outline-none transition-all"
              />
            </div>
            <button className="w-12 h-12 bg-gradient-to-r from-orange-400 to-rose-400 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-200 hover:shadow-xl transition-all flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ MAIN APP ============
export default function BagginsApp() {
  const [currentPage, setCurrentPage] = useState('landing');
  const [selectedTrip, setSelectedTrip] = useState(null);

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen shadow-2xl relative overflow-hidden">
      {currentPage === 'landing' && (
        <LandingPage onLogin={() => setCurrentPage('trips')} />
      )}

      {currentPage === 'trips' && (
        <TripsPage 
          onSelectTrip={(trip) => {
            setSelectedTrip(trip);
            setCurrentPage('tripDetail');
          }}
          onCreateTrip={() => setCurrentPage('create')}
        />
      )}

      {currentPage === 'create' && (
        <CreateTripPage 
          onBack={() => setCurrentPage('trips')}
          onCreateTrip={() => setCurrentPage('trips')}
        />
      )}

      {currentPage === 'tripDetail' && (
        <TripDetailPage 
          trip={selectedTrip}
          onBack={() => setCurrentPage('trips')}
        />
      )}

      {/* Page Selector for Demo */}
      <div className="fixed top-3 left-3 z-50 flex gap-1.5 bg-black/30 backdrop-blur-sm p-1.5 rounded-full">
        {[
          { id: 'landing', icon: '🚪' },
          { id: 'trips', icon: '📋' },
          { id: 'create', icon: '✨' },
          { id: 'tripDetail', icon: '🗺️' },
        ].map((page) => (
          <button
            key={page.id}
            onClick={() => setCurrentPage(page.id)}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
              currentPage === page.id 
                ? 'bg-white shadow-md scale-110' 
                : 'hover:bg-white/20'
            }`}
          >
            {page.icon}
          </button>
        ))}
      </div>
    </div>
  );
}
