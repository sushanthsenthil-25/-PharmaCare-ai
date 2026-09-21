import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import api from '../services/api';

const IMAGE_UNAVAILABLE_IMG = "data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3e%3crect width='100' height='100' fill='%23f8fafc' rx='12' stroke='%23e2e8f0' stroke-width='1.5'/%3e%3cpath d='M32 46l10-10 18 18 10-10 14 14H30z' fill='%23cbd5e1'/%3e%3ccircle cx='40' cy='34' r='4' fill='%2394a3b8'/%3e%3ctext x='50' y='76' font-family='system-ui, sans-serif' font-size='8' font-weight='600' fill='%2394a3b8' text-anchor='middle'%3eImage unavailable%3c/text%3e%3c/svg%3e";

export const AIAssistantOrb = () => {
  const navigate = useNavigate();
  const { aiState, setAiState, addToCart, loadCart, openCart } = useApp();
  const [queryText, setQueryText] = useState('');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [responseMessage, setResponseMessage] = useState(null);
  const [aiProducts, setAiProducts] = useState([]);
  const [sources, setSources] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [conversationContext, setConversationContext] = useState(null);
  const [conversationId] = useState(() => `conv_${Date.now()}_${Math.random().toString(36).substring(7)}`);
  const [addedItemName, setAddedItemName] = useState(null);
  const [micPermissionError, setMicPermissionError] = useState(null);

  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const silenceTimerRef = useRef(null);
  const currentTranscriptRef = useRef('');

  const states = [
    { id: 'ready', label: 'Ready to help', color: 'bg-secondary' },
    { id: 'listening', label: 'Listening...', color: 'bg-emerald-500' },
    { id: 'thinking', label: 'Thinking...', color: 'bg-amber-500' },
    { id: 'speaking', label: 'Speaking...', color: 'bg-purple-500' },
  ];

  // Clean up timers & speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Normalize numbers and common speech variations
  const normalizeSpeech = (text) => {
    if (!text) return '';
    let t = text.trim();
    t = t.replace(/\bsix fifty\b/gi, '650');
    t = t.replace(/\bfive hundred\b/gi, '500');
    t = t.replace(/\bforty\b/gi, '40');
    t = t.replace(/\btwenty\b/gi, '20');
    t = t.replace(/\bthirty\b/gi, '30');
    t = t.replace(/\bfifty\b/gi, '50');
    t = t.replace(/\bten\b/gi, '10');
    t = t.replace(/\bfive\b/gi, '5');
    t = t.replace(/\bfour\b/gi, '4');
    return t;
  };

  // ---------------------------------------------------------------------------
  // Web Speech API Voice Recognition Pipeline
  // ---------------------------------------------------------------------------
  const startListening = async () => {
    setMicPermissionError(null);

    // Echo prevention: Stop TTS if JARVIS is currently speaking
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMicPermissionError('Speech recognition is not supported in this browser. Please use Chrome, Edge, or type your message.');
      setAiState('ready');
      return;
    }

    // Request microphone permission cleanly first
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Close test stream tracks immediately after permission granted
        stream.getTracks().forEach((track) => track.stop());
      } catch (permErr) {
        console.warn('Microphone permission denied/unavailable:', permErr);
        setMicPermissionError('Microphone access is required for voice conversations. Please allow microphone access in your browser/device settings.');
        setAiState('ready');
        return;
      }
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = 'en-IN';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      currentTranscriptRef.current = '';
      setLiveTranscript('');
      setAiState('listening');
      isListeningRef.current = true;
      setResponseMessage(null);
      setAiProducts([]);
      setSources([]);

      recognition.onresult = (event) => {
        let interimText = '';
        let finalText = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalText += event.results[i][0].transcript;
          } else {
            interimText += event.results[i][0].transcript;
          }
        }

        const combinedText = normalizeSpeech(finalText || interimText || (event.results[0] && event.results[0][0].transcript) || '');
        if (combinedText) {
          currentTranscriptRef.current = combinedText;
          setLiveTranscript(combinedText);
          setQueryText(combinedText);
        }

        // Reset silence timer on every new speech chunk
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          if (isListeningRef.current && currentTranscriptRef.current.trim()) {
            const textToProcess = currentTranscriptRef.current.trim();
            stopListening();
            handleProcessQuery(textToProcess);
          }
        }, 1800);
      };

      recognition.onerror = (e) => {
        console.warn('Speech recognition event error:', e.error);
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          setMicPermissionError('Microphone access is required for voice conversations. Please allow microphone access in your browser/device settings.');
        } else if (e.error === 'audio-capture') {
          setMicPermissionError('No microphone was found. Ensure that a microphone is installed and microphone settings are configured.');
        } else if (e.error === 'network') {
          setMicPermissionError('Network speech recognition connection failed. Please check your internet connection or type below.');
        }

        if (e.error !== 'no-speech') {
          isListeningRef.current = false;
          setAiState('ready');
        }
      };

      recognition.onend = () => {
        if (isListeningRef.current) {
          if (currentTranscriptRef.current.trim()) {
            const captured = currentTranscriptRef.current.trim();
            isListeningRef.current = false;
            handleProcessQuery(captured);
          } else {
            isListeningRef.current = false;
            setAiState('ready');
          }
        }
      };

      recognition.start();
    } catch (err) {
      console.warn('Could not start speech recognition:', err);
      setMicPermissionError('Unable to start speech recognition. Please check your microphone permissions.');
      isListeningRef.current = false;
      setAiState('ready');
    }
  };

  const stopListening = () => {
    isListeningRef.current = false;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
  };

  // ---------------------------------------------------------------------------
  // Unified Backend Interaction (Voice + Text Share Exact Same Backend Pipeline)
  // ---------------------------------------------------------------------------
  const handleProcessQuery = async (inputText) => {
    const textToSend = inputText || queryText;
    if (!textToSend || !textToSend.trim()) return;

    stopListening();
    setAiState('thinking');
    setQueryText('');
    setLiveTranscript('');
    setMicPermissionError(null);

    const updatedHistory = [
      ...chatHistory,
      { role: 'user', message: textToSend.trim(), products: aiProducts },
    ];
    setChatHistory(updatedHistory);

    try {
      const res = await api.ai.chat({
        message: textToSend.trim(),
        conversationId,
        history: updatedHistory.map((h) => ({ role: h.role, message: h.message, products: h.products })),
        context: conversationContext,
      });

      const messageText = res.message || res.tts_text || "Hey! I'm listening. What can I help you with?";
      const ttsText = res.tts_text || messageText;

      setResponseMessage(messageText);

      // Update conversation context
      if (res.context) {
        setConversationContext(res.context);
      }

      // Handle direct Add-To-Cart action execution from JARVIS
      if (res.action === 'ADDED_TO_CART' && res.addedProduct) {
        addToCart(res.addedProduct);
        loadCart();
        setAddedItemName(res.addedProduct.name);
        setTimeout(() => setAddedItemName(null), 4000);
      }

      if (res.products && Array.isArray(res.products) && res.products.length > 0) {
        setAiProducts(res.products);
      } else if (res.type === 'PRODUCT_RESULTS' && res.products) {
        setAiProducts(res.products);
      }

      if (res.sources && Array.isArray(res.sources)) {
        setSources(res.sources);
      }

      setChatHistory([
        ...updatedHistory,
        { role: 'assistant', message: messageText, products: res.products || [] },
      ]);

      // Browser Text-To-Speech Synthesis with Echo Prevention
      if ('speechSynthesis' in window && ttsText) {
        try {
          window.speechSynthesis.cancel();
          setAiState('speaking');

          const cleanSpeech = ttsText.replace(/[*_#`[\]()]/g, '');
          const utterance = new SpeechSynthesisUtterance(cleanSpeech);
          utterance.rate = 1.0;
          utterance.pitch = 1.0;

          utterance.onend = () => {
            setAiState('ready');
          };

          utterance.onerror = () => {
            setAiState('ready');
          };

          window.speechSynthesis.speak(utterance);
        } catch {
          setAiState('ready');
        }
      } else {
        setAiState('ready');
      }
    } catch (err) {
      setResponseMessage(err.message || 'Error communicating with JARVIS.');
      setAiState('ready');
    }
  };

  // ---------------------------------------------------------------------------
  // Interactive Orb Click Handler (Supports Tap to Speak & Interrupting JARVIS)
  // ---------------------------------------------------------------------------
  const handleOrbClick = () => {
    if (aiState === 'ready') {
      startListening();
    } else if (aiState === 'listening') {
      if (currentTranscriptRef.current.trim() || queryText.trim()) {
        const text = currentTranscriptRef.current.trim() || queryText.trim();
        handleProcessQuery(text);
      } else {
        stopListening();
        setAiState('ready');
      }
    } else if (aiState === 'speaking') {
      // User Interruption: Immediately cancel speech and start listening to user's new request
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      startListening();
    } else if (aiState === 'thinking') {
      // Allow stopping during thinking
      setAiState('ready');
    }
  };

  return (
    <section className="relative overflow-hidden rounded-2xl bg-surface-container-lowest p-4 shadow-sm flex flex-col gap-4 border border-outline-variant/10" aria-label="JARVIS AI Assistant">
      {/* Ambient Backdrop Accent */}
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
          <span className="material-symbols-outlined text-secondary text-[14px]">smart_toy</span>
          <span className="font-label-sm text-label-sm text-on-surface-variant tracking-wider uppercase font-semibold text-[10px]">
            JARVIS • AI ASSISTANT
          </span>
        </div>
        <h2 className="font-headline-sm text-headline-sm text-primary font-bold mt-1">
          JARVIS
        </h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant max-w-[290px]">
          Ask in English, தமிழ் (Tamil), or Tanglish
        </p>
      </div>

      {/* Interactive AI Status Tabs */}
      <div className="flex items-center justify-center gap-1 bg-surface-container-low p-1 rounded-xl mx-auto w-full max-w-[340px] relative z-10" role="tablist" aria-label="JARVIS status">
        {states.map((st) => {
          const isActive = aiState === st.id;
          return (
            <button
              key={st.id}
              role="tab"
              aria-selected={isActive}
              aria-label={`JARVIS is ${st.label}`}
              onClick={() => {
                if (st.id === 'listening') startListening();
                else if (st.id === 'ready') {
                  stopListening();
                  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                  setAiState('ready');
                } else {
                  setAiState(st.id);
                }
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

      {/* Microphone Permission Warning Banner */}
      {micPermissionError && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-start gap-2 relative z-10">
          <span className="material-symbols-outlined text-[18px] text-amber-700 shrink-0 mt-0.5">warning</span>
          <div className="flex-1">
            <span className="font-bold block">Microphone Access Notice</span>
            <span>{micPermissionError}</span>
          </div>
          <button
            onClick={() => setMicPermissionError(null)}
            className="text-amber-700 hover:text-amber-900 font-bold ml-1 text-xs"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Center AI Glowing Orb Experience */}
      <div className="relative flex flex-col items-center justify-center py-4 z-10">
        {/* Rotating Dash Ring SVG */}
        <svg 
          className={`absolute w-44 h-44 ${aiState === 'thinking' ? 'animate-[spin_4s_linear_infinite]' : 'animate-[spin_16s_linear_infinite]'}`}
          style={{ color: aiState === 'listening' ? 'rgba(16, 185, 129, 0.4)' : aiState === 'speaking' ? 'rgba(168, 85, 247, 0.4)' : 'rgba(84, 68, 202, 0.3)' }} 
          viewBox="0 0 100 100"
        >
          <circle cx="50" cy="50" fill="none" r="46" stroke="currentColor" strokeDasharray="4 6" strokeWidth="1.5"></circle>
        </svg>

        {/* Outer Pulsing Halo */}
        <div 
          className={`absolute w-36 h-36 rounded-full opacity-30 ${aiState === 'listening' || aiState === 'speaking' ? 'animate-ping' : 'animate-pulse'}`}
          style={{ backgroundColor: aiState === 'listening' ? 'rgba(16, 185, 129, 0.35)' : aiState === 'speaking' ? 'rgba(168, 85, 247, 0.35)' : 'rgba(84, 68, 202, 0.35)' }}
        ></div>

        {/* Center Main Gradient Orb with Tap/Interrupt Action */}
        <div 
          className="relative w-28 h-28 rounded-full flex items-center justify-center shadow-[0_8px_32px_rgba(84,68,202,0.45)] cursor-pointer transition-transform hover:scale-105 active:scale-95"
          onClick={handleOrbClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleOrbClick(); }}
          aria-label={aiState === 'listening' ? 'JARVIS is listening, tap to process' : aiState === 'speaking' ? 'JARVIS is speaking, tap to interrupt and speak' : 'Tap to speak to JARVIS'}
          style={{ 
            background: aiState === 'listening' 
              ? 'radial-gradient(circle at 35% 30%, rgb(52, 211, 153) 0%, rgb(16, 185, 129) 40%, rgb(5, 150, 105) 100%)'
              : aiState === 'speaking'
              ? 'radial-gradient(circle at 35% 30%, rgb(192, 132, 252) 0%, rgb(168, 85, 247) 40%, rgb(126, 34, 206) 100%)'
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
        <div className="flex items-end justify-center gap-1.5 h-6 mt-4" aria-hidden="true">
          <span className={`w-1 rounded-full h-2 ${aiState !== 'ready' ? 'animate-bounce' : ''}`} style={{ backgroundColor: '#7b6ee6' }}></span>
          <span className={`w-1 rounded-full h-5 ${aiState !== 'ready' ? 'animate-bounce [animation-delay:-0.2s]' : ''}`} style={{ backgroundColor: '#5444ca' }}></span>
          <span className={`w-1 rounded-full h-3 ${aiState !== 'ready' ? 'animate-bounce [animation-delay:-0.4s]' : ''}`} style={{ backgroundColor: '#3b2e96' }}></span>
          <span className={`w-1 rounded-full h-6 ${aiState !== 'ready' ? 'animate-bounce [animation-delay:-0.1s]' : ''}`} style={{ backgroundColor: '#a296ff' }}></span>
          <span className={`w-1 rounded-full h-4 ${aiState !== 'ready' ? 'animate-bounce [animation-delay:-0.3s]' : ''}`} style={{ backgroundColor: '#5444ca' }}></span>
          <span className={`w-1 rounded-full h-2 ${aiState !== 'ready' ? 'animate-bounce [animation-delay:-0.5s]' : ''}`} style={{ backgroundColor: '#7b6ee6' }}></span>
        </div>

        {/* Realtime Live Recognized Transcript & Status Display */}
        <div className="mt-3 text-center w-full max-w-[340px] px-1" aria-live="polite">
          {aiState === 'listening' && (
            <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 text-emerald-950 text-xs font-semibold flex flex-col gap-1 text-left shadow-sm animate-pulse">
              <span className="text-[10px] text-emerald-700 uppercase tracking-wider font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                Listening...
              </span>
              <span className="text-xs font-medium text-emerald-900 italic">
                {liveTranscript ? `"${liveTranscript}"` : 'Listening for your voice...'}
              </span>
            </div>
          )}

          {aiState !== 'listening' && responseMessage ? (
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
            aiState !== 'listening' && (
              <span className="font-label-sm text-label-sm font-semibold text-primary text-[12px] block">
                {aiState === 'ready' && '"Ask JARVIS: Show me paracetamol 650, How is the weather, or Add it to cart"'}
                {aiState === 'thinking' && 'Thinking...'}
                {aiState === 'speaking' && 'Speaking... (Tap orb to interrupt)'}
              </span>
            )
          )}
        </div>
      </div>

      {/* Added to Cart Success Banner */}
      {addedItemName && (
        <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center justify-between animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
            <span>Added {addedItemName} to cart!</span>
          </div>
          <button
            onClick={openCart}
            className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[11px] font-bold hover:bg-emerald-700 shadow-sm"
          >
            View Cart
          </button>
        </div>
      )}

      {/* Structured AI Product Search Result Cards with Verified product.image */}
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
                    src={p.image || IMAGE_UNAVAILABLE_IMG}
                    alt={p.name}
                    onError={(e) => { e.target.src = IMAGE_UNAVAILABLE_IMG; }}
                    className="w-14 h-14 rounded-lg object-cover bg-surface-container-low shrink-0 border border-outline-variant/10"
                  />
                  <div className="flex flex-col min-w-0">
                    <h4 className="font-bold text-xs text-primary truncate hover:underline">{p.name}</h4>
                    {p.genericName && (
                      <span className="text-[10px] font-semibold text-secondary truncate">
                        {p.genericName} {p.strength ? `• ${p.strength}` : ''}
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
          handleProcessQuery(queryText);
        }}
        className="flex items-center gap-2 pt-1 relative z-10"
      >
        <input
          type="text"
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          placeholder="Ask JARVIS anything..."
          aria-label="Ask JARVIS anything"
          className="flex-1 py-2 px-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="button"
          onClick={handleOrbClick}
          aria-label={aiState === 'listening' ? 'Stop listening' : 'Start voice input'}
          className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-sm shrink-0 transition-all ${
            aiState === 'listening' ? 'bg-emerald-600 text-white animate-pulse' : 'bg-surface-container-low text-primary border border-outline-variant/20'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {aiState === 'listening' ? 'mic' : 'mic_none'}
          </span>
        </button>
        <button
          type="submit"
          aria-label="Send to JARVIS"
          className="w-8 h-8 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-sm shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">send</span>
        </button>
      </form>
    </section>
  );
};

export default AIAssistantOrb;
