import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function Profile() {
  const navigate = useNavigate();
  const [userData, setUserData] = useState({
    name: '',
    email: '',
    age: '',
    topSize: '',
    bottomSize: ''
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch user data on component mount
  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/users/profile', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          navigate('/login');
          return;
        }
        throw new Error('Failed to fetch user data');
      }

      const data = await response.json();
      console.log("User data received:", data);
      setUserData({
        name: data.name || '',
        email: data.email || '',
        age: data.details?.age || '',
        topSize: data.details?.topSize || '',
        bottomSize: data.details?.bottomSize || ''
      });
    } catch (error) {
      console.error('Error fetching user data:', error);
      setMessage({ text: 'Failed to load profile data', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setUserData(prevData => ({
      ...prevData,
      [name]: value
    }));
  };

  // Enable edit mode
  const enableEditMode = (e) => {
    // Prevent default to ensure no form submission occurs
    e.preventDefault();
    setIsEditing(true);
    setMessage(null);
  };

  // Cancel editing and revert changes
  const cancelEdit = () => {
    setIsEditing(false);
    setMessage(null);
    // Reload data to discard changes
    fetchUserData();
  };

  // Submit changes to the server
  const submitChanges = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      setMessage(null);
      console.log("Submitting profile update with data:", {
        age: userData.age,
        topSize: userData.topSize,
        bottomSize: userData.bottomSize
      });
      
      const response = await fetch('/api/users/update-details', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          age: userData.age,
          topSize: userData.topSize,
          bottomSize: userData.bottomSize
        })
      });

      const responseData = await response.json();
      console.log("Update response:", responseData);
      
      if (!response.ok) {
        throw new Error(responseData.message || 'Failed to update profile');
      }

      setMessage({ text: 'Profile updated successfully!', type: 'success' });
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage({ text: error.message || 'Failed to update profile', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const sizeOptions = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

  if (isLoading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-lg-8">
          <div className="card shadow-sm" style={{ borderRadius: '15px', overflow: 'hidden' }}>
            <div className="card-header text-center" style={{ backgroundColor: '#440809', color: 'white', padding: '25px 0' }}>
              <h2>Your Profile</h2>
            </div>
            <div className="card-body p-4">
              {message && (
                <div className={`alert alert-${message.type === 'success' ? 'success' : 'danger'} mb-4`} role="alert">
                  {message.text}
                </div>
              )}

              <div className="text-center mb-4">
                <div className="profile-avatar mb-3">
                  {/* Profile image placeholder using first letter of name */}
                  <div 
                    style={{ 
                      width: '100px', 
                      height: '100px', 
                      borderRadius: '50%', 
                      backgroundColor: '#440809', 
                      color: 'white', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      fontSize: '40px',
                      margin: '0 auto'
                    }}
                  >
                    {userData.name.charAt(0).toUpperCase()}
                  </div>
                </div>
                <h3 className="mb-0">{userData.name}</h3>
                <p className="text-muted">{userData.email}</p>
              </div>

              {/* Move the form button outside the form to prevent automatic submission */}
              {!isEditing && (
                <div className="d-flex justify-content-center mb-4">
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ backgroundColor: '#440809', borderColor: '#440809' }}
                    onClick={enableEditMode}
                  >
                    Edit Profile
                  </button>
                </div>
              )}

              <form onSubmit={submitChanges}>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label htmlFor="name" className="form-label">Name</label>
                    <input
                      type="text"
                      className="form-control"
                      id="name"
                      name="name"
                      value={userData.name}
                      readOnly
                      disabled
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label htmlFor="email" className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-control"
                      id="email"
                      name="email"
                      value={userData.email}
                      readOnly
                      disabled
                    />
                  </div>
                </div>

                <div className="row">
                  <div className="col-md-4 mb-3">
                    <label htmlFor="age" className="form-label">Age</label>
                    <input
                      type="number"
                      className="form-control"
                      id="age"
                      name="age"
                      value={userData.age}
                      onChange={handleChange}
                      readOnly={!isEditing}
                      disabled={!isEditing}
                      min="1"
                      max="120"
                    />
                  </div>
                  <div className="col-md-4 mb-3">
                    <label htmlFor="topSize" className="form-label">Top Size</label>
                    <select
                      className="form-control"
                      id="topSize"
                      name="topSize"
                      value={userData.topSize}
                      onChange={handleChange}
                      disabled={!isEditing}
                    >
                      <option value="">Select Size</option>
                      {sizeOptions.map(size => (
                        <option key={`top-${size}`} value={size}>{size}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-4 mb-3">
                    <label htmlFor="bottomSize" className="form-label">Bottom Size</label>
                    <select
                      className="form-control"
                      id="bottomSize"
                      name="bottomSize"
                      value={userData.bottomSize}
                      onChange={handleChange}
                      disabled={!isEditing}
                    >
                      <option value="">Select Size</option>
                      {sizeOptions.map(size => (
                        <option key={`bottom-${size}`} value={size}>{size}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Only show Save/Cancel buttons when in edit mode */}
                {isEditing && (
                  <div className="d-flex justify-content-center mt-4">
                    <button 
                      type="submit" 
                      className="btn btn-primary me-2" 
                      style={{ backgroundColor: '#440809', borderColor: '#440809' }}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-outline-secondary" 
                      onClick={cancelEdit}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;