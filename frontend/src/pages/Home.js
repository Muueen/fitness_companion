import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';
import ai_fit from './images/ai_fitness.png';
import smart_plan from './images/smart_planning.png';
import comm from './images/community.png';
import train from './images/trainer.png';
import main_logo from './images/fit_logo.png';
import API from '../services/api';

const Home = () => {
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [user] = useState({
    name: 'John Doe',
    profilePicture: null
  });

  const handleLogout = async () => {
    setIsLoggingOut(true);
    
    try {
      // Call the backend logout endpoint (Authorization header is automatically added)
      await API.post('/auth/logout');
      
      // Clear user session/token
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Dispatch custom logout event to notify App component
      window.dispatchEvent(new Event('logout'));
      
      // Show success message
      alert('Successfully logged out!');
      
      // Navigate to login page
      navigate('/login');
      
    } catch (error) {
      console.error('Logout error:', error);
      
      // Even if the API call fails, we should still log out locally
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Dispatch custom logout event to notify App component
      window.dispatchEvent(new Event('logout'));
      
      // Show message to user
      alert('Logged out successfully!');
      
      // Navigate to login page
      navigate('/login');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleProfile = () => {
    navigate('/profile');
  };

  return (
    <div className="home-container">
      {/* Background Image */}
      <div className="background-image"></div>
      
      {/* Header */}
      <header className="header">
        <div className="header-content">
          {/* Logo Section */}
          <div className="logo-section">
            <div className="logo-image">
              <img src={main_logo} alt="AI Fitness" className="main-logo" />
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="nav-buttons">
            <button className="nav-button profile-btn" onClick={handleProfile}>
              Profile
            </button>
            <button 
              className={`nav-button logout-btn ${isLoggingOut ? 'loading' : ''}`} 
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? 'Logging out...' : 'Logout'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {/* Welcome Section */}
        <div className="welcome-section">
          <div className="welcome-image">
            <div className="fitness-illustration">🏃‍♂️</div>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="feature-grid">
          {/* Card 1: Fitness Goals with AI-Driven Plans */}
          <div className="feature-card primary-card">
            <div className="card-image">
              <img src={ai_fit} alt="AI Fitness" className="ai-fitness-image" />
            </div>
            <div className="card-content">
              <h3 className="card-title">Fitness Goals with AI-Driven Plans</h3>
              <p className="card-description">
                Get personalized workout plans and nutrition guidance powered by artificial intelligence
              </p>
            </div>
          </div>

          {/* Card 2: Smart Planning & Activity Management */}
          <div className="feature-card secondary-card">
            <div className="card-image">
              <img src={smart_plan} alt="Smart_planning" className="smart-planning" />
            </div>
            <div className="card-content">
              <h3 className="card-title">Smart Planning & Activity Management</h3>
              <p className="card-description">
                Track your progress, manage workouts, and stay organized with smart planning tools
              </p>
            </div>
          </div>

          {/* Card 3: Community Engagement & Social Motivation */}
          <div className="feature-card secondary-card">
            <div className="card-image">
              <img src={comm} alt="community_icon" className="community-icon" />
            </div>
            <div className="card-content">
              <h3 className="card-title">Community Engagement & Social Motivation</h3>
              <p className="card-description">
                Connect with fitness enthusiasts, share achievements, and stay motivated together
              </p>
            </div>
          </div>

          {/* Card 4: Virtual Coaching & Real-Time Feedback */}
          <div className="feature-card secondary-card">
            <div className="card-image">
              <img src={train} alt="virt_trainer" className="virtual-trainer" />
            </div>
            <div className="card-content">
              <h3 className="card-title">Virtual Coaching & Real-Time Feedback</h3>
              <p className="card-description">
                Get instant feedback on your form and receive virtual coaching from fitness experts
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="quick-actions">
          <button className="action-button primary-action">
            <span className="action-icon">🏃‍♂️</span>
            Start Workout
          </button>
          <button className="action-button secondary-action">
            <span className="action-icon">📊</span>
            View Progress
          </button>
          <button className="action-button secondary-action">
            <span className="action-icon">👥</span>
            Join Community
          </button>
        </div>
      </main>
    </div>
  );
};

export default Home; 