import { PlaybackStats } from '../playlist/types';

export interface NetworkStats {
  downlink: number;
  effectiveType: string;
  rtt: number;
  bufferFillRate: number;
  lastRebuffer: number;
}

export interface BufferedRegion {
  start: number;
  end: number;
}

export interface PlaybackState {
  readyState: number;
  networkState: number;
  buffered: BufferedRegion[];
  currentTime: number;
  duration: number;
}

export interface AudioFormat {
  channels: number;
  sampleRate: number;
  bitDepth: number;
  duration: number;
}

export interface AudioFile {
  size: number;
  path: string;
  contentType: string;
  bitRate: number;
}

export interface AudioData {
  playback: PlaybackState;
  networkStats: NetworkStats;
  format: AudioFormat;
  file: AudioFile;
}

export interface BufferStrategy {
  minBuffer: number;
  maxBuffer: number;
  rebufferPoint: number;
  reason: string;
}

export interface AudioCallbacks {
  onPlaybackStats: (stats: PlaybackStats) => void;
  onBufferingChange: (isBuffering: boolean) => void;
  onBufferProgress: (progress: number) => void;
  onAudioDataUpdate: (data: AudioData) => void;
  onSongEnd: () => void;
}
