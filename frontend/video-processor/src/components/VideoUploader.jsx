import React, { useState } from 'react';
import axios from 'axios';
import AWS from 'aws-sdk';
import VideoPlayer from './VideoPlayer';

const VideoUploader = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');
  const [processedFolder, setProcessedFolder] = useState(null);

  // AWS S3 configuration - replace with your actual values
  const s3Config = {
    bucketName: 'videolecturefiles',
    region: 'us-west-1',
    accessKeyId: 'AKIA2NK3YJBY5WPPYDMV',
    secretAccessKey: 'V+s48rRN8kqQQQBiDioAkvzMN4f2OtEpK6zLpCv2'
  };

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
    setStatus('');
  };

  const uploadToS3 = async () => {
    if (!file) return null;

    // Create a consistent folder name using file metadata
    const fileDate = new Date(file.lastModified);
    const timestamp = fileDate.getTime();
    const safeName = file.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const folderName = `${safeName}_${timestamp}`; // Combines filename and creation time

    const fileName = 'in.mp4'; // Fixed filename as expected by backend
    const s3Key = `${folderName}/input/${fileName}`;

    // Create S3 instance
    const S3 = new AWS.S3({
      region: s3Config.region,
      accessKeyId: s3Config.accessKeyId,
      secretAccessKey: s3Config.secretAccessKey
    });

    const params = {
      Bucket: s3Config.bucketName,
      Key: s3Key,
      Body: file,
      ContentType: file.type,
    };

    try {
      await S3.upload(params).promise();
      return folderName;
    } catch (error) {
      console.error('Error uploading to S3:', error);
      throw error;
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setUploading(true);
    setStatus('Uploading video...');

    try {
      const folderName = await uploadToS3();
      setStatus('Processing video...');

      // Check if processed videos already exist for this folder
      try {
        const response = await axios.get(`http://localhost:5001/list_videos/${folderName}`);
        if (response.data.videos && response.data.videos.length > 0) {
          // Videos already exist, skip processing
          setStatus('Videos already processed!');
          setProcessedFolder(folderName);
          return;
        }
      } catch (error) {
        // If error occurs during check, continue with normal processing
        console.log('No existing videos found, proceeding with processing');
      }

      // If no videos exist, proceed with processing
      await axios.post('http://localhost:5001/generate_videos', {
        video_folder: folderName
      });

      setStatus('Video processed successfully!');
      setProcessedFolder(folderName);
    } catch (error) {
      console.error('Error:', error);
      setStatus(`Error: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="video-uploader">
      <h2>Jaike</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <input
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            disabled={uploading}
          />
        </div>
        <button type="submit" disabled={!file || uploading}>
          {uploading ? 'Processing...' : 'Upload and Process'}
        </button>
        {status && (
          <div className={status.includes('Error') ? 'error' : 'success'}>
            {status}
          </div>
        )}
      </form>

      {processedFolder && (
        <VideoPlayer videoFolder={processedFolder} />
      )}
    </div>
  );
};

export default VideoUploader;