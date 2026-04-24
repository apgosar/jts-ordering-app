import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FREE_DELIVERY_THRESHOLD, useCart } from '../App';
import { getMenu } from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import JtsLogo from './JtsLogo';

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
            : 'bg-red-100 text-jts-red hover:bg-red-200 active:bg-red-300'
          }`}
        aria-label="Decrease quantity"
      >
        −
      </button>
      <span className={`w-6 text-center font-semibold text-sm ${quantity > 0 ? 'text-jts-red' : 'text-gray-400'}`}>
        {quantity}
      </span>
      <button
        onClick={onIncrement}
        className="w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold bg-jts-red text-white hover:bg-jts-crimson active:bg-red-900 transition-colors"
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}

// ─── Menu Item Card ───────────────────────────────────────────────────────────
function MenuItem({ item, quantity, onIncrement, onDecrement }) {
  return (
    <div className={`flex items-start justify-between p-4 rounded-xl transition-colors
      ${quantity > 0 ? 'bg-jts-cream border border-red-200' : 'bg-white border border-gray-100'}`}>
      <div className="flex-1 min-w-0 pr-3">
        <div className="flex items-center gap-2">
          {/* Jain veg (green) indicator */}
          <span className="flex-shrink-0 w-4 h-4 border-2 border-green-600 rounded-sm flex items-center justify-center">
            <span className="w-2 h-2 rounded-full bg-green-600 block" />
          </span>
          <h3 className="font-semibold text-gray-800 text-sm leading-tight">{item.name}</h3>
        </div>
        {item.description && (
          <p className="text-xs text-gray-500 mt-1 ml-6 leading-snug">{item.description}</p>
        )}
        <p className="text-sm font-bold text-jts-red mt-2 ml-6">₹{item.price}/-</p>
      </div>
      <QuantityStepper quantity={quantity} onIncrement={onIncrement} onDecrement={onDecrement} />
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ name, packageInfo, count }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-3">
        {/* Red badge with cursive font – matches the poster */}
        <div className="bg-jts-red rounded-lg px-4 py-1 shadow-sm">
          <span
            className="text-white font-bold text-xl"
            style={{ fontFamily: "'Dancing Script', cursive" }}
          >
            {name}
          </span>
        </div>
        {packageInfo && (
          <span
            className="text-xs font-bold text-jts-navy uppercase tracking-wide"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            {packageInfo}
          </span>
        )}
      </div>
      <span className="text-xs bg-red-50 text-jts-red px-2 py-0.5 rounded-full font-medium border border-red-100">
        {count} {count === 1 ? 'item' : 'items'}
      </span>
    </div>
  );
}

// ─── Floating Cart Bar ────────────────────────────────────────────────────────
function CartBar({
  cartCount,
  cartTotal,
  qualifiesForFreeDelivery,
  itemsToFreeDelivery,
  showFreeDeliveryCelebration,
  onViewOrder,
}) {
  if (cartCount === 0) return null;

  const freeDeliveryMessage = qualifiesForFreeDelivery
    ? 'YAY! You have qualified for free delivery!'
    : `Add ${itemsToFreeDelivery} more ${itemsToFreeDelivery === 1 ? 'item' : 'items'} for free delivery`;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-2 bg-gradient-to-t from-jts-cream via-jts-cream/95 to-transparent">
      <div className="max-w-md mx-auto flex flex-col gap-2">
        <div
          className={`rounded-2xl border px-4 py-2.5 shadow-md backdrop-blur-sm ${
            qualifiesForFreeDelivery
              ? `border-green-200 bg-green-50 ${showFreeDeliveryCelebration ? 'free-delivery-burst' : ''}`
              : 'border-amber-200 bg-amber-50'
          }`}
        >
          {qualifiesForFreeDelivery && <div className="free-delivery-spark free-delivery-spark-left" aria-hidden="true" />}
          {qualifiesForFreeDelivery && <div className="free-delivery-spark free-delivery-spark-right" aria-hidden="true" />}
          <p className={`text-xs font-bold text-center ${qualifiesForFreeDelivery ? 'text-green-700' : 'text-amber-800'}`}>
            {freeDeliveryMessage}
          </p>
        </div>
        <button
          onClick={onViewOrder}
          className="w-full flex items-center justify-between bg-jts-red hover:bg-jts-crimson active:bg-red-900 text-white rounded-2xl px-5 py-4 shadow-lg transition-colors"
          style={{ display: 'flex' }}
        >
          <span className="bg-red-700 rounded-lg px-2 py-0.5 text-sm font-bold">
            {cartCount} {cartCount === 1 ? 'item' : 'items'}
          </span>
          <span className="font-bold text-base">View Order</span>
          <span className="font-bold text-base">₹{cartTotal}</span>
        </button>
      </div>
    </div>
  );
}

// ─── MenuPage ─────────────────────────────────────────────────────────────────
export default function MenuPage() {
  const navigate = useNavigate();
  const {
    cart,
    updateQuantity,
    registerItem,
    cartCount,
    cartTotal,
    qualifiesForFreeDelivery,
    itemsToFreeDelivery,
    menu,
    setMenu,
  } = useCart();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFreeDeliveryCelebration, setShowFreeDeliveryCelebration] = useState(false);
  const previousCartCount = useRef(cartCount);

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

  useEffect(() => {
    if (previousCartCount.current < FREE_DELIVERY_THRESHOLD && cartCount >= FREE_DELIVERY_THRESHOLD) {
      setShowFreeDeliveryCelebration(true);
      const timeoutId = window.setTimeout(() => setShowFreeDeliveryCelebration(false), 2600);
      previousCartCount.current = cartCount;
      return () => window.clearTimeout(timeoutId);
    }

    previousCartCount.current = cartCount;
    if (cartCount < FREE_DELIVERY_THRESHOLD) {
      setShowFreeDeliveryCelebration(false);
    }
  }, [cartCount]);

  const getQty = (section, itemName) =>
    cart[`${section}::${itemName}`]?.quantity || 0;

  return (
    <div className="min-h-screen bg-jts-lcream" style={{ paddingBottom: cartCount > 0 ? '160px' : '24px' }}>

      {/* ── Sticky Header ── */}
      <header className="sticky top-0 z-40 bg-white shadow-sm">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <JtsLogo className="w-12 h-12 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            {/* Brand name – matches poster typography */}
            <div className="flex items-baseline gap-0.5 leading-none">
              <span
                className="text-jts-red font-bold text-2xl"
                style={{ fontFamily: "'Oswald', Impact, sans-serif" }}
              >
                J
              </span>
              <span
                className="text-gray-900 font-bold text-lg"
                style={{ fontFamily: "'Oswald', Impact, sans-serif" }}
              >
                AIN TIFFIN
              </span>
            </div>
            <div
              className="text-gray-800 font-semibold text-sm tracking-widest"
              style={{ fontFamily: "'Oswald', Impact, sans-serif" }}
            >
              SERVICE
            </div>
            <div className="text-xs text-jts-navy font-semibold tracking-wide">
              BY KEYUR SHAH
            </div>
          </div>
        </div>
      </header>

      {/* ── Hero tagline banner ── */}
      <div className="bg-jts-navy">
        <p className="max-w-md mx-auto text-center text-white text-xs font-semibold py-2 px-4 tracking-wide uppercase">
          We make sure you eat healthy and stay healthy
        </p>
      </div>

      {/* ── Delivery info strip ── */}
      <div className="bg-jts-gold">
        <p className="max-w-md mx-auto text-center text-gray-900 text-xs font-medium py-1.5 px-4">
          🛵 Free delivery on orders above 5 packets · ₹30 charge for below 5 packets
        </p>
      </div>

      {/* ── Content ── */}
      <main className="max-w-md mx-auto px-4 py-5">
        {loading && <LoadingSpinner message="Loading menu…" />}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-jts-red">
            {error}
          </div>
        )}

        {!loading && !error && menu.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <p className="text-4xl mb-3">🍱</p>
            <p className="font-medium">No menu items available today.</p>
          </div>
        )}

        {!loading && !error && menu.map(({ section, packageInfo, items }) => (
          <section key={section} className="mb-7">
            <SectionHeader name={section} packageInfo={packageInfo} count={items.length} />
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

        {/* ── Contact footer ── */}
        {!loading && !error && menu.length > 0 && (
          <div className="mt-4 bg-jts-navy rounded-2xl p-4 text-center">
            <p className="text-white font-bold text-base" style={{ fontFamily: "'Oswald', sans-serif" }}>
              Keyur Shah
            </p>
            <a
              href="tel:+918779084488"
              className="text-jts-gold font-semibold text-lg tracking-wide hover:underline"
            >
              📞 87790 84488
            </a>
            <p className="text-white text-xs mt-1 opacity-75">Only in Borivali · Free delivery on 5+ packets</p>
          </div>
        )}
      </main>

      {/* Floating cart bar */}
      <CartBar
        cartCount={cartCount}
        cartTotal={cartTotal}
        qualifiesForFreeDelivery={qualifiesForFreeDelivery}
        itemsToFreeDelivery={itemsToFreeDelivery}
        showFreeDeliveryCelebration={showFreeDeliveryCelebration}
        onViewOrder={() => navigate('/checkout')}
      />
    </div>
  );
}

