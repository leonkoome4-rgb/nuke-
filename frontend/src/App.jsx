import { Routes, Route } from "react-router-dom";
import Feed from "./pages/Feed.jsx";
import Admin from "./pages/Admin.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Feed />} />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  );
}
