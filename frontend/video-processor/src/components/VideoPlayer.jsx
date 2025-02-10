import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Box, Text, SimpleGrid, VStack, AspectRatio, useColorModeValue } from '@chakra-ui/react';
import { motion } from 'framer-motion';

const MotionBox = motion(Box);

const VideoPlayer = ({ videoFolder }) => {
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [error, setError] = useState(null);
  const bgColor = useColorModeValue('gray.50', 'gray.700');
  const cardBg = useColorModeValue('white', 'gray.800');

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
  if (error) return <Text color="red.500">{error}</Text>;

  return (
    <Box mt={8} p={4} bg={bgColor} borderRadius="xl">
      <Text fontSize="2xl" fontWeight="bold" mb={6}>
        Processed Videos
      </Text>

      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4} mb={6}>
        {videos.map((video) => (
          <MotionBox
            key={video.name}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSelectedVideo(video)}
            bg={cardBg}
            p={4}
            borderRadius="lg"
            boxShadow="sm"
            cursor="pointer"
            border="2px solid"
            borderColor={selectedVideo?.name === video.name ? 'blue.500' : 'transparent'}
            transition="all 0.2s"
          >
            <VStack spacing={2} align="start">
              <Text fontWeight="medium" noOfLines={2}>
                {video.name}
              </Text>
            </VStack>
          </MotionBox>
        ))}
      </SimpleGrid>

      {selectedVideo && (
        <MotionBox
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          mx="auto"
          maxW="4xl"
        >
          <AspectRatio ratio={16 / 9} w="full" borderRadius="xl" overflow="hidden" boxShadow="lg">
            <video
              controls
              src={selectedVideo.url}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            >
              Your browser does not support the video tag.
            </video>
          </AspectRatio>
        </MotionBox>
      )}
    </Box>
  );
};

export default VideoPlayer;