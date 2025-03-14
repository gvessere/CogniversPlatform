import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../../context/AuthContext'
import { 
  Container, 
  Typography, 
  Box, 
  Button, 
  Grid, 
  Paper,
  CircularProgress
} from '@mui/material'
import { ReactElement } from 'react'

export default function Home(): ReactElement {
  const { user, loading } = useAuth()
  const router = useRouter()
  
  // Redirect to portal if already logged in
  useEffect(() => {
    if (user && !loading) {
      router.push('/portal')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <Container sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress size={60} />
      </Container>
    )
  }

  return (
    <Container maxWidth="lg" sx={{ py: 8 }}>
      <Grid container spacing={4}>
        <Grid item xs={12}>
          <Paper 
            elevation={3} 
            sx={{ 
              p: 4, 
              borderRadius: 2, 
              textAlign: 'center',
              backgroundColor: 'primary.light',
              color: 'white'
            }}
          >
            <Typography variant="h3" component="h1" gutterBottom>
              Welcome to Cognivers
            </Typography>
            <Typography variant="h5" sx={{ mb: 4 }}>
              Your premier platform for cognitive efficiency training and coaching
            </Typography>
            <Box sx={{ mt: 4 }}>
              <Button 
                variant="contained" 
                color="secondary" 
                size="large"
                onClick={() => router.push('/login')}
                sx={{ mr: 2 }}
              >
                Login
              </Button>
              <Button 
                variant="contained" 
                color="inherit" 
                size="large"
                onClick={() => router.push('/signup')}
                sx={{ bgcolor: 'white', color: 'primary.main', '&:hover': { bgcolor: '#f0f0f0' } }}
              >
                Sign Up
              </Button>
            </Box>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Paper 
            elevation={2} 
            sx={{ 
              p: 3, 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column',
              borderRadius: 2
            }}
          >
            <Typography variant="h5" gutterBottom>
              Personalized Training
            </Typography>
            <Typography variant="body1" sx={{ mb: 2, flexGrow: 1 }}>
              Access customized cognitive training programs designed to enhance your mental performance and efficiency.
            </Typography>
            <Button variant="text" color="primary">
              Learn More
            </Button>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Paper 
            elevation={2} 
            sx={{ 
              p: 3, 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column',
              borderRadius: 2
            }}
          >
            <Typography variant="h5" gutterBottom>
              Expert Coaching
            </Typography>
            <Typography variant="body1" sx={{ mb: 2, flexGrow: 1 }}>
              Work with skilled coaches who will guide you through techniques to maximize your cognitive potential.
            </Typography>
            <Button variant="text" color="primary">
              Learn More
            </Button>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Paper 
            elevation={2} 
            sx={{ 
              p: 3, 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column',
              borderRadius: 2
            }}
          >
            <Typography variant="h5" gutterBottom>
              Progress Tracking
            </Typography>
            <Typography variant="body1" sx={{ mb: 2, flexGrow: 1 }}>
              Monitor your journey with detailed analytics and insights that help you measure and improve your cognitive abilities.
            </Typography>
            <Button variant="text" color="primary">
              Learn More
            </Button>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  )
} 