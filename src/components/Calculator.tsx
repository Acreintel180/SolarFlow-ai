import React, { useState } from "react";
import { Calculator as CalcIcon, Zap, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "../lib/utils";

export function SolarCalculator() {
  const [busbar, setBusbar] = useState<number>(200);
  const [mainBreaker, setMainBreaker] = useState<number>(200);
  const [solarBreaker, setSolarBreaker] = useState<number>(40);

  const maxSolarBreaker = (busbar * 1.2) - mainBreaker;
  const isCompliant = solarBreaker <= maxSolarBreaker;

  return (
    <div className="bg-[#111111] border border-[#222222] p-8 font-mono h-full text-white">
      <div className="flex items-center gap-2 mb-8 text-white/40 text-[11px] uppercase tracking-widest font-bold">
        <CalcIcon size={14} className="text-[#f97316]" />
        <span>120% Rule Compliance Calculator</span>
      </div>

      <div className="space-y-8">
        <div className="grid grid-cols-1 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] uppercase text-white/40 tracking-widest font-bold">Busbar Rating (Amps)</label>
            <input 
              type="number"
              value={busbar}
              onChange={(e) => setBusbar(Number(e.target.value))}
              className="w-full bg-[#f5f5f5] border border-[#222222] px-4 py-3 text-sm text-black focus:outline-none focus:border-[#f97316] transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase text-white/40 tracking-widest font-bold">Main Breaker (Amps)</label>
            <input 
              type="number"
              value={mainBreaker}
              onChange={(e) => setMainBreaker(Number(e.target.value))}
              className="w-full bg-[#f5f5f5] border border-[#222222] px-4 py-3 text-sm text-black focus:outline-none focus:border-[#f97316] transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase text-white/40 tracking-widest font-bold">Proposed Solar Breaker (Amps)</label>
            <input 
              type="number"
              value={solarBreaker}
              onChange={(e) => setSolarBreaker(Number(e.target.value))}
              className="w-full bg-[#f5f5f5] border border-[#222222] px-4 py-3 text-sm text-black focus:outline-none focus:border-[#f97316] transition-colors"
            />
          </div>
        </div>

        <div className="border-t border-[#222222] pt-8 space-y-6">
          <div className="flex justify-between items-center text-[11px] uppercase tracking-widest text-white/60 font-bold">
            <span>Max Solar Breaker Allowed:</span>
            <span className="text-lg text-[#f97316]">{maxSolarBreaker.toFixed(1)}A</span>
          </div>

          <div className={cn(
            "p-6 border flex items-start gap-4 transition-all",
            isCompliant 
              ? "bg-[#f97316]/10 border-[#f97316]/30 text-white" 
              : "bg-red-500/10 border-red-500/30 text-white"
          )}>
            {isCompliant ? <CheckCircle2 size={24} className="text-[#f97316]" /> : <AlertTriangle size={24} className="text-red-500" />}
            <div>
              <div className={cn(
                "text-xs font-bold uppercase tracking-widest mb-2",
                isCompliant ? "text-[#f97316]" : "text-red-500"
              )}>
                {isCompliant ? "System Compliant" : "Compliance Violation"}
              </div>
              <p className="text-[11px] leading-relaxed opacity-70 uppercase tracking-wider">
                {isCompliant 
                  ? `Your proposed ${solarBreaker}A breaker is within the ${maxSolarBreaker.toFixed(1)}A limit per NEC 705.12(B)(2).`
                  : `Your proposed ${solarBreaker}A breaker exceeds the ${maxSolarBreaker.toFixed(1)}A limit. Consider a panel upgrade or supply-side connection.`}
              </p>
            </div>
          </div>
        </div>

        <div className="text-[9px] text-white/20 italic leading-tight uppercase tracking-widest">
          * Formula: (Busbar × 1.2) - Main Breaker. Bypassed by supply-side connections (NEC 705.12(A)).
        </div>
      </div>
    </div>
  );
}
