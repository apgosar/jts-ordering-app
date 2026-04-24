import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../App';

export default function ConfirmationPage() {
  const navigate = useNavigate();
  const { lastOrder } = useCart();

  if (!lastOrder) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-5xl">🍱</p>
        <p className="text-gray-600 font-medium text-center">No order found. Start a new order from the menu!</p>
        <button
          onClick={() => navigate('/')}
          className="mt-2 px-6 py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition"
        >
          Browse Menu
        </button>
      </div>
    );
  }

  const { orderId, items, total, customer } = lastOrder;

  return (
    <div className="min-h-screen bg-orange-50 flex flex-col">
      <main className="max-w-md mx-auto w-full px-4 py-10 flex flex-col gap-6">
        {/* Success banner */}
        <div className="bg-white rounded-3xl shadow-md border border-orange-100 p-6 flex flex-col items-center text-center gap-3">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-4xl">
            ✅
          </div>
          <h1 className="font-extrabold text-gray-900 text-xl">Order Placed Successfully!</h1>
          <p className="text-gray-500 text-sm">
            Thank you, <span className="font-semibold text-gray-700">{customer.name}</span>! Your order has been received
            and will be delivered soon. 🛵
          </p>
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-5 py-3 w-full">
            <p className="text-xs text-orange-600 font-medium uppercase tracking-wide">Order ID</p>
            <p className="text-xl font-black text-orange-600 tracking-widest">{orderId}</p>
          </div>
        </div>

        {/* Order summary */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <h2 className="font-bold text-gray-800 mb-3">🧾 Order Summary</h2>
          <div className="flex flex-col gap-2 text-sm">
            {items.map(item => (
              <div key={`${item.section}::${item.name}`} className="flex justify-between">
                <span className="text-gray-700">
                  {item.name}
                  <span className="text-gray-400 ml-1">×{item.quantity}</span>
                </span>
                <span className="font-semibold text-gray-800">
                  ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                </span>
              </div>
            ))}
            <div className="border-t border-gray-100 pt-2 flex justify-between font-bold mt-1">
              <span>Total</span>
              <span className="text-orange-600">₹{total.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Delivery address */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <h2 className="font-bold text-gray-800 mb-3">📍 Delivery Address</h2>
          <div className="text-sm text-gray-600 leading-relaxed">
            <p className="font-semibold text-gray-800">{customer.name}</p>
            <p>{customer.phone}</p>
            <p className="mt-1">
              {customer.wingFlat}, {customer.building}
              <br />
              {customer.street}
              {customer.landmark ? `, ${customer.landmark}` : ''}
              <br />
              {customer.locality} – {customer.pincode}
            </p>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={() => navigate('/')}
          className="w-full py-4 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-bold rounded-2xl text-base transition shadow-md"
        >
          🍱 Start New Order
        </button>
      </main>
    </div>
  );
}
