import React, { useState, useEffect } from 'react';
import API from '../services/api';
import './Collaboration.css';

const Collaboration = () => {
  const [posts, setPosts] = useState([]);
  const [collaborations, setCollaborations] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    workout_name: '',
    date: '',
    time: '',
    place: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchPosts();
    fetchCollaborations();
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const response = await API.get('/auth/collaboration/posts');
      if (response.data.success) {
        setPosts(response.data.posts);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
      setMessage('Error loading posts');
    } finally {
      setLoading(false);
    }
  };

  const fetchCollaborations = async () => {
    try {
      const response = await API.get('/auth/collaboration/list');
      if (response.data.success) {
        setCollaborations(response.data.collaborations);
      }
    } catch (error) {
      console.error('Error fetching collaborations:', error);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const response = await API.post('/auth/collaboration/posts', formData);
      if (response.data.success) {
        setMessage('Post created successfully!');
        setFormData({ workout_name: '', date: '', time: '', place: '' });
        setShowCreateForm(false);
        fetchPosts();
      }
    } catch (error) {
      console.error('Error creating post:', error);
      setMessage(error.response?.data?.message || 'Error creating post');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    
    try {
      setLoading(true);
      const response = await API.delete(`/auth/collaboration/posts/${postId}`);
      if (response.data.success) {
        setMessage('Post deleted successfully!');
        fetchPosts();
      }
    } catch (error) {
      console.error('Error deleting post:', error);
      setMessage(error.response?.data?.message || 'Error deleting post');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinPost = async (postId) => {
    try {
      setLoading(true);
      const response = await API.post(`/auth/collaboration/posts/${postId}/join`);
      if (response.data.success) {
        setMessage('Successfully joined the collaboration!');
        fetchPosts();
        fetchCollaborations();
      }
    } catch (error) {
      console.error('Error joining post:', error);
      setMessage(error.response?.data?.message || 'Error joining post');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelCollaboration = async (index) => {
    if (!window.confirm('Are you sure you want to cancel this collaboration?')) return;
    
    try {
      setLoading(true);
      const response = await API.post(`/auth/collaboration/cancel/${index}`);
      if (response.data.success) {
        setMessage('Collaboration cancelled successfully!');
        fetchCollaborations();
      }
    } catch (error) {
      console.error('Error cancelling collaboration:', error);
      setMessage(error.response?.data?.message || 'Error cancelling collaboration');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (timeString) => {
    return timeString;
  };

  return (
    <div className="collaboration-container">
      <div className="collaboration-header">
        <h1>Workout Collaboration</h1>
        <p>Find workout partners and collaborate on fitness goals</p>
      </div>

      {message && (
        <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
          {message}
          <button onClick={() => setMessage('')} className="close-message">×</button>
        </div>
      )}

      <div className="collaboration-content">
        {/* Create Post Section */}
        <div className="create-post-section">
          <div className="section-header">
            <h2>Create a Collaboration Post</h2>
            <button 
              className="toggle-btn"
              onClick={() => setShowCreateForm(!showCreateForm)}
            >
              {showCreateForm ? 'Cancel' : 'Create Post'}
            </button>
          </div>

          {showCreateForm && (
            <form onSubmit={handleCreatePost} className="create-post-form">
              <div className="form-group">
                <label htmlFor="workout_name">Workout Name *</label>
                <input
                  type="text"
                  id="workout_name"
                  value={formData.workout_name}
                  onChange={(e) => setFormData({...formData, workout_name: e.target.value})}
                  placeholder="e.g., Morning Cardio, Strength Training"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="date">Date *</label>
                <input
                  type="date"
                  id="date"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="time">Time *</label>
                <input
                  type="time"
                  id="time"
                  value={formData.time}
                  onChange={(e) => setFormData({...formData, time: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="place">Place *</label>
                <input
                  type="text"
                  id="place"
                  value={formData.place}
                  onChange={(e) => setFormData({...formData, place: e.target.value})}
                  placeholder="e.g., Central Park, Gym XYZ"
                  required
                />
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? 'Creating...' : 'Create Post'}
              </button>
            </form>
          )}
        </div>

        {/* Available Posts Section */}
        <div className="posts-section">
          <div className="section-header">
            <h2>Available Collaborations</h2>
            <button onClick={fetchPosts} className="refresh-btn" disabled={loading}>
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="loading">Loading...</div>
          ) : posts.length === 0 ? (
            <div className="no-posts">
              <p>No collaboration posts available at the moment.</p>
              <p>Be the first to create one!</p>
            </div>
          ) : (
            <div className="posts-grid">
              {posts.map((post) => (
                <div key={post._id} className="post-card">
                  <div className="post-header">
                    <h3>{post.workout_name}</h3>
                    <span className="posted-by">by {post.username}</span>
                  </div>
                  
                  <div className="post-details">
                    <div className="detail-item">
                      <span className="label">Date:</span>
                      <span className="value">{formatDate(post.date)}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Time:</span>
                      <span className="value">{formatTime(post.time)}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Place:</span>
                      <span className="value">{post.place}</span>
                    </div>
                  </div>

                  <div className="post-actions">
                    <button 
                      onClick={() => handleJoinPost(post._id)}
                      className="join-btn"
                      disabled={loading}
                    >
                      Join
                    </button>
                    {post.user_id === localStorage.getItem('userId') && (
                      <button 
                        onClick={() => handleDeletePost(post._id)}
                        className="delete-btn"
                        disabled={loading}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* My Collaborations Section */}
        <div className="collaborations-section">
          <div className="section-header">
            <h2>My Collaborations</h2>
            <button onClick={fetchCollaborations} className="refresh-btn" disabled={loading}>
              Refresh
            </button>
          </div>

          {collaborations.length === 0 ? (
            <div className="no-collaborations">
              <p>You don't have any active collaborations.</p>
              <p>Join a post or create one to get started!</p>
            </div>
          ) : (
            <div className="collaborations-list">
              {collaborations.map((collab, index) => (
                <div key={index} className="collaboration-card">
                  <div className="collab-header">
                    <h3>{collab.workout_name}</h3>
                    <span className="partner">with {collab.partner_name}</span>
                  </div>
                  
                  <div className="collab-details">
                    <div className="detail-item">
                      <span className="label">Date:</span>
                      <span className="value">{formatDate(collab.date)}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Time:</span>
                      <span className="value">{formatTime(collab.time)}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Place:</span>
                      <span className="value">{collab.place}</span>
                    </div>
                  </div>

                  <div className="collab-actions">
                    <button 
                      onClick={() => handleCancelCollaboration(index)}
                      className="cancel-btn"
                      disabled={loading}
                    >
                      Cancel Collaboration
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Collaboration;
