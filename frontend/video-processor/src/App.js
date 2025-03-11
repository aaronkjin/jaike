import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import VideoUploader from "./components/VideoUploader";
import LandingPage from "./components/LandingPage";
import { ChakraProvider, extendTheme, ColorModeScript } from "@chakra-ui/react";
import "./components/VideoUploader.css";
import { useAuth } from "./context/AuthContext";

const theme = extendTheme({
  config: {
    initialColorMode: "light",
    useSystemColorMode: false,
  },
  styles: {
    global: (props) => ({
      body: {
        bg: props.colorMode === "dark" ? "gray.700" : "gray.50",
      },
    }),
  },
  colors: {
    brand: {
      50: "#f7f7f7",
      100: "#dedede",
      200: "#cccccc",
      300: "#bbbbbb",
      400: "#aaaaaa",
      500: "#999999",
      600: "#888888",
      700: "#777777",
      800: "#666666",
      900: "#555555",
    },
  },
});

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

function App() {
  const { loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

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

export default App;
