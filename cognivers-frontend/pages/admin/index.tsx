import React from 'react';
import { Box, Typography, Grid, Paper, Button } from '@mui/material';
import { useRouter } from 'next/router';
import { withNavigationLayout } from '../../utils/layout';

function AdminDashboard() {
  const router = useRouter();

  const menuItems = [
    {
      title: 'Users',
      description: 'Manage system users and their roles',
      path: '/admin/users',
      color: '#1976d2'
    },
    {
      title: 'Sessions',
      description: 'Manage training sessions and enrollments',
      path: '/admin/sessions',
      color: '#2e7d32'
    },
    {
      title: 'Questionnaires',
      description: 'Create and manage questionnaires',
      path: '/admin/questionnaires',
      color: '#ed6c02'
    },
    {
      title: 'Processors',
      description: 'Configure and manage AI processors',
      path: '/admin/processors',
      color: '#9c27b0'
    },
    {
      title: 'Settings',
      description: 'System configuration and preferences',
      path: '/admin/settings',
      color: '#757575'
    }
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Admin Dashboard
      </Typography>
      
      <Grid container spacing={3}>
        {menuItems.map((item) => (
          <Grid item xs={12} sm={6} md={4} key={item.title}>
            <Paper 
              sx={{ 
                p: 3, 
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                cursor: 'pointer',
                '&:hover': {
                  boxShadow: 6,
                  transform: 'translateY(-2px)',
                  transition: 'all 0.2s ease-in-out'
                }
              }}
              onClick={() => router.push(item.path)}
            >
              <Typography 
                variant="h6" 
                component="h2" 
                gutterBottom
                sx={{ color: item.color }}
              >
                {item.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                {item.description}
              </Typography>
              <Button 
                variant="outlined" 
                sx={{ mt: 'auto' }}
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(item.path);
                }}
              >
                Go to {item.title}
              </Button>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

// Apply the navigation layout
AdminDashboard.getLayout = withNavigationLayout;

export default AdminDashboard; 