import React from 'react';
import { Container, Grid } from '@mui/material';
import SideNavigation from './SideNavigation';

interface NavigationLayoutProps {
  children: React.ReactNode;
}

export default function NavigationLayout({ children }: NavigationLayoutProps) {
  return (
    <Container sx={{ py: 4 }}>
      <Grid container spacing={3}>
        <Grid item xs={12} md={3}>
          <SideNavigation />
        </Grid>
        <Grid item xs={12} md={9}>
          {children}
        </Grid>
      </Grid>
    </Container>
  );
} 