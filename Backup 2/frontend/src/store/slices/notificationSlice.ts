import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { Notification } from '../../types';
import { notificationService } from '../../services';

interface NotificationState {
  items: Notification[];
  unreadCount: number;
  loading: boolean;
  lastFetchedAt: number | null;
  hasMore: boolean;
  page: number;
}

const initialState: NotificationState = {
  items: [],
  unreadCount: 0,
  loading: false,
  lastFetchedAt: null,
  hasMore: true,
  page: 1,
};

export const fetchUnreadCount = createAsyncThunk(
  'notifications/fetchUnreadCount',
  async () => {
    const { data } = await notificationService.unreadCount();
    return data.unread_count;
  }
);

export const fetchNotifications = createAsyncThunk(
  'notifications/fetchNotifications',
  async (page: number) => {
    const { data } = await notificationService.list(page);
    return { items: data.data, page, hasMore: data.current_page < data.last_page };
  }
);

export const markAsRead = createAsyncThunk(
  'notifications/markAsRead',
  async (id: number) => {
    await notificationService.markRead(id);
    return id;
  }
);

export const markAllAsRead = createAsyncThunk(
  'notifications/markAllAsRead',
  async () => {
    await notificationService.markAllRead();
  }
);

export const deleteNotification = createAsyncThunk(
  'notifications/delete',
  async (id: number) => {
    await notificationService.destroy(id);
    return id;
  }
);

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    resetNotifications: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUnreadCount.fulfilled, (state, action: PayloadAction<number>) => {
        const prev = state.unreadCount;
        state.unreadCount = action.payload;
        state.lastFetchedAt = Date.now();
        // If count increased, we know there are new notifications
        if (action.payload > prev && prev > 0) {
          // Trigger a refresh of the list next time it's opened
          state.items = [];
          state.page = 1;
          state.hasMore = true;
        }
      })
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        const { items, page, hasMore } = action.payload;
        if (page === 1) {
          state.items = items;
        } else {
          state.items = [...state.items, ...items];
        }
        state.page = page;
        state.hasMore = hasMore;
        state.loading = false;
      })
      .addCase(fetchNotifications.rejected, (state) => {
        state.loading = false;
      })
      .addCase(markAsRead.fulfilled, (state, action: PayloadAction<number>) => {
        const item = state.items.find(n => n.id === action.payload);
        if (item && !item.read_at) {
          item.read_at = new Date().toISOString();
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      })
      .addCase(markAllAsRead.fulfilled, (state) => {
        state.items.forEach(n => {
          if (!n.read_at) n.read_at = new Date().toISOString();
        });
        state.unreadCount = 0;
      })
      .addCase(deleteNotification.fulfilled, (state, action: PayloadAction<number>) => {
        const idx = state.items.findIndex(n => n.id === action.payload);
        if (idx !== -1) {
          const wasUnread = !state.items[idx].read_at;
          state.items.splice(idx, 1);
          if (wasUnread) state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      });
  },
});

export const { resetNotifications } = notificationSlice.actions;
export default notificationSlice.reducer;
