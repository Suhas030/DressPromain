// // import { useState } from 'react';
// import { BrowserRouter, Routes, Route } from 'react-router-dom';
// import Homepage from './components/Homepage';
// import Header from './components/Header';
// import Footer from './components/Footer';
// import RateMyFit from './components/RateMyFit';
// import Login from './components/Login';

// import './css/style-starter.css';

// function App() {
//   return (
//     <BrowserRouter>
//       <div className="app">
//         <Header />
//         <main>
//           <Routes>
//             <Route path="/" element={<Homepage />} />
//             <Route path="#" element={<div>Find Clothes Page</div>} />
//             <Route path="/rate-my-fit" element={<RateMyFit />} />
//             <Route path="#" element={<div>Profile Page</div>} />
//           </Routes>
//         </main>
//         <Footer />
//       </div>
//     </BrowserRouter>
//   );
// }

// export default App

import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Homepage from './components/Homepage';
import Header from './components/Header';
import Footer from './components/Footer';
import RateMyFit from './components/RateMyFit';
import Login from './components/Login';
import Profile from './components/Profile';

import './css/style-starter.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Check if user is authenticated on component mount
    const checkAuthStatus = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/users/auth-status', {
          method: 'GET',
          credentials: 'include', // Important for cookies
        });
        
        if (response.ok) {
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuthStatus();
  }, []);
  
  // Protected route component
  const ProtectedRoute = ({ children }) => {
    if (isLoading) {
      return <div className="loading">Loading...</div>;
    }
    
    if (!isAuthenticated) {
      return <Navigate to="/login" />;
    }
    
    return children;
  };

  return (
    <BrowserRouter>
      <div className="app">
        {isAuthenticated && <Header setIsAuthenticated={setIsAuthenticated} />}
        <main>
          <Routes>
            <Route path="/login" element={
              isLoading ? (
                <div className="loading">Loading...</div>
              ) : isAuthenticated ? (
                <Navigate to="/" />
              ) : (
                <Login setIsAuthenticated={setIsAuthenticated} />
              )
            } />
            <Route path="/" element={
              <ProtectedRoute>
                <Homepage />
              </ProtectedRoute>
            } />
            <Route path="/find-clothes" element={
              <ProtectedRoute>
                <div>Find Clothes Page</div>
              </ProtectedRoute>
            } />
            <Route path="/rate-my-fit" element={
              <ProtectedRoute>
                <RateMyFit />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } />
            {/* Catch-all redirect to login */}
            <Route path="*" element={<Navigate to="/login" />} />
          </Routes>
        </main>
        {isAuthenticated && <Footer />}
      </div>
    </BrowserRouter>
  );
}

export default App;