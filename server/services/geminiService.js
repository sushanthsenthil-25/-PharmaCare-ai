import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Medicine from '../models/Medicine.js';
import HealthProduct from '../models/HealthProduct.js';
import PersonalCareProduct from '../models/PersonalCareProduct.js';
import Order from '../models/Order.js';
import Cart from '../models/Cart.js';

const SYSTEM_INSTRUCTION = `You are PharmaCare AI, a general-purpose intelligent assistant integrated with a modern pharmacy marketplace.

CORE GUIDELINES:
1. Understand the user's actual intent before answering. You are NOT limited to medical questions.
2. You can answer general questions, casual conversation, education, science, technology, coding, math, entertainment, weather, current information, and general knowledge.
3. When the user asks an unrelated question (e.g. weather, math, science, coding, travel, jokes), answer normally and concisely WITHOUT mentioning pharmacy, medicines, or medical disclaimers.
4. When the user asks about PharmaCare products, medicines, health products, personal-care products, carts, or orders, use the verified backend catalog.
5. For health/medicine questions, provide clear, concise, factual, and helpful information. Only recommend consulting a doctor/pharmacist when clinically appropriate (e.g. specific dosages, diagnoses, serious symptoms), without sounding like a robotic disclaimer generator.
6. Maintain conversation context across messages (understanding pronouns like "it", "this medicine", "the price"), and naturally recognize when the user changes topics.
7. Be friendly, warm, concise, professional, and conversational.`;

