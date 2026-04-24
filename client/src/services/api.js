import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || '';

/** Fetch the menu from Google Sheets (or mock data) */
export const getMenu = () => axios.get(`${API_BASE}/api/menu`);

/** Place a new order */
export const placeOrder = (payload) => axios.post(`${API_BASE}/api/orders`, payload);

/** Fetch all orders (admin only) */
export const getAdminOrders = (filters = {}, adminPassword) =>
  axios.get(`${API_BASE}/api/admin/orders`, {
    params: filters,
    headers: { 'x-admin-password': adminPassword },
  });

/** Bulk-update order statuses (admin only) */
export const updateOrderStatus = (rowIndices, status, adminPassword) =>
  axios.put(
    `${API_BASE}/api/admin/orders/status`,
    { rowIndices, status },
    { headers: { 'x-admin-password': adminPassword } }
  );
