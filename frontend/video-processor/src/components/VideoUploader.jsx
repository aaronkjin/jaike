import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AWS from 'aws-sdk';
import VideoPlayer from './VideoPlayer';
import Sidebar from './Sidebar';
import toast, { Toaster } from 'react-hot-toast';
import {
  Heading,
  Button,
  Input,
  Box,
  Container,
  VStack,
  useColorModeValue,
  Flex,
  Avatar,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Text,
  Icon,
  IconButton,
  HStack,
  Divider,
  AspectRatio,
  Progress,
  Spinner,
  useColorMode
} from '@chakra-ui/react';
import { useAuth } from '../context/AuthContext';
import { keyframes } from '@emotion/react';
import { HamburgerIcon, MoonIcon, SunIcon } from '@chakra-ui/icons';

const pulseGlow = keyframes`
  0% {
    box-shadow: 0 0 0 0 rgba(0, 0, 0, 0.2);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(0, 0, 0, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(0, 0, 0, 0);
  }
`;

const blink = keyframes`
  from { border-right-color: transparent }
  to { border-right-color: inherit }
`;

const carouselTexts = [
  "conceptually difficult topics",
  "midterm prep material",
  "reviewing last week's content",
  "catching up on missed lectures",
  "creating study guides",
  "breaking down complex explanations",
  "quick lecture summaries"
];

const TextCarousel = () => {
  const [text, setText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const textColor = useColorModeValue('gray.500', 'gray.400');

  useEffect(() => {
    const typingSpeed = 50;
    const deletingSpeed = 30;
    const pauseTime = 2500;

    const currentPhrase = carouselTexts[phraseIndex];

    if (!isDeleting && text === currentPhrase) {
      setTimeout(() => setIsDeleting(true), pauseTime);
      return;
    }

    if (isDeleting && text === '') {
      setIsDeleting(false);
      setPhraseIndex((prev) => (prev + 1) % carouselTexts.length);
      return;
    }

    const timeout = setTimeout(() => {
      setText(prev => {
        if (isDeleting) {
          return prev.slice(0, -1);
        }
        return currentPhrase.slice(0, prev.length + 1);
      });
    }, isDeleting ? deletingSpeed : typingSpeed);

    return () => clearTimeout(timeout);
  }, [text, isDeleting, phraseIndex]);

  return (
    <Flex justify="flex-start" mb={4}>
      <Text fontSize="sm" color={textColor}>
        Process lectures for{' '}
        <Text
          as="span"
          display="inline-block"
          minW="200px"
          position="relative"
          sx={{
            '&::after': {
              content: '""',
              borderRight: '2px solid',
              animation: `${blink} 0.7s infinite`,
              marginLeft: '0.25rem'
            }
          }}
        >
          {text}
        </Text>
      </Text>
    </Flex>
  );
};

// Loading video component
const LoadingVideo = () => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [progressValue, setProgressValue] = useState(0);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
  // Visual indicator (not actually progress)
  useEffect(() => {
    const maxTime = 600;
    const newProgress = Math.min(90, (elapsedTime / maxTime) * 100);
    setProgressValue(newProgress);
  }, [elapsedTime]);
  
  const minutes = Math.floor(elapsedTime / 60);
  const seconds = elapsedTime % 60;
  
  return (
    <Box mt={6} width="100%">
      <AspectRatio ratio={16 / 9} maxW="1000px" mx="auto">
        <iframe
          src="https://www.youtube.com/embed/ChBg4aowzX8?si=ulizhwCIIz1jzjgk&autoplay=1&loop=1&playlist=ChBg4aowzX8"
          title="Processing Video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </AspectRatio>
      <VStack spacing={3} mt={4} align="center">
        <Flex align="center">
          <Spinner size="sm" mr={2} />
          <Text fontSize="sm" fontWeight="medium">
            Processing your video... ({minutes}:{seconds < 10 ? `0${seconds}` : seconds})
          </Text>
        </Flex>
        <Text fontSize="xs" color="gray.500">
          This may take 5-10 minutes depending on the lecture video length.
        </Text>
        <Box w="80%" maxW="600px">
          <Progress 
            value={progressValue} 
            size="sm" 
            colorScheme="gray" 
            borderRadius="full"
            isAnimated
          />
        </Box>
      </VStack>
    </Box>
  );
};