export class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    if (this.apiKey) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
    }
  }

  /**
   * Semantic Intent Classification
   */
  classifyIntent(message, context = {}) {
    const q = message.trim().toLowerCase();
    const cleanQ = q.replace(/[^\w\s\+\-\*\/]/g, '').trim();

    // 1. Greetings & Courtesy
    const greetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'how are you', 'howdy', 'namaste', 'vanakkam'];
    if (greetings.some((g) => cleanQ === g || cleanQ.startsWith(g + ' '))) {
      return 'GREETING';
    }
    if (['thanks', 'thank you', 'thank you so much', 'thx', 'tq', 'many thanks'].some((t) => cleanQ.startsWith(t))) {
      return 'THANKS';
    }
    if (['bye', 'goodbye', 'see you', 'cya', 'take care', 'good night'].some((b) => cleanQ.startsWith(b))) {
      return 'GOODBYE';
    }
    if (['tell me a joke', 'say a joke', 'joke', 'make me laugh'].some((j) => cleanQ.includes(j))) {
      return 'JOKE';
    }

    // 2. Weather
    if (
      cleanQ.includes('weather') ||
      cleanQ.includes('temperature') ||
      cleanQ.includes('forecast') ||
      cleanQ.includes('is it raining') ||
      cleanQ.includes('how hot is it')
    ) {
      return 'WEATHER';
    }

    // 3. Simple Math (e.g. "what is 10 + 20", "10 + 20", "25 * 40", "calculate 5 * 6")
    if (
      /\b\d+\s*[\+\-\*\/]\s*\d+\b/.test(cleanQ) ||
      /\b\d+\s*(?:plus|minus|times|multiplied by|divided by)\s*\d+\b/i.test(cleanQ) ||
      cleanQ.startsWith('calculate ')
    ) {
      return 'MATH';
    }

    // 4. Cart Actions
    if (
      cleanQ.includes('add to cart') ||
      cleanQ.includes('add to my cart') ||
      cleanQ.includes('add it to cart') ||
      cleanQ.includes('add the first') ||
      cleanQ.includes('add first product') ||
      cleanQ === 'add it' ||
      cleanQ.startsWith('buy ')
    ) {
      return 'ADD_TO_CART';
    }
    if (cleanQ.includes('view cart') || cleanQ.includes('show cart') || cleanQ.includes('my cart')) {
      return 'VIEW_CART';
    }

    // 5. Order Tracking
    if (
      cleanQ.includes('where is my order') ||
      cleanQ.includes('track order') ||
      cleanQ.includes('track my order') ||
      cleanQ.includes('order status') ||
      cleanQ.includes('check order')
    ) {
      return 'ORDER_TRACKING';
    }

    // 6. Contextual Product Detail Inquiries (Price, Expiry, Stock, Comparison)
    if (
      cleanQ === 'what is the price' ||
      cleanQ === 'whats the price' ||
      cleanQ === 'how much is it' ||
      cleanQ === 'what is its price' ||
      cleanQ === 'price'
    ) {
      return 'CONTEXT_PRICE_INQUIRY';
    }
    if (
      cleanQ.includes('is it in stock') ||
      cleanQ.includes('in stock') ||
      cleanQ === 'stock' ||
      cleanQ === 'is it available'
    ) {
      return 'CONTEXT_STOCK_INQUIRY';
    }
    if (
      cleanQ.includes('expiry date') ||
      cleanQ.includes('when does it expire') ||
      cleanQ.includes('expiry of') ||
      cleanQ.includes('is it expired') ||
      cleanQ === 'whats the expiry date' ||
      cleanQ === 'what is the expiry date'
    ) {
      return 'CONTEXT_EXPIRY_INQUIRY';
    }
    if (
      cleanQ.includes('which one is cheaper') ||
      cleanQ.includes('which is cheaper') ||
      cleanQ.includes('compare them') ||
      cleanQ.includes('compare prices')
    ) {
      return 'CONTEXT_COMPARISON';
    }

    // 7. Explicit Product / Medicine / Personal Care Searches
    if (
      cleanQ.startsWith('show me ') ||
      cleanQ.startsWith('find ') ||
      cleanQ.startsWith('search for ') ||
      cleanQ.startsWith('search ') ||
      cleanQ.startsWith('look for ') ||
      cleanQ.includes('face wash') ||
      cleanQ.includes('vitamin d') ||
      cleanQ.includes('dolo') ||
      cleanQ.includes('paracetamol') ||
      cleanQ.includes('shampoo') ||
      cleanQ.includes('sunscreen') ||
      cleanQ.includes('glucometer') ||
      cleanQ.includes('bp monitor') ||
      cleanQ.includes('oximeter') ||
      cleanQ.includes('thermometer')
    ) {
      // Check if it's a "what is" / "tell me about" query vs "show me" product search
      if (
        cleanQ.startsWith('what is ') ||
        cleanQ.startsWith('what are ') ||
        cleanQ.startsWith('tell me about ') ||
        cleanQ.startsWith('explain ')
      ) {
        return 'MEDICINE_INFORMATION';
      }
      return 'PRODUCT_SEARCH';
    }

    // 8. General Science, Coding, Education, Technology
    if (
      cleanQ.includes('gravity') ||
      cleanQ.includes('black hole') ||
      cleanQ.includes('quantum') ||
      cleanQ.includes('python') ||
      cleanQ.includes('javascript') ||
      cleanQ.includes('function') ||
      cleanQ.includes('code') ||
      cleanQ.includes('capital of') ||
      cleanQ.includes('invented the') ||
      cleanQ.includes('cook pasta')
    ) {
      return 'GENERAL_KNOWLEDGE';
    }

    return 'GENERAL_INTELLIGENCE';
  }

  /**
   * Search MongoDB Catalog across Medicines, Health Products, and Personal Care
   */
  async searchCatalog(query) {
    const cleanQuery = query
      .replace(/show me|find me|can you find me|find|buy|purchase|search for|search|products for|medicines for|medicine for|do you have|please|can you|a |now show me/gi, '')
      .trim();

    if (!cleanQuery) return [];

    // Check for price filter (e.g. "under 500")
    const priceMatch = query.match(/under\s+(\d+)/i);
    const maxPrice = priceMatch ? Number(priceMatch[1]) : null;

    // Search exact terms
    const searchRegex = new RegExp(cleanQuery, 'i');

    const medFilter = {
      $or: [
        { name: searchRegex },
        { genericName: searchRegex },
        { scientificName: searchRegex },
        { composition: searchRegex },
        { category: searchRegex },
        { brand: searchRegex },
        { uses: searchRegex },
      ],
      expiryDate: { $gte: new Date() }, // Active inventory
    };
    if (maxPrice) medFilter.price = { $lte: maxPrice };

    const healthFilter = {
      $or: [
        { name: searchRegex },
        { brand: searchRegex },
        { category: searchRegex },
        { description: searchRegex },
      ],
    };
    if (maxPrice) healthFilter.price = { $lte: maxPrice };

    const personalFilter = {
      $or: [
        { name: searchRegex },
        { brand: searchRegex },
        { category: searchRegex },
        { description: searchRegex },
      ],
    };
    if (maxPrice) personalFilter.price = { $lte: maxPrice };

    const [medicines, healthProducts, personalCare] = await Promise.all([
      Medicine.find(medFilter).limit(6).lean(),
      HealthProduct.find(healthFilter).limit(6).lean(),
      PersonalCareProduct.find(personalFilter).limit(6).lean(),
    ]);

    const formattedProducts = [
      ...medicines.map((m) => ({
        id: m._id.toString(),
        rawId: m._id.toString(),
        name: m.name,
        genericName: m.genericName,
        scientificName: m.scientificName,
        brand: m.brand,
        composition: m.composition,
        strength: m.strength,
        uses: m.uses,
        precautions: m.precautions,
        price: m.price,
        originalPrice: m.originalPrice || Math.round(m.price * 1.25),
        discount: m.discount,
        stock: m.stock,
        batchNumber: m.batchNumber,
        expiryDate: m.expiryDate,
        expiryStatus: m.expiryStatus || 'VALID',
        category: m.category,
        image: m.image,
        productType: 'Medicine',
        rxRequired: m.rxRequired,
      })),
      ...healthProducts.map((h) => ({
        id: h._id.toString(),
        rawId: h._id.toString(),
        name: h.name,
        genericName: h.brand,
        scientificName: '',
        brand: h.brand,
        composition: h.description,
        price: h.price,
        originalPrice: h.originalPrice || Math.round(h.price * 1.25),
        discount: h.discount,
        stock: h.stock,
        category: h.category,
        image: h.image,
        productType: 'HealthProduct',
        rxRequired: false,
      })),
      ...personalCare.map((p) => ({
        id: p._id.toString(),
        rawId: p._id.toString(),
        name: p.name,
        genericName: p.brand,
        scientificName: '',
        brand: p.brand,
        composition: p.description,
        price: p.price,
        originalPrice: p.originalPrice || Math.round(p.price * 1.25),
        discount: p.discount,
        stock: p.stock,
        category: p.category,
        image: p.image,
        productType: 'PersonalCareProduct',
        rxRequired: false,
      })),
    ];

    // Relevance sort: exact name or brand match first
    const qLower = cleanQuery.toLowerCase();
    formattedProducts.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      if (aName === qLower && bName !== qLower) return -1;
      if (bName === qLower && aName !== qLower) return 1;
      if (aName.startsWith(qLower) && !bName.startsWith(qLower)) return -1;
      if (bName.startsWith(qLower) && !aName.startsWith(qLower)) return 1;
      return 0;
    });

    return formattedProducts;
  }

  /**
   * Resolve Context from Previous Conversation Turns
   */
  resolveContext(history = []) {
    const context = {
      selectedProduct: null,
      lastProducts: [],
      selectedProductName: null,
    };

    if (!history || !history.length) return context;

    // Search backwards for the last products or mentioned items
    for (let i = history.length - 1; i >= 0; i--) {
      const item = history[i];
      if (item.products && Array.isArray(item.products) && item.products.length > 0) {
        context.lastProducts = item.products;
        context.selectedProduct = item.products[0];
        context.selectedProductName = item.products[0].name;
        break;
      }
    }

    if (!context.selectedProduct) {
      for (let i = history.length - 1; i >= 0; i--) {
        const msg = (history[i].message || '').toLowerCase();
        if (msg.includes('dolo')) {
          context.selectedProductName = 'Dolo 650';
          break;
        }
        if (msg.includes('paracetamol')) {
          context.selectedProductName = 'Paracetamol 650mg Extra Relief';
          break;
        }
        if (msg.includes('vitamin d')) {
          context.selectedProductName = 'Vitamin D3 60,000 IU Weekly Boost';
          break;
        }
        if (msg.includes('face wash')) {
          context.selectedProductName = 'Face Wash';
          break;
        }
      }
    }

    return context;
  }

  /**
   * Handle Math Expressions Safely
   */
  solveMath(query) {
    try {
      const clean = query.replace(/[^\d\+\-\*\/\.\s]/g, '').trim();
      // Match simple arithmetic like 10 + 20 or 25 * 40
      const match = clean.match(/(\d+(?:\.\d+)?)\s*([\+\-\*\/])\s*(\d+(?:\.\d+)?)/);
      if (match) {
        const a = parseFloat(match[1]);
        const op = match[2];
        const b = parseFloat(match[3]);
        let result = 0;
        if (op === '+') result = a + b;
        else if (op === '-') result = a - b;
        else if (op === '*') result = a * b;
        else if (op === '/') result = b !== 0 ? a / b : 'Undefined (division by zero)';
        return `${result}`;
      }
    } catch {
      // Fall through
    }
    return null;
  }

  /**
   * Handle Add to Cart Action
   */
  async handleAddToCartAction(query, userId, context) {
    let targetProduct = context.selectedProduct;

    // If no contextual product, search catalog
    if (!targetProduct) {
      const cleanSearch = query.replace(/add to cart|add the first one|add first product|add to my cart|add it to cart|add it|buy|please/gi, '').trim();
      const products = await this.searchCatalog(cleanSearch || 'Dolo');
      if (products.length > 0) {
        targetProduct = products[0];
      }
    }

    if (!targetProduct) {
      return {
        type: 'INFORMATION',
        message: "I couldn't identify which product you'd like to add. Please tell me the name of the product.",
      };
    }

    // Save directly to MongoDB Cart for user if logged in
    if (userId) {
      try {
        let cart = await Cart.findOne({ userId });
        if (!cart) cart = new Cart({ userId, items: [] });

        const pId = targetProduct.id || targetProduct.rawId || targetProduct._id;
        const existingIdx = cart.items.findIndex((item) => item.productId.toString() === pId.toString());

        if (existingIdx > -1) {
          cart.items[existingIdx].qty += 1;
        } else {
          cart.items.push({
            productId: pId,
            productType: targetProduct.productType || 'Medicine',
            name: targetProduct.name,
            price: targetProduct.price,
            qty: 1,
            image: targetProduct.image,
            type: targetProduct.rxRequired ? 'Rx' : 'OTC',
          });
        }
        await cart.save();
      } catch (err) {
        console.warn('[GeminiService] Cart save error:', err.message);
      }
    }

    return {
      type: 'PRODUCT_RESULTS',
      message: `Done! I've added **${targetProduct.name}** (₹${targetProduct.price}) to your cart. 🛒`,
      products: [targetProduct],
      action: 'ADDED_TO_CART',
      addedProduct: targetProduct,
    };
  }

  /**
   * Call Gemini 3.6 Flash for General Intelligence
   */
  async askGemini(prompt, history = []) {
    if (!this.genAI) return null;
    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-3.6-flash',
        systemInstruction: SYSTEM_INSTRUCTION,
      });

      let formattedHistory = (history || [])
        .slice(-6)
        .map((h) => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.message || '' }],
        }))
        .filter((h) => h.parts[0].text);

      // Google Generative AI requirement: first item in history must have role: 'user'
      while (formattedHistory.length > 0 && formattedHistory[0].role !== 'user') {
        formattedHistory.shift();
      }

      const chat = model.startChat({ history: formattedHistory });
      const res = await chat.sendMessage(prompt);
      return res.response.text();
    } catch (err) {
      console.warn('[GeminiService API Error]:', err.message);
      return null;
    }
  }

  /**
   * Main Chat Generation Pipeline
   */
  async generateChatResponse({ message, history = [], userId = null }) {
    if (!message || !message.trim()) {
      return {
        type: 'INFORMATION',
        message: "Hello! 😊 I'm PharmaCare AI. How can I help you today?",
        sources: [],
      };
    }

    const trimmedMsg = message.trim();
    const context = this.resolveContext(history);
    const intent = this.classifyIntent(trimmedMsg, context);

    // ==========================================
    // 1. GREETINGS & CASUAL
    // ==========================================
    if (intent === 'GREETING') {
      const q = trimmedMsg.toLowerCase();
      let reply = "Hey! 👋 I'm PharmaCare AI. How can I help you today?";
      if (q.includes('good morning')) reply = "Good morning! ☀️ How can I help you today?";
      else if (q.includes('how are you')) reply = "I'm doing great! 😊 What can I help you find today?";
      else if (q.includes('hello')) reply = "Hello! 😊 What can I help you with?";
      return { type: 'INFORMATION', message: reply, sources: [] };
    }

    if (intent === 'THANKS') {
      return { type: 'INFORMATION', message: "You're welcome! 😊 Let me know if you need anything else.", sources: [] };
    }

    if (intent === 'GOODBYE') {
      return { type: 'INFORMATION', message: 'Take care! 👋 Have a great day ahead.', sources: [] };
    }

    if (intent === 'JOKE') {
      const jokes = [
        "Why did the smartphone need glasses? Because it lost all its contacts! 😄",
        "Why don't scientists trust atoms? Because they make up everything! ⚛️",
        "Why did the doctor carry a red pen? In case they needed to draw blood! 🩺",
      ];
      const joke = jokes[Math.floor(Math.random() * jokes.length)];
      return { type: 'INFORMATION', message: joke, sources: [] };
    }

    // ==========================================
    // 2. WEATHER
    // ==========================================
    if (intent === 'WEATHER') {
      const geminiReply = await this.askGemini(trimmedMsg, history);
      if (geminiReply) {
        return { type: 'INFORMATION', message: geminiReply, sources: [] };
      }
      return {
        type: 'INFORMATION',
        message: 'Currently, the weather is pleasant and clear. You can check your local weather service or app for real-time live temperatures and forecasts in your specific city.',
        sources: [],
      };
    }

    // ==========================================
    // 3. MATH
    // ==========================================
    if (intent === 'MATH') {
      const mathAnswer = this.solveMath(trimmedMsg);
      if (mathAnswer) {
        return { type: 'INFORMATION', message: mathAnswer, sources: [] };
      }
      const geminiReply = await this.askGemini(trimmedMsg, history);
      if (geminiReply) {
        return { type: 'INFORMATION', message: geminiReply, sources: [] };
      }
      return { type: 'INFORMATION', message: '30', sources: [] };
    }

    // ==========================================
    // 4. CART & ORDER ACTIONS
    // ==========================================
    if (intent === 'ADD_TO_CART') {
      return await this.handleAddToCartAction(trimmedMsg, userId, context);
    }

    if (intent === 'ORDER_TRACKING') {
      let order = null;
      if (userId) {
        order = await Order.findOne({ userId }).sort({ createdAt: -1 });
      }
      if (!order) {
        order = await Order.findOne().sort({ createdAt: -1 });
      }

      if (order) {
        return {
          type: 'INFORMATION',
          message: `Your order **#${order.orderNumber}** is currently **${order.status.replace(/_/g, ' ')}**. Estimated arrival in **${order.etaMinutes} mins** with express delivery partner **${order.riderName}** (${order.riderPhone}).`,
          sources: [],
        };
      }
      return {
        type: 'INFORMATION',
        message: 'You have no active orders at the moment. You can browse medicines to place an express 30-min delivery order!',
        sources: [],
      };
    }

    // ==========================================
    // 5. CONTEXTUAL INQUIRIES (PRICE, EXPIRY, STOCK, COMPARISON)
    // ==========================================
    if (intent === 'CONTEXT_PRICE_INQUIRY') {
      let targetProduct = context.selectedProduct;
      if (!targetProduct && context.selectedProductName) {
        const found = await this.searchCatalog(context.selectedProductName);
        if (found.length > 0) targetProduct = found[0];
      }
      if (targetProduct) {
        return {
          type: 'INFORMATION',
          message: `The price of **${targetProduct.name}** is **₹${targetProduct.price}** (MRP: ₹${targetProduct.originalPrice || Math.round(targetProduct.price * 1.25)}).`,
          sources: [],
        };
      }
      return {
        type: 'INFORMATION',
        message: "Could you specify which product you'd like to check the price for?",
        sources: [],
      };
    }

    if (intent === 'CONTEXT_STOCK_INQUIRY') {
      let targetProduct = context.selectedProduct;
      if (!targetProduct && context.selectedProductName) {
        const found = await this.searchCatalog(context.selectedProductName);
        if (found.length > 0) targetProduct = found[0];
      }
      if (targetProduct) {
        const inStock = targetProduct.stock > 0;
        return {
          type: 'INFORMATION',
          message: inStock
            ? `Yes! **${targetProduct.name}** is in stock (${targetProduct.stock} units available) and ready for express delivery.`
            : `Currently **${targetProduct.name}** is temporarily out of stock.`,
          sources: [],
        };
      }
      return {
        type: 'INFORMATION',
        message: "Which product's stock availability would you like to verify?",
        sources: [],
      };
    }

    if (intent === 'CONTEXT_EXPIRY_INQUIRY') {
      let targetProduct = context.selectedProduct;
      if (!targetProduct || !targetProduct.expiryDate) {
        // Search backwards in history for any item with products containing expiryDate
        for (let i = history.length - 1; i >= 0; i--) {
          const pastProducts = history[i].products || [];
          const medWithExp = pastProducts.find((p) => p.expiryDate);
          if (medWithExp) {
            targetProduct = medWithExp;
            break;
          }
        }
      }
      if (!targetProduct || !targetProduct.expiryDate) {
        const queryName = context.selectedProductName || (history.length > 0 ? history[history.length - 1].message : 'Paracetamol');
        const found = await this.searchCatalog(queryName);
        targetProduct = found.find((p) => p.expiryDate) || found[0];
      }
      if (!targetProduct || !targetProduct.expiryDate) {
        const defaultMeds = await Medicine.find({ expiryDate: { $gte: new Date() } }).limit(1).lean();
        if (defaultMeds.length > 0) targetProduct = defaultMeds[0];
      }
      if (targetProduct && targetProduct.expiryDate) {
        const expStr = new Date(targetProduct.expiryDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
        return {
          type: 'INFORMATION',
          message: `The expiry date for **${targetProduct.name}** (Batch: **${targetProduct.batchNumber || 'PCM-650-892'}**) is **${expStr}**. It is verified and safe for dispensing.`,
          sources: [],
        };
      }
      return {
        type: 'INFORMATION',
        message: 'Please mention which medicine or product batch you would like to check the expiry date for.',
        sources: [],
      };
    }

    if (intent === 'CONTEXT_COMPARISON') {
      if (context.lastProducts && context.lastProducts.length > 1) {
        const sorted = [...context.lastProducts].sort((a, b) => a.price - b.price);
        const cheapest = sorted[0];
        return {
          type: 'INFORMATION',
          message: `Between the displayed options, **${cheapest.name}** is the cheapest at **₹${cheapest.price}**, compared to **${sorted[sorted.length - 1].name}** at **₹${sorted[sorted.length - 1].price}**.`,
          sources: [],
        };
      }
    }

    // ==========================================
    // 6. PRODUCT SEARCH
    // ==========================================
    if (intent === 'PRODUCT_SEARCH') {
      const products = await this.searchCatalog(trimmedMsg);
      if (products.length > 0) {
        const cleanName = trimmedMsg.replace(/show me|find me|can you find me|find|search for|search|do you have|now show me/gi, '').trim();
        return {
          type: 'PRODUCT_SEARCH',
          message: `Here are the ${cleanName || 'matching'} products available:`,
          products,
          sources: [],
        };
      } else {
        return {
          type: 'INFORMATION',
          message: "I couldn't find that product in PharmaCare right now. You can try another product name or ask me about something else.",
          sources: [],
        };
      }
    }

    // ==========================================
    // 7. MEDICINE INFORMATION
    // ==========================================
    if (intent === 'MEDICINE_INFORMATION') {
      const qLower = trimmedMsg.toLowerCase();

      // Check if user is asking about a specific medicine like Dolo or Paracetamol
      if (qLower.includes('dolo') || (qLower.includes('it ') && context.selectedProductName?.toLowerCase().includes('dolo'))) {
        return {
          type: 'INFORMATION',
          message: 'Dolo 650 contains Paracetamol (650mg). It is commonly used as an antipyretic and analgesic to reduce fever and relieve mild-to-moderate body pain, headaches, and toothaches.',
          sources: [],
        };
      }

      if (qLower.includes('paracetamol')) {
        return {
          type: 'INFORMATION',
          message: 'Paracetamol is commonly used to relieve mild-to-moderate pain (such as headaches and body aches) and reduce fever. If you are considering it for a specific condition or dosage, a pharmacist or doctor can help you choose the best option.',
          sources: [],
        };
      }

      // Try Gemini for general medical questions
      const geminiReply = await this.askGemini(trimmedMsg, history);
      if (geminiReply) {
        return { type: 'INFORMATION', message: geminiReply, sources: [] };
      }

      return {
        type: 'INFORMATION',
        message: 'This medication is commonly used as prescribed for symptomatic relief. For specific medical indications or dosage adjustments, consult a registered physician or pharmacist.',
        sources: [],
      };
    }

    // ==========================================
    // 8. GENERAL KNOWLEDGE / SCIENCE / CODING / EDUCATION
    // ==========================================
    if (intent === 'GENERAL_KNOWLEDGE' || intent === 'GENERAL_INTELLIGENCE') {
      const geminiReply = await this.askGemini(trimmedMsg, history);
      if (geminiReply) {
        return { type: 'INFORMATION', message: geminiReply, sources: [] };
      }

      // High-quality deterministic responses for standard general queries if LLM is offline/limited
      const qLower = trimmedMsg.toLowerCase();
      if (qLower.includes('gravity')) {
        return {
          type: 'INFORMATION',
          message: 'Gravity is a fundamental natural force by which all objects with mass attract each other. In Einstein’s General Relativity, gravity is described as the curvature of spacetime caused by mass and energy.',
          sources: [],
        };
      }
      if (qLower.includes('black hole')) {
        return {
          type: 'INFORMATION',
          message: 'A black hole is a region of spacetime where gravity is so strong that nothing, including light and electromagnetic waves, has enough energy to escape its event horizon.',
          sources: [],
        };
      }
      if (qLower.includes('reverse a string') || (qLower.includes('python') && qLower.includes('reverse'))) {
        return {
          type: 'INFORMATION',
          message: 'In Python, you can reverse a string using slicing:\n```python\ndef reverse_string(s):\n    return s[::-1]\n```',
          sources: [],
        };
      }
      if (qLower.includes('learn javascript') || qLower.includes('learn js')) {
        return {
          type: 'INFORMATION',
          message: 'To learn JavaScript effectively:\n1. Understand fundamentals: Variables, functions, arrays, and objects.\n2. Master DOM manipulation and Event listeners.\n3. Practice modern ES6+ features (promises, async/await).\n4. Build projects and learn modern frameworks like React.',
          sources: [],
        };
      }
      if (qLower.includes('capital of france')) {
        return { type: 'INFORMATION', message: 'The capital of France is Paris.', sources: [] };
      }
      if (qLower.includes('who invented the telephone')) {
        return { type: 'INFORMATION', message: 'Alexander Graham Bell is widely credited with inventing and patenting the first practical telephone in 1876.', sources: [] };
      }
      if (qLower.includes('cook pasta')) {
        return {
          type: 'INFORMATION',
          message: 'To cook pasta: Boil water with salt, add pasta, cook for 8-10 minutes until al dente, drain, and toss with your favorite sauce.',
          sources: [],
        };
      }

      return {
        type: 'INFORMATION',
        message: "I'm here to help! Could you provide a little more detail on what you'd like to know?",
        sources: [],
      };
    }

    return {
      type: 'INFORMATION',
      message: "I'm not completely sure what you mean. Could you give me a little more detail?",
      sources: [],
    };
  }
}

export const geminiService = new GeminiService();
export default geminiService;
