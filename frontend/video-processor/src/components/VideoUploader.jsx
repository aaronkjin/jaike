import React, { useState } from 'react';
import axios from 'axios';
import AWS from 'aws-sdk';
import VideoPlayer from './VideoPlayer';
import toast, { Toaster } from 'react-hot-toast';
import {
  Heading,
  Button,
  Input,
  Box,
  Container,
  VStack,
  useColorModeValue,
  Flex
} from '@chakra-ui/react';
import { useAuth } from '../context/AuthContext';

const VideoUploader = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [processedFolder, setProcessedFolder] = useState(null);
  const bgColor = useColorModeValue('gray.50', 'gray.700');
  const { logout } = useAuth();

  // AWS S3 configuration
  const s3Config = {
    bucketName: 'videolecturefiles',
    region: 'us-west-1',
    accessKeyId: 'AKIA2NK3YJBY5WPPYDMV',
    secretAccessKey: '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'
  };

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
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

    try {
      const folderName = await uploadToS3();

      // Check if processed videos already exist for this folder
      try {
        const response = await axios.get(`http://localhost:5001/list_videos/${folderName}`);
        if (response.data.videos && response.data.videos.length > 0) {
          toast.success('Videos already processed!');
          setProcessedFolder(folderName);
          return;
        }
      } catch (error) {
        console.log('No existing videos found, proceeding with processing');
      }

      toast('Processing video...');
      await axios.post('http://localhost:5001/generate_videos', {
        video_folder: folderName
      });

      toast.success('Video processed successfully!');
      setProcessedFolder(folderName);
    } catch (error) {
      console.error('Error:', error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={8} align="stretch">
        <Flex justify="space-between" align="center">
          <Heading as="h1" size="xl" textAlign="center">Jaike</Heading>
          <Button
            onClick={logout}
            colorScheme="gray"
            size="sm"
            _hover={{
              transform: 'translateY(-2px)',
              boxShadow: 'md'
            }}
          >
            Logout
          </Button>
        </Flex>

        <Box bg={bgColor} p={8} borderRadius="xl" boxShadow="sm">
          <Toaster position="top-center" />
          <form onSubmit={handleSubmit}>
            <VStack spacing={6}>
              <Box w="full">
                <Input
                  type="file"
                  accept="video/*"
                  onChange={handleFileChange}
                  disabled={uploading}
                  p={2}
                  height="48px"
                  fontSize="md"
                  border="2px dashed"
                  borderColor="gray.300"
                  _hover={{
                    borderColor: 'blue.500'
                  }}
                  sx={{
                    '::file-selector-button': {
                      height: '100%',
                      padding: '0 20px',
                      background: 'transparent',
                      border: 'none',
                      fontWeight: 'medium',
                      color: 'blue.500',
                      cursor: 'pointer'
                    }
                  }}
                />
              </Box>
              <Button
                type="submit"
                disabled={!file || uploading}
                colorScheme="blue"
                size="lg"
                width="full"
                height="48px"
                _hover={{
                  transform: 'translateY(-2px)',
                  boxShadow: 'md'
                }}
                transition="all 0.2s"
              >
                {uploading ? 'Processing...' : 'Upload and Process'}
              </Button>
            </VStack>
          </form>
        </Box>

        {processedFolder && (
          <VideoPlayer videoFolder={processedFolder} />
        )}
      </VStack>
    </Container>
  );
};

export default VideoUploader;