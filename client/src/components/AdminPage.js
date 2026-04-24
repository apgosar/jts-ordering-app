import React, { useState, useEffect, useCallback } from 'react';
import { getAdminOrders, updateOrderStatus } from '../services/api';
import JtsLogo from './JtsLogo';

const STATUS_COLORS = {
  Pending: 'bg-yellow-100 text-yellow-800',
  Dispatched: 'bg-blue-100 text-blue-800',
  Delivered: 'bg-green-100 text-green-800',
};

const STATUS_FLOW = ['Pending', 'Dispatched', 'Delivered'];

// ─── Login screen ──────────────────────────────────────────────────────────────
function LoginScreen({ onLogin, authError }) {
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  // Show server-side auth error (wrong password) from the parent
  const displayError = localError || authError || '';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setLocalError('Please enter the admin password.');
      return;
    }
    setLocalError('');
    onLogin(password.trim());
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md border border-gray-100 p-6">
        <div className="text-center mb-6">
          <JtsLogo className="w-16 h-16 mx-auto mb-3" />
          <h1 className="font-bold text-gray-900 text-lg" style={{ fontFamily: "'Oswald', sans-serif" }}>Admin Panel</h1>
          <p className="text-gray-500 text-sm mt-1">Enter the admin password to continue</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setLocalError(''); }}
            placeholder="Admin password"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-jts-red transition"
          />
          {displayError && <p className="text-xs text-red-600 -mt-2">{displayError}</p>}
          <button
            type="submit"
            className="w-full py-3 bg-jts-red hover:bg-jts-crimson text-white font-bold rounded-xl transition"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Order detail modal ────────────────────────────────────────────────────────
