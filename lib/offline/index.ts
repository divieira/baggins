/**
 * Offline support utilities for Baggins
 *
 * This module provides read-only offline access to cached trip data.
 * When online, data is cached automatically.
 * When offline, cached data is served for viewing.
 */

export * from './cache'
export * from './useOnlineStatus'
