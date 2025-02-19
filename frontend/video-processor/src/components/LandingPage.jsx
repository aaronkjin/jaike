import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Heading,
  Text,
  VStack,
  useColorModeValue,
  Icon
} from '@chakra-ui/react';
import { FaGoogle } from 'react-icons/fa';

const LandingPage = () => {
  const navigate = useNavigate();
  const bgColor = useColorModeValue('gray.50', 'gray.800');
  const buttonBgColor = useColorModeValue('white', 'gray.700');

  const handleGoogleLogin = () => {
    window.location.href = 'http://localhost:5001/auth/google';
  };

  return (
    <Container maxW="container.xl" py={20}>
      <VStack spacing={8} align="center">
        <Box textAlign="center" mb={10}>
          <Heading as="h1" size="2xl" mb={4}>
            Welcome to Jaike
          </Heading>
          <Text fontSize="xl" color={useColorModeValue('gray.600', 'gray.300')}>
            Transform your lectures into engaging short-form content
          </Text>
        </Box>

        <Box
          p={8}
          bg={bgColor}
          borderRadius="xl"
          boxShadow="xl"
          w="full"
          maxW="md"
        >
          <VStack spacing={4}>
            <Button
              w="full"
              h="50px"
              bg={buttonBgColor}
              onClick={handleGoogleLogin}
              leftIcon={<Icon as={FaGoogle} />}
              _hover={{ transform: 'translateY(-2px)', boxShadow: 'lg' }}
            >
              Continue with Google
            </Button>
          </VStack>
        </Box>
      </VStack>
    </Container>
  );
};

export default LandingPage; 