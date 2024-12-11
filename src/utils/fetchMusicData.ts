export interface SongData {
  index: string;
  path: string;
  selectedOptions: {
    songName: string;
    genre: string;
    version: string;
    showHide: string;
  };
}

export const fetchMusicData = async () => {
  try {
    console.log('🔍 Fetching music list...');
    const response = await fetch('https://ogmash.ecousins25.workers.dev/getMusicList');
    const data = await response.json();
    console.log('✅ Music list fetched:', data);

    return data;
  } catch (error) {
    console.error('❌ Failed to fetch music data:', error);
    throw error;
  }
};
