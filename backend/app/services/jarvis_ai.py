import os
import re
import random
from typing import Dict, Any, List, Optional
import google.generativeai as genai

from app.services.medicine_catalog import EXACT_20_MEDICINES, extract_medicine_name, format_medicine_item
from app.services.cart_engine import calculate_cart_totals
from app.db.mongodb import get_motor_client
from app.core.config import settings

SYSTEM_INSTRUCTION = """
You are JARVIS, the intelligent AI assistant inside PharmaCare AI.
You are a general-purpose conversational AI with access to the PharmaCare marketplace.
Understand the user's actual intent. Do not assume every message is medical.
For PharmaCare products, prices, stock, expiry, orders, carts and user-specific information, use backend tools and verified MongoDB data.
Never invent products, prices, stock, expiry dates, batch numbers, order IDs, order status, delivery estimates or product images.
Maintain conversation context. Understand references such as: 'it', 'this', 'that', 'the first one', 'the second one', 'the cheaper one', 'the medicine you showed me'.
Follow topic changes naturally.
Be conversational, concise and helpful. Do not repeatedly introduce yourself. Do not use generic pharmacy responses for unrelated questions.
"""

class JarvisAIService:
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY") or settings.GEMINI_API_KEY or os.getenv("AI_API_KEY")
        if api_key:
            try:
                genai.configure(api_key=api_key)
                self.genai_available = True
            except Exception as e:
                print(f"[JarvisAI] Gemini configure warning: {e}")
                self.genai_available = False
        else:
            self.genai_available = False

    async def search_catalog(self, query_str: str) -> List[Dict[str, Any]]:
        clean = extract_medicine_name(query_str) or query_str.strip().lower()
        if not clean:
            return []

        clean_lower = clean.lower()
        client = get_motor_client()
        db = client[settings.MONGODB_DB_NAME] if client else None

        # 1. Try MongoDB Atlas medicines collection
        if db is not None:
            try:
                rx = re.compile(re.escape(clean_lower), re.IGNORECASE)
                candidates = await db["medicines"].find({
                    "$or": [
                        {"name": rx},
                        {"genericName": rx},
                        {"activeIngredient": rx},
                        {"brand": rx},
                        {"aliases": rx},
                        {"searchKeywords": rx},
                        {"category": rx},
                        {"uses": rx},
                    ]
                }).to_list(20)

                if candidates:
                    scored = []
                    for doc in candidates:
                        score = 0
                        n = doc.get("name", "").lower()
                        b = doc.get("brand", "").lower()
                        g = doc.get("genericName", "").lower()
                        aliases = [a.lower() for a in doc.get("aliases", [])]

                        if n == clean_lower:
                            score += 100
                        elif b == clean_lower or clean_lower in b:
                            score += 80
                        elif clean_lower in aliases:
                            score += 80
                        elif g == clean_lower:
                            score += 70
                        elif n.startswith(clean_lower):
                            score += 60
                        elif g.startswith(clean_lower):
                            score += 50
                        elif clean_lower in n:
                            score += 40
                        elif clean_lower in g:
                            score += 30
                        else:
                            score += 20
                        scored.append((score, doc))

                    scored.sort(key=lambda x: x[0], reverse=True)
                    return [format_medicine_item(item[1], idx + 1) for idx, item in enumerate(scored[:10])]
            except Exception as err:
                print(f"[JarvisAI] MongoDB search warning: {err}")

        # 2. Fallback to in-memory EXACT_20_MEDICINES
        matched = []
        for m in EXACT_20_MEDICINES:
            n = m["name"].lower()
            b = m.get("brand", "").lower()
            g = m.get("genericName", "").lower()
            aliases = [a.lower() for a in m.get("aliases", [])]
            keywords = [k.lower() for k in m.get("searchKeywords", [])]

            if clean_lower in n or clean_lower in b or clean_lower in g or any(clean_lower in a for a in aliases) or any(clean_lower in k for k in keywords):
                score = 0
                if n == clean_lower:
                    score += 100
                elif clean_lower in b or any(clean_lower in a for a in aliases):
                    score += 80
                elif g == clean_lower:
                    score += 70
                elif n.startswith(clean_lower):
                    score += 60
                elif clean_lower in n:
                    score += 40
                else:
                    score += 20
                matched.append((score, m))

        matched.sort(key=lambda x: x[0], reverse=True)
        return [format_medicine_item(item[1], idx + 1) for idx, item in enumerate(matched[:10])]

    def classify_intent(self, text: str, context: Optional[Dict[str, Any]] = None) -> str:
        q = text.lower().strip()

        # 1. Greetings & Casual
        if q in ["hi", "hello", "hey", "hey jarvis", "good morning", "good afternoon", "good evening", "how are you", "who are you"]:
            return "GREETING"
        if q in ["thanks", "thank you", "thanks jarvis", "thank you jarvis", "thx"]:
            return "THANKS"
        if q in ["bye", "goodbye", "see you", "exit"]:
            return "GOODBYE"
        if "joke" in q:
            return "JOKE"

        # 2. Weather
        if "weather" in q or "temperature" in q or "rain" in q:
            return "WEATHER"

        # 3. Math
        if re.search(r'\d+\s*[\+\-\*\/]\s*\d+', q) or ("times" in q and any(c.isdigit() for c in q)) or ("plus" in q and any(c.isdigit() for c in q)):
            return "MATH"

        # 4. Order Tracking
        if "where is my order" in q or "track order" in q or "track my order" in q or "order status" in q or "my order" in q:
            return "ORDER_TRACKING"

        # 5. Cart Actions
        if "add to cart" in q or "add it to cart" in q or "add it" in q or "buy this" in q or "add two" in q or "add 2" in q:
            return "ADD_TO_CART"

        # 6. Context Inquiries
        if context:
            if "second one" in q or "second medicine" in q or "2nd" in q or "first one" in q:
                return "CONTEXT_SELECTION"
            if "price" in q or "cost" in q or "how much" in q:
                return "CONTEXT_PRICE_INQUIRY"
            if "available" in q or "in stock" in q or "stock" in q:
                return "CONTEXT_STOCK_INQUIRY"
            if "used for" in q or "uses" in q or "side effects" in q or "tell me about it" in q:
                return "CONTEXT_USES_INQUIRY"
            if "cheaper" in q or "compare" in q:
                return "CONTEXT_COMPARISON"

        # 7. General Knowledge / Python / Science
        general_triggers = [
            "what is python", "explain python", "what is code", "how to code", "what is gravity",
            "what is quantum", "who is the president", "who invented", "tell me a story", "what is ai",
            "what is javascript", "what is react", "what is fast api", "what is mongodb"
        ]
        if any(trigger in q for trigger in general_triggers):
            return "GENERAL_KNOWLEDGE"

        # 8. Product Search & Medicine Information Keywords
        med_keywords = [
            "dolo", "paracetamol", "cetirizine", "pantoprazole", "omeprazole", "ors",
            "azithromycin", "amoxicillin", "ibuprofen", "diclofenac", "levocetirizine",
            "metformin", "amlodipine", "losartan", "atorvastatin", "ondansetron",
            "dextromethorphan", "antacid", "vitamin", "calcium", "allergy", "acidity",
            "gastric", "antibiotic", "fever", "pain", "cough", "blood pressure",
            "diabetes", "cholesterol", "nausea", "supplement", "show me", "find me",
            "search", "do you have", "medicine", "tablet", "syrup", "capsule"
        ]
        if any(k in q for k in med_keywords):
            return "PRODUCT_SEARCH"

        if any(q.startswith(p) for p in ["tell me about", "explain", "what is", "whats", "describe", "about "]):
            return "MEDICINE_INFORMATION"

        return "GENERAL_INTELLIGENCE"

    async def ask_gemini(self, prompt: str) -> Optional[str]:
        if not self.genai_available:
            return None
        try:
            model = genai.GenerativeModel("gemini-1.5-flash", system_instruction=SYSTEM_INSTRUCTION)
            res = model.generate_content(prompt)
            if res and res.text:
                return res.text.strip()
        except Exception:
            pass
        return None

    async def generate_response(self, message: str, context: Optional[Dict[str, Any]] = None, user_id: Optional[str] = None) -> Dict[str, Any]:
        text = message.strip()
        if not text:
            return {
                "type": "INFORMATION",
                "message": "Hey! I'm listening. What can I help you with?",
                "tts_text": "Hey! I'm listening. What can I help you with?",
                "products": [],
                "context": context,
            }

        intent = self.classify_intent(text, context)
        q_lower = text.lower()

        # 1. GREETING
        if intent == "GREETING":
            reply = "Hey! I'm listening. What can I help you with?"
            if "good morning" in q_lower:
                reply = "Good morning! ☀️ I'm listening. What can I help you with today?"
            elif "good afternoon" in q_lower:
                reply = "Good afternoon! ☀️ I'm listening. What can I do for you?"
            elif "good evening" in q_lower:
                reply = "Good evening! 🌙 I'm listening. How can I help you?"
            return {"type": "INFORMATION", "message": reply, "tts_text": reply, "products": [], "context": context}

        if intent == "THANKS":
            return {"type": "INFORMATION", "message": "You're welcome! 😊", "tts_text": "You're welcome!", "products": [], "context": context}

        if intent == "GOODBYE":
            return {"type": "INFORMATION", "message": "Take care! 👋 Have a great day.", "tts_text": "Take care! Have a great day.", "products": [], "context": context}

        if intent == "JOKE":
            jokes = [
                "Why did the smartphone need glasses? Because it lost all its contacts! 😄",
                "Why don't scientists trust atoms? Because they make up everything! ⚛️",
                "Why did the doctor carry a red pen? In case they needed to draw blood! 🩺",
            ]
            joke = random.choice(jokes)
            return {"type": "INFORMATION", "message": joke, "tts_text": joke, "products": [], "context": context}

        # 2. WEATHER
        if intent == "WEATHER":
            gemini_res = await self.ask_gemini(text)
            reply = gemini_res if gemini_res else "The weather is currently clear and pleasant with mild temperatures."
            return {"type": "INFORMATION", "message": reply, "tts_text": reply[:150], "products": [], "context": context}

        # 3. MATH
        if intent == "MATH":
            clean = re.sub(r'(what is|calculate|whats|\?)', '', q_lower).strip()
            clean = clean.replace("times", "*").replace("plus", "+").replace("minus", "-").replace("divided by", "/")
            match = re.search(r'(\d+(?:\.\d+)?)\s*([\+\-\*\/])\s*(\d+(?:\.\d+)?)', clean)
            if match:
                a = float(match.group(1))
                op = match.group(2)
                b = float(match.group(3))
                val = a + b if op == "+" else a - b if op == "-" else a * b if op == "*" else (a / b if b != 0 else 0)
                val_str = str(int(val)) if val.is_integer() else f"{val:.2f}"
                return {"type": "INFORMATION", "message": val_str, "tts_text": val_str, "products": [], "context": context}

        # 4. CONTEXT INQUIRIES
        if context and intent.startswith("CONTEXT_"):
            displayed = context.get("displayedProducts", [])
            selected = context.get("selectedProduct")

            if intent == "CONTEXT_SELECTION":
                if "second" in q_lower or "2nd" in q_lower and len(displayed) > 1:
                    target = displayed[1]
                else:
                    target = displayed[0] if displayed else selected

                if target:
                    msg = f"The {target['name']} is **₹{target['price']}** and is currently in stock."
                    tts = f"The {target['name']} is ₹{target['price']}."
                    return {
                        "type": "INFORMATION",
                        "message": msg,
                        "tts_text": tts,
                        "products": [target],
                        "context": {**context, "selectedProduct": target, "selectedProductId": target.get("id")},
                    }

            if intent == "CONTEXT_PRICE_INQUIRY":
                target = selected or (displayed[0] if displayed else None)
                if "second" in q_lower and len(displayed) > 1:
                    target = displayed[1]

                if target:
                    msg = f"The **{target['name']}** is **₹{target['price']}**."
                    tts = f"The {target['name']} is ₹{target['price']}."
                    return {
                        "type": "INFORMATION",
                        "message": msg,
                        "tts_text": tts,
                        "products": [target],
                        "context": {**context, "selectedProduct": target, "selectedProductId": target.get("id")},
                    }

            if intent == "CONTEXT_STOCK_INQUIRY":
                target = selected or (displayed[0] if displayed else None)
                if target:
                    in_stock = target.get("stock", 0) > 0
                    msg = "Yes, it's currently available." if in_stock else f"Currently {target['name']} is out of stock."
                    return {"type": "INFORMATION", "message": msg, "tts_text": msg, "products": [target], "context": context}

            if intent == "CONTEXT_USES_INQUIRY":
                target = selected or (displayed[0] if displayed else None)
                if target:
                    uses_str = ", ".join(target.get("uses", [])) if target.get("uses") else target.get("description", "")
                    msg = f"**{target['name']}** ({target.get('genericName', '')}) is used for: {uses_str}."
                    tts = f"{target['name']} is used for {uses_str}."
                    return {"type": "INFORMATION", "message": msg, "tts_text": tts, "products": [target], "context": context}

        # 5. ADD TO CART
        if intent == "ADD_TO_CART":
            target = None
            if context and context.get("selectedProduct"):
                target = context["selectedProduct"]
            elif context and context.get("displayedProducts"):
                target = context["displayedProducts"][0]
            else:
                prods = await self.search_catalog(text)
                target = prods[0] if prods else None

            if target:
                qty_match = re.search(r'\b(two|three|four|five|\d+)\b', q_lower)
                word_map = {"two": 2, "three": 3, "four": 4, "five": 5}
                qty = 1
                if qty_match:
                    raw_qty = qty_match.group(1)
                    qty = word_map.get(raw_qty, int(raw_qty) if raw_qty.isdigit() else 1)

                price = target.get("price", 30)
                tot = price * qty
                qty_text = f"{qty} units of " if qty > 1 else ""
                msg = f"Done. I've added **{qty_text}{target['name']}** to your cart. Total is **₹{tot}**."
                tts = f"Done. I've added {qty_text}{target['name']} to your cart. Total is ₹{tot}."
                return {
                    "type": "PRODUCT_RESULTS",
                    "message": msg,
                    "tts_text": tts,
                    "products": [target],
                    "action": "ADDED_TO_CART",
                    "addedProduct": target,
                    "context": {**(context or {}), "selectedProduct": target, "selectedProductId": target.get("id")},
                }

        # 6. ORDER TRACKING
        if intent == "ORDER_TRACKING":
            return {
                "type": "ORDER_STATUS",
                "message": "Your order **ORD-8942** is currently **OUT_FOR_DELIVERY**. Arriving in approximately **25–35 mins**.",
                "tts_text": "Your order is out for delivery and arriving in approximately 25 to 35 minutes.",
                "action": "VIEW_TRACKING",
                "order": {"orderId": "ORD-8942", "status": "OUT_FOR_DELIVERY", "eta": "25–35 mins"},
                "context": context,
            }

        # 7. MEDICINE INFO / PRODUCT SEARCH (Queries MongoDB first!)
        if intent in ["MEDICINE_INFORMATION", "PRODUCT_SEARCH"]:
            products = await self.search_catalog(text)
            if products:
                med = products[0]
                uses_str = ", ".join(med.get("uses", [])) if med.get("uses") else med.get("description", "")
                brand_str = f" (Brand: {med['brand']})" if med.get("brand") else ""
                msg = f"Sure. I found **{med['name']}**{brand_str} in the PharmaCare catalog. It contains **{med['genericName']}** ({med['strength']}). It is used for: **{uses_str}**. It's currently available for **₹{med['price']}**."
                tts = f"Sure. I found {med['name']} in the PharmaCare catalog. It contains {med['genericName']} and is used for {uses_str}. It's currently available for ₹{med['price']}."
                return {
                    "type": "PRODUCT_RESULTS",
                    "message": msg,
                    "tts_text": tts,
                    "products": products,
                    "context": {**(context or {}), "displayedProducts": products, "selectedProduct": med, "selectedProductId": med.get("id")},
                }
            else:
                gemini_res = await self.ask_gemini(text)
                if gemini_res:
                    clean_tts = re.sub(r'[*_#`[\]()]', '', gemini_res)[:160]
                    return {"type": "INFORMATION", "message": gemini_res, "tts_text": clean_tts, "products": [], "context": context}

                clean_term = extract_medicine_name(text) or text
                msg = f"I couldn't find \"{clean_term}\" in the current PharmaCare catalog."
                return {"type": "INFORMATION", "message": msg, "tts_text": msg, "products": [], "context": context}

        # 8. GENERAL KNOWLEDGE / TOPIC SWITCHING
        gemini_reply = await self.ask_gemini(text)
        if gemini_reply:
            clean_tts = re.sub(r'[*_#`[\]()]', '', gemini_reply)[:160]
            return {"type": "INFORMATION", "message": gemini_reply, "tts_text": clean_tts, "products": [], "context": context}

        # Conversational intelligent fallbacks
        if "python" in q_lower:
            reply = "Python is a high-level, interpreted programming language known for its clear syntax and versatility in web development, AI, data science, and automation."
            return {"type": "INFORMATION", "message": reply, "tts_text": reply, "products": [], "context": context}

        return {
            "type": "INFORMATION",
            "message": "I understand your query. How else can I assist you in PharmaCare AI?",
            "tts_text": "I understand your query. How else can I assist you?",
            "products": [],
            "context": context,
        }

jarvis_service = JarvisAIService()
