import React, { useState, useEffect } from 'react';
import {
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Box,
  Typography
} from '@mui/material';
import Link from 'next/link';
import { useRouter } from 'next/router';
import PersonIcon from '@mui/icons-material/Person';
import HomeIcon from '@mui/icons-material/Home';
import LogoutIcon from '@mui/icons-material/Logout';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import QuizIcon from '@mui/icons-material/Quiz';
import AssignmentIcon from '@mui/icons-material/Assignment';
import { useAuth } from '../context/AuthContext';
import { hasRole } from '../lib/auth';
import { User, UserRole } from '../lib/types';

interface NavigationItem {
  text: string;
  icon: React.ReactNode;
  path: string;
  roles?: UserRole[];
}

const navigationItems: NavigationItem[] = [
  {
    text: 'Portal Home',
    icon: <DashboardIcon color="primary" />,
    path: '/portal'
  },
  {
    text: 'Profile',
    icon: <PersonIcon color="primary" />,
    path: '/profile'
  },
  {
    text: 'Mailing Address',
    icon: <HomeIcon color="primary" />,
    path: '/profile/address'
  }
];

const clientItems: NavigationItem[] = [
  {
    text: 'My Sessions',
    icon: <FitnessCenterIcon color="primary" />,
    path: '/client/sessions',
    roles: [UserRole.CLIENT, UserRole.TRAINER, UserRole.ADMINISTRATOR]
  },
  {
    text: 'My Questionnaires',
    icon: <AssignmentIcon color="primary" />,
    path: '/client/questionnaires',
    roles: [UserRole.CLIENT, UserRole.TRAINER, UserRole.ADMINISTRATOR]
  }
];

const trainerItems: NavigationItem[] = [
  {
    text: 'My Clients',
    icon: <PeopleIcon color="primary" />,
    path: '/trainer/clients',
    roles: [UserRole.TRAINER, UserRole.ADMINISTRATOR]
  },
  {
    text: 'Training Sessions',
    icon: <FitnessCenterIcon color="primary" />,
    path: '/trainer/sessions',
    roles: [UserRole.TRAINER, UserRole.ADMINISTRATOR]
  },
  {
    text: 'Questionnaires',
    icon: <QuizIcon color="primary" />,
    path: '/trainer/questionnaires',
    roles: [UserRole.TRAINER, UserRole.ADMINISTRATOR]
  }
];

const adminItems: NavigationItem[] = [
  {
    text: 'User Management',
    icon: <AdminPanelSettingsIcon color="primary" />,
    path: '/admin/users',
    roles: [UserRole.ADMINISTRATOR]
  },
  {
    text: 'System Settings',
    icon: <AdminPanelSettingsIcon color="primary" />,
    path: '/admin/settings',
    roles: [UserRole.ADMINISTRATOR]
  },
  {
    text: 'Questionnaire Management',
    icon: <QuizIcon color="primary" />,
    path: '/admin/questionnaires',
    roles: [UserRole.ADMINISTRATOR]
  }
];

export default function SideNavigation() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    // Debug info
    if (user) {
      // Use as string to compare with a string literal
      const userRoleString = String(user.role);
      const isAdminByDirectCheck = userRoleString === 'Administrator';
      const isAdminByEnumCheck = user.role === UserRole.ADMINISTRATOR;
      const isAdminByHasRole = hasRole(user, UserRole.ADMINISTRATOR);
      
      console.log('SideNavigation - Admin checks:', { 
        directCheck: isAdminByDirectCheck,
        enumCheck: isAdminByEnumCheck,
        hasRoleCheck: isAdminByHasRole,
        userRole: user.role,
        userRoleType: typeof user.role
      });
    }
  }, [user]);

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await logout();
  };

  // Helper function to check if user has any of the required roles
  const userHasRequiredRole = (requiredRoles?: UserRole[]): boolean => {
    if (!requiredRoles || requiredRoles.length === 0) return true;
    if (!user) return false;
    
    return requiredRoles.some(role => hasRole(user, role));
  };

  // Safely check if user has a specific role
  const userHasRole = (role: UserRole): boolean => {
    return hasRole(user, role);
  };

  const renderNavigationItems = (items: NavigationItem[], sectionTitle?: string) => {
    // Filter items based on user roles using our hasRole utility
    const filteredItems = items.filter(item => userHasRequiredRole(item.roles));
    
    if (filteredItems.length === 0) return null;

    return (
      <>
        {sectionTitle && (
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="overline" color="textSecondary">
              {sectionTitle}
            </Typography>
          </Box>
        )}
        {filteredItems.map((item, index) => (
          <React.Fragment key={item.path}>
            {index > 0 && <Divider />}
            <ListItem
              component={Link}
              href={item.path}
              sx={{
                textDecoration: 'none',
                color: 'inherit',
                backgroundColor: router.pathname === item.path ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.04)',
                }
              }}
            >
              <ListItemIcon>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItem>
          </React.Fragment>
        ))}
      </>
    );
  };

  return (
    <Paper elevation={3} sx={{ borderRadius: 2 }}>
      <List component="nav" aria-label="user actions">
        {/* General Navigation */}
        {renderNavigationItems(navigationItems)}

        {/* Client Section */}
        <>
          <Divider sx={{ my: 1 }} />
          {renderNavigationItems(clientItems, 'Client Tools')}
        </>

        {/* Trainer Section */}
        {user && (userHasRole(UserRole.TRAINER) || userHasRole(UserRole.ADMINISTRATOR)) && (
          <>
            <Divider sx={{ my: 1 }} />
            {renderNavigationItems(trainerItems, 'Trainer Tools')}
          </>
        )}

        {/* Admin Section */}
        {user && userHasRole(UserRole.ADMINISTRATOR) && (
          <>
            <Divider sx={{ my: 1 }} />
            {renderNavigationItems(adminItems, 'Administration')}
          </>
        )}
        
        <Box sx={{ mt: 2 }}>
          <Divider />
          <ListItem
            onClick={handleLogout}
            sx={{
              color: 'error.main',
              cursor: 'pointer',
              '&:hover': {
                backgroundColor: 'rgba(211, 47, 47, 0.04)',
              }
            }}
          >
            <ListItemIcon>
              <LogoutIcon color="error" />
            </ListItemIcon>
            <ListItemText primary="Sign Out" />
          </ListItem>
        </Box>
      </List>
    </Paper>
  );
} 