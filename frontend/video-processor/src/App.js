import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import VideoUploader from "./components/VideoUploader";
import LandingPage from "./components/LandingPage";
import { ChakraProvider } from "@chakra-ui/react";
import "./components/VideoUploader.css";
import { AuthProvider, useAuth } from './context/AuthContext';

// Create a protected route component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/" />;
  }

  return children;
};

// Create a public route component that redirects if authenticated
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (user) {
    return <Navigate to="/upload" />;
  }

  return children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <PublicRoute>
            <LandingPage />
          </PublicRoute>
        }
      />
      <Route
        path="/upload"
        element={
          <ProtectedRoute>
            <VideoUploader />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <ChakraProvider>
      <Router>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </Router>
    </ChakraProvider>
  );
}

export default App;
