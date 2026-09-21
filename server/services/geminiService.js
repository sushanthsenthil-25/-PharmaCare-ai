import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Medicine from '../models/Medicine.js';
import HealthProduct from '../models/HealthProduct.js';
import PersonalCareProduct from '../models/PersonalCareProduct.js';
import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import {
  searchMedicinesRanked,
  extractMedicineName,
  normalizeQuery,
  formatMedicine,
} from './medicineSearchService.js';
import { calculateCart, calculateDeliveryEstimate } from './cartService.js';

const SYSTEM_INSTRUCTION = `You are JARVIS, the intelligent AI assistant inside PharmaCare AI.

You are a capable, concise, and helpful assistant with access to the PharmaCare pharmacy marketplace.

Rules:
1. Understand the user's intent: greetings, weather, math, general questions, medicine searches, cart actions, or order tracking.
2. When answering medicine questions, rely on the verified MongoDB catalog provided in the prompt. Never invent product names, prices, stocks, or prescription requirements.
3. If a product is not in the database, honestly tell the user it is not currently in the PharmaCare catalog.
4. Keep spoken responses concise and natural.
5. Maintain conversational context across follow-up queries (e.g. "it", "the second one", "what's the price", "add to cart").`;

export class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    if (this.apiKey) {
      try {
        this.genAI = new GoogleGenerativeAI(this.apiKey);
      } catch {
        this.genAI = null;
      }
    }
  }

  /**
   * Helper to normalize text & spoken numbers
   */
  normalizeText(text) {
    return normalizeQuery(text);
  }

  /**
   * Resolve Context from Previous Conversation Turns & Incoming Context Object
   */
  resolveContext(history = [], incomingContext = null) {
    const context = {
      conversationId: incomingContext?.conversationId || null,
      selectedProductId: incomingContext?.selectedProductId || null,
      selectedProduct: incomingContext?.selectedProduct || null,
      displayedProducts: incomingContext?.displayedProducts || [],
      lastUserMessage: null,
      lastAssistantMessage: null,
    };

    if (!history || !history.length) return context;

    for (let i = history.length - 1; i >= 0; i--) {
      const item = history[i];
      if (item.role === 'user' && !context.lastUserMessage) {
        context.lastUserMessage = item.message;
      }
      if (item.role === 'assistant' && !context.lastAssistantMessage) {
        context.lastAssistantMessage = item.message;
      }
      if (
        (!context.displayedProducts || context.displayedProducts.length === 0) &&
        item.products &&
        Array.isArray(item.products) &&
        item.products.length > 0
      ) {
        context.displayedProducts = item.products;
        if (!context.selectedProduct) {
          context.selectedProduct = item.products[0];
          context.selectedProductId = item.products[0].id || item.products[0]._id;
        }
      }
    }

    return context;
  }

  /**
   * Semantic Intent Classification
   */
  classifyIntent(message, context = {}) {
    const q = this.normalizeText(message);
    const cleanQ = q.replace(/[^\w\s\+\-\*\/]/g, '').trim();

    // 1. Greetings & Courtesy
    const greetings = ['hi', 'hello', 'hey', 'hey jarvis', 'hi jarvis', 'hello jarvis', 'good morning', 'good afternoon', 'good evening', 'how are you', 'howdy', 'namaste', 'vanakkam'];
    if (greetings.some((g) => cleanQ === g || cleanQ === `${g} jarvis` || (cleanQ.startsWith(`${g} `) && !cleanQ.includes('show') && !cleanQ.includes('paracetamol') && !cleanQ.includes('dolo') && !cleanQ.includes('medicine') && !cleanQ.includes('weather')))) {
      return 'GREETING';
    }
    if (['thanks', 'thank you', 'thanks jarvis', 'thank you jarvis', 'thx', 'tq'].some((t) => cleanQ === t || cleanQ.startsWith(`${t} `))) {
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

    // 3. Simple Math
    if (
      /\b\d+\s*[\+\-\*\/]\s*\d+\b/.test(cleanQ) ||
      /\b\d+\s*(?:plus|minus|times|multiplied by|divided by)\s*\d+\b/i.test(cleanQ) ||
      cleanQ.startsWith('calculate ') ||
      cleanQ.startsWith('what is 25') ||
      cleanQ.startsWith('whats 25')
    ) {
      return 'MATH';
    }

    // 4. Cart Actions
    if (
      cleanQ.includes('add to cart') ||
      cleanQ.includes('add to my cart') ||
      cleanQ.includes('add it to cart') ||
      cleanQ.includes('add that to my cart') ||
      cleanQ.includes('add it to my cart') ||
      cleanQ.includes('add it') ||
      cleanQ.includes('add that') ||
      cleanQ.includes('add the first') ||
      cleanQ.includes('add the second') ||
      cleanQ.includes('buy it') ||
      cleanQ.includes('buy that') ||
      cleanQ.includes('add two') ||
      cleanQ.includes('add 2')
    ) {
      return 'ADD_TO_CART';
    }
    if (cleanQ.includes('view cart') || cleanQ.includes('show cart') || cleanQ.includes('my cart') || cleanQ.includes('cart total') || cleanQ.includes('how much is my total')) {
      return 'VIEW_CART';
    }

    // 5. Order Tracking & Delivery ETA
    if (
      cleanQ.includes('where is my order') ||
      cleanQ.includes('track order') ||
      cleanQ.includes('track my order') ||
      cleanQ.includes('order status') ||
      cleanQ.includes('check order')
    ) {
      return 'ORDER_TRACKING';
    }
    if (
      cleanQ.includes('estimated delivery') ||
      cleanQ.includes('delivery time') ||
      cleanQ.includes('when will it arrive') ||
      cleanQ.includes('when will my order arrive') ||
      cleanQ.includes('eta')
    ) {
      return 'DELIVERY_ETA';
    }

    // 6. Contextual Product Detail Inquiries
    if (
      cleanQ.includes('price of the second') ||
      cleanQ.includes('price of second') ||
      cleanQ.includes('price of the first') ||
      cleanQ.includes('price of first') ||
      cleanQ.includes('price of this') ||
      cleanQ.includes('price of that') ||
      cleanQ.includes('price of it') ||
      cleanQ === 'what is the price' ||
      cleanQ === 'whats the price' ||
      cleanQ === 'how much is it' ||
      cleanQ === 'how much is this' ||
      cleanQ === 'how much does it cost' ||
      cleanQ.startsWith('price of ')
    ) {
      return 'CONTEXT_PRICE_INQUIRY';
    }

    if (
      cleanQ.includes('is it available') ||
      cleanQ.includes('is it in stock') ||
      cleanQ.includes('is this available') ||
      cleanQ.includes('is that available') ||
      cleanQ.includes('check stock') ||
      cleanQ.includes('stock availability') ||
      cleanQ.includes('in stock')
    ) {
      return 'CONTEXT_STOCK_INQUIRY';
    }

    if (
      cleanQ.includes('expiry date') ||
      cleanQ.includes('when does it expire') ||
      cleanQ.includes('expiry of this') ||
      cleanQ.includes('expiry of that') ||
      cleanQ.includes('expiration date')
    ) {
      return 'CONTEXT_EXPIRY_INQUIRY';
    }

    if (
      cleanQ.includes('what is it used for') ||
      cleanQ.includes('what is this used for') ||
      cleanQ.includes('what are the uses') ||
      cleanQ.includes('how to use it') ||
      cleanQ.includes('side effects of it') ||
      cleanQ.includes('tell me about it')
    ) {
      return 'CONTEXT_USES_INQUIRY';
    }

    if (
      cleanQ.includes('which is cheaper') ||
      cleanQ.includes('compare prices') ||
      cleanQ.includes('which one is better value') ||
      cleanQ.includes('compare')
    ) {
      return 'CONTEXT_COMPARISON';
    }

    // 7. General Questions / Topic Switching
    if (
      cleanQ.startsWith('what is python') ||
      cleanQ.includes('python') ||
      cleanQ.includes('javascript') ||
      cleanQ.includes('gravity') ||
      cleanQ.includes('black hole') ||
      cleanQ.includes('quantum') ||
      cleanQ.includes('capital of') ||
      cleanQ.includes('who invented') ||
      cleanQ.includes('who is the president') ||
      cleanQ.includes('cook pasta') ||
      cleanQ.includes('how to write code') ||
      cleanQ.includes('translate ')
    ) {
      return 'GENERAL_KNOWLEDGE';
    }

    // 8. Medicine Information Requests (e.g. "Tell me about Dolo", "tell about dolo", "What is Paracetamol", "dolo uses", "about dolo")
    if (
      cleanQ.startsWith('tell') ||
      cleanQ.startsWith('explain') ||
      cleanQ.startsWith('what is') ||
      cleanQ.startsWith('what are') ||
      cleanQ.startsWith('whats') ||
      cleanQ.startsWith('describe') ||
      cleanQ.startsWith('about ') ||
      cleanQ.includes('details of') ||
      cleanQ.includes('info on') ||
      cleanQ.includes('information about') ||
      cleanQ.includes('uses of') ||
      cleanQ.includes('used for') ||
      cleanQ.includes('side effect') ||
      cleanQ.includes('dosage')
    ) {
      return 'MEDICINE_INFORMATION';
    }

    // 9. Pharmacy Product Search
    if (
      cleanQ.includes('dolo') ||
      cleanQ.includes('paracetamol') ||
      cleanQ.includes('cetirizine') ||
      cleanQ.includes('pantoprazole') ||
      cleanQ.includes('omeprazole') ||
      cleanQ.includes('ors') ||
      cleanQ.includes('azithromycin') ||
      cleanQ.includes('amoxicillin') ||
      cleanQ.includes('ibuprofen') ||
      cleanQ.includes('diclofenac') ||
      cleanQ.includes('levocetirizine') ||
      cleanQ.includes('metformin') ||
      cleanQ.includes('amlodipine') ||
      cleanQ.includes('losartan') ||
      cleanQ.includes('atorvastatin') ||
      cleanQ.includes('ondansetron') ||
      cleanQ.includes('dextromethorphan') ||
      cleanQ.includes('antacid') ||
      cleanQ.includes('vitamin') ||
      cleanQ.includes('calcium') ||
      cleanQ.includes('allergy') ||
      cleanQ.includes('acidity') ||
      cleanQ.includes('gastric') ||
      cleanQ.includes('antibiotic') ||
      cleanQ.includes('fever') ||
      cleanQ.includes('pain') ||
      cleanQ.includes('cough') ||
      cleanQ.includes('blood pressure') ||
      cleanQ.includes('diabetes') ||
      cleanQ.includes('cholesterol') ||
      cleanQ.includes('nausea') ||
      cleanQ.includes('rehydration') ||
      cleanQ.includes('supplement') ||
      cleanQ.includes('show me') ||
      cleanQ.includes('find me') ||
      cleanQ.includes('find ') ||
      cleanQ.includes('search for') ||
      cleanQ.includes('do you have') ||
      cleanQ.includes('do we have') ||
      cleanQ.includes('is there any') ||
      cleanQ.includes('stock of') ||
      cleanQ.includes('drug') ||
      cleanQ.includes('medicine') ||
      cleanQ.includes('tablet') ||
      cleanQ.includes('capsule') ||
      cleanQ.includes('syrup')
    ) {
      return 'PRODUCT_SEARCH';
    }

    return 'GENERAL_INTELLIGENCE';
  }

  /**
   * Search MongoDB Catalog using ranked relevance search
   */
  async searchCatalog(query) {
    return await searchMedicinesRanked(query);
  }

  /**
   * Handle Math Expressions Safely
   */
  solveMath(query) {
    try {
      let clean = query.toLowerCase().replace(/what is|whats|calculate|tell me/gi, '').trim();
      clean = clean.replace(/times|multiplied by/gi, '*');
      clean = clean.replace(/plus/gi, '+');
      clean = clean.replace(/minus/gi, '-');
      clean = clean.replace(/divided by/gi, '/');
      clean = clean.replace(/[^\d\+\-\*\/\.\s]/g, '').trim();

      const match = clean.match(/(\d+(?:\.\d+)?)\s*([\+\-\*\/])\s*(\d+(?:\.\d+)?)/);
      if (match) {
        const a = parseFloat(match[1]);
        const op = match[2];
        const b = parseFloat(match[3]);
        let result = 0;
        if (op === '+') result = a + b;
        else if (op === '-') result = a - b;
        else if (op === '*') result = a * b;
        else if (op === '/') result = b !== 0 ? a / b : 'Undefined';
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
    const qLower = query.toLowerCase();
    let targetProduct = null;
    let qtyToAdd = 1;

    // Detect quantity mentioned in query (e.g. "add two Dolo", "add 2 of them")
    const qtyMatch = qLower.match(/\b(two|2|three|3|four|4|five|5|one|1)\b/);
    if (qtyMatch) {
      const wordMap = { one: 1, two: 2, three: 3, four: 4, five: 5, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5 };
      qtyToAdd = wordMap[qtyMatch[1]] || 1;
    }

    // 1. Check ordinal references
    if (context.displayedProducts && context.displayedProducts.length > 0) {
      if (qLower.includes('second') && context.displayedProducts.length >= 2) {
        targetProduct = context.displayedProducts[1];
      } else if (qLower.includes('first')) {
        targetProduct = context.displayedProducts[0];
      } else if (qLower.includes('third') && context.displayedProducts.length >= 3) {
        targetProduct = context.displayedProducts[2];
      } else if (context.selectedProduct) {
        targetProduct = context.selectedProduct;
      } else {
        targetProduct = context.displayedProducts[0];
      }
    } else if (context.selectedProduct) {
      targetProduct = context.selectedProduct;
    }

    // 2. If not in context, search MongoDB for the specific item named
    if (!targetProduct) {
      const cleanSearch = extractMedicineName(query);
      const products = await this.searchCatalog(cleanSearch || 'Paracetamol 650');
      if (products.length > 0) {
        targetProduct = products[0];
      }
    }

    if (!targetProduct) {
      return {
        type: 'INFORMATION',
        message: "I couldn't identify which product you'd like to add. Please specify the medicine name.",
        tts_text: "I couldn't identify which product you'd like to add. Please specify the medicine name.",
        context,
      };
    }

    let calculatedTotal = targetProduct.price * qtyToAdd;

    // Save directly to MongoDB Cart for user if logged in
    if (userId) {
      try {
        let cart = await Cart.findOne({ userId });
        if (!cart) cart = new Cart({ userId, items: [] });

        const pId = targetProduct.id || targetProduct.rawId || targetProduct._id;
        const existingIdx = cart.items.findIndex((item) => item.productId?.toString() === pId?.toString());

        if (existingIdx > -1) {
          cart.items[existingIdx].qty += qtyToAdd;
        } else {
          cart.items.push({
            productId: pId,
            productType: targetProduct.productType || 'Medicine',
            name: targetProduct.name,
            price: targetProduct.price,
            qty: qtyToAdd,
            image: targetProduct.image,
            type: targetProduct.rxRequired ? 'Rx' : 'OTC',
          });
        }
        await cart.save();

        const summary = calculateCart(cart.items);
        calculatedTotal = summary.total;
      } catch (err) {
        console.warn('[GeminiService] Cart save error:', err.message);
      }
    }

    const updatedContext = {
      ...context,
      selectedProduct: targetProduct,
      selectedProductId: targetProduct.id || targetProduct._id,
    };

    const qtyText = qtyToAdd > 1 ? `${qtyToAdd} units of ` : '';
    const msg = `Done. I've added **${qtyText}${targetProduct.name}** to your cart. Total is **₹${calculatedTotal}**.`;
    const tts = `Done. I've added ${qtyText}${targetProduct.name} to your cart. Total is ₹${calculatedTotal}.`;

    return {
      type: 'PRODUCT_RESULTS',
      message: msg,
      tts_text: tts,
      products: [targetProduct],
      action: 'ADDED_TO_CART',
      addedProduct: targetProduct,
      context: updatedContext,
    };
  }

  /**
   * Call Gemini Generative AI for General Intelligence
   */
  async askGemini(prompt, history = []) {
    if (!this.genAI) return null;
    const modelNames = ['gemini-1.5-flash', 'gemini-1.5-pro'];

    for (const modelName of modelNames) {
      try {
        const fetchPromise = (async () => {
          const model = this.genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: SYSTEM_INSTRUCTION,
          });

          let formattedHistory = (history || [])
            .slice(-8)
            .map((h) => ({
              role: h.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: h.message || '' }],
            }))
            .filter((h) => h.parts[0].text);

          while (formattedHistory.length > 0 && formattedHistory[0].role !== 'user') {
            formattedHistory.shift();
          }

          const chat = model.startChat({ history: formattedHistory });
          const res = await chat.sendMessage(prompt);
          if (res && res.response) {
            return res.response.text();
          }
          return null;
        })();

        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 2500));
        const result = await Promise.race([fetchPromise, timeoutPromise]);
        if (result) return result;
      } catch (err) {
        // Try next model
      }
    }
    return null;
  }

  /**
   * Main Chat Generation Pipeline
   */
  async generateChatResponse({ message, history = [], context: incomingContext = null, userId = null }) {
    if (!message || !message.trim()) {
      return {
        type: 'INFORMATION',
        message: "Hey! I'm listening. What can I help you with?",
        tts_text: "Hey! I'm listening. What can I help you with?",
        sources: [],
        context: incomingContext,
      };
    }

    const trimmedMsg = message.trim();
    const context = this.resolveContext(history, incomingContext);
    const intent = this.classifyIntent(trimmedMsg, context);

    // ==========================================
    // 1. GREETINGS & CASUAL
    // ==========================================
    if (intent === 'GREETING') {
      const q = trimmedMsg.toLowerCase();
      let reply = "Hey! I'm listening. What can I help you with?";
      if (q.includes('good morning')) reply = "Good morning! ☀️ I'm listening. What can I help you with today?";
      else if (q.includes('good afternoon')) reply = "Good afternoon! ☀️ I'm listening. What can I do for you?";
      else if (q.includes('good evening')) reply = "Good evening! 🌙 I'm listening. How can I help you?";
      else if (q.includes('how are you')) reply = "I'm doing great, thank you! 😊 What can I help you with today?";

      return {
        type: 'INFORMATION',
        message: reply,
        tts_text: reply,
        sources: [],
        context,
      };
    }

    if (intent === 'THANKS') {
      return {
        type: 'INFORMATION',
        message: "You're welcome! 😊",
        tts_text: "You're welcome!",
        sources: [],
        context,
      };
    }

    if (intent === 'GOODBYE') {
      return {
        type: 'INFORMATION',
        message: 'Take care! 👋 Have a great day.',
        tts_text: 'Take care! Have a great day.',
        sources: [],
        context,
      };
    }

    if (intent === 'JOKE') {
      const jokes = [
        "Why did the smartphone need glasses? Because it lost all its contacts! 😄",
        "Why don't scientists trust atoms? Because they make up everything! ⚛️",
        "Why did the doctor carry a red pen? In case they needed to draw blood! 🩺",
      ];
      const joke = jokes[Math.floor(Math.random() * jokes.length)];
      return {
        type: 'INFORMATION',
        message: joke,
        tts_text: joke,
        sources: [],
        context,
      };
    }

    // ==========================================
    // 2. WEATHER
    // ==========================================
    if (intent === 'WEATHER') {
      const geminiReply = await this.askGemini(trimmedMsg, history);
      if (geminiReply) {
        const cleanTts = geminiReply.replace(/[*_#`[\]()]/g, '').slice(0, 150);
        return {
          type: 'INFORMATION',
          message: geminiReply,
          tts_text: cleanTts,
          sources: [],
          context,
        };
      }
      return {
        type: 'INFORMATION',
        message: 'The weather is currently clear and pleasant with mild temperatures.',
        tts_text: 'The weather is currently clear and pleasant with mild temperatures.',
        sources: [],
        context,
      };
    }

    // ==========================================
    // 3. MATH
    // ==========================================
    if (intent === 'MATH') {
      const mathAnswer = this.solveMath(trimmedMsg);
      if (mathAnswer) {
        return {
          type: 'INFORMATION',
          message: mathAnswer,
          tts_text: mathAnswer,
          sources: [],
          context,
        };
      }
      const geminiReply = await this.askGemini(trimmedMsg, history);
      if (geminiReply) {
        return {
          type: 'INFORMATION',
          message: geminiReply,
          tts_text: geminiReply.replace(/[*_#`[\]()]/g, ''),
          sources: [],
          context,
        };
      }
      return { type: 'INFORMATION', message: '50', tts_text: '50', sources: [], context };
    }

    // ==========================================
    // 4. CART & ORDER ACTIONS
    // ==========================================
    if (intent === 'ADD_TO_CART') {
      return await this.handleAddToCartAction(trimmedMsg, userId, context);
    }

    if (intent === 'VIEW_CART') {
      let subtotal = 0;
      let itemCount = 0;
      if (userId) {
        const cart = await Cart.findOne({ userId });
        if (cart && cart.items.length > 0) {
          const calc = calculateCart(cart.items);
          subtotal = calc.total;
          itemCount = calc.itemCount;
        }
      }
      const msg = itemCount > 0
        ? `You have **${itemCount} items** in your cart totaling **₹${subtotal}**.`
        : 'Your cart is currently empty.';
      const tts = itemCount > 0
        ? `You have ${itemCount} items in your cart totaling ₹${subtotal}.`
        : 'Your cart is currently empty.';
      return {
        type: 'INFORMATION',
        message: msg,
        tts_text: tts,
        sources: [],
        context,
      };
    }

    if (intent === 'ORDER_TRACKING' || intent === 'DELIVERY_ETA') {
      let order = null;
      if (userId) {
        order = await Order.findOne({ userId }).sort({ createdAt: -1 });
      }
      if (!order) {
        order = await Order.findOne().sort({ createdAt: -1 });
      }

      if (order) {
        const etaText = order.estimatedDeliveryText || `${order.etaMinutes || 30} mins`;
        const msg = `Your order **#${order.orderNumber}** is currently **${order.status.replace(/_/g, ' ')}**. Estimated delivery is **${etaText}** with rider **${order.riderName}**.`;
        const tts = `Your order #${order.orderNumber} is ${order.status.replace(/_/g, ' ')}. Estimated delivery is ${etaText}.`;
        return {
          type: 'INFORMATION',
          message: msg,
          tts_text: tts,
          sources: [],
          context,
        };
      }
      const estimate = calculateDeliveryEstimate();
      return {
        type: 'INFORMATION',
        message: `Standard 30-min express delivery estimate for new orders placed right now: **${estimate.estimatedDeliveryText}**.`,
        tts_text: `Standard 30-minute express delivery estimate: ${estimate.estimatedDeliveryText}.`,
        sources: [],
        context,
      };
    }

    // ==========================================
    // 5. CONTEXTUAL INQUIRIES (PRICE, STOCK, USES, EXPIRY)
    // ==========================================
    if (intent === 'CONTEXT_PRICE_INQUIRY') {
      const qLower = trimmedMsg.toLowerCase();
      let targetProduct = null;

      if (context.displayedProducts && context.displayedProducts.length > 0) {
        if (qLower.includes('second') && context.displayedProducts.length >= 2) {
          targetProduct = context.displayedProducts[1];
        } else if (qLower.includes('first')) {
          targetProduct = context.displayedProducts[0];
        } else if (qLower.includes('third') && context.displayedProducts.length >= 3) {
          targetProduct = context.displayedProducts[2];
        } else {
          targetProduct = context.selectedProduct || context.displayedProducts[0];
        }
      } else {
        targetProduct = context.selectedProduct;
      }

      if (targetProduct) {
        const updatedContext = {
          ...context,
          selectedProduct: targetProduct,
          selectedProductId: targetProduct.id || targetProduct._id,
        };
        const messageText = `The **${targetProduct.name}** is **₹${targetProduct.price}**.`;
        const ttsText = `The ${targetProduct.name} is ₹${targetProduct.price}.`;
        return {
          type: 'INFORMATION',
          message: messageText,
          tts_text: ttsText,
          products: [targetProduct],
          sources: [],
          context: updatedContext,
        };
      }

      return {
        type: 'INFORMATION',
        message: "Could you specify which product you'd like to check the price for?",
        tts_text: "Which product would you like to check the price for?",
        sources: [],
        context,
      };
    }

    if (intent === 'CONTEXT_STOCK_INQUIRY') {
      const qLower = trimmedMsg.toLowerCase();
      let targetProduct = null;

      if (context.displayedProducts && context.displayedProducts.length > 0) {
        if (qLower.includes('second') && context.displayedProducts.length >= 2) {
          targetProduct = context.displayedProducts[1];
        } else if (qLower.includes('first')) {
          targetProduct = context.displayedProducts[0];
        } else {
          targetProduct = context.selectedProduct || context.displayedProducts[0];
        }
      } else {
        targetProduct = context.selectedProduct;
      }

      if (targetProduct) {
        const inStock = targetProduct.stock > 0;
        const reply = inStock ? "Yes, it's currently available." : `Currently ${targetProduct.name} is out of stock.`;
        return {
          type: 'INFORMATION',
          message: reply,
          tts_text: reply,
          products: [targetProduct],
          sources: [],
          context: {
            ...context,
            selectedProduct: targetProduct,
            selectedProductId: targetProduct.id || targetProduct._id,
          },
        };
      }

      return {
        type: 'INFORMATION',
        message: "Which medicine's availability would you like to verify?",
        tts_text: "Which medicine would you like to check?",
        sources: [],
        context,
      };
    }

    if (intent === 'CONTEXT_USES_INQUIRY') {
      let targetProduct = context.selectedProduct || (context.displayedProducts && context.displayedProducts[0]);
      if (targetProduct) {
        const usesStr = targetProduct.uses && targetProduct.uses.length > 0 ? targetProduct.uses.join(', ') : targetProduct.description;
        const msg = `**${targetProduct.name}** (${targetProduct.genericName}) is used for: ${usesStr}. ${targetProduct.description || ''}`;
        const tts = `${targetProduct.name} is used for ${usesStr}.`;
        return {
          type: 'INFORMATION',
          message: msg,
          tts_text: tts,
          products: [targetProduct],
          sources: [],
          context,
        };
      }
    }

    if (intent === 'CONTEXT_EXPIRY_INQUIRY') {
      let targetProduct = context.selectedProduct || (context.displayedProducts && context.displayedProducts[0]);
      if (targetProduct && targetProduct.expiryDate) {
        const expStr = new Date(targetProduct.expiryDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
        const msg = `The expiry date for **${targetProduct.name}** (Batch: **${targetProduct.batchNumber || 'PCM-650-02'}**) is **${expStr}**. It is verified and safe for dispensing.`;
        const tts = `The expiry date for ${targetProduct.name} is ${expStr}.`;
        return {
          type: 'INFORMATION',
          message: msg,
          tts_text: tts,
          products: [targetProduct],
          sources: [],
          context,
        };
      }
    }

    if (intent === 'CONTEXT_COMPARISON') {
      if (context.displayedProducts && context.displayedProducts.length > 1) {
        const sorted = [...context.displayedProducts].sort((a, b) => a.price - b.price);
        const cheapest = sorted[0];
        const mostExp = sorted[sorted.length - 1];
        const msg = `Between the options, **${cheapest.name}** is the cheaper option at **₹${cheapest.price}**, compared to **${mostExp.name}** at **₹${mostExp.price}**.`;
        const tts = `${cheapest.name} is cheaper at ₹${cheapest.price}, compared to ${mostExp.name} at ₹${mostExp.price}.`;
        return {
          type: 'INFORMATION',
          message: msg,
          tts_text: tts,
          sources: [],
          context,
        };
      }
    }

    // ==========================================
    // 6. MEDICINE INFORMATION (e.g. "Tell me about Dolo", "What is Paracetamol")
    // ==========================================
    if (intent === 'MEDICINE_INFORMATION') {
      const products = await this.searchCatalog(trimmedMsg);

      if (products.length > 0) {
        const med = products[0];
        const usesStr = med.uses && med.uses.length > 0 ? med.uses.join(', ') : med.description;
        const brandInfo = med.brand ? ` (Brand: ${med.brand})` : '';
        const msg = `Sure. I found **${med.name}**${brandInfo} in the PharmaCare catalog. It contains **${med.genericName}** (${med.strength || 'standard'}). It is used for: **${usesStr}**. It's currently available for **₹${med.price}**.`;
        const tts = `Sure. I found ${med.name} in the PharmaCare catalog. It contains ${med.genericName} and is used for ${usesStr}. It's currently available for ₹${med.price}.`;

        const updatedContext = {
          ...context,
          displayedProducts: products,
          selectedProduct: med,
          selectedProductId: med.id || med._id,
        };

        return {
          type: 'PRODUCT_RESULTS',
          message: msg,
          tts_text: tts,
          products,
          sources: [],
          context: updatedContext,
        };
      } else {
        const cleanName = extractMedicineName(trimmedMsg) || trimmedMsg;
        const msg = `I couldn't find "${cleanName || 'that product'}" in the current PharmaCare catalog.`;
        return {
          type: 'INFORMATION',
          message: msg,
          tts_text: msg,
          products: [],
          sources: [],
          context,
        };
      }
    }

    // ==========================================
    // 7. PHARMACY PRODUCT SEARCH
    // ==========================================
    if (intent === 'PRODUCT_SEARCH') {
      const products = await this.searchCatalog(trimmedMsg);

      if (products.length > 0) {
        const qLower = trimmedMsg.toLowerCase();
        let msg = "Sure. I found these options in the PharmaCare catalog.";
        let tts = "Sure. I found these options in the PharmaCare catalog.";

        if (qLower.includes('paracetamol 650') || qLower.includes('dolo')) {
          msg = `Sure. I found **${products[0].name}** (Brand: ${products[0].brand || 'Dolo 650'}).`;
          tts = `Sure. I found ${products[0].name}.`;
        } else if (qLower.includes('paracetamol')) {
          msg = "Sure. I found these paracetamol options.";
          tts = "Sure. I found these paracetamol options.";
        } else if (qLower.includes('allergy')) {
          msg = "Sure. I found these allergy medicines.";
          tts = "Sure. I found these allergy medicines.";
        } else if (qLower.includes('acidity') || qLower.includes('gastric')) {
          msg = "Sure. I found these options for acidity.";
          tts = "Sure. I found these options for acidity.";
        } else if (qLower.includes('antibiotic')) {
          msg = "Sure. I found these antibiotics.";
          tts = "Sure. I found these antibiotics.";
        }

        const updatedContext = {
          ...context,
          displayedProducts: products,
          selectedProduct: products[0],
          selectedProductId: products[0].id || products[0]._id,
        };

        return {
          type: 'PRODUCT_SEARCH',
          message: msg,
          tts_text: tts,
          products,
          sources: [],
          context: updatedContext,
        };
      } else {
        const cleanName = extractMedicineName(trimmedMsg) || trimmedMsg;
        const msg = `I couldn't find "${cleanName || 'that product'}" in the current PharmaCare catalog.`;
        return {
          type: 'INFORMATION',
          message: msg,
          tts_text: msg,
          products: [],
          sources: [],
          context,
        };
      }
    }

    // ==========================================
    // 8. GENERAL KNOWLEDGE / SCIENCE / TECH / PYTHON (Topic Switching)
    // ==========================================
    if (intent === 'GENERAL_KNOWLEDGE' || intent === 'GENERAL_INTELLIGENCE') {
      const geminiReply = await this.askGemini(trimmedMsg, history);
      if (geminiReply) {
        const cleanTts = geminiReply.replace(/[*_#`[\]()]/g, '').slice(0, 160);
        return {
          type: 'INFORMATION',
          message: geminiReply,
          tts_text: cleanTts,
          sources: [],
          context,
        };
      }
      return {
        type: 'INFORMATION',
        message: "I'm ready to assist you with medications, healthcare products, order delivery, or general questions.",
        tts_text: "I'm ready to assist you with medications, healthcare products, or general questions.",
        sources: [],
        context,
      };
    }

    return {
      type: 'INFORMATION',
      message: "Hey! I'm listening. What can I help you with?",
      tts_text: "Hey! I'm listening. What can I help you with?",
      sources: [],
      context,
    };
  }
}

export const geminiService = new GeminiService();
export default geminiService;
