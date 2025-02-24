import React, { useState, useEffect } from 'react';
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
  Flex,
  Avatar,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Text
} from '@chakra-ui/react';
import { useAuth } from '../context/AuthContext';
import { keyframes } from '@emotion/react';

const pulseGlow = keyframes`
  0% {
    box-shadow: 0 0 0 0 rgba(66, 153, 225, 0.4);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(66, 153, 225, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(66, 153, 225, 0);
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
    const typingSpeed = 80; 
    const deletingSpeed = 40;
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

const VideoUploader = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [processedFolder, setProcessedFolder] = useState(null);
  const bgColor = useColorModeValue('gray.50', 'gray.700');
  const { user, logout } = useAuth();
  const buttonBgColor = useColorModeValue('blackAlpha.800', 'gray.700');
  const menuBgColor = useColorModeValue('white', 'gray.800');
  const menuBorderColor = useColorModeValue('gray.200', 'gray.600');

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
    <Box position="relative" minH="100vh">
      <Flex position="absolute" right="6" top="6" zIndex="10">
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
          <MenuList 
            bg={useColorModeValue('gray.100', 'gray.700')}
            borderColor={useColorModeValue('gray.200', 'gray.600')}
            boxShadow="xl"
            minW="120px"
            borderRadius="lg"
            py={1}
            zIndex="10"
          >
            <MenuItem 
              onClick={logout}
              bg="transparent"
              _hover={{ 
                bg: useColorModeValue('gray.200', 'gray.600'),
                borderRadius: 'md'
              }}
              _focus={{ bg: 'transparent' }}
              _active={{ bg: 'transparent' }}
              transition="all 0.2s cubic-bezier(.08,.52,.52,1)"
            >
              <Text fontWeight="medium">Log Out</Text>
            </MenuItem>
          </MenuList>
        </Menu>
      </Flex>

      <Container maxW="container.xl" py={8}>
        <VStack spacing={8} align="stretch">
          <Box bg={bgColor} p={8} borderRadius="xl" boxShadow="sm">
            <TextCarousel />
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
                  _hover={!uploading ? {
                    transform: 'translateY(-2px)',
                    boxShadow: 'md'
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

          {processedFolder && (
            <VideoPlayer videoFolder={processedFolder} />
          )}
        </VStack>
      </Container>

      <Flex justify="center" position="fixed" bottom="4" left="0" right="0">
        <Text fontSize="xs" color={useColorModeValue('gray.500', 'gray.400')}>
          Jaike can make mistakes. Check important info.
        </Text>
      </Flex>
    </Box>
  );
};

export default VideoUploader;