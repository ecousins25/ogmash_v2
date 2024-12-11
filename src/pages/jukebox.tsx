import Jukebox from '@/components/jukebox';

export default function JukeboxPage() {
  return (
    <div className="min-h-screen bg-sky-400 text-white flex flex-col">
      <main className="flex-grow sm:container sm:mx-auto sm:px-4 sm:py-8">
        <Jukebox />
      </main>
    </div>
  );
} 