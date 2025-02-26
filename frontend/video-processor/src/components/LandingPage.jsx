import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Heading,
  Text,
  VStack,
  useColorModeValue,
  Icon,
  Fade,
  ScaleFade,
  IconButton,
  useColorMode,
  Flex,
} from '@chakra-ui/react';
import { FaGoogle } from 'react-icons/fa';
import { MoonIcon, SunIcon } from '@chakra-ui/icons';
import { keyframes } from '@emotion/react';

const blink = keyframes`
  from { border-right-color: transparent; }
  to { border-right-color: inherit; }
`;

const LandingPage = () => {
  const navigate = useNavigate();
  const { colorMode, toggleColorMode } = useColorMode();
  const bgColor = useColorModeValue('gray.50', 'gray.700');
  const buttonBgColor = useColorModeValue('blackAlpha.800', 'gray.700');
  const textColor = useColorModeValue('gray.600', 'gray.300');
  
  const [currentText, setCurrentText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showSubtitle, setShowSubtitle] = useState(false);
  const [subtitleText, setSubtitleText] = useState('');
  const [subtitleIndex, setSubtitleIndex] = useState(0);

  const headingText = "Welcome to Jaike";
  const subtitle = "Turn your lectures into brainrot";

  useEffect(() => {
    if (currentIndex < headingText.length) {
      const timeout = setTimeout(() => {
        setCurrentText(prev => prev + headingText[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, 80);

      return () => clearTimeout(timeout);
    } else {
      const timeout = setTimeout(() => setShowSubtitle(true), 500);
      return () => clearTimeout(timeout);
    }
  }, [currentIndex]);

  useEffect(() => {
    if (showSubtitle && subtitleIndex < subtitle.length) {
      const timeout = setTimeout(() => {
        setSubtitleText(prev => prev + subtitle[subtitleIndex]);
        setSubtitleIndex(prev => prev + 1);
      }, 50);

      return () => clearTimeout(timeout);
    }
  }, [showSubtitle, subtitleIndex]);

  const handleGoogleLogin = () => {
    window.location.href = 'http://localhost:5001/auth/google';
  };

  return (
    <Box position="relative" minH="100vh" w="100%" bg={bgColor}>
      <Container maxW="container.xl" h="100vh" display="flex" alignItems="center">        
        <VStack spacing={8} w="full" align="center">
          <Fade in={true} transition={{ enter: { duration: 0.5 } }}>
            <Box textAlign="center" mb={10}>
              <ScaleFade initialScale={0.9} in={true}>
                <Heading 
                  as="h1" 
                  size="2xl" 
                  mb={4} 
                  fontWeight="semibold" 
                  letterSpacing="tighter"
                  sx={{
                    '&::after': {
                      content: '""',
                      borderRight: '2px solid',
                      animation: `${blink} 0.7s infinite`,
                      marginLeft: '0.25rem'
                    }
                  }}
                >
                  {currentText}
                </Heading>
              </ScaleFade>
              <Text fontSize="xl" color={textColor} mt={4}>
                {subtitleText}
              </Text>
            </Box>
          </Fade>

          <Fade in={true} transition={{ enter: { duration: 0.5, delay: 3.0 } }}>
            <Button
              size="lg"
              px={8}
              h="50px"
              bg={buttonBgColor}
              color="white"
              onClick={handleGoogleLogin}
              leftIcon={<Icon as={FaGoogle} />}
              _hover={{
                transform: 'translateY(-2px)',
                boxShadow: 'lg',
                bg: 'blackAlpha.700'
              }}
              _active={{
                transform: 'scale(0.98)'
              }}
              transition="all 0.2s cubic-bezier(.08,.52,.52,1)"
            >
              Continue
            </Button>
          </Fade>
        </VStack>
      </Container>
      
      <IconButton
        aria-label="Toggle color mode"
        icon={colorMode === 'light' ? <MoonIcon /> : <SunIcon />}
        onClick={toggleColorMode}
        position="fixed"
        bottom="6"
        right="6"
        zIndex="1000"
        variant="ghost"
        size="md"
        color={useColorModeValue('gray.600', 'gray.300')}
        _hover={{
          bg: useColorModeValue('gray.100', 'gray.700')
        }}
      />
    </Box>
  );
};

export default LandingPage; 