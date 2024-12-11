import { PlaylistItem } from '../playlist/types';
import { Selection } from './types';

// Cache for genre and version lookups
const cache = {
  genres: new Map<string, Set<string>>(),
  versions: new Map<string, Set<string>>()
};

// Get available genres based on selected songs with caching
export const getAvailableGenres = (
  allSongs: PlaylistItem[],
  selectedSongs: Set<string>
): string[] => {
  if (selectedSongs.size === 0) return [];

  // Create cache key from selected songs
  const cacheKey = Array.from(selectedSongs).sort().join('|');
  
  if (!cache.genres.has(cacheKey)) {
    const genres = new Set<string>();
    allSongs
      .filter(song => selectedSongs.has(song.songName))
      .forEach(song => genres.add(song.genre));
    cache.genres.set(cacheKey, genres);
  }

  return Array.from(cache.genres.get(cacheKey) || new Set());
};

// Get available versions based on selected songs and genres with caching
export const getAvailableVersions = (
  allSongs: PlaylistItem[],
  selectedSongs: Set<string>,
  selectedGenres: Set<string>
): string[] => {
  if (selectedSongs.size === 0 || selectedGenres.size === 0) return [];

  // Create cache key from selected songs and genres
  const cacheKey = [
    Array.from(selectedSongs).sort().join('|'),
    Array.from(selectedGenres).sort().join('|')
  ].join('::');

  if (!cache.versions.has(cacheKey)) {
    const versions = new Set<string>();
    allSongs
      .filter(song => 
        selectedSongs.has(song.songName) && 
        selectedGenres.has(song.genre)
      )
      .forEach(song => versions.add(song.version));
    cache.versions.set(cacheKey, versions);
  }

  return Array.from(cache.versions.get(cacheKey) || new Set());
};

// Clear cache when needed (e.g., when songs list changes)
export const clearCache = () => {
  cache.genres.clear();
  cache.versions.clear();
};

// Logging functions with rate limiting
let lastLogTime = 0;
const LOG_THROTTLE = 100; // ms

const throttledLog = (message: string, data?: any) => {
  const now = Date.now();
  if (now - lastLogTime > LOG_THROTTLE) {
    if (data) {
      console.log(message, data);
    } else {
      console.log(message);
    }
    lastLogTime = now;
  }
};

export const logInitialSongCount = (songs: PlaylistItem[]) => {
  // Only log when explicitly called after Get Started
};

export const logSelectedSongs = (songs: PlaylistItem[], selectedSongs: Set<string>) => {
  if (selectedSongs.size === 0) return;
  
  selectedSongs.forEach(songName => {
    const count = songs.filter(s => s.songName === songName).length;
    throttledLog(`📀 Selected "${songName}": ${count} versions available`);
  });
};

export const logSelectedGenres = (
  songs: PlaylistItem[], 
  selectedSongs: Set<string>,
  selectedGenres: Set<string>
) => {
  if (selectedGenres.size === 0) return;

  selectedSongs.forEach(songName => {
    selectedGenres.forEach(genre => {
      const count = songs.filter(s => 
        s.songName === songName && 
        s.genre === genre
      ).length;
      throttledLog(`🎸 "${songName}" in ${genre}: ${count} versions`);
    });
  });
};

export const logSelectedVersions = (
  songs: PlaylistItem[],
  selection: Selection
) => {
  if (selection.versions.size === 0) return;

  const filteredSongs = filterSongs(songs, selection);
  throttledLog('✨ Final selection:', {
    songs: Array.from(selection.songs),
    genres: Array.from(selection.genres),
    versions: Array.from(selection.versions),
    matchingTracks: filteredSongs.length
  });
};

// Optimized filtering with early exit conditions
export const filterSongs = (
  songs: PlaylistItem[],
  selection: Selection
): PlaylistItem[] => {
  // Early exit if no selection criteria
  if (
    selection.songs.size === 0 ||
    selection.genres.size === 0 ||
    selection.versions.size === 0
  ) {
    return [];
  }

  // Only log when there's an actual selection with versions
  throttledLog('🔍 Filtering songs with criteria:', {
    songs: Array.from(selection.songs),
    genres: Array.from(selection.genres),
    versions: Array.from(selection.versions)
  });

  const filtered = songs.filter(song => {
    const songMatch = selection.songs.has(song.songName);
    if (!songMatch) return false;
    
    const genreMatch = selection.genres.has(song.genre);
    if (!genreMatch) return false;
    
    return selection.versions.has(song.version);
  });

  // Only log non-zero results when versions are selected
  if (filtered.length > 0) {
    throttledLog(`✨ Found ${filtered.length} matching songs`);
  }
  return filtered;
};

export const extractFilterOptions = (songs: PlaylistItem[]) => {
  return songs.reduce((options, song) => {
    options.songNames.add(song.songName);
    options.genres.add(song.genre);
    options.versions.add(song.version);
    return options;
  }, {
    songNames: new Set<string>(),
    genres: new Set<string>(),
    versions: new Set<string>()
  });
};
