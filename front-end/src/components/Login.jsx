import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../css/login.css';

function Login({ setIsAuthenticated }) {
  const [isActive, setIsActive] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const navigate = useNavigate();

  const handleRegister = () => {
    setIsActive(true);
  };

  const handleLogin = () => {
    setIsActive(false);
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/users/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword
        }),
        credentials: 'include', // Important for cookies
      });

      if (response.ok) {
        // Login successful
        setIsAuthenticated(true);
        navigate('/');
      } else {
        alert('Login failed. Please check your credentials.');
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed. Please try again later.');
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/users/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: signupName,
          email: signupEmail,
          password: signupPassword
        }),
      });

      if (response.ok) {
        // Registration successful
        setIsActive(false); // Switch to login form
        alert('Registration successful! Please log in.');
      } else {
        const data = await response.json();
        alert(`Registration failed: ${data.message || 'Please try again.'}`);
      }
    } catch (error) {
      console.error('Registration error:', error);
      alert('Registration failed. Please try again later.');
    }
  };

  return (
    <div className="login-page">
      <div className={`container ${isActive ? 'active' : ''}`} id="container">
        <div className="form-container sign-up">
          <form onSubmit={handleSignUp}>
            <h1>Create Account</h1>
            <div className="social-icons">
              <a href="#" className="icon"><i className="fa-brands fa-google-plus-g"></i></a>
              <a href="#" className="icon"><i className="fa-brands fa-facebook-f"></i></a>
              <a href="#" className="icon"><i className="fa-brands fa-github"></i></a>
              <a href="#" className="icon"><i className="fa-brands fa-linkedin-in"></i></a>
            </div>
            <span>or use your email for registration</span>
            <input 
              type="text" 
              placeholder="Name" 
              value={signupName} 
              onChange={(e) => setSignupName(e.target.value)} 
              required 
            />
            <input 
              type="email" 
              placeholder="Email" 
              value={signupEmail} 
              onChange={(e) => setSignupEmail(e.target.value)} 
              required 
            />
            <input 
              type="password" 
              placeholder="Password" 
              value={signupPassword} 
              onChange={(e) => setSignupPassword(e.target.value)} 
              required 
            />
            <button type="submit">Sign Up</button>
          </form>
        </div>

        <div className="form-container sign-in">
          <form onSubmit={handleSignIn}>
            <h1>Sign In</h1>
            <div className="social-icons">
              <a href="#" className="icon"><i className="fa-brands fa-google-plus-g"></i></a>
              <a href="#" className="icon"><i className="fa-brands fa-facebook-f"></i></a>
              <a href="#" className="icon"><i className="fa-brands fa-github"></i></a>
              <a href="#" className="icon"><i className="fa-brands fa-linkedin-in"></i></a>
            </div>
            <span>or use your email password</span>
            <input 
              type="email" 
              placeholder="Email" 
              value={loginEmail} 
              onChange={(e) => setLoginEmail(e.target.value)} 
              required 
            />
            <input 
              type="password" 
              placeholder="Password" 
              value={loginPassword} 
              onChange={(e) => setLoginPassword(e.target.value)} 
              required 
            />
            <a href="#">Forgot Your Password?</a>
            <button type="submit">Sign In</button>
          </form>
        </div>

        <div className="toggle-container">
          <div className="toggle">
            <div className="toggle-panel toggle-left">
              <h1>Welcome Back!</h1>
              <p>Enter your personal details to use all of site features</p>
              <button className="hidden" type="button" onClick={handleLogin}>Sign In</button>
            </div>
            <div className="toggle-panel toggle-right">
              <h1>Hello, Friend!</h1>
              <p>Register with your personal details to use all of site features</p>
              <button className="hidden" type="button" onClick={handleRegister}>Sign Up</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;