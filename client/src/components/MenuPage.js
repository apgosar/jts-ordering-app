import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../App';
import { getMenu } from '../services/api';
import LoadingSpinner from './LoadingSpinner';

// ─── Quantity Stepper ─────────────────────────────────────────────────────────
function QuantityStepper({ quantity, onIncrement, onDecrement }) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onDecrement}
        disabled={quantity === 0}
        className={`w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold transition-colors
          ${quantity === 0
            ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
            : 'bg-orange-100 text-orange-600 hover:bg-orange-200 active:bg-orange-300'
          }`}
        aria-label="Decrease quantity"
      >
        −
      </button>
      <span className={`w-6 text-center font-semibold text-sm ${quantity > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
        {quantity}
      </span>
      <button
        onClick={onIncrement}
        className="w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold bg-orange-500 text-white hover:bg-orange-600 active:bg-orange-700 transition-colors"
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}

// ─── Menu Item Card ───────────────────────────────────────────────────────────
function MenuItem({ item, section, quantity, onIncrement, onDecrement }) {
  return (
    <div className={`flex items-start justify-between p-4 rounded-xl transition-colors
      ${quantity > 0 ? 'bg-orange-50 border border-orange-200' : 'bg-white border border-gray-100'}`}>
      <div className="flex-1 min-w-0 pr-3">
        <div className="flex items-center gap-2">
          {/* Jain green dot indicator */}
          <span className="flex-shrink-0 w-4 h-4 border-2 border-green-600 rounded-sm flex items-center justify-center">
            <span className="w-2 h-2 rounded-full bg-green-600 block" />
          </span>
          <h3 className="font-semibold text-gray-800 text-sm leading-tight">{item.name}</h3>
        </div>
        {item.description && (
          <p className="text-xs text-gray-500 mt-1 ml-6 leading-snug">{item.description}</p>
        )}
        <p className="text-sm font-bold text-orange-600 mt-2 ml-6">₹{item.price}</p>
      </div>
      <QuantityStepper quantity={quantity} onIncrement={onIncrement} onDecrement={onDecrement} />
    </div>
  );
}

// ─── Floating Cart Bar ────────────────────────────────────────────────────────
function CartBar({ cartCount, cartTotal, onViewOrder }) {
  if (cartCount === 0) return null;
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-2 bg-gradient-to-t from-gray-100 to-transparent">
      <button
        onClick={onViewOrder}
        className="w-full max-w-md mx-auto flex items-center justify-between bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white rounded-2xl px-5 py-4 shadow-lg transition-colors"
        style={{ display: 'flex' }}
      >
        <span className="bg-orange-400 rounded-lg px-2 py-0.5 text-sm font-bold">
          {cartCount} {cartCount === 1 ? 'item' : 'items'}
        </span>
        <span className="font-bold text-base">View Order</span>
        <span className="font-bold text-base">₹{cartTotal}</span>
      </button>
    </div>
  );
}

// ─── MenuPage ─────────────────────────────────────────────────────────────────
export default function MenuPage() {
  const navigate = useNavigate();
  const { cart, updateQuantity, registerItem, cartCount, cartTotal, menu, setMenu } = useCart();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (menu.length > 0) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    getMenu()
      .then(res => {
        if (cancelled) return;
        const fetchedMenu = res.data.menu || [];
        setMenu(fetchedMenu);
        fetchedMenu.forEach(({ section, items }) => {
          items.forEach(item => registerItem(section, item));
        });
      })
      .catch(err => {
        if (cancelled) return;
        console.error(err);
        setError('Failed to load the menu. Please refresh and try again.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [menu.length, registerItem, setMenu]);

  const getQty = (section, itemName) =>
    cart[`${section}::${itemName}`]?.quantity || 0;

  return (
    <div className="min-h-screen bg-gray-50" style={{ paddingBottom: cartCount > 0 ? '100px' : '24px' }}>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white shadow-sm">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
            JTS
          </div>
          <div>
            <h1 className="font-bold text-gray-900 text-base leading-tight">Jain Tiffin Service</h1>
            <p className="text-xs text-gray-500">Fresh • Wholesome • Jain</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-md mx-auto px-4 py-4">
        {loading && <LoadingSpinner message="Loading today's menu…" />}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && menu.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <p className="text-4xl mb-3">🍱</p>
            <p className="font-medium">No menu items available today.</p>
          </div>
        )}

        {!loading && !error && menu.map(({ section, items }) => (
          <section key={section} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="font-bold text-gray-800 text-base">{section}</h2>
              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                {items.length} {items.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {items.map(item => (
                <MenuItem
                  key={item.name}
                  item={item}
                  section={section}
                  quantity={getQty(section, item.name)}
                  onIncrement={() => updateQuantity(section, item.name, 1)}
                  onDecrement={() => updateQuantity(section, item.name, -1)}
                />
              ))}
            </div>
          </section>
        ))}
      </main>

      {/* Floating cart bar */}
      <CartBar
        cartCount={cartCount}
        cartTotal={cartTotal}
        onViewOrder={() => navigate('/checkout')}
      />
    </div>
  );
}
