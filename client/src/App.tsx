import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { trpc, trpcClient } from '@/lib/trpc';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { NewSongDialog } from '@/components/NewSongDialog';
import { SongList } from '@/components/SongList';
import { SongEditor } from '@/components/SongEditor';
import { Music4, Sparkles } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      refetchOnWindowFocus: false,
    },
  },
});

function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex">
      <div className="w-96 border-r border-border bg-card/30 flex flex-col">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent">
              <Music4 className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">CDG Creator</h1>
              <p className="text-xs text-muted-foreground">
                Karaoke Timeline Editor
              </p>
            </div>
          </div>
          <NewSongDialog onSongCreated={(id) => navigate(`/edit/${id}`)} />
        </div>

        <div className="flex-1 p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">
            Your Songs
          </h2>
          <SongList
            selectedSongId={null}
            onSelectSong={(id) => navigate(`/edit/${id}`)}
          />
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md px-8">
          <div className="flex items-center justify-center w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20">
            <Sparkles className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-2xl font-semibold mb-3">
            Create Amazing Karaoke
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Select a song from the sidebar or create a new one to start editing
            your karaoke timeline. Add lyrics, set timing, and customize colors
            for each singer.
          </p>
        </div>
      </div>
    </div>
  );
}

function EditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) {
    navigate('/');
    return null;
  }

  return (
    <SongEditor
      songId={id}
      onBack={() => navigate('/')}
    />
  );
}

function App() {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/edit/:id" element={<EditPage />} />
            </Routes>
          </BrowserRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

export default App;

