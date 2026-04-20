import { BrowserRouter, Routes, Route } from "react-router-dom";
import AgentManager from "./pages/AgentManager";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AgentManager />} />
        <Route path="/agent-manager" element={<AgentManager />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;