import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  VStack,
  Heading,
  Text,
  Flex,
  useColorModeValue,
  List,
  ListItem,
  IconButton,
  Divider,
  useColorMode,
  useToast,
  HStack,
  Spinner,
  Button
} from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { HamburgerIcon, DeleteIcon, ChevronLeftIcon } from '@chakra-ui/icons';
import { FaHome } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';

const MotionBox = motion(Box);

const Sidebar = ({ isOpen, onToggle, onSelectVideo, onHomeClick }) => {
  const [userVideos, setUserVideos] = useState([]);
  const [sampleVideos, setSampleVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { colorMode } = useColorMode();
  const toast = useToast();

  const mainBgColor = useColorModeValue('#f7f7f7', '#212121');
  const sidebarBgColor = useColorModeValue('#dedede', '#1A202C');
  const textColor = useColorModeValue('#222222', '#e0e0e0');
  const hoverBgColor = useColorModeValue('#cccccc', '#4A5568');
  const borderColor = useColorModeValue('#cccccc', '#2D3748');
  const secondaryTextColor = useColorModeValue('#444444', '#bbbbbb');
  const headingColor = useColorModeValue('#000000', '#ffffff');
  const iconColor = useColorModeValue('#333333', '#dddddd');
  const sampleColor = useColorModeValue('blue.600', 'blue.300');

  useEffect(() => {
    const fetchVideos = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`/user_videos`, {
          withCredentials: true
        });

        setUserVideos(response.data.user_folders || []);
        setSampleVideos(response.data.sample_folders || []);
      } catch (error) {
        console.error('Error fetching videos:', error);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      fetchVideos();
    }
  }, [isOpen]);

  const handleVideoSelect = (folderName, isSample = false) => {
    if (folderName) {
      let fullPath;

      if (isSample) {
        fullPath = `sample/${folderName}`;
      } else if (user?.email) {
        const safeEmail = user.email.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        fullPath = `${safeEmail}/${folderName}`;
      }

      if (fullPath) {
        onSelectVideo(fullPath);
      }
    }
  };

  const handleDelete = async (folder, e) => {
    e.stopPropagation(); // Prevent video selection when clicking delete

    try {
      await axios.delete(`/delete_video/${folder}`, {
        withCredentials: true
      });

      // Remove the deleted video from the list
      setUserVideos(userVideos.filter(v => v !== folder));

      toast({
        title: "Video deleted",
        status: "success",
        duration: 3000,
        isClosable: true,
        position: 'top-right'
      });
    } catch (error) {
      toast({
        title: "Error deleting video",
        description: error.message,
        status: "error",
        duration: 3000,
        isClosable: true,
        position: 'top-right'
      });
    }
  };

  // Format the folder name for display (remove timestamps, etc.)
  const formatFolderName = (folder) => {
    return folder.split('_').slice(0, -1).join('_').replace(/_/g, ' ');
  };

  // Format timestamp to readable date
  const formatDate = (timestamp) => {
    const date = new Date(parseInt(timestamp));
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <MotionBox
      position="fixed"
      left={isOpen ? "0" : "-300px"}
      top="0"
      width="300px"
      height="100vh"
      bg={sidebarBgColor}
      zIndex="1000"
      boxShadow="2px 0 10px rgba(0, 0, 0, 0.1)"
      overflowY="auto"
      initial={{ x: isOpen ? 0 : "-100%" }}
      animate={{ x: isOpen ? 0 : "-100%" }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
    >
      <Flex justify="space-between" align="center" p={4}>
        <Heading size="md" color={headingColor}>My Videos</Heading>
        <IconButton
          icon={<ChevronLeftIcon />}
          onClick={onToggle}
          variant="ghost"
          aria-label="Close sidebar"
          color={iconColor}
        />
      </Flex>

      <Divider borderColor={borderColor} />

      <Flex 
        p={4} 
        onClick={onHomeClick} 
        cursor="pointer" 
        _hover={{ bg: hoverBgColor }}
        align="center"
      >
        <Box 
          as={FaHome} 
          mr={2}
          color={iconColor}
        />
        <Text color={textColor}>Home</Text>
      </Flex>

      <Divider borderColor={borderColor} />

      <VStack align="stretch" spacing={0} mt={2}>
        {loading ? (
          <Flex justify="center" p={4}>
            <Spinner />
          </Flex>
        ) : (
          <>
            {userVideos.length > 0 && (
              <>
                <Text px={4} py={2} fontWeight="bold" color={headingColor}>Uploaded Videos</Text>
                {userVideos.map((folder) => (
                  <Flex
                    key={folder}
                    p={4}
                    cursor="pointer"
                    _hover={{ bg: hoverBgColor }}
                    onClick={() => handleVideoSelect(folder)}
                    justify="space-between"
                    align="center"
                  >
                    <Text color={textColor}>{formatFolderName(folder)}</Text>
                    <IconButton
                      icon={<DeleteIcon />}
                      size="sm"
                      variant="ghost"
                      colorScheme="red"
                      onClick={(e) => handleDelete(folder, e)}
                      aria-label="Delete video"
                    />
                  </Flex>
                ))}
                <Divider borderColor={borderColor} my={2} />
              </>
            )}

            {sampleVideos.length > 0 && (
              <>
                <Text px={4} py={2} fontWeight="bold" color={headingColor}>Sample Videos</Text>
                {sampleVideos.map((folder) => (
                  <Flex
                    key={folder}
                    p={4}
                    cursor="pointer"
                    _hover={{ bg: hoverBgColor }}
                    onClick={() => handleVideoSelect(folder, true)}
                    justify="space-between"
                    align="center"
                  >
                    <Text color={sampleColor}>{formatFolderName(folder)}</Text>
                  </Flex>
                ))}
              </>
            )}

            {userVideos.length === 0 && sampleVideos.length === 0 && (
              <Text p={4} color={secondaryTextColor}>No videos found. Upload a video to get started.</Text>
            )}
          </>
        )}
      </VStack>
    </MotionBox>
  );
};

export default Sidebar; 