import React, { useState, useEffect } from 'react';
import { collection, getDocs, orderBy, limit, query } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';
import { firebaseApp } from '../lib/firebase';

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
        // For now, we'll create some mock data
        // In a real implementation, you'd fetch from a 'public_movies' collection
        const mockMovies: GalleryMovie[] = [
          {
            id: '1',
            title: 'The Adventures of Banana Man',
            description: 'A thrilling tale of a banana superhero saving the world from fruit villains!',
            videoUrl: 'https://example.com/video1.mp4',
            thumbnailUrl: 'https://via.placeholder.com/400x225/4F46E5/FFFFFF?text=Banana+Man',
            createdAt: new Date().toISOString(),
            views: 1250,
            likes: 89
          },
          {
            id: '2',
            title: 'Space Banana Odyssey',
            description: 'Join our brave banana astronaut on an epic journey through the cosmos!',
            videoUrl: 'https://example.com/video2.mp4',
            thumbnailUrl: 'https://via.placeholder.com/400x225/059669/FFFFFF?text=Space+Banana',
            createdAt: new Date(Date.now() - 86400000).toISOString(),
            views: 2100,
            likes: 156
          },
          {
            id: '3',
            title: 'The Great Banana Heist',
            description: 'A comedic caper involving a gang of fruit thieves and their ultimate heist!',
            videoUrl: 'https://example.com/video3.mp4',
            thumbnailUrl: 'https://via.placeholder.com/400x225/DC2626/FFFFFF?text=Banana+Heist',
            createdAt: new Date(Date.now() - 172800000).toISOString(),
            views: 890,
            likes: 67
          }
        ];
        
        setMovies(mockMovies);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching movies:', error);
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
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="relative">
              <video
                className="w-full h-auto"
                controls
                autoPlay
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
