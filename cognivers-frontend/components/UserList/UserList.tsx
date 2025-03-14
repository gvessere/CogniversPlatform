import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  Paper,
  Select,
  MenuItem,
  IconButton,
  Typography,
  Box,
  TextField,
  InputAdornment,
  Tooltip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { format, parseISO } from 'date-fns';
import CreateUserDialog from './CreateUserDialog';
import { postData } from '../../lib/api';
import { useRouter } from 'next/router';
import { User, UserRole } from '../../lib/types';

interface UserListProps {
  users: User[];
  isAdmin?: boolean;
  onRoleChange?: (userId: number, newRole: UserRole) => Promise<void>;
  onUserSelect?: (user: User) => void;
  onUserDelete?: (userId: number) => Promise<void>;
  onUserCreate?: () => void;
  loading?: boolean;
  onRefresh: () => void;
  currentUserRole: string | UserRole;
}

type Order = 'asc' | 'desc';
interface HeadCell {
  id: keyof User;
  label: string;
  sortable: boolean;
}

const headCells: HeadCell[] = [
  { id: 'first_name', label: 'Name', sortable: true },
  { id: 'email', label: 'Email', sortable: true },
  { id: 'role', label: 'Role', sortable: true }
];

// Helper function to check if a role matches a target role
const roleMatches = (role: string | UserRole, targetRole: string | UserRole): boolean => {
  if (!role) return false;
  
  // Direct comparison
  if (role === targetRole) {
    return true;
  }
  
  // Convert to strings for case-insensitive comparison
  const roleString = String(role).toLowerCase();
  const targetRoleString = String(targetRole).toLowerCase();
  
  return roleString === targetRoleString;
};

export default function UserList({
  users,
  isAdmin = false,
  onRoleChange,
  onUserSelect,
  onUserDelete,
  onUserCreate,
  loading = false,
  onRefresh,
  currentUserRole
}: UserListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [orderBy, setOrderBy] = useState<keyof User>('first_name');
  const [order, setOrder] = useState<Order>('asc');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<number | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const router = useRouter();

  // Filter and sort users
  const getFilteredUsers = () => {
    const filtered = users.filter(user => 
      user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sort
    filtered.sort((a, b) => {
      const isAsc = order === 'asc';
      if (orderBy === 'first_name') {
        return isAsc 
          ? `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
          : `${b.first_name} ${b.last_name}`.localeCompare(`${a.first_name} ${a.last_name}`);
      }
      return isAsc
        ? String(a[orderBy]).localeCompare(String(b[orderBy]))
        : String(b[orderBy]).localeCompare(String(a[orderBy]));
    });

    return filtered;
  };

  const handleSort = (property: keyof User) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleDeleteClick = (userId: number) => {
    setUserToDelete(userId);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (userToDelete && onUserDelete) {
      await onUserDelete(userToDelete);
      setDeleteConfirmOpen(false);
      setUserToDelete(null);
    }
  };

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setPage(0);
  };

  // Define the type to match what CreateUserDialog expects
  interface CreateUserFormData {
    email: string;
    password: string;
    confirm_password: string;
    first_name: string;
    last_name: string;
    role: string;
    dob: Date | null;
  }

  const handleCreateUser = async (userData: CreateUserFormData) => {
    try {
      // Convert Date to string format for API
      const apiUserData = {
        ...userData,
        dob: userData.dob ? userData.dob.toISOString().split('T')[0] : undefined,
      };
      
      // Remove confirm_password as it's not needed for the API
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { confirm_password: _, ...dataForApi } = apiUserData;
      
      await postData('/users', dataForApi);
      onRefresh?.();
      setCreateDialogOpen(false);
    } catch (error) {
      console.error('Error creating user:', error);
    }
  };

  const handleUserClick = (userId: number) => {
    if (roleMatches(currentUserRole, UserRole.TRAINER) || roleMatches(currentUserRole, UserRole.ADMINISTRATOR)) {
      router.push(`/trainer/clients/${userId}`);
    }
  };

  const filteredUsers = getFilteredUsers();
  const emptyRows = page > 0 ? Math.max(0, (1 + page) * rowsPerPage - filteredUsers.length) : 0;

  return (
    <Box>
      {/* Header with search and add button */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
        <TextField
          sx={{ flexGrow: 1 }}
          variant="outlined"
          placeholder="Search users..."
          value={searchTerm}
          onChange={handleSearch}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        {isAdmin && onUserCreate && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
          >
            Create User
          </Button>
        )}
      </Box>

      {/* Users Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              {headCells.map((headCell) => (
                <TableCell
                  key={headCell.id}
                  sortDirection={orderBy === headCell.id ? order : false}
                >
                  {headCell.sortable ? (
                    <TableSortLabel
                      active={orderBy === headCell.id}
                      direction={orderBy === headCell.id ? order : 'asc'}
                      onClick={() => handleSort(headCell.id)}
                    >
                      {headCell.label}
                    </TableSortLabel>
                  ) : (
                    headCell.label
                  )}
                </TableCell>
              ))}
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  <Typography>Loading...</Typography>
                </TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  <Typography>No users found</Typography>
                </TableCell>
              </TableRow>
            ) : (
              <>
                {filteredUsers
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((user) => (
                    <TableRow
                      key={user.id}
                      hover={roleMatches(currentUserRole, UserRole.TRAINER) || roleMatches(currentUserRole, UserRole.ADMINISTRATOR)}
                      onClick={() => handleUserClick(user.id)}
                      sx={{
                        cursor: roleMatches(currentUserRole, UserRole.TRAINER) || roleMatches(currentUserRole, UserRole.ADMINISTRATOR)
                          ? 'pointer'
                          : 'default'
                      }}
                    >
                      <TableCell>
                        {user.first_name} {user.last_name}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        {isAdmin ? (
                          <Select
                            value={user.role}
                            onChange={(e) => onRoleChange && onRoleChange(user.id, e.target.value as UserRole)}
                            size="small"
                          >
                            <MenuItem value={UserRole.CLIENT}>Client</MenuItem>
                            <MenuItem value={UserRole.TRAINER}>Trainer</MenuItem>
                            <MenuItem value={UserRole.ADMINISTRATOR}>Administrator</MenuItem>
                          </Select>
                        ) : (
                          user.role
                        )}
                      </TableCell>
                      <TableCell>
                        {user.dob ? format(parseISO(user.dob), 'MM/dd/yyyy') : '-'}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Tooltip title="View Details">
                            <IconButton
                              size="small"
                              onClick={() => onUserSelect && onUserSelect(user)}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          {isAdmin && onUserDelete && (
                            <Tooltip title="Delete User">
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteClick(user.id)}
                                color="error"
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                {emptyRows > 0 && (
                  <TableRow style={{ height: 53 * emptyRows }}>
                    <TableCell colSpan={4} />
                  </TableRow>
                )}
              </>
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={filteredUsers.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </TableContainer>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          Are you sure you want to delete this user? This action cannot be undone.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <CreateUserDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSubmit={handleCreateUser}
      />
    </Box>
  );
} 