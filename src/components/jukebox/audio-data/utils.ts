import { NetworkStats, BufferStrategy, AudioData } from './types';

// Network speed thresholds (in Mbps)
const NETWORK_THRESHOLDS = {
  FAST: 5,
  MEDIUM: 2
};

export const calculateBufferStrategy = (networkStats: NetworkStats): BufferStrategy => {
  const { downlink } = networkStats;
  
  if (downlink > NETWORK_THRESHOLDS.FAST) {
    return {
      minBuffer: 2,
      maxBuffer: 10,
      rebufferPoint: 3,
      reason: `Fast network detected: ${downlink.toFixed(1)} Mbps`
    };
  } else if (downlink > NETWORK_THRESHOLDS.MEDIUM) {
    return {
      minBuffer: 5,
      maxBuffer: 15,
      rebufferPoint: 5,
      reason: `Medium network detected: ${downlink.toFixed(1)} Mbps`
    };
  } else {
    return {
      minBuffer: 15,
      maxBuffer: 30,
      rebufferPoint: 10,
      reason: `Slow network detected: ${downlink.toFixed(1)} Mbps`
    };
  }
};

export const calculateNetworkStats = (
  currentBytes: number,
  lastBytes: number,
  timeDiff: number
): Partial<NetworkStats> => {
  const bytesPerSecond = (currentBytes - lastBytes) / (timeDiff / 1000);
  const mbps = (bytesPerSecond * 8) / (1024 * 1024);

  return {
    downlink: mbps,
    effectiveType: mbps > 5 ? '4g' : mbps > 2 ? '3g' : '2g',
    bufferFillRate: bytesPerSecond
  };
};

export const getBufferedAmount = (audio: HTMLAudioElement): number => {
  if (audio.buffered.length === 0) return 0;
  return audio.buffered.end(audio.buffered.length - 1);
};

export const calculateBufferHealth = (
  audioData: AudioData,
  bufferStrategy: BufferStrategy
): {
  isHealthy: boolean;
  timeUntilStarve: number;
} => {
  const currentBuffer = audioData.playback.buffered[0]?.end || 0;
  const timeUntilStarve = currentBuffer - audioData.playback.currentTime;

  return {
    isHealthy: timeUntilStarve > bufferStrategy.rebufferPoint,
    timeUntilStarve
  };
};
