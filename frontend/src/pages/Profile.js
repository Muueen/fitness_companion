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
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0,10));
  const [generating, setGenerating] = useState(false);
  const [plan, setPlan] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [statuses, setStatuses] = useState({});
  const [updating, setUpdating] = useState(false);
  const [modifying, setModifying] = useState(false);

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

  const generateWorkout = async () => {
    try {
      setGenerating(true);
      setError(null);
      setPlan(null);
      const res = await API.post('/generate-workout', {
        start_date: startDate
      });
      if (res.data.success) {
        setPlan(res.data.plan);
        setStatuses(res.data.statuses || {});
      } else {
        setError(res.data.message || 'Failed to generate plan');
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to generate plan');
    } finally {
      setGenerating(false);
    }
  };

  const showWorkout = async () => {
    try {
      setLoadingPlan(true);
      setError(null);
      setPlan(null);
      const res = await API.get('/workout-plan', {
        params: { start_date: startDate }
      });
      if (res.data.success) {
        setPlan(res.data.plan);
        setStatuses(res.data.statuses || {});
      } else {
        setError(res.data.message || 'No saved plan found');
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load saved plan');
    } finally {
      setLoadingPlan(false);
    }
  };

  const markDayStatus = async (dateKey, status) => {
    try {
      setUpdating(true);
      setError(null);
      const res = await API.post('/workout-day-status', {
        start_date: startDate,
        date_key: dateKey,
        status
      });
      if (res.data.success) {
        setStatuses(res.data.statuses || {});
      } else {
        setError(res.data.message || 'Failed to update day status');
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to update day status');
    } finally {
      setUpdating(false);
    }
  };

  const requestExerciseChange = async (dateKey, exercise) => {
    const reason = window.prompt('Reason for change (optional):') || undefined;
    try {
      setUpdating(true);
      setError(null);
      const res = await API.post('/workout-change', {
        start_date: startDate,
        date_key: dateKey,
        exercise,
        reason
      });
      if (!res.data.success) {
        setError(res.data.message || 'Failed to request change');
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to request change');
    } finally {
      setUpdating(false);
    }
  };

  const modifyWorkoutPlan = async () => {
    try {
      setModifying(true);
      setError(null);
      const res = await API.post('/modify-workout-plan', { start_date: startDate });
      if (res.data.success) {
        setPlan(res.data.plan);
        // change requests are cleared server-side; keep statuses as is for audit
      } else {
        setError(res.data.message || 'Failed to modify plan');
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to modify plan');
    } finally {
      setModifying(false);
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

        <div className="profile-section">
          <h2>Workout Planner</h2>
          <div className="planner-controls">
            <label>
              Start date:
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ marginLeft: 8 }}
              />
            </label>
            <button className="calculator-toggle-btn" onClick={generateWorkout} disabled={generating}>
              {generating ? 'Generating...' : 'Generate 7-day Plan'}
            </button>
            <button className="calculator-toggle-btn" onClick={showWorkout} disabled={loadingPlan}>
              {loadingPlan ? 'Loading...' : 'Show Workout Plan'}
            </button>
            <button className="calculator-toggle-btn" onClick={modifyWorkoutPlan} disabled={modifying}>
              {modifying ? 'Modifying...' : 'Modify Work Plan'}
            </button>
          </div>
          {plan && (
            <div className="plan-container">
              {Object.keys(plan).map((dateKey) => (
                <div key={dateKey} className="plan-day">
                  <h3>{dateKey}</h3>
                  <p><strong>Time:</strong> {plan[dateKey].time}</p>
                  <div style={{ marginBottom: 8 }}>
                    <strong>Status:</strong> {statuses[dateKey] || 'pending'}
                    <button
                      className="calculator-toggle-btn"
                      style={{ marginLeft: 8 }}
                      onClick={() => markDayStatus(dateKey, 'done')}
                      disabled={updating}
                    >
                      Mark Done
                    </button>
                    <button
                      className="calculator-toggle-btn"
                      style={{ marginLeft: 8 }}
                      onClick={() => markDayStatus(dateKey, 'missed')}
                      disabled={updating}
                    >
                      Mark Missed
                    </button>
                  </div>
                  <ul>
                    {plan[dateKey].exercises.map((ex, idx) => (
                      <li key={idx}>
                        {ex}
                        <button
                          className="calculator-toggle-btn"
                          style={{ marginLeft: 8 }}
                          onClick={() => requestExerciseChange(dateKey, ex)}
                          disabled={updating}
                        >
                          Change
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
