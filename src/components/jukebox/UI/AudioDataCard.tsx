import { FC } from 'react';
import { AudioData, NetworkStats, PlaybackState, AudioFormat, AudioFile } from '../audio-data/types';
import { calculateBufferHealth } from '../audio-data/utils';

interface AudioDataCardProps {
  audioData: AudioData | null;
  isVisible: boolean;
}

export const AudioDataCard: FC<AudioDataCardProps> = ({ audioData, isVisible }) => {
  if (!isVisible) return null;

  // Show message when no audio data is available
  if (!audioData) {
    console.log('📊 AudioDataCard: No audio data available:', {
      receivedData: !!audioData,
      isVisible
    });
    return (
      <div className="bg-gray-900 p-8 rounded text-center">
        <p className="text-gray-400 text-lg">
          No audio data available yet.
        </p>
        <p className="text-gray-500 mt-2">
          Select a song from the builder to see detailed audio information.
        </p>
      </div>
    );
  }

  // Log when we receive new audio data
  console.log('📊 AudioDataCard: Received audio data update:', {
    hasPlayback: !!audioData.playback,
    currentTime: audioData.playback?.currentTime || 0,
    readyState: audioData.playback?.readyState || 0,
    networkState: audioData.playback?.networkState || 0,
    bufferedRegions: audioData.playback?.buffered?.length || 0
  });

  const {
    networkStats = {
      downlink: 0,
      effectiveType: 'unknown',
      rtt: 0,
      bufferFillRate: 0,
      lastRebuffer: 0
    } as NetworkStats,
    playback = {
      readyState: 0,
      networkState: 0,
      buffered: [],
      currentTime: 0,
      duration: 0
    } as PlaybackState,
    format = {
      channels: 0,
      sampleRate: 0,
      bitDepth: 0,
      duration: 0
    } as AudioFormat,
    file = {
      size: 0,
      path: '',
      contentType: 'audio/wav'
    } as AudioFile
  } = audioData;

  // Calculate buffer health
  const bufferHealth = calculateBufferHealth(audioData, {
    minBuffer: 2,
    maxBuffer: 10,
    rebufferPoint: 3,
    reason: `Network speed: ${networkStats.downlink.toFixed(1)} Mbps`
  });

  // Calculate buffer progress
  const currentBuffered = playback.buffered[0]?.end || 0;
  const bufferProgress = (currentBuffered / playback.duration * 100) || 0;
  const timeUntilRebuffer = currentBuffered - playback.currentTime;

  return (
    <div className="bg-gray-900 p-4 rounded text-green-400 text-sm font-mono">
      <div className="space-y-4">
        {/* Network and Buffer Analysis */}
        <div>
          <p className="text-blue-400 font-bold">Network Analysis:</p>
          <p className="pl-4">Connection Speed: {networkStats.downlink?.toFixed(1) || 0} Mbps</p>
          <p className="pl-4">Connection Type: {networkStats.effectiveType || 'unknown'}</p>
          <p className="pl-4">Round Trip Time: {networkStats.rtt || 0}ms</p>
          <p className="pl-4">Buffer Fill Rate: {((networkStats.bufferFillRate || 0) / 1024).toFixed(2)} KB/s</p>
        </div>

        {/* Add Buffer Strategy Section */}
        <div>
          <p className="text-blue-400 font-bold">Buffer Strategy:</p>
          <p className="pl-4">Current Mode: {networkStats.downlink > 5 ? 'Fast' : networkStats.downlink > 2 ? 'Medium' : 'Slow'}</p>
          <p className="pl-4">Min Buffer Required: 2s</p>
          <p className="pl-4">Max Buffer Size: 10s</p>
          <p className="pl-4">Rebuffer Trigger: 3s</p>
          <p className="pl-4 text-yellow-400">Reason: Network speed: {networkStats.downlink.toFixed(1)} Mbps</p>
        </div>

        {/* Add Real-time Buffer Status */}
        <div>
          <p className="text-blue-400 font-bold">Real-time Buffer Status:</p>
          <div className="w-full bg-gray-700 rounded-full h-2.5 mb-2">
            <div 
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${bufferProgress}%` }}
            />
          </div>
          <p className="pl-4 text-xs">Buffer Progress: {bufferProgress.toFixed(1)}%</p>
          <p className="pl-4">Buffer Health: {bufferHealth.isHealthy ? '✅ Healthy' : '⚠️ Building Buffer'}</p>
          <p className="pl-4">Time Until Rebuffer: {timeUntilRebuffer.toFixed(1)}s</p>
        </div>

        {/* Format Information */}
        <div>
          <p className="text-blue-400 font-bold">Format Information:</p>
          <p className="pl-4">
            Channels: {format.channels || 'Loading...'} 
            {format.channels === 2 && ' (Stereo)'}
          </p>
          <p className="pl-4">
            Sample Rate: {format.sampleRate || 'Loading...'} 
            {format.sampleRate ? 'Hz' : ''}
          </p>
          <p className="pl-4">
            Bit Depth: {format.bitDepth || 'Loading...'} 
            {format.bitDepth ? 'bits' : ''}
          </p>
          <p className="pl-4">Duration: {
            format.duration 
              ? `${format.duration.toFixed(2)}s (${(format.duration / 60).toFixed(2)} minutes)`
              : 'Loading...'
          }</p>
        </div>

        {/* File Information */}
        <div>
          <p className="text-blue-400 font-bold">File Information:</p>
          <p className="pl-4">Size: {
            file.size 
              ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
              : 'Loading...'
          }</p>
          <p className="pl-4">Bit Rate: {
            (file.size && format.duration)
              ? `${((file.size * 8) / format.duration / 1000).toFixed(2)} kbps`
              : 'Loading...'
          }</p>
          <p className="pl-4">Type: {file.contentType || 'Loading...'}</p>
        </div>

        {/* Playback State */}
        <div>
          <p className="text-blue-400 font-bold">Playback State:</p>
          <p className="pl-4">Ready State: {playback.readyState || 0} - {
            ['HAVE_NOTHING', 'HAVE_METADATA', 'HAVE_CURRENT_DATA', 'HAVE_FUTURE_DATA', 'HAVE_ENOUGH_DATA'][playback.readyState || 0]
          }</p>
          <p className="pl-4">Network State: {playback.networkState || 0} - {
            ['NETWORK_EMPTY', 'NETWORK_IDLE', 'NETWORK_LOADING', 'NETWORK_NO_SOURCE'][playback.networkState || 0]
          }</p>
          <p className="pl-4">Current Time: {(playback.currentTime || 0).toFixed(2)}s</p>
          <p className="pl-4">Buffered Regions:</p>
          {(playback.buffered || []).length > 0 ? (
            playback.buffered.map((region, i) => (
              <p key={i} className="pl-8">
                Region {i + 1}: {region.start.toFixed(2)}s - {region.end.toFixed(2)}s 
                {format.duration > 0 && ` (${((region.end - region.start) / format.duration * 100).toFixed(1)}%)`}
              </p>
            ))
          ) : (
            <p className="pl-8 text-yellow-400">No buffered regions yet</p>
          )}
        </div>
      </div>
    </div>
  );
}; 