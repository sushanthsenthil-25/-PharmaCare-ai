from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any

def calculate_delivery_estimate() -> Dict[str, Any]:
    now = datetime.now()
    start_time = now + timedelta(minutes=25)
    end_time = now + timedelta(minutes=45)

    time_fmt_start = start_time.strftime("%I:%M %p").lstrip("0").lower()
    time_fmt_end = end_time.strftime("%I:%M %p").lstrip("0").lower()
    text = f"Today, {time_fmt_start} – {time_fmt_end}"

    return {
        "text": text,
        "estimatedDeliveryText": text,
        "estimatedDeliveryAt": end_time.isoformat(),
        "minMinutes": 25,
        "maxMinutes": 45,
    }

def calculate_cart_totals(raw_items: List[Dict[str, Any]], custom_discount: float = 0.0, discount_amount: float = 0.0) -> Dict[str, Any]:
    discount_val = discount_amount if discount_amount > 0 else custom_discount
    if not raw_items:
        eta = calculate_delivery_estimate()
        return {
            "items": [],
            "itemCount": 0,
            "subtotal": 0.0,
            "deliveryFee": 0.0,
            "discount": 0.0,
            "total": 0.0,
            "grandTotal": 0.0,
            "isFreeDelivery": False,
            "freeDeliveryThreshold": 100.0,
            "amountNeededForFreeDelivery": 100.0,
            "estimatedDeliveryText": eta["text"],
            "estimatedDeliveryAt": eta["estimatedDeliveryAt"],
        }

    formatted_items = []
    subtotal = 0.0
    total_qty = 0

    for it in raw_items:
        price = float(it.get("price", it.get("unit_price", 0)))
        qty = max(1, int(it.get("quantity", it.get("qty", 1))))
        item_subtotal = round(price * qty, 2)
        subtotal += item_subtotal
        total_qty += qty

        formatted_items.append({
            "productId": str(it.get("productId", it.get("id", it.get("_id", "")))),
            "name": it.get("name", "Medicine Item"),
            "price": price,
            "quantity": qty,
            "itemSubtotal": item_subtotal,
            "image": it.get("image", "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80"),
            "category": it.get("category", "Medicine"),
            "strength": it.get("strength", ""),
            "form": it.get("form", "Tablet"),
        })

    subtotal = round(subtotal, 2)
    # Delivery rule: Free if subtotal >= 100, else 30
    delivery_fee = 0.0 if subtotal >= 100.0 else 30.0
    discount = round(float(discount_val), 2)
    grand_total = max(0.0, round(subtotal + delivery_fee - discount, 2))

    is_free = subtotal >= 100.0
    amount_needed = max(0.0, round(100.0 - subtotal, 2)) if not is_free else 0.0

    eta = calculate_delivery_estimate()

    return {
        "items": formatted_items,
        "itemCount": total_qty,
        "subtotal": subtotal,
        "deliveryFee": delivery_fee,
        "discount": discount,
        "total": grand_total,
        "grandTotal": grand_total,
        "isFreeDelivery": is_free,
        "freeDeliveryThreshold": 100.0,
        "amountNeededForFreeDelivery": amount_needed,
        "estimatedDeliveryText": eta["text"],
        "estimatedDeliveryAt": eta["estimatedDeliveryAt"],
    }
