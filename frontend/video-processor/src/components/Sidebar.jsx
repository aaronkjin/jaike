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
  HStack
} from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { HamburgerIcon, DeleteIcon } from '@chakra-ui/icons';
import { FaHome } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';

const MotionBox = motion(Box);

const Sidebar = ({ isOpen, onToggle, onSelectVideo, onHomeClick }) => {
  const [previousVideos, setPreviousVideos] = useState([]);
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

  useEffect(() => {
    const fetchPreviousVideos = async () => {
      setLoading(true);
      try {
        const response = await axios.get('http://localhost:5001/user_videos', {
          withCredentials: true
        });
        setPreviousVideos(response.data.folders);
      } catch (error) {
        console.error('Error fetching previous videos:', error);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      fetchPreviousVideos();
    }
  }, [isOpen]);

  const handleVideoSelect = (folderName) => {
    if (folderName && user?.email) {
      const safeEmail = user.email.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const fullPath = `${safeEmail}/${folderName}`;
      onSelectVideo(fullPath);
    }
  };

  const handleDelete = async (folder, e) => {
    e.stopPropagation(); // Prevent video selection when clicking delete

    try {
      await axios.delete(`http://localhost:5001/delete_video/${folder}`, {
        withCredentials: true
      });

      // Remove the deleted video from the list
      setPreviousVideos(previousVideos.filter(v => v !== folder));

      toast({
        title: "Video deleted",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: "Error deleting video",
        description: error.message,
        status: "error",
        duration: 3000,
        isClosable: true,
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
      left={0}
      top={0}
      bottom={0}
      zIndex="999"
      width="280px"
      bg={sidebarBgColor}
      borderRight="1px solid"
      borderColor={borderColor}
      boxShadow="sm"
      initial={{ x: isOpen ? 0 : "-100%" }}
      animate={{ x: isOpen ? 0 : "-100%" }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      p={5}
      overflow="auto"
    >
      {/* Sidebar Header */}
      <Flex justify="space-between" align="center" mb={6} pl={1}>
        <Flex align="center">
          <IconButton
            aria-label="Toggle sidebar"
            icon={<HamburgerIcon />}
            variant="ghost"
            color={iconColor}
            onClick={onToggle}
            size="md"
            mr={2}
            _hover={{ bg: 'rgba(0,0,0,0.05)' }}
          />
          <Heading size="sm" color={headingColor} fontWeight="semibold">
            My Videos
          </Heading>
        </Flex>

        {/* Home icon at the top right */}
        <IconButton
          aria-label="Go to home"
          icon={<FaHome />}
          variant="ghost"
          color={iconColor}
          onClick={onHomeClick}
          size="md"
          _hover={{ bg: 'rgba(0,0,0,0.05)' }}
        />
      </Flex>

      {/* Videos Section */}
      <VStack spacing={4} align="stretch" mt={6}>
        {loading ? (
          <Text color={secondaryTextColor}>Loading...</Text>
        ) : previousVideos.length === 0 ? (
          <Text color={secondaryTextColor}>No videos processed yet</Text>
        ) : (
          <VStack spacing={2} align="stretch">
            {previousVideos.map((folder) => (
              <HStack
                key={folder}
                p={3}
                cursor="pointer"
                borderRadius="md"
                _hover={{ bg: hoverBgColor }}
                onClick={() => handleVideoSelect(folder)}
                justify="space-between"
              >
                <Text noOfLines={1}>
                  {formatFolderName(folder)}
                </Text>
                <IconButton
                  aria-label="Delete video"
                  icon={<DeleteIcon />}
                  size="sm"
                  variant="ghost"
                  colorScheme="red"
                  onClick={(e) => handleDelete(folder, e)}
                  _hover={{ bg: 'red.100' }}
                />
              </HStack>
            ))}
          </VStack>
        )}
      </VStack>
    </MotionBox>
  );
};

export default Sidebar; 