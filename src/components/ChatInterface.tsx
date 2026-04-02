import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, Search, Brain, MapPin, AlertCircle, Loader2, Info, Zap, Plus, Trash2, MessageSquare, Menu, X } from "lucide-react";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { Jurisdiction, Message, ChatSession } from "../types";
import { cn } from "../lib/utils";

interface ChatInterfaceProps {
  jurisdiction?: Jurisdiction;
  onAskJurisdiction: () => void;
}

export function ChatInterface({ jurisdiction, onAskJurisdiction }: ChatInterfaceProps) {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem("solarflow_chat_sessions");
    return saved ? JSON.parse(saved) : [];
  });
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => {
    const saved = localStorage.getItem("solarflow_current_session_id");
    return saved || null;
  });
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"search" | "thinking">("search");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentSession = sessions.find(s => s.id === currentSessionId);
  const messages = currentSession?.messages || [];

  useEffect(() => {
    localStorage.setItem("solarflow_chat_sessions", JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    if (currentSessionId) {
      localStorage.setItem("solarflow_current_session_id", currentSessionId);
    } else {
      localStorage.removeItem("solarflow_current_session_id");
    }
  }, [currentSessionId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: crypto.randomUUID(),
      title: "New Compliance Check",
      messages: [],
      timestamp: new Date().toISOString(),
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setIsSidebarOpen(false);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.id !== id));
    if (currentSessionId === id) {
      setCurrentSessionId(null);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    if (!jurisdiction) {
      onAskJurisdiction();
      return;
    }

    let sessionId = currentSessionId;
    if (!sessionId) {
      const newSession: ChatSession = {
        id: crypto.randomUUID(),
        title: input.slice(0, 30) + (input.length > 30 ? "..." : ""),
        messages: [],
        timestamp: new Date().toISOString(),
      };
      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(newSession.id);
      sessionId = newSession.id;
    }

    const userMessage: Message = {
      role: "user",
      content: input,
      timestamp: new Date().toISOString(),
    };

    setSessions(prev => prev.map(s => 
      s.id === sessionId 
        ? { 
            ...s, 
            messages: [...s.messages, userMessage],
            title: s.messages.length === 0 ? input.slice(0, 30) + (input.length > 30 ? "..." : "") : s.title
          } 
        : s
    ));
    setInput("");
    setIsLoading(true);

    try {
      let apiKey = process.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
      
      // Handle cases where environment variables might be stringified "undefined"
      if (apiKey === "undefined" || apiKey === "null") {
        apiKey = "";
      }

      if (!apiKey) {
        throw new Error("Gemini API Key not found. Please configure it in the settings or as a secret.");
      }

      const ai = new GoogleGenAI({ apiKey: apiKey as string });
      const modelName = mode === "search" ? "gemini-3-flash-preview" : "gemini-3.1-pro-preview";
      
      const systemInstruction = `
        IDENTITY: You are SolarFlow AI.
        STRICT RULES:
        1. ONLY provide legal, public, and NEC (National Electrical Code) information.
        2. NO HALLUCINATIONS. If a fact is unknown or cannot be verified from public records, state "Information not available" or "Source not available".
        3. Use only authoritative public sources.
        4. Follow the mandatory response structure:
           - 📍 JURISDICTION
           - 📋 CODE REFERENCE
           - ✅ / ❌ COMPLIANCE STATUS
           - ⚡ ACTION REQUIRED
           - ⚠️ SOLARFLOW COMPLIANCE NOTICE (Disclaimer)
        
        JURISDICTION CONTEXT:
        - State: ${jurisdiction.state}
        - County: ${jurisdiction.county}
        - Adopted NEC: ${jurisdiction.adopted_nec}
      `;

      const config: any = {
        systemInstruction,
      };

      if (mode === "search") {
        config.tools = [{ googleSearch: {} }];
      } else {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
      }

      // Prepare contents with history
      const contents = [
        ...messages.map(m => ({
          role: m.role === "user" ? "user" : "model",
          parts: [{ text: m.content }]
        })),
        {
          role: "user",
          parts: [{ text: input }]
        }
      ];

      const response = await ai.models.generateContent({
        model: modelName,
        contents,
        config,
      });

      const aiMessage: Message = {
        role: "assistant",
        content: response.text || "I'm sorry, I couldn't generate a response.",
        timestamp: new Date().toISOString(),
        groundingUrls: response.candidates?.[0]?.groundingMetadata?.groundingChunks
          ?.map((chunk: any) => chunk.web?.uri)
          .filter(Boolean) || [],
      };

      setSessions(prev => prev.map(s => 
        s.id === sessionId 
          ? { ...s, messages: [...s.messages, aiMessage] } 
          : s
      ));
    } catch (error) {
      console.error("AI Error:", error);
      setSessions(prev => prev.map(s => 
        s.id === sessionId 
          ? { 
              ...s, 
              messages: [...s.messages, {
                role: "assistant",
                content: "⚠️ **ERROR**: Failed to connect to SolarFlow AI. Please check your connection or try again later.",
                timestamp: new Date().toISOString(),
              }] 
            } 
          : s
      ));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full bg-white text-[#141414] font-mono relative overflow-hidden">
      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="absolute inset-0 bg-black/20 z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Chat History Sidebar */}
      <div className={cn(
        "absolute inset-y-0 left-0 w-64 bg-[#f5f5f5] border-r border-[#141414] z-30 transition-transform duration-300 md:relative md:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-[#141414]">
            <button 
              onClick={createNewSession}
              className="w-full flex items-center justify-center gap-2 bg-[#141414] text-[#E4E3E0] py-2 text-xs uppercase font-bold hover:bg-[#141414]/90 transition-colors"
            >
              <Plus size={14} />
              New Chat
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {sessions.length === 0 ? (
              <div className="p-8 text-center opacity-30">
                <MessageSquare size={24} className="mx-auto mb-2" />
                <p className="text-[10px] uppercase font-bold">No History</p>
              </div>
            ) : (
              <div className="divide-y divide-[#141414]/5">
                {sessions.map(session => (
                  <div 
                    key={session.id}
                    onClick={() => {
                      setCurrentSessionId(session.id);
                      setIsSidebarOpen(false);
                    }}
                    className={cn(
                      "p-4 cursor-pointer group hover:bg-white transition-colors relative",
                      currentSessionId === session.id ? "bg-white border-l-4 border-l-[#141414]" : ""
                    )}
                  >
                    <p className={cn(
                      "text-[10px] uppercase font-bold truncate pr-6",
                      currentSessionId === session.id ? "text-[#141414]" : "text-[#141414]/60"
                    )}>
                      {session.title}
                    </p>
                    <p className="text-[8px] text-[#141414]/30 mt-1">
                      {new Date(session.timestamp).toLocaleDateString()}
                    </p>
                    <button 
                      onClick={(e) => deleteSession(e, session.id)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 hover:text-red-600 transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Header */}
        <div className="border-b border-[#141414] p-4 md:p-6 flex justify-between items-center bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 hover:bg-[#141414]/5 transition-colors"
            >
              <Menu size={20} />
            </button>
            <div className="w-8 h-8 bg-[#141414] flex items-center justify-center text-[#E4E3E0]">
              <Zap size={18} />
            </div>
            <div>
              <h1 className="text-sm font-bold uppercase tracking-widest">SolarFlow AI</h1>
              <p className="text-[10px] text-[#141414]/50 uppercase tracking-wider">Compliance Assistant v3.0</p>
            </div>
          </div>

          <div className="flex gap-1 bg-[#f5f5f5] p-1 rounded-lg">
            <button
              onClick={() => setMode("search")}
              className={cn(
                "px-4 py-1.5 text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all rounded-md font-bold",
                mode === "search" ? "bg-white text-[#141414] shadow-sm" : "text-[#141414]/40 hover:text-[#141414]"
              )}
            >
              <Search size={12} />
              <span className="hidden sm:inline">Search</span>
            </button>
            <button
              onClick={() => setMode("thinking")}
              className={cn(
                "px-4 py-1.5 text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all rounded-md font-bold",
                mode === "thinking" ? "bg-white text-[#141414] shadow-sm" : "text-[#141414]/40 hover:text-[#141414]"
              )}
            >
              <Brain size={12} />
              <span className="hidden sm:inline">Thinking</span>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 scroll-smooth"
        >
          {messages.length === 0 && !isLoading && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
              <Zap size={48} />
              <div className="max-w-xs">
                <p className="text-xs uppercase tracking-widest font-bold">System Ready</p>
                <p className="text-[10px] leading-relaxed mt-2 uppercase">
                  Ask about NEC compliance, 120% rule, or permit requirements for your jurisdiction.
                </p>
              </div>
            </div>
          )}

        {messages.map((msg, idx) => (
          <div 
            key={idx}
            className={cn(
              "flex flex-col w-full border-b border-[#141414]/10 last:border-0 pb-10",
              msg.role === "user" ? "items-end" : "items-start"
            )}
          >
            <div className={cn(
              "w-full max-w-4xl text-sm leading-relaxed",
              msg.role === "user" ? "text-right" : "text-left bg-[#f9f9f9] p-6 border border-[#141414]/5"
            )}>
              <div className="flex items-center gap-2 mb-2 text-[9px] uppercase tracking-widest font-bold opacity-40">
                {msg.role === "user" ? (
                  <>
                    <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <div className="w-1 h-1 bg-[#141414] rounded-full" />
                    <span>Contractor</span>
                  </>
                ) : (
                  <>
                    <Zap size={10} className="fill-current" />
                    <span>SolarFlow AI</span>
                    <div className="w-1 h-1 bg-[#141414] rounded-full" />
                    <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </>
                )}
              </div>

              <div className={cn(
                "markdown-body prose prose-sm max-w-none prose-p:my-2 prose-headings:uppercase prose-headings:text-xs prose-headings:tracking-widest prose-headings:font-bold prose-ul:list-none prose-li:my-1",
                msg.role === "user" ? "text-[#141414]/70" : "text-[#141414]"
              )}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content}
                </ReactMarkdown>
              </div>

              {msg.groundingUrls && msg.groundingUrls.length > 0 && (
                <div className="mt-4 pt-4 border-t border-[#141414]/5 space-y-2">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-[#141414]/30 flex items-center gap-1">
                    <Info size={10} />
                    Sources
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {msg.groundingUrls.map((url, i) => (
                      <a 
                        key={i} 
                        href={url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[9px] text-[#141414]/50 hover:text-[#141414] underline underline-offset-2 transition-colors truncate max-w-[200px]"
                      >
                        {new URL(url).hostname}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex flex-col mr-auto items-start max-w-[90%]">
            <div className="p-4 border border-[#141414] bg-white text-[#141414] flex items-center gap-3">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-[10px] uppercase tracking-widest font-bold">
                {mode === "thinking" ? "Analyzing Code..." : "Searching AHJ Data..."}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-6 bg-white">
        <div className="flex gap-4 items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={jurisdiction ? "Ask a compliance question..." : "Set jurisdiction first..."}
            className="flex-1 bg-[#f5f5f5] border-none px-6 py-4 text-sm text-black placeholder:text-black/30 focus:outline-none transition-all rounded-full"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-[#141414] text-white w-12 h-12 rounded-full flex items-center justify-center hover:bg-[#f97316] disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-90 shadow-lg shadow-black/10"
          >
            <Send size={18} />
          </button>
        </div>
      </form>
    </div>
  </div>
);
}
