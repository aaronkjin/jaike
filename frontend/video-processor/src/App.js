import React from "react";
import VideoUploader from "./components/VideoUploader";
import "./components/VideoUploader.css";
import { ChakraProvider } from "@chakra-ui/react";

function App() {
  return (
    <ChakraProvider>
      <div className="App">
        <VideoUploader />
      </div>
    </ChakraProvider>
  );
}

export default App;
