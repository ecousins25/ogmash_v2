import { AudioData } from '../audio-data/types';

export type PlaybackMode = 'normal' | 'shuffle' | 'preview';

export interface PlaylistItem {
  id: string;
  path: string;
  songName: string;
  genre: string;
  version: string;
}

export interface PlaylistState {
  items: PlaylistItem[];
  currentIndex: number;
  isPlaying: boolean;
  mode: PlaybackMode;
  repeat: boolean;
  transitionTimeoutMs: number;
  currentSong?: string;
}

export interface PlaybackStats {
  currentTime: number;
  duration: number;
  isTransitioning: boolean;
  nextSongPreloaded: boolean;
  lastMode?: PlaybackMode;
}
