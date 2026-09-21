import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export const CartModal = () => {
  const navigate = useNavigate();
  const {
    isCartOpen,
    closeCart,
    cart,
    cartSummary,
    updateCartQty,
    removeFromCart,
    clearCart,
    checkoutOrder,
    location,
  } = useApp();

  if (!isCartOpen) return null;

  const items = cartSummary?.items?.length ? cartSummary.items : cart;
  const subtotal = cartSummary?.subtotal ?? items.reduce((sum, i) => sum + (i.price || 0) * (i.qty || 1), 0);
  const deliveryFee = cartSummary?.deliveryFee ?? (subtotal >= 100 ? 0 : 30);
  const discount = cartSummary?.discount ?? 0;
  const grandTotal = cartSummary?.total ?? Math.max(0, subtotal + deliveryFee - discount);
  const estimatedDeliveryText = cartSummary?.estimatedDeliveryText || 'Today, 30–45 mins';
  const amountToFreeDelivery = cartSummary?.amountToFreeDelivery ?? Math.max(0, 100 - subtotal);

  const handleCheckout = async () => {
    try {
      const order = await checkoutOrder();
      closeCart();
      if (order) {
        navigate('/track-order');
      }
    } catch (err) {
      alert(err.message || 'Could not place order');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-end sm:items-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-surface-container-lowest rounded-t-3xl sm:rounded-3xl shadow-2xl border-t sm:border border-outline-variant/20 max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-outline-variant/15 flex items-center justify-between bg-surface-container-low/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[20px]">shopping_bag</span>
            </div>
            <div>
              <h3 className="font-headline-sm text-sm font-bold text-primary">Your PharmaCare Cart</h3>
              <span className="text-[11px] text-on-surface-variant font-medium">
                {items.length} {items.length === 1 ? 'item' : 'items'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button
                onClick={clearCart}
                className="text-[11px] text-on-surface-variant hover:text-error font-semibold px-2 py-1 rounded"
              >
                Clear
              </button>
            )}
            <button
              onClick={closeCart}
              className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        {/* Free Delivery Banner Progress */}
        {items.length > 0 && (
          <div className="px-4 py-2.5 bg-gradient-to-r from-secondary-container/40 to-primary-container/30 border-b border-outline-variant/10 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-[18px]">local_shipping</span>
              <span className="font-semibold text-primary">
                {deliveryFee === 0
                  ? '🎉 Free 30-min express delivery unlocked!'
                  : `Add ₹${amountToFreeDelivery} more for FREE express delivery`}
              </span>
            </div>
          </div>
        )}

        {/* Estimated Delivery Time Header */}
        {items.length > 0 && (
          <div className="px-4 py-2 bg-surface-container-low/30 flex items-center justify-between text-xs border-b border-outline-variant/10">
            <div className="flex items-center gap-1.5 text-on-surface-variant">
              <span className="material-symbols-outlined text-primary text-[16px]">schedule</span>
              <span>Estimated Delivery:</span>
            </div>
            <span className="font-bold text-primary">{estimatedDeliveryText}</span>
          </div>
        )}

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 no-scrollbar">
          {items.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface-variant">
                <span className="material-symbols-outlined text-[32px]">remove_shopping_cart</span>
              </div>
              <div>
                <h4 className="font-headline-sm text-sm font-bold text-primary">Your cart is empty</h4>
                <p className="text-xs text-on-surface-variant mt-1">
                  Search medicines or ask JARVIS to add products to your cart.
                </p>
              </div>
              <button
                onClick={() => {
                  closeCart();
                  navigate('/medicines');
                }}
                className="mt-2 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-sm hover:bg-primary/90 transition-all"
              >
                Browse Medicines
              </button>
            </div>
          ) : (
            items.map((item) => {
              const itemId = item._id || item.id || item.productId;
              const unitPrice = Number(item.price || 0);
              const itemTotal = unitPrice * (item.qty || 1);

              return (
                <div
                  key={itemId}
                  className="p-3 rounded-2xl bg-surface-container-low/40 border border-outline-variant/15 flex items-center justify-between gap-3 shadow-sm"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {item.image && (
                      <img
                        src={item.image}
                        alt={item.name}
                        loading="lazy"
                        className="w-12 h-12 rounded-xl object-cover bg-surface-container-lowest shrink-0 border border-outline-variant/10"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    )}
                    <div className="flex flex-col min-w-0">
                      <h4 className="font-headline-sm text-xs font-bold text-primary truncate">
                        {item.name}
                      </h4>
                      <span className="text-[11px] text-on-surface-variant">
                        ₹{unitPrice} each
                      </span>
                      <span className="text-xs font-bold text-secondary mt-0.5">
                        ₹{unitPrice} × {item.qty} = ₹{itemTotal}
                      </span>
                    </div>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => updateCartQty(itemId, (item.qty || 1) - 1)}
                      className="w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors"
                      title="Decrease quantity"
                    >
                      <span className="material-symbols-outlined text-[16px]">remove</span>
                    </button>
                    <span className="w-6 text-center font-bold text-xs text-primary">
                      {item.qty || 1}
                    </span>
                    <button
                      onClick={() => updateCartQty(itemId, (item.qty || 1) + 1)}
                      className="w-7 h-7 rounded-lg bg-primary text-on-primary flex items-center justify-center hover:bg-primary/90 transition-colors"
                      title="Increase quantity"
                    >
                      <span className="material-symbols-outlined text-[16px]">add</span>
                    </button>
                    <button
                      onClick={() => removeFromCart(itemId)}
                      className="w-7 h-7 rounded-lg text-on-surface-variant hover:text-error flex items-center justify-center ml-1 transition-colors"
                      title="Remove item"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bill Breakdown & Checkout Footer */}
        {items.length > 0 && (
          <div className="p-4 bg-surface-container-low/50 border-t border-outline-variant/20 flex flex-col gap-3">
            {/* Delivery address */}
            <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-primary text-[14px]">location_on</span>
                Deliver to:
              </span>
              <span className="font-semibold text-on-surface truncate max-w-[200px]">{location}</span>
            </div>

            {/* Price breakdown table */}
            <div className="flex flex-col gap-1.5 text-xs">
              <div className="flex justify-between items-center text-on-surface-variant">
                <span>Item Subtotal</span>
                <span className="font-semibold text-on-surface">₹{subtotal}</span>
              </div>
              <div className="flex justify-between items-center text-on-surface-variant">
                <span>Delivery Fee (Express 30-Min)</span>
                <span className={`font-semibold ${deliveryFee === 0 ? 'text-emerald-600' : 'text-on-surface'}`}>
                  {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}
                </span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between items-center text-emerald-600 font-semibold">
                  <span>Discount</span>
                  <span>-₹{discount}</span>
                </div>
              )}
              <div className="border-t border-outline-variant/20 pt-2 flex justify-between items-center font-bold text-sm text-primary">
                <span>Grand Total</span>
                <span className="text-base text-secondary font-extrabold">₹{grandTotal}</span>
              </div>
            </div>

            {/* CTA Button */}
            <button
              onClick={handleCheckout}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-primary to-primary/90 text-on-primary font-bold text-sm shadow-md hover:shadow-lg transition-all active:scale-[0.99] flex items-center justify-center gap-2"
            >
              <span>Confirm & Place 30-Min Order</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CartModal;
