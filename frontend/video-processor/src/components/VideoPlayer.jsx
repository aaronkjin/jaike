import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Box, Text, SimpleGrid, VStack, AspectRatio, useColorModeValue, useColorMode } from '@chakra-ui/react';
import { motion } from 'framer-motion';

const MotionBox = motion(Box);

/**
 * @typedef {Object} VideoInfo
 * @property {string} name
 * @property {string} url
 * @property {number|null} startTime
 */

const getDisplayTitle = (videoName) => {
  // Remove the timestamp prefix and return just the title
  return videoName.replace(/^timestamp_[\d.]+_/, '');
};

const VideoPlayer = ({ videoFolder }) => {
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [error, setError] = useState(null);
  const { colorMode } = useColorMode();

  // Updated color values for better consistency
  const bgColor = useColorModeValue('gray.50', 'gray.700');
  const cardBg = useColorModeValue('white', 'gray.800');
  const selectedBorderColor = useColorModeValue('blackAlpha.800', 'gray.500');
  const cardHoverColor = useColorModeValue('gray.100', 'gray.600');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const errorColor = useColorModeValue('red.500', 'red.300');

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const response = await axios.get(`http://localhost:5001/list_videos/${videoFolder}`, {
          withCredentials: true
        });

        // Sort videos in chronological order
        const processedVideos = response.data.videos.map((video) => {
          // Extract timestamp from format: timestamp_123.45_title
          const timestampMatch = video.name.match(/^timestamp_([\d.]+)_/);
          const startTime = timestampMatch ? parseFloat(timestampMatch[1]) : null;

          return {
            ...video,
            startTime: startTime,
            displayName: getDisplayTitle(video.name)
          };
        });

        const sortedVideos = [...processedVideos].sort((a, b) => {
          if (a.startTime !== null && b.startTime !== null) {
            return a.startTime - b.startTime;
          }
          if (a.startTime !== null) return -1;
          if (b.startTime !== null) return 1;
          return a.name.localeCompare(b.name);
        });

        setVideos(sortedVideos);

        // Auto-select the first video if none is selected
        if (sortedVideos.length > 0 && !selectedVideo) {
          setSelectedVideo(sortedVideos[0]);
        }
      } catch (error) {
        setError('Failed to fetch videos');
        console.error('Error fetching videos:', error);
      }
    };

    if (videoFolder) {
      fetchVideos();
    }
  }, [videoFolder, selectedVideo]);

  if (!videoFolder) return null;
  if (error) return <Text color={errorColor}>{error}</Text>;

  return (
    <Box mt={8} p={4} bg={bgColor} borderRadius="xl">
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
            borderColor={selectedVideo?.name === video.name ? selectedBorderColor : 'transparent'}
            transition="all 0.2s"
            _hover={{
              bg: cardHoverColor
            }}
          >
            <VStack spacing={2} align="start">
              <Text fontWeight="medium" noOfLines={2} color={textColor}>
                {video.displayName || video.name}
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
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                backgroundColor: colorMode === 'dark' ? '#1A202C' : 'white'
              }}
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