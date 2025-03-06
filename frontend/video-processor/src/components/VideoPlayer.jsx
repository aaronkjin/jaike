import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Box, Text, SimpleGrid, VStack, AspectRatio, useColorModeValue, useColorMode, Flex, Textarea, Button, HStack, Divider, Heading, useToast, Tooltip } from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { CheckIcon, InfoIcon } from '@chakra-ui/icons';

const MotionBox = motion(Box);

/**
 * @typedef {Object} VideoInfo
 * @property {string} name
 * @property {string} url
 * @property {number|null} startTime
 */

/**
 * @typedef {Object} NoteData
 * @property {string} content
 * @property {string} lastUpdated
 */

const getDisplayTitle = (videoName) => {
  // Remove the timestamp prefix and return just the title
  return videoName.replace(/^timestamp_[\d.]+_/, '');
};

const VideoPlayer = ({ videoFolder }) => {
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [error, setError] = useState(null);
  const [notes, setNotes] = useState({});
  const [currentNote, setCurrentNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const autoSaveTimerRef = useRef(null);
  const { user } = useAuth();
  const { colorMode } = useColorMode();
  const toast = useToast();
  const bgColor = useColorModeValue('gray.50', 'gray.700');
  const cardBg = useColorModeValue('white', 'gray.800');
  const selectedBorderColor = useColorModeValue('blackAlpha.800', 'gray.500');
  const cardHoverColor = useColorModeValue('gray.100', 'gray.600');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const errorColor = useColorModeValue('red.500', 'red.300');
  const notesBg = useColorModeValue('gray.50', 'gray.900');
  const notesBorder = useColorModeValue('gray.200', 'gray.600');
  const notesPlaceholderColor = useColorModeValue('gray.400', 'gray.500');
  const buttonBgColor = useColorModeValue('blackAlpha.800', 'gray.700');

  const getNotesStorageKey = () => {
    if (!user || !videoFolder) return null;
    const safeEmail = user.email.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    return `jaike_notes_${safeEmail}_${videoFolder}`;
  };

  // Use localStorage to get notes on first render
  useEffect(() => {
    const storageKey = getNotesStorageKey();
    if (storageKey) {
      const savedNotes = localStorage.getItem(storageKey);
      if (savedNotes) {
        try {
          setNotes(JSON.parse(savedNotes));
        } catch (e) {
          console.error('Error going through notes:', e);
        }
      }
    }
  }, [user, videoFolder]);

  // Auto-save timer
  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setInterval(() => {
      if (selectedVideo && currentNote != notes[selectedVideo.name]?.content) {
        handleSaveNote();
      }
    }, 30000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [selectedVideo, currentNote, notes]);

  // Update current note when video selected changes
  useEffect(() => {
    if (selectedVideo) {
      const videoNotes = notes[selectedVideo.name];
      setCurrentNote(videoNotes?.content || '');
    } else {
      setCurrentNote('');
    }
  }, [selectedVideo, notes]);

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

  const saveNotesToStorage = (updatedNotes) => {
    const storageKey = getNotesStorageKey();
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(updatedNotes));
    }
  };

  const handleNoteChange = (e) => {
    setCurrentNote(e.target.value);
  };

  const handleSaveNote = () => {
    if (!selectedVideo) return;

    setIsSaving(true);
    const now = new Date();
    const updatedNotes = {
      ...notes,
      [selectedVideo.name]: {
        content: currentNote,
        lastUpdated: now.toISOString()
      }
    };

    setNotes(updatedNotes);
    saveNotesToStorage(updatedNotes);
    setLastSaved(now);

    toast({
      title: 'Note saved!',
      status: 'success',
      duration: 2000,
      isClosable: true,
      position: 'top-right'
    });

    setTimeout(() => setIsSaving(false), 500);
  }

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
              {notes[video.name] && (
                <HStack spacing={1}>
                  <InfoIcon color='blue.500' boxSize={3} />
                  <Text fontsize='xs' color='blue.500'>Has notes</Text>
                </HStack>
              )}
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
          <Flex direction={{ base: 'column', lg: 'row' }} gap={6} w='full'>
            {/* VideoPlayer */}
            <Box flex='1' minW={{ base: '100%', lg: '60%'}}>
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
              <Text mt={2} fontSize='lg' fontWeight='semibold' textAlign='center'>
                {selectedVideo.displayName || selectedVideo.name}
              </Text>
            </Box>

            {/* Notes */}
            <Box flex='1' minW={{ base: '100%', lg: '40%' }}>
              <VStack
                spacing={4}
                bg={notesBg}
                p={5}
                borderRadius='xl'
                border='1px solid'
                borderColor={notesBorder}
                boxShadow='sm'
                height='full'
                align='stretch'
              >
                <Heading size='md' mb={2}>Notes</Heading>
                <Divider />

                <Textarea
                  value={currentNote}
                  onChange={handleNoteChange}
                  placeHolder='Take notes for this clip here!'
                  fontSize='md'
                  minH='200px'
                  resize='vertical'
                  flex='1'
                  borderColor={notesBorder}
                  _placeholder={{ color: notesPlaceholderColor }}
                />

                <Flex justify='space-between' width='100%' align='center'>
                  <Text fontSize='xs' color='gray.500'>
                    {lastSaved && selectedVideo && notes[selectedVideo.name]?.lastUpdated ? `Last saved: ${new Date(notes[selectedVideo.name].lastUpdated).toLocaleString()}` : 'Not saved yet'}
                  </Text>

                  <Tooltip label='Notes are auto-saved every 30 seconds'>
                    <Button
                      onClick={handleSaveNote}
                      isLoading={isSaving}
                      loadingText='Saving'
                      size='sm'
                      bg={buttonBgColor}
                      color='white'
                      rightIcon={<CheckIcon />}
                      _hover={{
                        bg: 'blackAlpha.700'
                      }}
                    >
                      Save Note
                    </Button>
                  </Tooltip>
                </Flex>
              </VStack>
            </Box>
          </Flex>
        </MotionBox>
      )}
    </Box>
  );
};

export default VideoPlayer;