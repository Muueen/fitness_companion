import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Profile.css';
import API from '../services/api';

const Profile = () => {
  const navigate = useNavigate();
  const [showCalculator, setShowCalculator] = useState(false);
  const [userData, setUserData] = useState(null);
  const [healthMetrics, setHealthMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch user profile data
      const profileResponse = await API.get('/auth/profile');
      if (profileResponse.data.success) {
        setUserData(profileResponse.data.user);
      }
      
      // Fetch and calculate health metrics
      const metricsResponse = await API.get('/auth/calculate-health-metrics');
      if (metricsResponse.data.success) {
        setHealthMetrics(metricsResponse.data.metrics);
      }
      
    } catch (err) {
      console.error('Error fetching user data:', err);
      setError('Failed to load user data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToHome = () => {
    navigate('/home');
  };

  if (loading) {
    return (
      <div className="profile-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-container">
        <div className="error-container">
          <h2>Error</h2>
          <p>{error}</p>
          <button className="retry-btn" onClick={fetchUserData}>
            Try Again
          </button>
          <button className="back-btn" onClick={handleBackToHome}>
            ← Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="profile-header">
        <h1>Profile</h1>
        <button className="back-btn" onClick={handleBackToHome}>
          ← Back to Home
        </button>
      </div>

      <div className="profile-content">
        <div className="profile-section">
          <h2>User Information</h2>
          <div className="user-info">
            <div className="avatar">👤</div>
            <div className="user-details">
              <h3>{userData?.full_name || 'User'}</h3>
              <p>{userData?.fitness_level || 'Fitness Enthusiast'}</p>
              <div className="user-stats">
                <span>Age: {userData?.age}</span>
                <span>Gender: {userData?.gender}</span>
                <span>Weight: {userData?.weight} kg</span>
                <span>Height: {userData?.height} cm</span>
              </div>
            </div>
          </div>
        </div>

        <div className="profile-section">
          <h2>Health Metrics</h2>
          <button 
            className="calculator-toggle-btn"
            onClick={() => setShowCalculator(!showCalculator)}
          >
            {showCalculator ? 'Hide Health Metrics' : 'Show BMI & Body Fat Percentage'}
          </button>

          {showCalculator && healthMetrics && (
            <div className="calculator-container">
              <div className="metrics-header">
                <h3>Your Health Metrics</h3>
                <p className="metrics-subtitle">
                  Calculated from your profile data: Weight {healthMetrics.user_data.weight}kg, 
                  Height {healthMetrics.user_data.height}cm, Age {healthMetrics.user_data.age}, 
                  Gender {healthMetrics.user_data.gender}
                </p>
              </div>

              <div className="results-container">
                <h3>Results</h3>
                <div className="result-item">
                  <span className="result-label">BMI:</span>
                  <span className="result-value">{healthMetrics.bmi}</span>
                  <span className="result-category">({healthMetrics.bmi_category})</span>
                </div>
                <div className="result-item">
                  <span className="result-label">Body Fat %:</span>
                  <span className="result-value">{healthMetrics.bfp}%</span>
                  <span className="result-category">({healthMetrics.bfp_category})</span>
                </div>
                
                <div className="formula-info">
                  <h4>Formulas Used:</h4>
                  <p><strong>BMI:</strong> Weight (kg) / Height (m)²</p>
                  <p><strong>Body Fat %:</strong> 1.20 × BMI + 0.23 × Age - 10.8 × Gender - 5.4</p>
                  <p><em>Gender: 1 for Male, 0 for Female</em></p>
                </div>
              </div>
            </div>
          )}

          {showCalculator && !healthMetrics && (
            <div className="calculator-container">
              <div className="no-data-message">
                <h3>No Data Available</h3>
                <p>Unable to calculate health metrics. Please ensure your profile contains:</p>
                <ul>
                  <li>Weight (kg)</li>
                  <li>Height (cm)</li>
                  <li>Age</li>
                  <li>Gender</li>
                </ul>
                <p>You can update your profile information to enable these calculations.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
