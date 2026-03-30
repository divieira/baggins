/**
 * Pre-defined test scenarios for LLM-judged E2E tests.
 *
 * Each scenario represents a realistic trip that a user might plan,
 * with expected traits the judge should verify.
 */

import { TestScenario } from './types';

export const SCENARIOS: Record<string, TestScenario> = {
  familyParis: {
    name: 'Family Paris Trip',
    description: 'Family of 4 with young children visiting Paris',
    tripMessage:
      'We\'re planning a trip to Paris from March 15-20, 2026. Our family: ' +
      'John (38), Sarah (36), Emma (8), and Liam (5). Flying from NYC JFK to ' +
      'Paris CDG on Air France AF001 departing March 15 at 6pm, arriving March 16 at 7am. ' +
      'Staying at Hotel Le Marais near the Marais district.',
    context: {
      destination: 'Paris, France',
      start_date: '2026-03-16',
      end_date: '2026-03-20',
      travelers: [
        { name: 'John', age: 38 },
        { name: 'Sarah', age: 36 },
        { name: 'Emma', age: 8 },
        { name: 'Liam', age: 5 },
      ],
    },
    expectedTraits: [
      'Kid-friendly attractions should be well-represented',
      'Attractions should be in Paris (coordinates ~48.8, ~2.3)',
      'Should include iconic Paris landmarks (Eiffel Tower, Louvre, etc.)',
      'Restaurant suggestions should include family-friendly options',
      'No nightclub or bar suggestions (young children present)',
    ],
    modificationRequests: [
      'Add more kid-friendly activities, our 5-year-old loves animals and playgrounds',
      'Replace expensive restaurants with budget-friendly options',
      'We want more outdoor activities since the weather should be nice',
    ],
  },

  soloTokyo: {
    name: 'Solo Tokyo Adventure',
    description: 'Solo traveler exploring Tokyo, interested in tech and food',
    tripMessage:
      'Solo trip to Tokyo, June 1-7, 2026. I\'m Alex, 28 years old. ' +
      'I love technology, anime, and street food. Flying from LAX to Narita on ' +
      'Japan Airlines JL061. Staying near Shinjuku station.',
    context: {
      destination: 'Tokyo, Japan',
      start_date: '2026-06-01',
      end_date: '2026-06-07',
      travelers: [{ name: 'Alex', age: 28 }],
    },
    expectedTraits: [
      'Should include Akihabara (electronics/anime district)',
      'Attractions should be in Tokyo (coordinates ~35.6, ~139.7)',
      'Restaurant suggestions should feature Japanese cuisine',
      'Should include diverse dining (ramen, sushi, izakaya, etc.)',
      'Evening activities should reflect solo traveler flexibility',
    ],
    modificationRequests: [
      'I want to spend a full day in Akihabara, reorganize the schedule',
      'Add more ramen shops, I want to try different styles each day',
    ],
  },

  coupleRome: {
    name: 'Romantic Rome Getaway',
    description: 'Couple celebrating anniversary in Rome',
    tripMessage:
      'Romantic trip to Rome for our 10th anniversary. Maria and Paolo, both 35. ' +
      'April 5-10, 2026. We love art, wine, and history. Flying from Chicago O\'Hare. ' +
      'Staying at Hotel de Russie near Piazza del Popolo.',
    context: {
      destination: 'Rome, Italy',
      start_date: '2026-04-05',
      end_date: '2026-04-10',
      travelers: [
        { name: 'Maria', age: 35 },
        { name: 'Paolo', age: 35 },
      ],
    },
    expectedTraits: [
      'Attractions should be in Rome (coordinates ~41.9, ~12.5)',
      'Should include major Rome sites (Colosseum, Vatican, Pantheon, etc.)',
      'Restaurants should feature Italian cuisine prominently',
      'Should include romantic dining options (not fast food)',
      'Art museums and galleries should be well-represented',
    ],
    modificationRequests: [
      'Add a wine tasting experience and a cooking class',
      'We want one day to just wander Trastevere, adjust the schedule',
    ],
  },

  budgetBangkok: {
    name: 'Budget Bangkok Backpacking',
    description: 'Budget-conscious friends exploring Bangkok',
    tripMessage:
      'Backpacking through Bangkok for 5 days, April 10-15, 2026. ' +
      'Two friends: Jake (24) and Sam (25). We love street food, temples, ' +
      'and nightlife. Budget-friendly please! Flying from Sydney.',
    context: {
      destination: 'Bangkok, Thailand',
      start_date: '2026-04-10',
      end_date: '2026-04-15',
      travelers: [
        { name: 'Jake', age: 24 },
        { name: 'Sam', age: 25 },
      ],
    },
    expectedTraits: [
      'Attractions should be in Bangkok (coordinates ~13.7, ~100.5)',
      'Should include famous temples (Wat Phra Kaew, Wat Arun, etc.)',
      'Restaurants should be budget-friendly (price levels 1-2)',
      'Should include street food options',
      'Evening options should include nightlife/markets',
    ],
    modificationRequests: [
      'Add more night markets and street food spots',
      'We want to visit Chatuchak market on the weekend, adjust the plan',
    ],
  },
};

/**
 * Get a scenario by name. Throws if not found.
 */
export function getScenario(name: keyof typeof SCENARIOS): TestScenario {
  const scenario = SCENARIOS[name];
  if (!scenario) {
    throw new Error(`Unknown scenario: ${String(name)}. Available: ${Object.keys(SCENARIOS).join(', ')}`);
  }
  return scenario;
}

/**
 * All scenario names for iterating.
 */
export const ALL_SCENARIO_NAMES = Object.keys(SCENARIOS) as (keyof typeof SCENARIOS)[];
