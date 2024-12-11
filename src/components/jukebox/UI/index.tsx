import { FC, useState, useEffect } from 'react';
import { AudioData } from '../audio-data/types';
import { AudioDataManager } from '../audio-data';
import { PlaylistState, PlaybackStats, PlaylistItem } from '../playlist/types';
import { BuilderState, SelectionStep } from '../playlist-builder/types';
import { TabButton } from './TabButton';
import dynamic from 'next/dynamic';

// Import PlayerCard with no SSR
const PlayerCard = dynamic<any>(
  () => import('./PlayerCard').then(mod => mod.PlayerCard),
  { ssr: false }
);
import { PlaylistCard } from './PlaylistCard';
import { BuilderCard } from './BuilderCard';
import { AudioDataCard } from './AudioDataCard';

export type ActiveTab = 'audioData' | 'playlist' | 'builder';

interface JukeboxUIProps {
  audioData: AudioData | null;
  audioDataManager: AudioDataManager | null;
  playbackStats: PlaybackStats;
  playlistState: PlaylistState;
  builderState: BuilderState;
  isBuffering: boolean;
  bufferProgress: number;
  onPlayModeChange: (state: Partial<PlaylistState>) => void;
  onRemoveSong: (index: number) => void;
  onSelectionChange: (type: string, value: string, selected: boolean) => void;
  onSongSelect: (songId: string) => void;
  onPlaylistSongSelect: (songId: string) => void;
  onPlay: () => void;
  onPause: () => void;
  currentSong: PlaylistItem | null;
  onSongLoad: (songId: string) => void;
  onStepChange: (step: SelectionStep) => void;
  onResetSelection: () => void;
  onRemoveFromSelection: (song: PlaylistItem) => void;
  onPlayPlaylist: () => void;
}

export const JukeboxUI: FC<JukeboxUIProps> = ({
  audioData,
  audioDataManager,
  playbackStats,
  playlistState,
  builderState,
  isBuffering,
  bufferProgress,
  onPlayModeChange,
  onRemoveSong,
  onSelectionChange,
  onSongSelect,
  onPlaylistSongSelect,
  onPlay,
  onPause,
  currentSong,
  onSongLoad,
  onStepChange,
  onResetSelection,
  onRemoveFromSelection,
  onPlayPlaylist
}) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('builder');

  const handlePlaylistIndexSelect = async (index: number): Promise<void> => {
    const selectedSong = playlistState.items[index];
    if (selectedSong) {
      await Promise.resolve(onPlaylistSongSelect(selectedSong.id));
    }
  };

  return (
    <>
      <div className="hidden sm:flex justify-center mt-[5vh] mb-[5vh]">
        <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-500 [text-shadow:3px_3px_0_#2563eb,6px_6px_0_#1e40af] tracking-wider uppercase">OGMASH Jukebox</h1>
      </div>
      <div className="bg-gray-900 rounded-xl p-4 sm:p-6 shadow-2xl h-screen sm:h-auto overflow-y-auto w-full">
        <div className="mb-4 sm:mb-6">
          <PlayerCard
            audioData={audioData}
            audioDataManager={audioDataManager}
            playlistState={playlistState}
            playbackStats={playbackStats}
            currentSong={currentSong}
            isBuffering={isBuffering}
            bufferProgress={bufferProgress}
            onPlay={onPlay}
            onPause={onPause}
            onPlayPlaylist={onPlayPlaylist}
            onPlayModeChange={onPlayModeChange}
          />
        </div>

        <div className="space-y-2">
          <div className="flex gap-2 border-b border-gray-700">
            <TabButton
              label="Builder"
              isActive={activeTab === 'builder'}
              onClick={() => setActiveTab('builder')}
            />
            <TabButton
              label="Playlist"
              isActive={activeTab === 'playlist'}
              onClick={() => setActiveTab('playlist')}
            />
            <TabButton
              label="Audio Data"
              isActive={activeTab === 'audioData'}
              onClick={() => setActiveTab('audioData')}
            />
          </div>

          <div className="bg-gray-800 rounded-lg">
            <BuilderCard
              builderState={builderState}
              onSelectionChange={onSelectionChange}
              onSongSelect={onSongSelect}
              onSongLoad={onSongLoad}
              currentSong={currentSong}
              onStepChange={onStepChange}
              onResetSelection={onResetSelection}
              isVisible={activeTab === 'builder'}
              playlistItems={playlistState.items}
              onRemoveFromSelection={onRemoveFromSelection}
              onTabChange={setActiveTab}
            />

            <AudioDataCard
              audioData={audioData}
              isVisible={activeTab === 'audioData'}
            />
            
            {activeTab === 'playlist' && (
              <PlaylistCard
                items={playlistState.items}
                currentIndex={playlistState.currentIndex}
                isPlaying={playlistState.isPlaying}
                mode={playlistState.mode}
                currentSong={currentSong?.songName}
                onRemove={onRemoveSong}
                onSongSelect={handlePlaylistIndexSelect}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
};
