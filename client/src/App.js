import React, { createContext, useContext, useState } from 'react';
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

// ─── App ──────────────────────────────────────────────────────────────────────
function App() {
  // cart: { "Section::ItemName": { name, section, description, price, quantity } }
  const [cart, setCart] = useState({});
  const [menu, setMenu] = useState([]);
  const [lastOrder, setLastOrder] = useState(null);

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
      if (newQty <= 0) {
        const { [key]: _removed, ...rest } = prev;
        return rest;
      }
      const existing = prev[key];
      const menuItem = findMenuItem(section, itemName);
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

  const cartItems = Object.values(cart).filter(i => i.quantity > 0);
  const cartCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);
  const cartTotal = cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const qualifiesForFreeDelivery = cartCount >= FREE_DELIVERY_THRESHOLD;
  const deliveryCharge = cartCount === 0 || qualifiesForFreeDelivery ? 0 : DELIVERY_CHARGE;
  const itemsToFreeDelivery = Math.max(0, FREE_DELIVERY_THRESHOLD - cartCount);
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
        menu,
        setMenu,
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
