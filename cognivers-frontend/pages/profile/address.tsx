import { 
  Typography, 
  Paper
} from '@mui/material';
import AddressForm from '../../components/AddressForm';
import ProtectedRoute from '../../components/ProtectedRoute';
import { withNavigationLayout } from '../../utils/layout';

function AddressPage() {
  return (
    <ProtectedRoute>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Mailing Address
        </Typography>
        <AddressForm />
      </Paper>
    </ProtectedRoute>
  );
}

export default AddressPage;

// Add the getLayout function to the AddressPage component
AddressPage.getLayout = withNavigationLayout; 