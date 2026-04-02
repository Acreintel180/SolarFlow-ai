import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ClipboardCheck, Printer, Download, Loader2, AlertCircle, FileText, RotateCcw, X } from "lucide-react";
import { GoogleGenAI } from "@google/genai";
import { Jurisdiction } from "../types";
import { cn } from "../lib/utils";

interface PermitChecklistProps {
  jurisdiction?: Jurisdiction;
}

export function PermitChecklist({ jurisdiction }: PermitChecklistProps) {
  const [checklist, setChecklist] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateChecklist = async () => {
    if (!jurisdiction) return;
    setIsLoading(true);
    setError(null);

    try {
      let apiKey = process.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
      
      if (apiKey === "undefined" || apiKey === "null") {
        apiKey = "";
      }

      if (!apiKey) {
        throw new Error("Gemini API Key not found. Please configure it in the settings or as a secret.");
      }

      const ai = new GoogleGenAI({ apiKey: apiKey as string });
      const systemInstruction = `
        IDENTITY: You are SolarFlow AI.
        TASK: Generate a comprehensive permit checklist for ${jurisdiction.county}, ${jurisdiction.state} (NEC ${jurisdiction.adopted_nec}).
        STRICT RULES:
        1. ONLY use public authoritative sources.
        2. NO HALLUCINATIONS. If a requirement is unknown, state "Source not available".
        3. Include: Required Documents (Task List), Utility Requirements, AHJ Contact Info, and the ⚠️ SOLARFLOW COMPLIANCE NOTICE.
      `;

      let attempts = 0;
      const maxAttempts = 2;
      let lastError = null;

      while (attempts < maxAttempts) {
        try {
          attempts++;
          const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: "Generate the permit checklist now with task list checkboxes.",
            config: {
              systemInstruction,
              tools: [{ googleSearch: {} }],
            },
          });

          if (response.text) {
            setChecklist(response.text);
            return;
          }
          throw new Error("Empty response from AI model.");
        } catch (err: any) {
          console.warn(`Checklist attempt ${attempts} failed:`, err);
          lastError = err;
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      throw lastError || new Error("Failed to generate checklist.");
    } catch (err: any) {
      console.error("Checklist Error:", err);
      setError(err.message || "Failed to generate checklist. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!jurisdiction) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-[#111111] border border-[#222222] font-mono opacity-40 text-white">
        <AlertCircle size={48} className="text-[#f97316]" />
        <p className="mt-4 text-xs uppercase tracking-widest font-bold">Jurisdiction Required</p>
        <p className="text-[10px] mt-2 uppercase">Set your jurisdiction to generate a permit checklist.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#111111] border border-[#222222] font-mono overflow-hidden text-white">
      <div className="bg-[#111111] border-b border-[#222222] p-4 flex justify-between items-center">
        <div className="flex items-center gap-2 text-white/40 text-[11px] uppercase tracking-widest font-bold">
          <ClipboardCheck size={14} className="text-[#f97316]" />
          <span>Permit Checklist Generator</span>
        </div>
        
        <div className="flex gap-2">
          {checklist && (
            <>
              <button 
                onClick={() => setChecklist(null)}
                className="p-2 border border-[#222222] hover:bg-red-500 hover:text-white transition-colors"
                title="Clear Checklist"
              >
                <X size={16} />
              </button>
              <button 
                onClick={generateChecklist}
                disabled={isLoading}
                className="p-2 border border-[#222222] hover:bg-[#f97316] hover:text-white transition-colors disabled:opacity-20"
                title="Regenerate Checklist"
              >
                <RotateCcw size={16} className={cn(isLoading && "animate-spin")} />
              </button>
              <button 
                onClick={handlePrint}
                className="p-2 border border-[#222222] hover:bg-[#f97316] hover:text-white transition-colors"
                title="Print Checklist"
              >
                <Printer size={16} />
              </button>
              <button 
                className="p-2 border border-[#222222] hover:bg-[#f97316] hover:text-white transition-colors"
                title="Download PDF"
              >
                <Download size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 bg-[#0a0a0a] print:bg-white print:text-black print:p-0">
        {!checklist && !isLoading && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-8">
            <div className="w-20 h-20 bg-[#111111] flex items-center justify-center text-[#f97316] border border-[#222222]">
              <FileText size={40} />
            </div>
            <div className="max-w-xs space-y-6">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em]">Generate Official Checklist</h3>
              <p className="text-[10px] leading-relaxed uppercase text-white/40 tracking-widest">
                SolarFlow AI will analyze local AHJ requirements and utility standards for {jurisdiction.county}, {jurisdiction.state}.
              </p>
              <button 
                onClick={generateChecklist}
                className="w-full bg-[#f97316] text-white px-8 py-4 text-[11px] uppercase tracking-widest font-bold hover:bg-[#f97316]/90 transition-all active:scale-[0.98]"
              >
                Generate Checklist
              </button>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="h-full flex flex-col items-center justify-center space-y-6">
            <Loader2 size={40} className="animate-spin text-[#f97316]" />
            <p className="text-[10px] uppercase tracking-widest font-bold animate-pulse text-white/60">
              Compiling AHJ Requirements...
            </p>
          </div>
        )}

        {error && !isLoading && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-20 h-20 bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20">
              <AlertCircle size={40} />
            </div>
            <div className="max-w-xs space-y-6">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-red-500">Generation Failed</h3>
              <p className="text-[10px] leading-relaxed uppercase text-white/40 tracking-widest">
                We encountered an issue while analyzing AHJ requirements for {jurisdiction.county}. This could be due to a temporary connection problem or an AI processing error.
              </p>
              <button 
                onClick={generateChecklist}
                className="w-full bg-white text-black px-8 py-4 text-[11px] uppercase tracking-widest font-bold hover:bg-white/90 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <RotateCcw size={14} />
                Retry Generation
              </button>
            </div>
          </div>
        )}

        {checklist && (
          <div className="max-w-2xl mx-auto animate-in fade-in duration-700 print:max-w-none">
            <div className="markdown-body prose prose-invert prose-sm max-w-none prose-p:my-2 prose-headings:uppercase prose-headings:text-xs prose-headings:tracking-widest prose-headings:font-bold prose-ul:list-none prose-li:my-1 print:prose-neutral">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {checklist}
              </ReactMarkdown>
            </div>
            <div className="mt-12 pt-8 border-t border-[#222222] flex justify-center print:hidden">
              <button 
                onClick={generateChecklist}
                disabled={isLoading}
                className="flex items-center gap-2 bg-[#111111] border border-[#222222] text-white/60 px-6 py-3 text-[10px] uppercase font-bold tracking-widest hover:bg-[#f97316] hover:text-white transition-all disabled:opacity-20"
              >
                <RotateCcw size={14} className={cn(isLoading && "animate-spin")} />
                Regenerate Checklist
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-[#111111] border-t border-[#222222] p-3 px-6 flex justify-between items-center text-[9px] uppercase tracking-widest text-white/40">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#f97316]" />
          <span>Jurisdiction: {jurisdiction.county}, {jurisdiction.state}</span>
        </div>
        <span>SolarFlow AI — NEC {jurisdiction.adopted_nec}</span>
      </div>
    </div>
  );
}
