import React, { useState, useEffect } from 'react';
import axios from 'axios';

const VideoPlayer = ({ videoFolder }) => {
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const response = await axios.get(`http://localhost:5001/list_videos/${videoFolder}`);
        setVideos(response.data.videos);
      } catch (error) {
        setError('Failed to fetch videos');
        console.error('Error fetching videos:', error);
      }
    };

    if (videoFolder) {
      fetchVideos();
    }
  }, [videoFolder]);

  if (!videoFolder) return null;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="mt-4">
      <h3 className="text-lg font-semibold mb-2">Processed Videos</h3>

      <div className="space-y-4">
        {/* Video Selection */}
        <div>
          <select
            className="w-full p-2 border rounded"
            onChange={(e) => setSelectedVideo(videos.find(v => v.name === e.target.value))}
            value={selectedVideo?.name || ''}
          >
            <option value="">Select a video</option>
            {videos.map((video) => (
              <option key={video.name} value={video.name}>
                {video.name}
              </option>
            ))}
          </select>
        </div>

        {/* Video Player */}
        {selectedVideo && (
          <div className="video-container" style={{ marginTop: '2rem' }}>
            <video
              className="w-full rounded shadow-lg"
              style={{ maxWidth: '500px', margin: '0 auto', display: 'block' }}
              controls
              src={selectedVideo.url}
            >
              Your browser does not support the video tag.
            </video>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoPlayer;