import { PlaylistItem, PlaybackMode } from './types';

export const getNextSongIndex = (
  currentIndex: number,
  totalSongs: number,
  mode: PlaybackMode,
  repeat: boolean
): number | null => {
  if (currentIndex >= totalSongs - 1) {
    return repeat ? 0 : null;
  }

  return currentIndex + 1;
};

export const shouldTransitionToNext = (
  currentTime: number,
  duration: number,
  isPlaying: boolean
): boolean => {
  const END_THRESHOLD = 0.5; // seconds before end to transition
  return isPlaying && duration > 0 && (duration - currentTime) <= END_THRESHOLD;
};
