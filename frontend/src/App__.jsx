import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";

const Home = () => (
  <div className="p-8">
    <h1 className="text-3xl font-bold mb-4">Hello, World!</h1>
    <p className="mb-4">This is the homepage.</p>
    <Link to="/about" className="text-blue-600 underline">Go to About</Link>
  </div>
);

const About = () => (
  <div className="p-8">
    <h1 className="text-3xl font-bold mb-4">About Page</h1>
    <Link to="/" className="text-blue-600 underline">Back to Home</Link>
  </div>
);

const App = () => (
  <Router>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
    </Routes>
  </Router>
);

export default App;
