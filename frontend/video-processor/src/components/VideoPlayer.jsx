import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Box, Text, SimpleGrid, VStack, AspectRatio, useColorModeValue } from '@chakra-ui/react';
import { motion } from 'framer-motion';

const MotionBox = motion(Box);

// Function to determine the chronological order priority of a video
const getVideoPriority = (videoName) => {
  const nameLower = videoName.toLowerCase();
  
  // Priority 1: Intro/Introduction videos should come first
  if (nameLower.includes('intro') || nameLower.includes('introduction')) {
    return 1;
  }
  
  // Priority 2: Overview or summary videos
  if (nameLower.includes('overview') || nameLower.includes('summary')) {
    return 2;
  }
  
  // Priority 3: Numbered videos (extract the number for sorting)
  const numberMatch = nameLower.match(/part\s*(\d+)|section\s*(\d+)|chapter\s*(\d+)|(\d+)/);
  if (numberMatch) {
    const number = parseInt(numberMatch[1] || numberMatch[2] || numberMatch[3] || numberMatch[4]);
    return 100 + number; // Adding 100 to ensure it comes after non-numbered priorities
  }
  
  // Priority 4: Conclusion/Summary videos should come last
  if (nameLower.includes('conclusion') || nameLower.includes('final') || nameLower.includes('end')) {
    return 1000;
  }
  
  // Default priority for other videos
  return 500;
};

const VideoPlayer = ({ videoFolder }) => {
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [error, setError] = useState(null);
  const bgColor = useColorModeValue('gray.50', 'gray.700');
  const cardBg = useColorModeValue('white', 'gray.800');
  const selectedBorderColor = useColorModeValue('blackAlpha.800', 'gray.500');
  const cardHoverColor = useColorModeValue('gray.100', 'gray.700');

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const response = await axios.get(`http://localhost:5001/list_videos/${videoFolder}`, {
          withCredentials: true
        });
        
        // Sort videos in chronological order
        const sortedVideos = [...response.data.videos].sort((a, b) => {
          const priorityA = getVideoPriority(a.name);
          const priorityB = getVideoPriority(b.name);
          
          if (priorityA !== priorityB) {
            return priorityA - priorityB;
          }
          
          // If same priority, sort alphabetically
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
  if (error) return <Text color="red.500">{error}</Text>;

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