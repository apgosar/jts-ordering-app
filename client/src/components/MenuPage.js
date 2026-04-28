import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FREE_DELIVERY_THRESHOLD, useCart } from '../App';
import { getMenu } from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import JtsLogo from './JtsLogo';

function getSectionId(sectionName) {
  return `menu-section-${sectionName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

const COMBO_SECTION_NAME = 'Combo Offers';

// ─── Quantity Stepper ─────────────────────────────────────────────────────────
function QuantityStepper({ quantity, onIncrement, onDecrement, disableIncrement = false }) {
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
        disabled={disableIncrement}
        className={`w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold transition-colors ${
          disableIncrement
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
            : 'bg-jts-red text-white hover:bg-jts-crimson active:bg-red-900'
        }`}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}

// ─── Menu Item Card ───────────────────────────────────────────────────────────
function MenuItem({ item, quantity, onIncrement, onDecrement }) {
  const isOutOfStock = !!item.outOfStock;

  return (
    <div className={`flex items-start justify-between p-4 rounded-xl transition-colors
      ${isOutOfStock ? 'bg-gray-100 border border-gray-200 opacity-80' : quantity > 0 ? 'bg-jts-cream border border-red-200' : 'bg-white border border-gray-100'}`}>
      <div className="flex-1 min-w-0 pr-3">
        <div className="flex items-center gap-2">
          {/* Jain veg (green) indicator */}
          <span className="flex-shrink-0 w-4 h-4 border-2 border-green-600 rounded-sm flex items-center justify-center">
            <span className="w-2 h-2 rounded-full bg-green-600 block" />
          </span>
          <h3 className={`font-semibold text-sm leading-tight ${isOutOfStock ? 'text-gray-500' : 'text-gray-800'}`}>{item.name}</h3>
        </div>
        {item.description && (
          <p className={`text-xs mt-1 ml-6 leading-snug ${isOutOfStock ? 'text-gray-400' : 'text-gray-500'}`}>{item.description}</p>
        )}
        <p className={`text-sm font-bold mt-2 ml-6 ${isOutOfStock ? 'text-gray-500' : 'text-jts-red'}`}>₹{item.price}/-</p>
        {isOutOfStock && <p className="text-xs font-bold text-red-600 mt-1 ml-6">Out of Stock</p>}
      </div>
      <QuantityStepper
        quantity={quantity}
        onIncrement={onIncrement}
        onDecrement={onDecrement}
        disableIncrement={isOutOfStock}
      />
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

function FloatingSectionMenu({ sections, isOpen, onToggle, onSelect, hasCart }) {
  if (sections.length === 0) return null;

  const bottomOffset = hasCart ? '176px' : '20px';
  const rightOffset = 'max(1rem, calc(50% - 14rem))';

  return (
    <div className="fixed z-40 flex flex-col items-end gap-3" style={{ bottom: bottomOffset, right: rightOffset }}>
      {isOpen && (
        <div className="w-52 overflow-hidden rounded-2xl border border-red-100 bg-white shadow-xl">
          <div className="border-b border-red-50 px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-jts-red">
            Browse Menu
          </div>
          <div className="flex max-h-64 flex-col overflow-y-auto py-2">
            {sections.map(section => (
              <button
                key={section}
                type="button"
                onClick={() => onSelect(section)}
                className="px-4 py-3 text-left text-sm font-semibold text-gray-700 transition hover:bg-red-50 hover:text-jts-red"
              >
                {section}
              </button>
            ))}
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={onToggle}
        className="rounded-full bg-jts-red px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-jts-crimson active:bg-red-900"
        aria-expanded={isOpen}
        aria-label="Open menu sections"
      >
        Menu
      </button>
    </div>
  );
}

function ComboOfferCard({ combo, cart, onAddCombo }) {
  const [selectedBySlot, setSelectedBySlot] = useState({});
  const requiredSlots = combo.slots.filter(slot => slot.slotType === 'required');
  const freeSlots = combo.slots.filter(slot => slot.slotType === 'free');
  const hasRequiredSelections = requiredSlots.every(slot => selectedBySlot[slot.slotId]);
  const hasFreeSelections = freeSlots.every(slot => selectedBySlot[slot.slotId]);
  const canAdd = combo.available && hasRequiredSelections && hasFreeSelections;
  const comboQty = Object.values(cart).reduce((count, item) => {
    if (!item?.isCombo) return count;

    const sameComboId = combo.comboId && item.comboId === combo.comboId;
    const sameComboTitle = item.section === COMBO_SECTION_NAME && item.name === combo.title;
    return sameComboId || sameComboTitle ? count + (item.quantity || 0) : count;
  }, 0);
  const seenLabels = new Set();

  const onSelectOption = (slotId, optionKey) => {
    setSelectedBySlot(prev => ({ ...prev, [slotId]: optionKey }));
  };

  const handleAdd = () => {
    const selections = combo.slots
      .filter(slot => selectedBySlot[slot.slotId])
      .map(slot => {
        const optionKey = selectedBySlot[slot.slotId];
        const selectedOption = slot.options.find(option => option.key === optionKey);
        if (!selectedOption) return null;
        return {
          slotId: slot.slotId,
          slotLabel: slot.label,
          slotType: slot.slotType,
          optionKey: selectedOption.key,
          optionName: selectedOption.name,
          optionSection: selectedOption.section,
        };
      })
      .filter(Boolean);

    onAddCombo(combo, selections);
  };

  return (
    <section className="mb-7 rounded-2xl border border-jts-gold/40 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-jts-red">Promo Combo</p>
          <h3 className="mt-1 text-base font-bold text-gray-900">{combo.title}</h3>
          <p className="mt-1 text-xs text-gray-600">Pick 1 item from each of 5 pairs, then 1 from free pair.</p>
        </div>
        <div className="rounded-xl bg-jts-cream px-3 py-1.5 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-jts-navy">Combo Price</p>
          <p className="text-lg font-extrabold text-jts-red">₹{combo.fixedPrice}</p>
        </div>
      </div>

      {!combo.available && (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          Combo unavailable. Please ensure each required and free pair has at least one in-stock option.
        </div>
      )}

      <div className="flex flex-col gap-3">
        {combo.slots.map((slot) => (
          <div key={slot.slotId} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
            {(() => {
              const slotLabelKey = `${slot.slotType}::${(slot.label || '').trim().toLowerCase()}`;
              const showLabel = slot.slotType !== 'free' && !seenLabels.has(slotLabelKey);
              if (slot.slotType !== 'free') {
                seenLabels.add(slotLabelKey);
              }

              return (
            <div className="mb-2 flex items-center gap-2">
              {slot.slotType === 'free' && (
                <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-700">
                  free 100gm
                </span>
              )}
              {showLabel && <p className="text-xs font-semibold text-gray-700">{slot.label}</p>}
            </div>
              );
            })()}
            <div className="flex flex-wrap gap-2">
              {slot.options.map((option, optionIndex) => {
                const selected = selectedBySlot[slot.slotId] === option.key;
                return (
                  <React.Fragment key={`${slot.slotId}-${option.key}`}>
                    <button
                      type="button"
                      onClick={() => onSelectOption(slot.slotId, option.key)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${selected ? 'border-jts-red bg-red-100 text-jts-red' : 'border-gray-200 bg-white text-gray-700 hover:border-red-300 hover:bg-red-50'}`}
                    >
                      {option.name}
                    </button>
                    {optionIndex < slot.options.length - 1 && (
                      <span className="self-center text-xs font-semibold text-gray-400">/</span>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-gray-600">Added in cart: <span className="font-bold text-jts-red">{comboQty}</span></p>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!canAdd}
          className={`rounded-xl px-4 py-2 text-sm font-bold text-white transition ${canAdd ? 'bg-jts-red hover:bg-jts-crimson active:bg-red-900' : 'cursor-not-allowed bg-gray-300'}`}
        >
          Add Combo
        </button>
      </div>
    </section>
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
    combos,
    setCombos,
    addComboToCart,
  } = useCart();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFreeDeliveryCelebration, setShowFreeDeliveryCelebration] = useState(false);
  const [isSectionMenuOpen, setIsSectionMenuOpen] = useState(false);
  const previousCartCount = useRef(cartCount);
  const hasComboInCart = Object.values(cart).some(item => item?.isCombo && (item?.quantity || 0) > 0);

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
        const fetchedCombos = res.data.combos || [];
        setMenu(fetchedMenu);
        setCombos(fetchedCombos);
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
  }, [menu.length, registerItem, setCombos, setMenu]);

  useEffect(() => {
    if (hasComboInCart) {
      setShowFreeDeliveryCelebration(false);
      previousCartCount.current = cartCount;
      return;
    }

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
  }, [cartCount, hasComboInCart]);

  const getQty = (section, itemName) =>
    cart[`${section}::${itemName}`]?.quantity || 0;

  const handleSectionSelect = (section) => {
    setIsSectionMenuOpen(false);
    document.getElementById(getSectionId(section))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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

        {!loading && !error && combos.length > 0 && (
          <div id={getSectionId(COMBO_SECTION_NAME)} className="mb-6 scroll-mt-24">
            {combos.map(combo => (
              <ComboOfferCard
                key={combo.comboId}
                combo={combo}
                cart={cart}
                onAddCombo={addComboToCart}
              />
            ))}
          </div>
        )}

        {!loading && !error && menu.map(({ section, packageInfo, items }) => (
          <section key={section} id={getSectionId(section)} className="mb-7 scroll-mt-24">
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
            <p className="text-white text-xs mt-1 opacity-75">Only in Borivali</p>
            <p className="text-jts-gold text-xs mt-2 font-medium">
              <span className="block">🛵 Free delivery on orders above 5 packets</span>
              <span className="block mt-0.5">₹30 charge for below 5 packets</span>
            </p>
          </div>
        )}
      </main>

      <FloatingSectionMenu
        sections={combos.length > 0 ? [COMBO_SECTION_NAME, ...menu.map(({ section }) => section)] : menu.map(({ section }) => section)}
        isOpen={isSectionMenuOpen}
        onToggle={() => setIsSectionMenuOpen(prev => !prev)}
        onSelect={handleSectionSelect}
        hasCart={cartCount > 0}
      />

      {/* Floating cart bar */}
      <CartBar
        cartCount={cartCount}
        cartTotal={cartTotal}
        qualifiesForFreeDelivery={qualifiesForFreeDelivery}
        itemsToFreeDelivery={itemsToFreeDelivery}
        showFreeDeliveryCelebration={showFreeDeliveryCelebration}
        onViewOrder={() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
          navigate('/checkout');
        }}
      />
    </div>
  );
}

