import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from "react";
import { JurisdictionSelector, JurisdictionBadge, getSavedJurisdiction } from "./components/JurisdictionSelector";
import { ChatInterface } from "./components/ChatInterface";
import { SolarCalculator } from "./components/Calculator";
import { PermitChecklist } from "./components/PermitChecklist";
import { AHJLookup } from "./components/AHJLookup";
import { Jurisdiction } from "./types";
import { Zap, Calculator, MessageSquare, AlertTriangle, ShieldCheck, ClipboardCheck, X, MapPin } from "lucide-react";
import { cn } from "./lib/utils";

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-8 font-mono">
          <div className="max-w-md w-full border border-red-500/50 bg-red-500/10 p-6 rounded-lg">
            <div className="flex items-center gap-3 text-red-500 mb-4">
              <AlertTriangle size={24} />
              <h2 className="text-lg font-bold uppercase tracking-widest">System Error</h2>
            </div>
            <p className="text-xs text-white/60 mb-6 leading-relaxed">
              An unexpected error occurred in the SolarFlow engine. Please try refreshing the page.
            </p>
            <div className="bg-black/40 p-3 rounded text-[10px] font-mono text-red-400 overflow-auto max-h-32 mb-6">
              {this.state.error?.message}
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-red-500 text-white py-3 text-[10px] font-bold uppercase hover:bg-red-600 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction | undefined>();
  const [showSelector, setShowSelector] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "calc" | "checklist" | "ahj">("chat");
  const [apiKey, setApiKey] = useState(() => {
    const saved = localStorage.getItem("solarflow_api_key");
    return saved || "";
  });
  const [showKeyModal, setShowKeyModal] = useState(false);

  // Load jurisdiction on mount
  useEffect(() => {
    const saved = getSavedJurisdiction();
    if (saved) {
      setJurisdiction(saved);
    } else {
      setShowSelector(true);
    }
  }, []);

  // Listen for storage changes (from the selector)
  useEffect(() => {
    const handleStorage = () => {
      const savedJur = getSavedJurisdiction();
      if (savedJur) setJurisdiction(savedJur);
      const savedKey = localStorage.getItem("solarflow_api_key");
      if (savedKey !== null) setApiKey(savedKey);
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    localStorage.setItem("solarflow_api_key", apiKey);
    // Dispatch storage event for other components in the same window
    window.dispatchEvent(new Event("storage"));
  }, [apiKey]);

  const handleSave = () => {
    setShowSelector(false);
  };

  return (
    <ErrorBoundary>
      <div className="h-screen bg-[#0a0a0a] text-white font-mono flex flex-col overflow-hidden">
      {/* Top Navigation */}
      <header className="bg-[#111111] text-white p-4 flex justify-between items-center border-b border-[#222222] z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#f97316] flex items-center justify-center text-white">
            <Zap size={24} />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-lg font-bold uppercase tracking-[0.2em]">SolarFlow AI</h1>
            <p className="text-[10px] text-white/40 uppercase tracking-widest">Compliance & Permit Assistant</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <JurisdictionBadge onClick={() => setShowSelector(true)} />
          
          <div className="hidden md:flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-white/60">
            <ShieldCheck size={16} className="text-[#f97316]" />
            <span>Verified</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Jurisdiction Selector Modal */}
        {showSelector && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center p-4 bg-[#0a0a0a]/90 backdrop-blur-sm animate-in fade-in duration-300">
            <JurisdictionSelector 
              onSave={handleSave} 
              onClose={jurisdiction ? () => setShowSelector(false) : undefined}
            />
          </div>
        )}

        {/* API Key Modal */}
        {showKeyModal && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center p-4 bg-[#0a0a0a]/90 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="max-w-md w-full bg-[#111111] border border-[#222222] p-8 space-y-6 shadow-2xl">
              <div className="flex justify-between items-center border-b border-[#222222] pb-4">
                <div className="flex items-center gap-2">
                  <Zap size={18} className="text-[#f97316]" />
                  <h2 className="text-sm font-bold uppercase tracking-widest">API Configuration</h2>
                </div>
                <button onClick={() => setShowKeyModal(false)} className="text-white/40 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-[10px] text-white/40 uppercase tracking-widest leading-relaxed">
                  Enter your Gemini API Key to override the shared system quota. This key is stored locally in your browser.
                </p>
                
                <div className="space-y-2">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-[#888888]">Gemini API Key</label>
                  <input 
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="AIza..."
                    className="w-full bg-[#0a0a0a] border border-[#222222] p-4 text-sm focus:border-[#f97316] outline-none transition-all placeholder:text-white/10"
                  />
                </div>

                <div className="bg-[#f97316]/10 border border-[#f97316]/20 p-4 rounded text-[9px] text-[#f97316] uppercase tracking-widest leading-relaxed">
                  Using a personal key ensures maximum reliability and higher rate limits for complex compliance checks.
                </div>
              </div>

              <button 
                onClick={() => setShowKeyModal(false)}
                className="w-full bg-[#f97316] text-white py-4 text-[11px] font-bold uppercase tracking-widest hover:bg-[#f97316]/90 transition-all"
              >
                Save Configuration
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar Navigation */}
          <div className="w-16 md:w-20 bg-[#111111] border-r border-[#222222] flex flex-col z-40 flex-none">
            <button 
              onClick={() => setActiveTab("chat")}
              className={cn(
                "w-full aspect-square flex flex-col items-center justify-center gap-1 transition-all flex-none",
                activeTab === "chat" ? "bg-[#f97316] text-white" : "text-white/40 hover:bg-white/5"
              )}
              title="Compliance Chat"
            >
              <MessageSquare size={20} />
              <span className="text-[8px] md:text-[10px] uppercase font-bold">Chat</span>
            </button>
            <button 
              onClick={() => setActiveTab("ahj")}
              className={cn(
                "w-full aspect-square flex flex-col items-center justify-center gap-1 transition-all flex-none",
                activeTab === "ahj" ? "bg-[#f97316] text-white" : "text-white/40 hover:bg-white/5"
              )}
              title="AHJ Lookup"
            >
              <MapPin size={20} />
              <span className="text-[8px] md:text-[10px] uppercase font-bold">Lookup</span>
            </button>
            <button 
              onClick={() => setActiveTab("calc")}
              className={cn(
                "w-full aspect-square flex flex-col items-center justify-center gap-1 transition-all flex-none",
                activeTab === "calc" ? "bg-[#f97316] text-white" : "text-white/40 hover:bg-white/5"
              )}
              title="120% Calculator"
            >
              <Calculator size={20} />
              <span className="text-[8px] md:text-[10px] uppercase font-bold">Calc</span>
            </button>
            <button 
              onClick={() => setActiveTab("checklist")}
              className={cn(
                "w-full aspect-square flex flex-col items-center justify-center gap-1 transition-all flex-none",
                activeTab === "checklist" ? "bg-[#f97316] text-white" : "text-white/40 hover:bg-white/5"
              )}
              title="Permit Checklist"
            >
              <ClipboardCheck size={20} />
              <span className="text-[8px] md:text-[10px] uppercase font-bold">Check</span>
            </button>
          </div>

          {/* Content Sections */}
          <div className="flex-1 bg-[#0a0a0a] relative overflow-hidden">
            <div className={cn("absolute inset-0 flex flex-col", activeTab === "chat" ? "z-10" : "hidden")}>
              <ChatInterface 
                jurisdiction={jurisdiction} 
                onAskJurisdiction={() => setShowSelector(true)}
              />
            </div>

            <div className={cn("absolute inset-0 overflow-y-auto", activeTab === "ahj" ? "z-10" : "hidden")}>
              <AHJLookup />
            </div>

            <div className={cn("absolute inset-0 overflow-y-auto p-4 md:p-8", activeTab === "calc" ? "z-10" : "hidden")}>
              <div className="max-w-3xl mx-auto">
                <SolarCalculator />
              </div>
            </div>

            <div className={cn("absolute inset-0 overflow-y-auto p-4 md:p-8", activeTab === "checklist" ? "z-10" : "hidden")}>
              <div className="max-w-4xl mx-auto">
                <PermitChecklist jurisdiction={jurisdiction} />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer / Status Bar */}
      <footer className="bg-[#111111] border-t border-[#222222] p-2 px-6 flex justify-between items-center text-[9px] uppercase tracking-widest text-white/30">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-[#f97316] animate-pulse" />
            <span>SolarFlow Engine Online</span>
          </div>
          <span className="hidden sm:inline">NEC 2017 | 2020 | 2023 Database Loaded</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 text-[#f97316]">
            <AlertTriangle size={10} />
            <span>Not a PE substitute</span>
          </div>
          <span>© 2026 SolarFlow AI</span>
        </div>
      </footer>
    </div>
    </ErrorBoundary>
  );
}