const VideoUploader = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [processedFolder, setProcessedFolder] = useState(null);
  const [previousVideos, setPreviousVideos] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState('home');
  
  const { colorMode, toggleColorMode } = useColorMode();
  const mainBgColor = useColorModeValue('gray.50', 'gray.700');
  const sidebarBgColor = useColorModeValue('gray.100', 'gray.800');
  const { user, logout } = useAuth();
  const buttonBgColor = useColorModeValue('blackAlpha.800', 'gray.700');
  const iconColor = useColorModeValue('gray.700', 'gray.200');
  const headingColor = useColorModeValue('black', 'white');
  const accentColor = useColorModeValue('blackAlpha.800', 'gray.600');
  const inputBorderColor = useColorModeValue('gray.300', 'gray.600');
  const inputHoverColor = useColorModeValue('gray.400', 'gray.500');


  const [numClips, setNumClips] = useState(5); // Default value of 5
  const [lengthOfClips, setLengthOfClips] = useState(60); // Default value of 60 seconds

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const goToHome = () => {
    setCurrentView('home');
  };

  // AWS S3 configuration
  const s3Config = {
    bucketName: 'videolecturefiles',
    region: 'us-west-1',
    accessKeyId: 'AKIA2NK3YJBY5WPPYDMV',
    secretAccessKey: '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',
    useAcceleration: true
  };

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
  };

  const uploadToS3 = async () => {
    if (!file) return null;

    const fileDate = new Date(file.lastModified);
    const timestamp = fileDate.getTime();
    const safeName = file.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const safeEmail = user.email.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const folderName = `${safeEmail}/${safeName}_${timestamp}`;

    const fileName = 'in.mp4';
    const s3Key = `${folderName}/input/${fileName}`;

    // Create S3 instance
    const S3 = new AWS.S3({
      region: s3Config.region,
      accessKeyId: s3Config.accessKeyId,
      secretAccessKey: s3Config.secretAccessKey,
      ...(s3Config.useAcceleration && {
        useAccelerateEndpoint: true
      })
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
        const response = await axios.get(`http://localhost:5001/list_videos/${folderName}`, {
          withCredentials: true
        });
        if (response.data.videos && response.data.videos.length > 0) {
          toast.success('Videos already processed!');
          setProcessedFolder(folderName);
          setCurrentView('player'); // Switch to player view
          return;
        }
      } catch (error) {
        console.log('No existing videos found, proceeding with processing');
      }

      toast('Processing video...');
      await axios.post('http://localhost:5001/generate_videos', {
        video_folder: folderName,
        num_clips: numClips,
        length_of_clips: lengthOfClips
      }, {
        withCredentials: true
      });

      toast.success('Video processed successfully!');
      setProcessedFolder(folderName);
      setCurrentView('player'); // Switch to player view
    } catch (error) {
      console.error('Error:', error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    const fetchPreviousVideos = async () => {
      try {
        const response = await axios.get('http://localhost:5001/user_videos', {
          withCredentials: true
        });
        setPreviousVideos(response.data.folders);
      } catch (error) {
        console.error('Error fetching previous videos:', error);
      }
    };

    fetchPreviousVideos();
  }, []);

  const handleVideoSelect = (folderName) => {
    if (folderName) {
      setProcessedFolder(folderName);
      setCurrentView('player'); // Switch to player view when selecting a video
      
      // Close sidebar on mobile after selecting a video
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    }
  };

  // Home view - Upload and Process
  const renderHomeView = () => {
    return (
      <VStack spacing={8} align="center" maxW="1200px" mx="auto" mt="2vh" justifyContent="center" minH="70vh">
        <Heading
          as="h1"
          size="2xl"
          color={headingColor}
          letterSpacing="tight"
          textAlign="center"
          mb={-4} 
        >
          Jaike
        </Heading>
        
        {uploading ? (
          <LoadingVideo />
        ) : (
          <Box 
            bg={mainBgColor} 
            p={8} 
            borderRadius="xl" 
            boxShadow="sm" 
            w="full"
            mt={-4} 
          >
            <TextCarousel />
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
                    borderColor={inputBorderColor}
                    _hover={{
                      borderColor: inputHoverColor
                    }}
                    sx={{
                      '::file-selector-button': {
                        height: '100%',
                        padding: '0 20px',
                        background: 'transparent',
                        border: 'none',
                        fontWeight: 'medium',
                        color: iconColor,
                        cursor: 'pointer'
                      }
                    }}
                  />
                </Box>
                <Flex w="full" gap={4}>
                <Box flex="1">
                  <select
                    value={numClips}
                    onChange={(e) => setNumClips(parseInt(e.target.value))}
                    disabled={uploading}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '4px',
                      borderColor: inputBorderColor,
                      background: 'transparent'
                    }}
                  >
                    <option value="3">3 clips</option>
                    <option value="5">5 clips</option>
                    <option value="7">7 clips</option>
                    <option value="10">10 clips</option>
                  </select>
                </Box>
                <Box flex="1">
                  <select
                    value={lengthOfClips}
                    onChange={(e) => setLengthOfClips(parseInt(e.target.value))}
                    disabled={uploading}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '4px',
                      borderColor: inputBorderColor,
                      background: 'transparent'
                    }}
                  >
                    <option value="30">30 seconds</option>
                    <option value="45">45 seconds</option>
                    <option value="60">60 seconds</option>
                    <option value="90">90 seconds</option>
                  </select>
                </Box>
              </Flex>
                <Button
                  type="submit"
                  disabled={!file || uploading}
                  bg={accentColor}
                  color="white"
                  size="lg"
                  width="full"
                  height="48px"
                  _hover={!uploading ? {
                    transform: 'translateY(-2px)',
                    boxShadow: 'md',
                    bg: 'blackAlpha.700'
                  } : {}}
                  transition="all 0.2s"
                  position="relative"
                  animation={uploading ? `${pulseGlow} 2s infinite` : undefined}
                  _before={uploading ? {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    borderRadius: 'md',
                  } : undefined}
                >
                  {uploading ? 'Processing...' : 'Process'}
                </Button>
              </VStack>
            </form>
          </Box>
        )}
      </VStack>
    );
  };

  // Player view - Video player only
  const renderPlayerView = () => {
    if (!processedFolder) return null;
    return <VideoPlayer videoFolder={processedFolder} />;
  };

  return (
    <Box position="relative" minH="100vh" bg={mainBgColor}>
      <Sidebar 
        isOpen={sidebarOpen}
        onToggle={toggleSidebar}
        onSelectVideo={handleVideoSelect} 
        onHomeClick={goToHome}
      />
      
      <Box
        ml={sidebarOpen ? "280px" : "0"}
        transition="margin-left 0.25s ease-in-out"
        minH="100vh"
        position="relative"
      >
        <Flex 
          position="absolute" 
          top="4" 
          left="4" 
          right="4" 
          justify="space-between" 
          align="center"
          zIndex="900"
        >
          <Box>
            {!sidebarOpen && (
              <IconButton
                aria-label="Toggle sidebar"
                icon={<HamburgerIcon />}
                variant="ghost"
                color={iconColor}
                onClick={toggleSidebar}
                size="md"
                _hover={{ bg: 'rgba(0,0,0,0.05)' }}
              />
            )}
          </Box>
          
          <Flex align="center">
            {/* Dark Mode Toggle */}
            <IconButton
              aria-label="Toggle color mode"
              icon={colorMode === 'light' ? <MoonIcon /> : <SunIcon />}
              variant="ghost"
              color={iconColor}
              onClick={toggleColorMode}
              size="md"
              mr={2}
              _hover={{ bg: 'rgba(0,0,0,0.05)' }}
            />
            
            <Menu>
              <MenuButton
                as={Button}
                rounded="full"
                p={0}
                minW="auto"
                bg="transparent"
                _hover={{ bg: 'transparent' }}
                _active={{ bg: 'transparent' }}
                _focus={{ bg: 'transparent' }}
              >
                <Avatar
                  size="sm"
                  name={user?.email?.[0] || 'U'}
                  src={user?.picture}
                  bg={buttonBgColor}
                  color="white"
                  transition="all 0.2s cubic-bezier(.08,.52,.52,1)"
                />
              </MenuButton>
              <MenuList>
                <MenuItem onClick={logout}>
                  <Text fontWeight="medium">Log Out</Text>
                </MenuItem>
              </MenuList>
            </Menu>
          </Flex>
        </Flex>

        <Container 
          maxW="container.xl" 
          py="16" 
          px={{ base: 4, md: 8 }}
        >
          <Toaster position="top-center" />
          {currentView === 'home' ? renderHomeView() : renderPlayerView()}
        </Container>

        <Flex 
          justify="center" 
          position="absolute" 
          bottom="4" 
          left="0" 
          right="0"
        >
          <Text fontSize="xs" color={useColorModeValue('gray.500', 'gray.400')}>
            Jaike is currently in beta. For reference only.
          </Text>
        </Flex>
      </Box>
    </Box>
  );
};

export default VideoUploader;