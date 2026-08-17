import { ICompany } from '@/Utils/constants';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UserData {
  id: string;
  email: string;
  email_confirmed: boolean;
  created_at: string;
  last_sign_in: string;
  first_name: string | null;
  last_name: string | null;
  user_id:string;
  role_id: string | null;
  status: string | null;
  is_active: boolean;
  company_data: ICompany;
  company_id: string | null;
  full_name: string | null;
  department_id: string | null;  // Add department
  locations: any | null;          // Add locations
  stores: any[] | null;
  approve_authorizations: any | null; // Add approve authorizations
}

interface UserState {
  userData: UserData | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

const storedUserData = localStorage.getItem('userData');
const parsedUserData: UserData | null = storedUserData ? JSON.parse(storedUserData) : null;

const initialState: UserState = {
  userData: parsedUserData,
  isAuthenticated: !!parsedUserData,
  isLoading: false,
  error: null,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<any>) => {
      state.userData = action.payload;
      state.isAuthenticated = true;
      state.error = null;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
    },
    clearUser: (state) => {
      state.userData = null;
      state.isAuthenticated = false;
      state.error = null;
    },
  },
});

export const { setUser, setLoading, setError, clearUser } = userSlice.actions;

// Selectors
export const selectUser = (state: { user: UserState }) => state.user.userData;
export const selectIsAuthenticated = (state: { user: UserState }) => state.user.isAuthenticated;
export const selectIsLoading = (state: { user: UserState }) => state.user.isLoading;
export const selectError = (state: { user: UserState }) => state.user.error;

export default userSlice.reducer;