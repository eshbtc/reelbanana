import React, { useState, useEffect } from 'react';
import { collection, getDocs, orderBy, limit, query } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';
import { firebaseApp } from '../lib/firebase';
import { getAppCheckToken } from '../lib/appCheck';

// Use centralized Firebase app for consistency and App Check
const db = getFirestore(firebaseApp);

interface GalleryMovie {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  createdAt: string;
  views: number;
  likes: number;
}

const PublicGallery: React.FC = () => {
  const [movies, setMovies] = useState<GalleryMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMovie, setSelectedMovie] = useState<GalleryMovie | null>(null);

  useEffect(() => {
    const fetchMovies = async () => {
      try {
        // Try to get App Check token for better compatibility
        try {
          const appCheckToken = await getAppCheckToken();
          if (appCheckToken) {
            console.log('🔐 PublicGallery: App Check token available for public access');
          } else {
            console.warn('🔐 PublicGallery: No App Check token available');
          }
        } catch (appCheckError) {
          console.warn('🔐 PublicGallery: App Check token error:', appCheckError);
        }

        // First attempt: Firestore SDK read (fast path)
        try {
          const col = collection(db, 'public_movies');
          const q = query(col, orderBy('createdAt', 'desc'), limit(18));
          const snap = await getDocs(q);
          const items: GalleryMovie[] = snap.docs.map((d) => {
            const data: any = d.data();
            return {
              id: d.id,
              title: data.title || 'Untitled Movie',
              description: data.description || '',
              videoUrl: data.videoUrl,
              thumbnailUrl: data.thumbnailUrl || 'https://via.placeholder.com/400x225/374151/FFFFFF?text=ReelBanana',
              createdAt: (data.createdAt?.toDate?.() || new Date()).toISOString(),
              views: data.views || 0,
              likes: data.likes || 0,
            };
          });
          setMovies(items);
          console.log('✅ PublicGallery: Successfully fetched', items.length, 'movies (Firestore)');
          return;
        } catch (fsErr) {
          console.warn('⚠️ PublicGallery: Firestore fetch failed, falling back to functions:', fsErr);
        }

        // Fallback: Cloud Function listPublicMovies (public)
        try {
          const resp = await fetch('https://us-central1-reel-banana-35a54.cloudfunctions.net/listPublicMovies', {
            headers: {
              'Content-Type': 'application/json'
            }
          });
          if (resp.ok) {
            const json = await resp.json();
            const items: GalleryMovie[] = (json.items || []).map((m: any) => ({
              id: m.id,
              title: m.title,
              description: m.description,
              videoUrl: m.videoUrl,
              thumbnailUrl: m.thumbnailUrl || 'https://via.placeholder.com/400x225/374151/FFFFFF?text=ReelBanana',
              createdAt: m.createdAt || new Date().toISOString(),
              views: 0,
              likes: 0,
            }));
            setMovies(items);
            console.log('✅ PublicGallery: Successfully fetched', items.length, 'movies (functions)');
            return;
          } else {
            console.warn('⚠️ PublicGallery: listPublicMovies returned', resp.status);
          }
        } catch (fnErr) {
          console.warn('⚠️ PublicGallery: functions fallback failed:', fnErr);
        }

        // Final fallback: empty state
        setMovies([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMovies();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k`;
    }
    return num.toString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-white mb-4">
          🎬 ReelBanana Gallery
        </h1>
        <p className="text-xl text-gray-300 max-w-2xl mx-auto">
          Discover amazing movies created by our community using AI-powered storytelling
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {movies.map((movie) => (
          <div
            key={movie.id}
            className="bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 cursor-pointer"
            onClick={() => setSelectedMovie(movie)}
          >
            <div className="relative">
              <img
                src={movie.thumbnailUrl}
                alt={movie.title}
                className="w-full h-48 object-cover"
              />
              <div className="absolute top-2 right-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-sm">
                {formatNumber(movie.views)} views
              </div>
              <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center">
                <div className="opacity-0 hover:opacity-100 transition-opacity duration-300">
                  <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8 5v10l8-5-8-5z" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-2">{movie.title}</h3>
              <p className="text-gray-400 text-sm mb-4 line-clamp-2">{movie.description}</p>
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>{formatDate(movie.createdAt)}</span>
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
                  </svg>
                  {formatNumber(movie.likes)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Movie Modal */}
      {selectedMovie && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[9999] p-4">
          <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="relative">
              <video
                className="w-full h-auto"
                controls
                autoPlay
                muted
                playsInline
                preload="metadata"
                poster={selectedMovie.thumbnailUrl}
                src={selectedMovie.videoUrl}
              >
                Your browser does not support the video tag.
              </video>
              <button
                onClick={() => setSelectedMovie(null)}
                className="absolute top-4 right-4 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-75 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <h2 className="text-2xl font-bold text-white mb-2">{selectedMovie.title}</h2>
              <p className="text-gray-300 mb-4">{selectedMovie.description}</p>
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <span>{formatDate(selectedMovie.createdAt)}</span>
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                  </svg>
                  {formatNumber(selectedMovie.views)} views
                </div>
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
                  </svg>
                  {formatNumber(selectedMovie.likes)} likes
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="text-center mt-12">
        <p className="text-gray-400 mb-4">
          Want to see your movie featured here?
        </p>
        <button className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-8 rounded-lg transition-colors">
          Create Your Movie
        </button>
      </div>
    </div>
  );
};

export default PublicGallery;
