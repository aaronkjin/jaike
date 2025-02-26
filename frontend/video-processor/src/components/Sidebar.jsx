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
  useColorMode
} from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { HamburgerIcon } from '@chakra-ui/icons';
import { FaHome } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';

const MotionBox = motion(Box);

const Sidebar = ({ isOpen, onToggle, onSelectVideo, onHomeClick }) => {
  const [previousVideos, setPreviousVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { colorMode } = useColorMode();
  
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
          <List spacing={1}>
            {previousVideos.map((folder) => {
              const timestamp = folder.split('_').pop();
              
              return (
                <ListItem key={folder}>
                  <Box
                    p={3}
                    borderRadius="lg"
                    cursor="pointer"
                    _hover={{ bg: hoverBgColor }}
                    onClick={() => handleVideoSelect(folder)}
                    transition="all 0.2s"
                  >
                    <Text fontWeight="medium" noOfLines={1} fontSize="sm">
                      {formatFolderName(folder)}
                    </Text>
                    <Text fontSize="xs" color={secondaryTextColor} noOfLines={1} mt={1}>
                      {formatDate(timestamp)}
                    </Text>
                  </Box>
                </ListItem>
              );
            })}
          </List>
        )}
      </VStack>
    </MotionBox>
  );
};

export default Sidebar; 