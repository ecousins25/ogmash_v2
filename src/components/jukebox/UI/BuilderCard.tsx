import { FC, useMemo, useEffect, useCallback } from 'react';
import { BuilderState, SelectionStep } from '../playlist-builder/types';
import { PlaylistItem } from '../playlist/types';
import { getAvailableGenres, getAvailableVersions, logInitialSongCount, logSelectedSongs, logSelectedGenres, logSelectedVersions, filterSongs } from '../playlist-builder/utils';
import { ActiveTab } from './index';

interface BuilderCardProps {
  builderState: BuilderState;
  onSelectionChange: (type: string, value: string, selected: boolean) => void;
  onSongSelect: (songId: string) => void;
  onSongLoad: (songId: string) => void;
  currentSong: PlaylistItem | null;
  onStepChange: (step: SelectionStep) => void;
  onResetSelection: () => void;
  isVisible: boolean;
  playlistItems: PlaylistItem[];
  onRemoveFromSelection: (song: PlaylistItem) => void;
  onTabChange: (tab: ActiveTab) => void;
}

export const BuilderCard: FC<BuilderCardProps> = ({
  builderState,
  onSelectionChange,
  onSongSelect,
  onSongLoad,
  currentSong,
  onStepChange,
  onResetSelection,
  isVisible,
  playlistItems,
  onRemoveFromSelection,
  onTabChange
}) => {
  const selectionKey = useMemo(() => {
    const { songs, genres, versions } = builderState.selection;
    return JSON.stringify({
      songs: Array.from(songs),
      genres: Array.from(genres),
      versions: Array.from(versions)
    });
  }, [builderState.selection]);

  const filteredSongs = useMemo(() => {
    if (builderState.currentStep !== 'complete') return [];
    return filterSongs(builderState.availableSongs, builderState.selection);
  }, [builderState.availableSongs, selectionKey, builderState.currentStep]);

  const availableGenres = useMemo(() => 
    builderState.currentStep === 'genres' 
      ? getAvailableGenres(builderState.availableSongs, builderState.selection.songs)
      : [],
    [builderState.currentStep, builderState.availableSongs, selectionKey]
  );

  const availableVersions = useMemo(() => 
    builderState.currentStep === 'versions'
      ? getAvailableVersions(
          builderState.availableSongs,
          builderState.selection.songs,
          builderState.selection.genres
        )
      : [],
    [builderState.currentStep, builderState.availableSongs, selectionKey]
  );

  const canMoveToNextStep = useCallback(() => {
    switch (builderState.currentStep) {
      case 'welcome':
        return true;
      case 'songs':
        return builderState.selection.songs.size > 0;
      case 'genres':
        return builderState.selection.genres.size > 0;
      case 'versions':
        return builderState.selection.versions.size > 0;
      default:
        return false;
    }
  }, [builderState.currentStep, selectionKey]);

  useEffect(() => {
    if (builderState.currentStep === 'welcome') {
      logInitialSongCount(builderState.availableSongs);
    }
  }, [builderState.currentStep, builderState.availableSongs]);

  useEffect(() => {
    if (builderState.currentStep === 'songs') {
      logSelectedSongs(builderState.availableSongs, builderState.selection.songs);
    }
  }, [builderState.currentStep, builderState.availableSongs, selectionKey]);

  useEffect(() => {
    if (builderState.currentStep === 'genres') {
      logSelectedGenres(
        builderState.availableSongs, 
        builderState.selection.songs,
        builderState.selection.genres
      );
    }
  }, [builderState.currentStep, builderState.availableSongs, selectionKey]);

  useEffect(() => {
    if (builderState.currentStep === 'versions') {
      logSelectedVersions(builderState.availableSongs, builderState.selection);
    }
  }, [builderState.currentStep, builderState.availableSongs, selectionKey]);

  useEffect(() => {
    if (builderState.currentStep === 'complete' && filteredSongs.length === 0) {
      onResetSelection();
    }
  }, [builderState.currentStep, filteredSongs.length, onResetSelection]);

  if (!isVisible) return null;

  const handleAddAllToPlaylist = () => {
    const newSongs = filteredSongs.filter(
      song => !playlistItems.some(item => item.id === song.id)
    );

    if (newSongs.length === 0) {
      alert('All these songs are already in the playlist. Click Build List to find new songs.');
      return;
    }

    newSongs.forEach(song => onSongSelect(song.id));
    onStepChange('add-more');
    onTabChange('playlist');
  };

  const handleAddToPlaylist = (songId: string) => {
    if (playlistItems.some(item => item.id === songId)) {
      alert('This song is already in the playlist');
      return;
    }
    onSongSelect(songId);
    onStepChange('add-more');
    onTabChange('playlist');
  };

  const renderStepContent = () => {
    switch (builderState.currentStep) {
      case 'welcome':
        return (
          <div className="text-white text-center p-8 space-y-4">
            <h2 className="text-2xl font-bold">Welcome to the Jukebox!</h2>
            <p className="text-gray-400">Let&apos;s help you build your perfect playlist.</p>
            <button
              onClick={() => onStepChange('songs')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
            >
              Get Started
            </button>
          </div>
        );

      case 'songs':
        return (
          <div className="space-y-4">
            <h2 className="text-white text-xl font-bold">Step 1: Select Songs</h2>
            <div className="space-y-2">
              {builderState.filterOptions.songNames.map((song: string) => (
                <label key={song} className="flex items-center space-x-3 text-white">
                  <input
                    type="checkbox"
                    checked={builderState.selection.songs.has(song)}
                    onChange={(e) => onSelectionChange('songs', song, e.target.checked)}
                    className="form-checkbox h-5 w-5 text-blue-600"
                  />
                  <span>{song}</span>
                </label>
              ))}
            </div>
            <button
              onClick={() => onStepChange('genres')}
              disabled={!canMoveToNextStep()}
              className={`w-full ${
                canMoveToNextStep() 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-gray-600 cursor-not-allowed'
              } text-white px-4 py-2 rounded transition-colors mt-4`}
            >
              Next: Select Genres
            </button>
          </div>
        );

      case 'genres':
        return (
          <div className="space-y-4">
            <h2 className="text-white text-xl font-bold">Step 2: Select Genres</h2>
            <div className="space-y-2">
              {availableGenres.map((genre: string) => (
                <label key={genre} className="flex items-center space-x-3 text-white">
                  <input
                    type="checkbox"
                    checked={builderState.selection.genres.has(genre)}
                    onChange={(e) => onSelectionChange('genres', genre, e.target.checked)}
                    className="form-checkbox h-5 w-5 text-blue-600"
                  />
                  <span>{genre}</span>
                </label>
              ))}
            </div>
            <button
              onClick={() => onStepChange('versions')}
              disabled={!canMoveToNextStep()}
              className={`w-full ${
                canMoveToNextStep() 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-gray-600 cursor-not-allowed'
              } text-white px-4 py-2 rounded transition-colors mt-4`}
            >
              Next: Select Versions
            </button>
          </div>
        );

      case 'versions':
        return (
          <div className="space-y-4">
            <h2 className="text-white text-xl font-bold">Step 3: Select Versions</h2>
            <div className="space-y-2">
              {availableVersions.map((version: string) => (
                <label key={version} className="flex items-center space-x-3 text-white">
                  <input
                    type="checkbox"
                    checked={builderState.selection.versions.has(version)}
                    onChange={(e) => onSelectionChange('versions', version, e.target.checked)}
                    className="form-checkbox h-5 w-5 text-blue-600"
                  />
                  <span>{version}</span>
                </label>
              ))}
            </div>
            <button
              onClick={() => onStepChange('complete')}
              disabled={!canMoveToNextStep()}
              className={`w-full ${
                canMoveToNextStep() 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-gray-600 cursor-not-allowed'
              } text-white px-4 py-2 rounded transition-colors mt-4`}
            >
              Next: Complete
            </button>
          </div>
        );

      case 'complete':
        if (filteredSongs.length === 0) {
          return null;
        }

        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-white text-xl font-bold">Available Songs</h2>
              <div className="flex gap-2">
                <button
                  onClick={handleAddAllToPlaylist}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
                >
                  Add All to Playlist
                </button>
                <button
                  onClick={onResetSelection}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition-colors"
                >
                  Build New List
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {filteredSongs.map((song) => (
                <div
                  key={song.id}
                  className="flex items-center justify-between bg-gray-800 p-4 rounded"
                >
                  <div>
                    <h3 className="text-white font-bold">{song.songName}</h3>
                    <p className="text-gray-400">{song.genre} - {song.version}</p>
                  </div>
                  <button
                    onClick={() => handleAddToPlaylist(song.id)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
                  >
                    Add to Playlist
                  </button>
                </div>
              ))}
            </div>
          </div>
        );

      case 'add-more':
        return (
          <div className="text-white text-center p-8 space-y-4">
            <h2 className="text-2xl font-bold">Add More Songs</h2>
            <p className="text-gray-400">Ready to expand your playlist?</p>
            <button
              onClick={() => onStepChange('songs')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
            >
              Select Songs
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-4">
      {renderStepContent()}
    </div>
  );
};
