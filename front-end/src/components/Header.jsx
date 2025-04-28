import { Link } from 'react-router-dom';

function Header({ setIsAuthenticated }) {
  const handleLogout = async () => {
    try {
      const response = await fetch('/api/users/logout', {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        // Update authentication state
        setIsAuthenticated(false);
        // Redirect to login page
        window.location.href = '/login'; // Using window.location to force full refresh
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <header className="header" style={{ backgroundColor: '#440809' }}>
      <div className="container" style={{ backgroundColor: '#440809' }}>
        <nav className="navbar navbar-expand-lg navbar-light">
          <Link className="navbar-brand" to="/" style={{ color: 'white', fontSize: '30px', fontWeight: 'bold' }}>
             <span className="lohny">D</span>ress <span className="lohny">P</span>ro
          </Link>
          <button className="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarNav">
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="navbarNav">
            <ul className="navbar-nav ml-auto">
              <li className="nav-item">
                <Link className="nav-link" to="/" style={{color: 'white'}}>Home</Link>
              </li>
              <li className="nav-item">
                <Link className="nav-link" to="/find-clothes" style={{color: 'white'}}>Find Clothes</Link>
              </li>
              <li className="nav-item">
                <Link className="nav-link" to="/rate-my-fit" style={{color: 'white'}}>Rate My Fit</Link>
              </li>
              <li className="nav-item">
                <Link className="nav-link" to="/profile" style={{color: 'white'}}>Profile</Link>
              </li>
              <li className="nav-item">
                <button 
                  onClick={handleLogout} 
                  className="nav-link btn btn-link" 
                  style={{ 
                    display: 'inline-block', 
                    outline: 'none', 
                    border: 'none', 
                    fontWeight: 600, 
                    padding: '8px', 
                    fontSize: '16px', 
                    backgroundColor: 'Transparent', 
                    marginTop: '0px', 
                    color: 'white', 
                    borderRadius: '25px', 
                    textDecoration: 'none' 
                  }}
                >
                  Logout
                </button>
              </li>
            </ul>
          </div>
        </nav>
      </div>
    </header>
  );
}

export default Header;