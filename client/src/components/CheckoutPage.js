import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../App';
import { placeOrder } from '../services/api';

// ─── Input field ──────────────────────────────────────────────────────────────
function Field({ label, id, required, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function TextInput({ id, value, onChange, placeholder, type = 'text', maxLength, inputMode }) {
  return (
    <input
      id={id}
      type={type}
      inputMode={inputMode}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      maxLength={maxLength}
      className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400
        focus:outline-none focus:ring-2 focus:ring-jts-red focus:border-transparent transition"
    />
  );
}

// ─── Order summary row ────────────────────────────────────────────────────────
function OrderRow({ item }) {
  return (
    <div className="flex items-start justify-between text-sm">
      <div className="flex-1 min-w-0">
        <span className="font-medium text-gray-800">{item.name}</span>
        <span className="text-gray-400 text-xs ml-1">({item.section})</span>
      </div>
      <div className="flex items-center gap-4 ml-4 flex-shrink-0">
        <span className="text-gray-500">×{item.quantity}</span>
        <span className="font-semibold text-gray-800 w-16 text-right">
          ₹{(item.price * item.quantity).toLocaleString('en-IN')}
        </span>
      </div>
    </div>
  );
}

// ─── CheckoutPage ─────────────────────────────────────────────────────────────
const INITIAL_FORM = {
  name: '',
  phone: '',
  wingFlat: '',
  building: '',
  street: '',
  landmark: '',
  locality: '',
  pincode: '',
};

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { cartItems, cartTotal, clearCart, setLastOrder } = useCart();

  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  // Redirect to menu if cart is empty
  if (cartItems.length === 0 && !submitting) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-5xl">🛒</p>
        <p className="text-gray-600 font-medium text-center">Your cart is empty. Add items from the menu first.</p>
        <button
          onClick={() => navigate('/')}
          className="mt-2 px-6 py-3 bg-jts-red text-white font-semibold rounded-xl hover:bg-jts-crimson transition"
        >
          Browse Menu
        </button>
      </div>
    );
  }

  const handleChange = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.phone.trim()) {
      e.phone = 'Phone number is required';
    } else if (!/^[6-9]\d{9}$/.test(form.phone.trim())) {
      e.phone = 'Enter a valid 10-digit Indian mobile number (starting with 6–9)';
    }
    if (!form.wingFlat.trim()) e.wingFlat = 'Wing / Flat No is required';
    if (!form.building.trim()) e.building = 'Building Name is required';
    if (!form.street.trim()) e.street = 'Street Name is required';
    if (!form.locality.trim()) e.locality = 'Locality is required';
    if (!form.pincode.trim()) {
      e.pincode = 'PINCODE is required';
    } else if (!/^\d{6}$/.test(form.pincode.trim())) {
      e.pincode = 'Enter a valid 6-digit PINCODE';
    }
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      // Scroll to first error
      const firstKey = Object.keys(validationErrors)[0];
      document.getElementById(firstKey)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSubmitting(true);
    setServerError('');
    try {
      const res = await placeOrder({
        customer: {
          name: form.name.trim(),
          phone: form.phone.trim(),
          wingFlat: form.wingFlat.trim(),
          building: form.building.trim(),
          street: form.street.trim(),
          landmark: form.landmark.trim(),
          locality: form.locality.trim(),
          pincode: form.pincode.trim(),
        },
        items: cartItems.map(({ name, section, price, quantity }) => ({ name, section, price, quantity })),
        total: cartTotal,
      });

      setLastOrder({
        orderId: res.data.orderId,
        items: cartItems,
        total: cartTotal,
        customer: form,
      });
      clearCart();
      navigate('/confirmation');
    } catch (err) {
      console.error(err);
      setServerError(
        err.response?.data?.error || 'Something went wrong. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white shadow-sm">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-xl hover:bg-gray-100 transition text-gray-600"
            aria-label="Back to menu"
          >
            ←
          </button>
          <h1 className="font-bold text-gray-900 text-base">Checkout</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-4 flex flex-col gap-5">
        {/* ── Order Summary ── */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span>🧾</span> Your Order
          </h2>
          <div className="flex flex-col gap-2.5 divide-y divide-gray-50">
            {cartItems.map(item => (
              <OrderRow key={`${item.section}::${item.name}`} item={item} />
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
            <span className="font-bold text-gray-700">Total</span>
            <span className="font-extrabold text-jts-red text-xl">
              ₹{cartTotal.toLocaleString('en-IN')}
            </span>
          </div>
        </section>

        {/* ── Customer Details Form ── */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-4" noValidate>
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <span>👤</span> Your Details
          </h2>

          <Field label="Full Name" id="name" required error={errors.name}>
            <TextInput
              id="name"
              value={form.name}
              onChange={handleChange('name')}
              placeholder="e.g. Raj Mehta"
            />
          </Field>

          <Field label="Phone Number" id="phone" required error={errors.phone}>
            <TextInput
              id="phone"
              value={form.phone}
              onChange={handleChange('phone')}
              placeholder="10-digit mobile number"
              type="tel"
              inputMode="tel"
              maxLength={10}
            />
          </Field>

          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span>📍</span> Delivery Address
            </h3>
            <div className="flex flex-col gap-3">
              <Field label="Wing / Flat No" id="wingFlat" required error={errors.wingFlat}>
                <TextInput
                  id="wingFlat"
                  value={form.wingFlat}
                  onChange={handleChange('wingFlat')}
                  placeholder="e.g. B-204"
                />
              </Field>

              <Field label="Building Name" id="building" required error={errors.building}>
                <TextInput
                  id="building"
                  value={form.building}
                  onChange={handleChange('building')}
                  placeholder="e.g. Shanti Apartments"
                />
              </Field>

              <Field label="Street Name" id="street" required error={errors.street}>
                <TextInput
                  id="street"
                  value={form.street}
                  onChange={handleChange('street')}
                  placeholder="e.g. MG Road"
                />
              </Field>

              <Field label="Landmark (optional)" id="landmark" error={errors.landmark}>
                <TextInput
                  id="landmark"
                  value={form.landmark}
                  onChange={handleChange('landmark')}
                  placeholder="e.g. Near State Bank ATM"
                />
              </Field>

              <Field label="Locality" id="locality" required error={errors.locality}>
                <TextInput
                  id="locality"
                  value={form.locality}
                  onChange={handleChange('locality')}
                  placeholder="e.g. Andheri West"
                />
              </Field>

              <Field label="PINCODE" id="pincode" required error={errors.pincode}>
                <TextInput
                  id="pincode"
                  value={form.pincode}
                  onChange={handleChange('pincode')}
                  placeholder="6-digit PINCODE"
                  inputMode="numeric"
                  maxLength={6}
                />
              </Field>
            </div>
          </div>

          {serverError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              {serverError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className={`w-full py-4 rounded-2xl font-bold text-white text-base transition
              ${submitting
                ? 'bg-red-300 cursor-not-allowed'
                : 'bg-jts-red hover:bg-jts-crimson active:bg-red-900 shadow-md'
              }`}
          >
            {submitting ? 'Placing Order…' : '🛍️ Place Order'}
          </button>
        </form>
      </main>
    </div>
  );
}
