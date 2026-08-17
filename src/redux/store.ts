import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage'; // Default storage (localStorage for web)
import printReducer from './features/PurchaseOrderReportPrintSlice';
import userReducer from './features/userSlice';

// Individual persist configs for each slice
const printPersistConfig = {
  key: 'print',
  storage,
};

const userPersistConfig = {
  key: 'user',
  storage,
};

// Create persisted reducers
const persistedPrintReducer = persistReducer(printPersistConfig, printReducer);
const persistedUserReducer = persistReducer(userPersistConfig, userReducer);

export const store = configureStore({
  reducer: {
    print: persistedPrintReducer,
    user: persistedUserReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
        ignoredActionPaths: ['payload.dateRange'],
        ignoredPaths: ['print.dateRange'],
      },
    }),
});

export const persistor = persistStore(store);

// Type definitions
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;