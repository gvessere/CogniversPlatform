# API Usage Examples

This document provides examples of how to use the API architecture in different scenarios.

## Basic Component Example

Here's a simple component that fetches and displays sessions:

```tsx
import React, { useState, useEffect } from 'react';
import { getSessions } from '../lib/api';
import { Session } from '../lib/types';

const SessionsList: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoading(true);
        const data = await getSessions();
        setSessions(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching sessions:', err);
        setError('Failed to load sessions. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, []);

  if (loading) return <div>Loading sessions...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>Sessions</h1>
      {sessions.length === 0 ? (
        <p>No sessions found.</p>
      ) : (
        <ul>
          {sessions.map(session => (
            <li key={session.id}>{session.title}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SessionsList;
```

## Creating a Resource

Example of creating a new session:

```tsx
import React, { useState } from 'react';
import { createSession } from '../lib/api';
import { Session } from '../lib/types';

const CreateSessionForm: React.FC = () => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);
      
      const sessionData = {
        title,
        description,
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 86400000).toISOString() // Tomorrow
      };
      
      const newSession = await createSession(sessionData);
      console.log('Session created:', newSession);
      
      // Reset form
      setTitle('');
      setDescription('');
      setSuccess(true);
    } catch (err) {
      console.error('Error creating session:', err);
      setError('Failed to create session. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Create New Session</h2>
      {success && <div className="success">Session created successfully!</div>}
      {error && <div className="error">{error}</div>}
      
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="title">Title:</label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        
        <div>
          <label htmlFor="description">Description:</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        
        <button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create Session'}
        </button>
      </form>
    </div>
  );
};

export default CreateSessionForm;
```

## Using Custom API Calls

For operations without a specific resource function:

```tsx
import React, { useState } from 'react';
import { callFrontendApi } from '../lib/api';

interface AnalyticsData {
  totalUsers: number;
  activeUsers: number;
  completedQuestionnaires: number;
}

const DashboardStats: React.FC = () => {
  const [stats, setStats] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        // Using callFrontendApi directly for a custom endpoint
        const data = await callFrontendApi<AnalyticsData>('/api/analytics/dashboard', 'GET');
        setStats(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching analytics:', err);
        setError('Failed to load dashboard statistics.');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) return <div>Loading statistics...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!stats) return <div>No data available</div>;

  return (
    <div className="dashboard-stats">
      <div className="stat-card">
        <h3>Total Users</h3>
        <p>{stats.totalUsers}</p>
      </div>
      <div className="stat-card">
        <h3>Active Users</h3>
        <p>{stats.activeUsers}</p>
      </div>
      <div className="stat-card">
        <h3>Completed Questionnaires</h3>
        <p>{stats.completedQuestionnaires}</p>
      </div>
    </div>
  );
};

export default DashboardStats;
```

## Using Generic Helper Functions

For simple CRUD operations:

```tsx
import React, { useState, useEffect } from 'react';
import { getData, postData } from '../lib/api';

interface Notification {
  id: number;
  message: string;
  read: boolean;
  created_at: string;
}

const NotificationsPanel: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        // Using getData for a simple GET request
        const data = await getData<Notification[]>('/api/notifications');
        setNotifications(data);
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      }
    };
    
    fetchNotifications();
  }, []);
  
  const markAsRead = async (id: number) => {
    try {
      // Using postData for a simple POST request
      await postData<void, { id: number }>('/api/notifications/mark-read', { id });
      
      // Update local state
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === id ? { ...notif, read: true } : notif
        )
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };
  
  return (
    <div className="notifications-panel">
      <h2>Notifications</h2>
      {notifications.length === 0 ? (
        <p>No notifications</p>
      ) : (
        <ul>
          {notifications.map(notification => (
            <li 
              key={notification.id} 
              className={notification.read ? 'read' : 'unread'}
            >
              <p>{notification.message}</p>
              <small>{new Date(notification.created_at).toLocaleString()}</small>
              {!notification.read && (
                <button onClick={() => markAsRead(notification.id)}>
                  Mark as read
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default NotificationsPanel;
```

## Error Handling Best Practices

```tsx
import React, { useState } from 'react';
import { updateSession } from '../lib/api';
import { Session } from '../lib/types';

interface EditSessionProps {
  session: Session;
  onSuccess: (updatedSession: Session) => void;
}

const EditSessionForm: React.FC<EditSessionProps> = ({ session, onSuccess }) => {
  const [formData, setFormData] = useState({
    title: session.title,
    description: session.description || ''
  });
  const [status, setStatus] = useState<{
    loading: boolean;
    error: string | null;
  }>({
    loading: false,
    error: null
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setStatus({ loading: true, error: null });
    
    try {
      // Validate form data
      if (!formData.title.trim()) {
        throw new Error('Title is required');
      }
      
      // Call API
      const updatedSession = await updateSession(session.id, formData);
      
      // Handle success
      onSuccess(updatedSession);
    } catch (error) {
      // Handle different types of errors
      if (error instanceof Error) {
        // Client-side validation error
        setStatus({ loading: false, error: error.message });
      } else if (typeof error === 'object' && error !== null) {
        // API error with response
        const apiError = error as any;
        if (apiError.response?.status === 400) {
          // Bad request - validation error
          setStatus({ 
            loading: false, 
            error: apiError.response.data.message || 'Invalid form data' 
          });
        } else if (apiError.response?.status === 403) {
          // Forbidden - permissions error
          setStatus({ 
            loading: false, 
            error: 'You do not have permission to edit this session' 
          });
        } else {
          // Other API errors
          setStatus({ 
            loading: false, 
            error: 'Failed to update session. Please try again.' 
          });
        }
      } else {
        // Unknown error
        setStatus({ 
          loading: false, 
          error: 'An unexpected error occurred' 
        });
      }
      
      // Log error for debugging
      console.error('Error updating session:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {status.error && (
        <div className="error-message">{status.error}</div>
      )}
      
      <div className="form-group">
        <label htmlFor="title">Title</label>
        <input
          type="text"
          id="title"
          name="title"
          value={formData.title}
          onChange={handleChange}
          disabled={status.loading}
          required
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          disabled={status.loading}
        />
      </div>
      
      <button 
        type="submit" 
        disabled={status.loading}
      >
        {status.loading ? 'Saving...' : 'Save Changes'}
      </button>
    </form>
  );
};

export default EditSessionForm;
```

These examples demonstrate the recommended patterns for using the API architecture in different scenarios. By following these patterns, you'll ensure consistency, proper error handling, and type safety throughout your application. 