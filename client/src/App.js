import React, { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MenuPage from './components/MenuPage';
import CheckoutPage from './components/CheckoutPage';
import ConfirmationPage from './components/ConfirmationPage';
import AdminPage from './components/AdminPage';

// ─── Cart Context ─────────────────────────────────────────────────────────────
export const CartContext = createContext(null);

export const FREE_DELIVERY_THRESHOLD = 5;
export const DELIVERY_CHARGE = 30;

export function useCart() {
  return useContext(CartContext);
}

const CART_STORAGE_KEY = 'jts:cart';
const LAST_ORDER_STORAGE_KEY = 'jts:last-order';

function getStoredJson(storageKey, fallback) {
  try {
    const rawValue = window.localStorage.getItem(storageKey);
    return rawValue ? JSON.parse(rawValue) : fallback;
  } catch {
    return fallback;
  }
}

function getMaxComboCounter(cart) {
  return Object.keys(cart || {}).reduce((maxCounter, key) => {
    const match = key.match(/::(\d+)$/);
    if (!match) return maxCounter;
    return Math.max(maxCounter, parseInt(match[1], 10) || 0);
  }, 0);
}

// Module-level counter ensures unique cart keys for each combo addition across re-renders
let comboCounter = 0;

// ─── App ──────────────────────────────────────────────────────────────────────
function App() {
  // cart: { "Section::ItemName": { name, section, description, price, quantity } }
  const [cart, setCart] = useState(() => {
    const storedCart = getStoredJson(CART_STORAGE_KEY, {});
    comboCounter = getMaxComboCounter(storedCart);
    return storedCart;
  });
  const [menu, setMenu] = useState([]);
  const [combos, setCombos] = useState([]);
  const [lastOrder, setLastOrder] = useState(() => getStoredJson(LAST_ORDER_STORAGE_KEY, null));

  useEffect(() => {
    try {
      const activeCartItems = Object.fromEntries(
        Object.entries(cart).filter(([, item]) => (item?.quantity || 0) > 0)
      );
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(activeCartItems));
    } catch {
      // Ignore storage failures; cart still works in-memory.
    }
  }, [cart]);

  useEffect(() => {
    try {
      if (lastOrder) {
        window.localStorage.setItem(LAST_ORDER_STORAGE_KEY, JSON.stringify(lastOrder));
      } else {
        window.localStorage.removeItem(LAST_ORDER_STORAGE_KEY);
      }
    } catch {
      // Ignore storage failures; order flow still works in-memory.
    }
  }, [lastOrder]);

  const findMenuItem = (section, itemName) => {
    const sectionData = menu.find(s => s.section === section);
    if (!sectionData) return null;
    return sectionData.items.find(item => item.name === itemName) || null;
  };

  /** Increment or decrement item quantity; removes item when qty reaches 0 */
  const updateQuantity = (section, itemName, delta) => {
    setCart(prev => {
      const key = `${section}::${itemName}`;
      const current = prev[key]?.quantity || 0;
      const newQty = current + delta;
      const menuItem = findMenuItem(section, itemName);

      if (delta > 0 && menuItem?.outOfStock) {
        return prev;
      }

      if (newQty <= 0) {
        const { [key]: _removed, ...rest } = prev;
        return rest;
      }
      const existing = prev[key];
      const baseItem = existing || (menuItem ? { ...menuItem, section } : { name: itemName, section, price: 0 });

      return {
        ...prev,
        [key]: {
          ...baseItem,
          quantity: newQty,
        },
      };
    });
  };

  /** Register an item in the cart (used when menu data is first available) */
  const registerItem = (section, item) => {
    setCart(prev => {
      const key = `${section}::${item.name}`;
      if (prev[key]) return prev; // already registered
      return {
        ...prev,
        [key]: { ...item, section, quantity: 0 },
      };
    });
  };

  /** Remove all items from cart */
  const clearCart = () => setCart({});

  const clearLastOrder = () => setLastOrder(null);

  /** Remove a single item by its exact cart key (used for combo entries) */
  const removeFromCart = (cartKey) => {
    setCart((prev) => {
      const { [cartKey]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const addComboToCart = (combo, selections) => {
    const comboSection = 'Combo Offers';
    const comboName = combo?.title || 'Combo Offer';
    comboCounter += 1;
    const cartKey = `${comboSection}::${comboName}::${comboCounter}`;

    setCart((prev) => ({
      ...prev,
      [cartKey]: {
        cartKey,
        name: comboName,
        section: comboSection,
        description: `${selections.length} selections configured`,
        price: Math.max(0, Number(combo?.fixedPrice) || 0),
        quantity: 1,
        isCombo: true,
        comboId: combo?.comboId || '',
        comboSelections: selections,
      },
    }));
  };

  const cartItems = Object.values(cart).filter(i => i.quantity > 0);
  const cartCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);
  const cartTotal = cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const hasComboInCart = cartItems.some(item => item.isCombo);
  const qualifiesForFreeDelivery = hasComboInCart || cartCount >= FREE_DELIVERY_THRESHOLD;
  const deliveryCharge = cartCount === 0 || qualifiesForFreeDelivery ? 0 : DELIVERY_CHARGE;
  const itemsToFreeDelivery = qualifiesForFreeDelivery ? 0 : Math.max(0, FREE_DELIVERY_THRESHOLD - cartCount);
  const orderTotal = cartTotal + deliveryCharge;

  return (
    <CartContext.Provider
      value={{
        cart,
        cartItems,
        cartTotal,
        cartCount,
        deliveryCharge,
        orderTotal,
        qualifiesForFreeDelivery,
        itemsToFreeDelivery,
        updateQuantity,
        registerItem,
        clearCart,
        clearLastOrder,
        removeFromCart,
        menu,
        setMenu,
        combos,
        setCombos,
        addComboToCart,
        lastOrder,
        setLastOrder,
      }}
    >
      <Router>
        <Routes>
          <Route path="/" element={<MenuPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/confirmation" element={<ConfirmationPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </Router>
    </CartContext.Provider>
  );
}

export default App;