function OrderModal({ order, onClose }) {
  if (!order) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4"
         onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] overflow-y-auto"
           onClick={e => e.stopPropagation()}>
        <div className="p-5">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs text-gray-500">Order ID</p>
              <p className="font-black text-jts-red text-lg tracking-widest">{order.orderId}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition text-gray-500">✕</button>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <span className={`text-xs px-2 py-1 rounded-full font-semibold ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-600'}`}>
              {order.status}
            </span>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{order.date} {order.time}</span>
          </div>

          <div className="space-y-3">
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Customer</h3>
              <p className="text-sm font-semibold text-gray-800">{order.name}</p>
              <p className="text-sm text-gray-600">{order.phone}</p>
            </section>
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Delivery Address</h3>
              <p className="text-sm text-gray-700 leading-relaxed">
                {order.wingFlat}, {order.building}<br />
                {order.street}{order.landmark ? `, ${order.landmark}` : ''}<br />
                {order.locality} – {order.pincode}
              </p>
            </section>
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Items</h3>
              <div className="space-y-1.5">
                {order.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-700">{item.name} <span className="text-gray-400">×{item.quantity}</span></span>
                    <span className="font-semibold">₹{(item.price * item.quantity).toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-100 mt-2 pt-2 flex justify-between font-bold text-sm">
                <span>Total</span>
                <span className="text-jts-red">₹{order.total.toLocaleString('en-IN')}</span>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Order row ─────────────────────────────────────────────────────────────────
function OrderRow({ order, selected, onSelect, onClick }) {
  return (
    <div
      className={`bg-white rounded-xl border p-3 flex items-start gap-3 transition cursor-pointer
        ${selected ? 'border-jts-red bg-jts-cream' : 'border-gray-100 hover:border-red-200'}`}
      onClick={onClick}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={selected}
        onChange={e => { e.stopPropagation(); onSelect(); }}
        onClick={e => e.stopPropagation()}
        className="mt-1 w-4 h-4 accent-jts-red flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="font-bold text-jts-red text-xs tracking-widest">{order.orderId}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-600'}`}>
            {order.status}
          </span>
        </div>
        <p className="text-sm font-semibold text-gray-800 mt-0.5 truncate">{order.name}</p>
        <p className="text-xs text-gray-500">{order.phone}</p>
        <p className="text-xs text-gray-500 truncate mt-0.5">
          {order.wingFlat}, {order.building}, {order.locality}
        </p>
        <div className="flex justify-between items-center mt-1.5">
          <span className="text-xs text-gray-400">{order.date} {order.time}</span>
          <span className="text-sm font-bold text-gray-700">₹{order.total.toLocaleString('en-IN')}</span>
        </div>
      </div>
    </div>
  );
}

// ─── AdminPage ─────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [adminPassword, setAdminPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filters
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortField, setSortField] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  // Selection
  const [selected, setSelected] = useState(new Set());
  const [modalOrder, setModalOrder] = useState(null);

  // Action feedback
  const [actionMsg, setActionMsg] = useState('');

  // Convert HTML date input (YYYY-MM-DD) to stored format (DD/MM/YYYY)
  const convertDateFormat = (dateStr) => {
    if (!dateStr) return undefined;
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const fetchOrders = useCallback(async (pass) => {
    setLoading(true);
    setError('');
    try {
      const formattedDate = convertDateFormat(filterDate);
      const res = await getAdminOrders(
        { date: formattedDate || undefined, status: filterStatus || undefined },
        pass || adminPassword
      );
      setOrders(res.data.orders || []);
      setSelected(new Set());
    } catch (err) {
      if (err.response?.status === 401) {
        setAuthenticated(false);
        setAuthError('Incorrect password. Please try again.');
      } else {
        setError(err.response?.data?.error || 'Failed to fetch orders.');
      }
    } finally {
      setLoading(false);
    }
  }, [filterDate, filterStatus, adminPassword]);

  const handleLogin = async (pass) => {
    setAuthError('');
    try {
      const res = await getAdminOrders({}, pass);
      setOrders(res.data.orders || []);
      setAdminPassword(pass);
      setAuthenticated(true);
    } catch (err) {
      if (err.response?.status === 401) {
        setAuthError('Incorrect password. Please try again.');
      } else {
        // Auth succeeded, server error
        setAdminPassword(pass);
        setAuthenticated(true);
      }
    }
  };

  useEffect(() => {
    if (authenticated) fetchOrders();
  }, [authenticated, filterDate, filterStatus, fetchOrders]);

  if (!authenticated) {
    return <LoginScreen onLogin={handleLogin} authError={authError} />;
  }

  // ── Sort ──
  const sortedOrders = [...orders].sort((a, b) => {
    let valA, valB;
    if (sortField === 'date') {
      valA = new Date(`${a.date} ${a.time}`);
      valB = new Date(`${b.date} ${b.time}`);
    } else if (sortField === 'total') {
      valA = a.total;
      valB = b.total;
    } else if (sortField === 'status') {
      valA = STATUS_FLOW.indexOf(a.status);
      valB = STATUS_FLOW.indexOf(b.status);
    } else if (sortField === 'name') {
      valA = a.name.toLowerCase();
      valB = b.name.toLowerCase();
    } else {
      valA = a[sortField];
      valB = b[sortField];
    }
    if (valA < valB) return sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const toggleSelect = (rowIndex) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === sortedOrders.length) setSelected(new Set());
    else setSelected(new Set(sortedOrders.map(o => o.rowIndex)));
  };

  const flash = (msg) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(''), 3000);
  };

  const handleStatusUpdate = async (status) => {
    if (selected.size === 0) return;
    try {
      await updateOrderStatus([...selected], status, adminPassword);
      flash(`✅ ${selected.size} order(s) marked as ${status}`);
      fetchOrders();
    } catch {
      flash('❌ Failed to update status. Please try again.');
    }
  };

  const handleShare = () => {
    if (selected.size === 0) return;
    const selectedOrders = sortedOrders.filter(o => selected.has(o.rowIndex));
    const lines = selectedOrders.map(o => {
      const itemList = o.items.map(i => `  • ${i.name} ×${i.quantity} = ₹${i.price * i.quantity}`).join('\n');
      return `🔖 Order: ${o.orderId}
👤 ${o.name} | 📞 ${o.phone}
📍 ${o.wingFlat}, ${o.building}, ${o.street}${o.landmark ? ', ' + o.landmark : ''}
   ${o.locality} – ${o.pincode}
🕒 ${o.date} ${o.time}
${itemList}
💰 Total: ₹${o.total}
Status: ${o.status}`;
    });
    const text = lines.join('\n\n──────────────────\n\n');
    navigator.clipboard.writeText(text).then(
      () => flash(`📋 ${selected.size} order(s) copied to clipboard!`),
      () => {
        // Fallback: open WhatsApp
        const encoded = encodeURIComponent(text);
        window.open(`https://wa.me/?text=${encoded}`, '_blank');
      }
    );
  };

  const totalRevenue = sortedOrders.reduce((s, o) => s + o.total, 0);
  const pendingCount = sortedOrders.filter(o => o.status === 'Pending').length;

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {modalOrder && <OrderModal order={modalOrder} onClose={() => setModalOrder(null)} />}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <JtsLogo className="w-9 h-9 flex-shrink-0" />
            <div>
              <h1 className="font-bold text-gray-900 text-sm leading-tight" style={{ fontFamily: "'Oswald', sans-serif" }}>Admin Panel</h1>
              <p className="text-xs text-gray-500">{orders.length} orders</p>
            </div>
          </div>
          <button
            onClick={() => fetchOrders()}
            className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition"
          >
            ↻ Refresh
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <p className="text-2xl font-black text-gray-800">{orders.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total Orders</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <p className="text-2xl font-black text-yellow-600">{pendingCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">Pending</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <p className="text-lg font-black text-jts-red">₹{totalRevenue.toLocaleString('en-IN')}</p>
            <p className="text-xs text-gray-500 mt-0.5">Revenue</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-100 p-3 flex flex-wrap gap-3">
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs font-medium text-gray-600 block mb-1">Filter by Date</label>
            <input
              type="date"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-jts-red transition"
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs font-medium text-gray-600 block mb-1">Filter by Status</label>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-jts-red transition bg-white"
            >
              <option value="">All Statuses</option>
              {STATUS_FLOW.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs font-medium text-gray-600 block mb-1">Sort By</label>
            <select
              value={`${sortField}:${sortDir}`}
              onChange={e => {
                const [f, d] = e.target.value.split(':');
                setSortField(f);
                setSortDir(d);
              }}
              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-jts-red transition bg-white"
            >
              <option value="date:desc">Date (Newest First)</option>
              <option value="date:asc">Date (Oldest First)</option>
              <option value="total:desc">Amount (High→Low)</option>
              <option value="total:asc">Amount (Low→High)</option>
              <option value="status:asc">Status</option>
              <option value="name:asc">Customer Name</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => { setFilterDate(''); setFilterStatus(''); }}
              className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Bulk actions */}
        {selected.size > 0 && (
          <div className="bg-jts-cream border border-red-200 rounded-xl p-3 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-jts-red flex-1 min-w-max">
              {selected.size} selected
            </span>
            <button
              onClick={() => handleStatusUpdate('Dispatched')}
              className="px-3 py-1.5 text-xs bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition"
            >
              🚚 Mark Dispatched
            </button>
            <button
              onClick={() => handleStatusUpdate('Delivered')}
              className="px-3 py-1.5 text-xs bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition"
            >
              ✅ Mark Delivered
            </button>
            <button
              onClick={handleShare}
              className="px-3 py-1.5 text-xs bg-jts-red hover:bg-jts-crimson text-white font-semibold rounded-lg transition"
            >
              📤 Share with Vendor
            </button>
          </div>
        )}

        {/* Action message */}
        {actionMsg && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700 font-medium">
            {actionMsg}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Select all + list */}
        {!loading && sortedOrders.length > 0 && (
          <>
            <div className="flex items-center gap-2 px-1">
              <input
                type="checkbox"
                checked={selected.size === sortedOrders.length && sortedOrders.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 accent-jts-red"
              />
              <span className="text-xs text-gray-500">Select all ({sortedOrders.length})</span>
            </div>
            <div className="flex flex-col gap-2">
              {sortedOrders.map(order => (
                <OrderRow
                  key={order.rowIndex}
                  order={order}
                  selected={selected.has(order.rowIndex)}
                  onSelect={() => toggleSelect(order.rowIndex)}
                  onClick={() => setModalOrder(order)}
                />
              ))}
            </div>
          </>
        )}

        {!loading && sortedOrders.length === 0 && !error && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📋</p>
            <p className="font-medium">No orders found</p>
            {(filterDate || filterStatus) && (
              <p className="text-sm mt-1">Try clearing the filters</p>
            )}
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-red-200 border-t-jts-red rounded-full animate-spin" />
          </div>
        )}
      </main>
    </div>
  );
}
