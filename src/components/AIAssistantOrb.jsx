import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import api from '../services/api';

const FALLBACK_MED_IMG = "data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3e%3crect width='100' height='100' fill='%23f1f5f9' rx='12'/%3e%3cpath d='M50 30v40M30 50h40' stroke='%235444ca' stroke-width='6' stroke-linecap='round'/%3e%3c/svg%3e";

export const AIAssistantOrb = () => {
  const navigate = useNavigate();
  const { aiState, setAiState, addToCart, loadActiveOrder, loadCart, loadDashboardSummary } = useApp();
  const [queryText, setQueryText] = useState('');
  const [responseMessage, setResponseMessage] = useState(null);
  const [aiProducts, setAiProducts] = useState([]);
  const [sources, setSources] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [addedItemName, setAddedItemName] = useState(null);

  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);

  const states = [
    { id: 'ready', label: 'Ready to help', color: 'bg-secondary' },
    { id: 'listening', label: 'Listening...', color: 'bg-emerald-500' },
    { id: 'thinking', label: 'Thinking...', color: 'bg-amber-500' },
    { id: 'speaking', label: 'Speaking...', color: 'bg-purple-500' },
  ];

  // ---------------------------------------------------------------------------
  // Web Speech API Voice Recognition
  // ---------------------------------------------------------------------------
  const startListening = () => {
    setAiState('listening');
    isListeningRef.current = true;
    setResponseMessage(null);
    setAiProducts([]);
    setSources([]);

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.lang = 'en-IN';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          isListeningRef.current = false;
          setQueryText(transcript);
          handleProcessVoiceQuery(transcript);
        };

        recognition.onerror = (e) => {
          console.warn('Speech recognition error:', e.error);
          isListeningRef.current = false;
          setAiState('ready');
        };

        recognition.onend = () => {
          if (isListeningRef.current) {
            isListeningRef.current = false;
            setAiState('thinking');
          }
        };

        recognition.start();
      } catch (err) {
        console.warn('Could not initialize speech recognition:', err);
        isListeningRef.current = false;
        setAiState('ready');
      }
    } else {
      setAiState('ready');
    }
  };

  const stopListening = () => {
    isListeningRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore
      }
    }
  };

  // ---------------------------------------------------------------------------
  // Send Voice / Chat Query to Gemini Backend
  // ---------------------------------------------------------------------------
  const handleProcessVoiceQuery = async (inputText) => {
    const textToSend = inputText || queryText;
    if (!textToSend.trim()) return;

    stopListening();
    setAiState('thinking');
    setQueryText('');
    setAiProducts([]);
    setSources([]);

    const updatedHistory = [
      ...chatHistory,
      { role: 'user', message: textToSend, products: aiProducts },
    ];
    setChatHistory(updatedHistory);

    try {
      const res = await api.ai.chat({
        message: textToSend,
        history: updatedHistory.map((h) => ({ role: h.role, message: h.message, products: h.products })),
      });

      const messageText = res.message || res.tts_text || 'I am ready to help you with medicines, vitamins, and healthcare.';
      setResponseMessage(messageText);

      // Handle direct Add-To-Cart action execution from AI
      if (res.action === 'ADDED_TO_CART' && res.addedProduct) {
        addToCart(res.addedProduct);
        loadCart();
        setAddedItemName(res.addedProduct.name);
        setTimeout(() => setAddedItemName(null), 3000);
      }

      if (res.products && Array.isArray(res.products) && res.products.length > 0) {
        setAiProducts(res.products);
      }

      if (res.sources && Array.isArray(res.sources)) {
        setSources(res.sources);
      }

      setChatHistory([
        ...updatedHistory,
        { role: 'assistant', message: messageText, products: res.products || [] },
      ]);

      setAiState('speaking');

      // Browser Text-To-Speech Synthesis
      if ('speechSynthesis' in window && messageText) {
        try {
          window.speechSynthesis.cancel();
          const cleanSpeech = messageText.replace(/[*_#`[\]()]/g, '');
          const utterance = new SpeechSynthesisUtterance(cleanSpeech);
          utterance.rate = 1.0;
          utterance.onend = () => setAiState('ready');
          utterance.onerror = () => setAiState('ready');
          window.speechSynthesis.speak(utterance);
        } catch {
          setTimeout(() => setAiState('ready'), 3500);
        }
      } else {
        setTimeout(() => setAiState('ready'), 3500);
      }
    } catch (err) {
      setResponseMessage(err.message || 'Error communicating with PharmaCare AI.');
      setAiState('ready');
    }
  };

  const handleOrbClick = () => {
    if (aiState === 'ready') {
      startListening();
    } else if (aiState === 'listening') {
      if (queryText) {
        handleProcessVoiceQuery(queryText);
      } else {
        setAiState('ready');
        stopListening();
      }
    } else if (aiState === 'speaking') {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      setAiState('ready');
    } else {
      setAiState('ready');
    }
  };

  return (
    <section className="relative overflow-hidden rounded-2xl bg-surface-container-lowest p-4 shadow-sm flex flex-col gap-4 border border-outline-variant/10">
      {/* Subtle Ambient Backdrop Accent */}
      <div 
        className="absolute -top-16 -right-16 w-44 h-44 rounded-full blur-3xl pointer-events-none opacity-40" 
        style={{ backgroundColor: 'rgba(84, 68, 202, 0.25)' }}
      ></div>
      <div 
        className="absolute -bottom-16 -left-16 w-44 h-44 rounded-full blur-3xl pointer-events-none opacity-40" 
        style={{ backgroundColor: 'rgba(104, 87, 219, 0.2)' }}
      ></div>

      <div className="flex flex-col items-center text-center gap-1 relative z-10">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-low border border-outline-variant/20">
          <span className="material-symbols-outlined text-secondary text-[14px]">neurology</span>
          <span className="font-label-sm text-label-sm text-on-surface-variant tracking-wider uppercase font-semibold text-[10px]">
            PHARMACARE AI • CLINICAL VOICE CORE
          </span>
        </div>
        <h2 className="font-headline-sm text-headline-sm text-primary font-bold mt-1">
          Your AI Health Assistant
        </h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant max-w-[290px]">
          Ask in English, தமிழ் (Tamil), or Tanglish
        </p>
      </div>

      {/* Interactive AI Status Tabs */}
      <div className="flex items-center justify-center gap-1 bg-surface-container-low p-1 rounded-xl mx-auto w-full max-w-[340px] relative z-10">
        {states.map((st) => {
          const isActive = aiState === st.id;
          return (
            <button
              key={st.id}
              onClick={() => {
                if (st.id === 'listening') startListening();
                else setAiState(st.id);
              }}
              className={`flex-1 py-1.5 px-2 rounded-lg font-label-sm text-label-sm font-semibold transition-all flex items-center justify-center gap-1.5 text-[11px] ${
                isActive
                  ? 'bg-surface-container-lowest text-primary shadow-sm ring-1 ring-primary/10'
                  : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? st.color : 'bg-outline-variant'}`}></span>
              {st.label}
            </button>
          );
        })}
      </div>

      {/* Center AI Glowing Orb Experience */}
      <div className="relative flex flex-col items-center justify-center py-4 z-10">
        {/* Rotating Dash Ring SVG */}
        <svg 
          className={`absolute w-44 h-44 ${aiState === 'thinking' ? 'animate-[spin_4s_linear_infinite]' : 'animate-[spin_16s_linear_infinite]'}`}
          style={{ color: aiState === 'listening' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(84, 68, 202, 0.3)' }} 
          viewBox="0 0 100 100"
        >
          <circle cx="50" cy="50" fill="none" r="46" stroke="currentColor" strokeDasharray="4 6" strokeWidth="1.5"></circle>
        </svg>

        {/* Outer Pulsing Halo */}
        <div 
          className={`absolute w-36 h-36 rounded-full opacity-30 ${aiState === 'listening' || aiState === 'speaking' ? 'animate-ping' : 'animate-pulse'}`}
          style={{ backgroundColor: aiState === 'listening' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(84, 68, 202, 0.35)' }}
        ></div>

        {/* Center Main Gradient Orb */}
        <div 
          className="relative w-28 h-28 rounded-full flex items-center justify-center shadow-[0_8px_32px_rgba(84,68,202,0.45)] cursor-pointer transition-transform hover:scale-105 active:scale-95"
          onClick={handleOrbClick}
          style={{ 
            background: aiState === 'listening' 
              ? 'radial-gradient(circle at 35% 30%, rgb(52, 211, 153) 0%, rgb(16, 185, 129) 40%, rgb(5, 150, 105) 100%)'
              : 'radial-gradient(circle at 35% 30%, rgb(139, 125, 248) 0%, rgb(104, 87, 219) 35%, rgb(84, 68, 202) 65%, rgb(53, 38, 151) 100%)'
          }}
        >
          <div className="w-20 h-20 rounded-full bg-gradient-to-b from-surface-container-lowest/20 to-transparent flex items-center justify-center backdrop-blur-sm">
            <span className="material-symbols-outlined text-surface-container-lowest text-[38px]">
              {aiState === 'listening' ? 'mic' : aiState === 'thinking' ? 'psychology' : aiState === 'speaking' ? 'volume_up' : 'graphic_eq'}
            </span>
          </div>
        </div>

        {/* Realtime Dynamic Voice Frequency Visualizer Bars */}
        <div className="flex items-end justify-center gap-1.5 h-6 mt-4">
          <span className={`w-1 rounded-full h-2 ${aiState !== 'ready' ? 'animate-bounce' : ''}`} style={{ backgroundColor: '#7b6ee6' }}></span>
          <span className={`w-1 rounded-full h-5 ${aiState !== 'ready' ? 'animate-bounce [animation-delay:-0.2s]' : ''}`} style={{ backgroundColor: '#5444ca' }}></span>
          <span className={`w-1 rounded-full h-3 ${aiState !== 'ready' ? 'animate-bounce [animation-delay:-0.4s]' : ''}`} style={{ backgroundColor: '#3b2e96' }}></span>
          <span className={`w-1 rounded-full h-6 ${aiState !== 'ready' ? 'animate-bounce [animation-delay:-0.1s]' : ''}`} style={{ backgroundColor: '#a296ff' }}></span>
          <span className={`w-1 rounded-full h-4 ${aiState !== 'ready' ? 'animate-bounce [animation-delay:-0.3s]' : ''}`} style={{ backgroundColor: '#5444ca' }}></span>
          <span className={`w-1 rounded-full h-2 ${aiState !== 'ready' ? 'animate-bounce [animation-delay:-0.5s]' : ''}`} style={{ backgroundColor: '#7b6ee6' }}></span>
        </div>

        {/* Status / Response Message Block */}
        <div className="mt-3 text-center w-full max-w-[340px] px-1">
          {responseMessage ? (
            <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/15 text-left flex flex-col gap-2 shadow-sm">
              <span className="font-body-sm text-xs text-on-surface font-medium leading-relaxed block whitespace-pre-wrap">
                {responseMessage}
              </span>

              {/* Web Grounding Sources */}
              {sources.length > 0 && (
                <div className="mt-1 pt-2 border-t border-outline-variant/20 flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-secondary uppercase tracking-wider flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">public</span>
                    Verified Sources
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {sources.map((src, i) => (
                      <a
                        key={i}
                        href={src.uri}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-primary bg-primary-container/20 px-2 py-0.5 rounded-full hover:underline truncate max-w-[220px]"
                      >
                        {src.title || src.uri}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <span className="font-label-sm text-label-sm font-semibold text-primary text-[12px] block">
              {aiState === 'ready' && '"Ask: Show me Paracetamol, Vitamin D, or Where is my order?"'}
              {aiState === 'listening' && 'Listening to your voice...'}
              {aiState === 'thinking' && 'Connecting to PharmaCare AI...'}
              {aiState === 'speaking' && 'Speaking response...'}
            </span>
          )}
        </div>
      </div>

      {/* Added to Cart Success Banner */}
      {addedItemName && (
        <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1.5 animate-bounce">
          <span className="material-symbols-outlined text-[16px]">check_circle</span>
          <span>Added {addedItemName} to cart!</span>
        </div>
      )}

      {/* Structured AI Product Search Result Cards with Valid Images */}
      {aiProducts.length > 0 && (
        <div className="flex flex-col gap-2 relative z-10 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-primary flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-secondary">inventory_2</span>
              Recommended Catalog Products
            </span>
            <span className="text-[10px] font-bold text-secondary bg-secondary-container/40 px-2 py-0.5 rounded-full">
              {aiProducts.length} Available
            </span>
          </div>

          <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto pr-1">
            {aiProducts.map((p) => (
              <div
                key={p.id || p.rawId || p._id}
                className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/20 shadow-sm flex items-center justify-between gap-3 hover:shadow-md transition-all"
              >
                <div
                  className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                  onClick={() => navigate(`/product/${p.id || p.rawId || p._id}`)}
                >
                  <img
                    src={p.image || FALLBACK_MED_IMG}
                    alt={p.name}
                    onError={(e) => { e.target.src = FALLBACK_MED_IMG; }}
                    className="w-14 h-14 rounded-lg object-cover bg-surface-container-low shrink-0 border border-outline-variant/10"
                  />
                  <div className="flex flex-col min-w-0">
                    <h4 className="font-bold text-xs text-primary truncate hover:underline">{p.name}</h4>
                    {p.genericName && (
                      <span className="text-[10px] font-semibold text-secondary truncate">
                        {p.genericName}
                      </span>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-bold text-xs text-primary">₹{p.price}</span>
                      <span className="text-[10px] font-semibold text-emerald-600">
                        {p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => addToCart(p)}
                  disabled={p.stock <= 0 || p.expiryStatus === 'EXPIRED'}
                  className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-bold shadow-sm hover:bg-primary/90 transition-all flex items-center gap-1 shrink-0 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[14px]">add_shopping_cart</span>
                  Add
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Multilingual Voice / Text Prompt Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleProcessVoiceQuery(queryText);
        }}
        className="flex items-center gap-2 pt-1 relative z-10"
      >
        <input
          type="text"
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          placeholder="Ask e.g. 'Show me Paracetamol' or 'Where is my order?'"
          className="flex-1 py-2 px-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="submit"
          className="w-8 h-8 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-sm shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">send</span>
        </button>
      </form>
    </section>
  );
};

export default AIAssistantOrb;
