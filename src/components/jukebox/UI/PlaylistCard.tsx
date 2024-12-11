import { FC, useMemo, useCallback } from 'react';
import { PlaylistItem, PlaybackMode } from '../playlist/types';
import { PlayIcon, TrashIcon } from '@heroicons/react/24/solid';

// Audio playback error constants
const PLAYBACK_ERRORS = {
  ABORTED: 'AbortError',
  NETWORK: 'NetworkError',
  DECODE: 'DecodeError',
  SRC_NOT_SUPPORTED: 'SourceNotSupported'
};

// Enhanced error logging
const logError = (error: any, context: string) => {
  console.error(`[PlaylistCard] ${context}:`, {
    message: error.message,
    name: error.name,
    code: error.code,
    type: error instanceof Error ? error.constructor.name : 'Unknown',
    details: error.details || 'No additional details'
  });
};

const LOG_THROTTLE = 1000;
let lastLogTime = 0;

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

interface PlaylistCardProps {
  items: PlaylistItem[];
  currentIndex: number;
  isPlaying: boolean;
  mode: PlaybackMode;
  currentSong?: string;
  onRemove: (index: number) => void;
  onSongSelect: (index: number) => Promise<void>;
}

export const PlaylistCard: FC<PlaylistCardProps> = ({
  items = [],
  currentIndex,
  isPlaying,
  mode,
  currentSong,
  onRemove,
  onSongSelect,
}) => {
  const memoizedEmptyState = useMemo(() => (
    <div className="text-center p-4 text-gray-400">
      <p>Your playlist is empty. Add some songs to get started!</p>
    </div>
  ), []);

  const isHighlighted = useMemo(() => {
    return (item: PlaylistItem, index: number) => {
      return index === currentIndex;
    };
  }, [currentIndex]);

  const handleSongSelect = useCallback(async (index: number) => {
    try {
      await onSongSelect(index);
    } catch (error: unknown) {
      const err = error as Error;
      switch (err.name) {
        case PLAYBACK_ERRORS.ABORTED:
          logError(err, 'Playback aborted by user');
          break;
        case PLAYBACK_ERRORS.NETWORK:
          logError(err, 'Network error during playback');
          break;
        case PLAYBACK_ERRORS.DECODE:
          logError(err, 'Audio decode error');
          break;
        case PLAYBACK_ERRORS.SRC_NOT_SUPPORTED:
          logError(err, 'Audio source not supported');
          break;
        default:
          logError(err, 'Unexpected playback error');
      }
    }
  }, [onSongSelect]);

  if (!Array.isArray(items)) {
    console.warn('PlaylistCard: items prop is not an array', items);
    return null;
  }

  if (items.length === 0) {
    return memoizedEmptyState;
  }

  return (
    <div className="bg-gray-800 rounded-lg p-2 sm:p-4">
      <h2 className="text-xl font-bold mb-4">Playlist</h2>
      <div className="space-y-2">
        {items.map((item, index) => {
          const highlighted = isHighlighted(item, index);
          return (
            <div
              key={`${item.id}-${index}`}
              className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                highlighted ? 'bg-gray-700' : 'bg-gray-800 hover:bg-gray-700/50'
              }`}
              onClick={() => handleSongSelect(index)}
            >
              <div className="flex items-center space-x-2">
                {highlighted && isPlaying ? (
                  <PlayIcon className="h-5 w-5 text-green-500" />
                ) : (
                  <div className="h-5 w-5" />
                )}
                <span>{item.songName} - {item.version}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(index);
                }}
                className="text-red-500 hover:text-red-400"
              >
                <TrashIcon className="h-5 w-5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
