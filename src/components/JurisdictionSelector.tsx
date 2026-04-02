// SolarFlow Jurisdiction Selector v2.0
import React, { useState, useEffect } from "react";

/**
 * UTILITY: getSavedJurisdiction
 * Reads from localStorage, calculates age, and returns data + stale status.
 */
export const getSavedJurisdiction = () => {
  const saved = localStorage.getItem("solarflow_jurisdiction");
  if (!saved) return null;

  try {
    const data = JSON.parse(saved);
    const savedDate = new Date(data.saved_at);
    const now = new Date();
    
    const months = (now.getFullYear() - savedDate.getFullYear()) * 12 + (now.getMonth() - savedDate.getMonth());
    
    return {
      ...data,
      data_age_months: months,
      is_stale: months >= 6
    };
  } catch (e) {
    return null;
  }
};

/**
 * COMPONENT: JurisdictionBadge
 * Header component to display current jurisdiction.
 */
export const JurisdictionBadge: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const [jurisdiction, setJurisdiction] = useState<any>(null);

  useEffect(() => {
    const data = getSavedJurisdiction();
    setJurisdiction(data);
    
    // Listen for storage changes to update badge
    const handleStorage = () => setJurisdiction(getSavedJurisdiction());
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  if (!jurisdiction) {
    return (
      <button 
        onClick={onClick}
        className="flex items-center gap-2 px-3 py-1.5 border border-[#f97316] text-[#f97316] font-mono text-[10px] font-bold uppercase hover:bg-[#f97316] hover:text-white transition-all"
      >
        ⚠️ SET JURISDICTION
      </button>
    );
  }

  return (
    <button 
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-1.5 bg-[#111111] border border-[#222222] hover:border-[#f97316] transition-all font-mono group"
    >
      <div className="flex items-center gap-2">
        <span className="text-[#888888] group-hover:text-[#f97316]">📍</span>
        <span className="text-white text-[10px] font-bold uppercase tracking-wider">
          {jurisdiction.city}, {jurisdiction.county}, {jurisdiction.state} — NEC {jurisdiction.adopted_nec}
        </span>
      </div>
      {jurisdiction.is_stale && (
        <div className="w-2 h-2 rounded-full bg-[#f97316] animate-pulse" title="Data may be stale" />
      )}
    </button>
  );
};

/**
 * COMPONENT: JurisdictionSelector
 * Main UI for selecting and saving jurisdiction.
 */
export const JurisdictionSelector: React.FC<{ onSave?: () => void; onClose?: () => void }> = ({ onSave, onClose }) => {
  const [selectedState, setSelectedState] = useState("");
  const [selectedCounty, setSelectedCounty] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedNec, setSelectedNec] = useState("2023");
  const [isSaved, setIsSaved] = useState(false);
  const [savedData, setSavedData] = useState<any>(null);

  useEffect(() => {
    const data = getSavedJurisdiction();
    if (data) {
      setSavedData(data);
      setSelectedNec(data.adopted_nec);
      setSelectedState(data.state);
      setSelectedCounty(data.county);
      setSelectedCity(data.city);
    }
  }, []);

  const handleSave = () => {
    if (!selectedState || !selectedCounty || !selectedCity) return;

    const data = {
      state: selectedState,
      county: selectedCounty,
      city: selectedCity,
      adopted_nec: selectedNec,
      saved_at: new Date().toISOString(),
      data_age_months: 0
    };

    localStorage.setItem("solarflow_jurisdiction", JSON.stringify(data));
    setSavedData({ ...data, is_stale: false });
    setIsSaved(true);
    
    // Dispatch storage event for other components
    window.dispatchEvent(new Event("storage"));
    
    if (onSave) onSave();
  };

  const isSavedState = isSaved || (savedData && !selectedState);
  
  if (isSavedState) {
    const displayData = isSaved ? savedData : savedData;
    return (
      <div className="bg-[#111111] border border-[#222222] p-8 max-w-md w-full font-mono text-white max-h-full overflow-y-auto scrollbar-hide">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-[#f97316] text-xl font-bold uppercase tracking-tighter">JURISDICTION ACTIVE</h2>
            <p className="text-[#888888] text-[10px] uppercase mt-1">Compliance parameters locked</p>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-[#888888] hover:text-white">✕</button>
          )}
        </div>

        <div className="space-y-4 mb-8">
          <div className="border-l-2 border-[#f97316] pl-4 py-1">
            <p className="text-[10px] text-[#888888] uppercase">Location</p>
            <p className="text-sm font-bold uppercase">{displayData.city}, {displayData.county}, {displayData.state}</p>
          </div>
          <div className="border-l-2 border-[#f97316] pl-4 py-1">
            <p className="text-[10px] text-[#888888] uppercase">NEC Standard</p>
            <p className="text-sm font-bold uppercase">Article 690 / 705 — NEC {displayData.adopted_nec}</p>
          </div>
          <div className="border-l-2 border-[#f97316] pl-4 py-1">
            <p className="text-[10px] text-[#888888] uppercase">Last Verified</p>
            <p className="text-sm font-bold uppercase">{new Date(displayData.saved_at).toLocaleDateString()}</p>
          </div>
        </div>

        {displayData.is_stale && (
          <div className="bg-[#f97316]/10 border border-[#f97316]/30 p-3 mb-6">
            <p className="text-[#f97316] text-[10px] font-bold uppercase leading-tight">
              ⚠️ Your jurisdiction data may be outdated. Verify NEC version with your AHJ.
            </p>
          </div>
        )}

        <button 
          onClick={() => {
            setIsSaved(false);
            setSavedData(null);
            setSelectedState("");
          }}
          className="w-full border border-[#222222] py-3 text-[10px] font-bold uppercase hover:bg-[#222222] transition-colors"
        >
          Update Jurisdiction
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#111111] border border-[#222222] p-8 max-w-md w-full font-mono text-white max-h-full overflow-y-auto scrollbar-hide">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-white text-xl font-bold uppercase tracking-tighter">JURISDICTION SETUP</h2>
          <p className="text-[#888888] text-[10px] uppercase mt-1">Set once. Used for all compliance checks.</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-[#888888] hover:text-white">✕</button>
        )}
      </div>

      <div className="space-y-6">
        {/* State Input */}
        <div>
          <label className="text-[10px] text-[#888888] uppercase mb-2 block">State</label>
          <input 
            type="text"
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            placeholder="Enter State..."
            className="w-full bg-[#f5f5f5] border border-[#222222] p-3 text-sm text-black focus:border-[#f97316] outline-none transition-colors"
          />
        </div>

        {/* County Input */}
        <div>
          <label className="text-[10px] text-[#888888] uppercase mb-2 block">County</label>
          <input 
            type="text"
            value={selectedCounty}
            onChange={(e) => setSelectedCounty(e.target.value)}
            placeholder="Enter County..."
            className="w-full bg-[#f5f5f5] border border-[#222222] p-3 text-sm text-black focus:border-[#f97316] outline-none transition-colors"
          />
        </div>

        {/* City Input */}
        <div>
          <label className="text-[10px] text-[#888888] uppercase mb-2 block">City</label>
          <input 
            type="text"
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            placeholder="Enter City..."
            className="w-full bg-[#f5f5f5] border border-[#222222] p-3 text-sm text-black focus:border-[#f97316] outline-none transition-colors"
          />
        </div>

        {/* NEC Selector */}
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between bg-[#0a0a0a] border border-[#222222] p-4">
            <div>
              <p className="text-[10px] text-[#888888] uppercase">Adopted NEC</p>
              <p className="text-xs text-[#888888] mt-1">Select code version</p>
            </div>
            <div className="relative">
              <select 
                value={selectedNec}
                onChange={(e) => setSelectedNec(e.target.value)}
                className="bg-[#f97316] text-white pl-3 pr-8 py-1 text-sm font-bold border-none outline-none cursor-pointer appearance-none"
              >
                <option value="2017">2017</option>
                <option value="2020">2020</option>
                <option value="2023">2023</option>
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-white">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          </div>
          <p className="text-[9px] text-[#888888] mt-2 italic">
            * Verify NEC version with your AHJ before permit submission.
          </p>
        </div>

        {/* Save Button */}
        <button 
          onClick={handleSave}
          disabled={!selectedState || !selectedCounty || !selectedCity}
          className={`w-full min-h-[56px] flex items-center justify-center font-bold uppercase text-xs tracking-[0.2em] transition-all ${
            !selectedState || !selectedCounty || !selectedCity
              ? "bg-[#222222] text-[#888888] cursor-not-allowed opacity-40" 
              : "bg-[#f97316] text-white hover:bg-[#f97316]/90 active:scale-[0.98] shadow-[0_4px_20px_rgba(249,115,22,0.3)]"
          }`}
        >
          Save Jurisdiction
        </button>
      </div>
    </div>
  );
};
