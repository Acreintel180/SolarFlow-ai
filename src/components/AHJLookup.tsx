import React, { useState } from "react";
import { Search, MapPin, Globe, Phone, Mail, ExternalLink, AlertTriangle, CheckCircle2, Loader2, Info, Download, ClipboardCheck } from "lucide-react";
import { GoogleGenAI } from "@google/genai";
import { AHJLookupResult, AHJ } from "../types";
import { cn } from "../lib/utils";

export function AHJLookup() {
  const [zipCode, setZipCode] = useState("");
  const [result, setResult] = useState<AHJLookupResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getReadinessScore = (ahj: AHJ | undefined) => {
    if (!ahj) return 0;
    let score = 0;
    if (ahj.permit_url) score += 20;
    if (ahj.contact?.phone || ahj.contact?.email) score += 20;
    if (ahj.required_codes?.length > 0) score += 20;
    if (ahj.forms?.length > 0) score += 20;
    if (ahj.required_documents?.length > 0) score += 20;
    return score;
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zipCode.trim() || zipCode.length < 5 || isLoading) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    // Validate ZIP code (US format)
    if (!/^\d{5}(-\d{4})?$/.test(zipCode.trim())) {
      setError("Please enter a valid 5-digit US ZIP code.");
      setIsLoading(false);
      return;
    }

    try {
      const savedKey = localStorage.getItem("solarflow_api_key");
      let apiKey = savedKey || process.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
      
      // Handle cases where environment variables might be stringified "undefined"
      if (apiKey === "undefined" || apiKey === "null") {
        apiKey = "";
      }

      if (!apiKey) {
        throw new Error("Gemini API Key not found. Please configure it in the settings (Zap icon) or add it as a secret named GEMINI_API_KEY in the AI Studio interface.");
      }

      const ai = new GoogleGenAI({ apiKey: apiKey as string });
      
      const systemInstruction = `
        IDENTITY: You are SolarFlow AHJ Intelligence Engine.
        PURPOSE: Perform a single-ZIP lookup to identify the Authority Having Jurisdiction (AHJ) for solar permitting and inspections.
        
        STRICT RULES:
        1. ONLY use public authoritative sources (city/county building depts, state code bodies, utility tariffs, NEC text, fire marshal).
        2. NO HALLUCINATIONS. If a fact cannot be found, return null and mark confidence low with explanation.
        3. OUTPUT FORMAT: You MUST return a valid JSON object matching the requested schema.
        4. ACCURACY: Prioritize authoritative sources and show provenance for every claim.
        5. DISCLOSURE: Always include the SolarFlow Compliance Notice.
        6. ACTIONABLE OUTPUTS: Generate a concise inspection/permit checklist (items <= 280 chars), common rejection reasons with mitigation tips, and required forms with URLs.
        
        JSON SCHEMA:
        {
          "zip_code": "string",
          "primary_city": "string",
          "county": "string",
          "state": "string",
          "recommended_ahj": AHJ_OBJECT,
          "ahj_list": [AHJ_OBJECT],
          "nearest_grid_operator": "string",
          "utility_interconnection_info": {
            "net_metering_allowed": boolean,
            "interconnection_limit_kw": number,
            "tariff_reference": "string",
            "application_link": "string"
          },
          "parcel_level_override": boolean,
          "recommended_next_steps": ["string"],
          "map_bounds": { "north": number, "south": number, "east": number, "west": number }
        }
        
        AHJ_OBJECT:
        {
          "ahj_id": "string",
          "name": "string",
          "type": "city | county | state | utility",
          "address": "string",
          "contact": { "phone": "string", "email": "string", "website": "string" },
          "permit_authority": boolean,
          "permit_url": "string",
          "inspection_authority": boolean,
          "inspection_requirements_summary": "string (max 280 chars)",
          "required_codes": ["string"],
          "avg_permit_fee": "string (range like '$400-$800')",
          "response_latency_days": number,
          "avg_turnaround_days": number,
          "common_rejection_reasons": [{ "reason": "string", "mitigation": "string" }],
          "required_documents": ["string"],
          "forms": [{ "name": "string", "url": "string" }],
          "bond_required": boolean,
          "insurance_required": boolean,
          "last_verified": "ISO_TIMESTAMP",
          "source": "string (URL)",
          "confidence_score": number (0-1),
          "confidence_rationale": "string"
        }
      `;

      let attempts = 0;
      const maxAttempts = 3;
      let lastError = null;

      while (attempts < maxAttempts) {
        try {
          attempts++;
          console.log(`AHJ Lookup Attempt ${attempts}/${maxAttempts}...`);

          const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Perform a production-ready AHJ lookup for ZIP code: ${zipCode}. Use Google Search to find REAL, CURRENT data from official city/county building departments, state code adoption records, and utility tariffs.`,
            config: {
              systemInstruction,
              responseMimeType: "application/json",
              tools: [{ googleSearch: {} }],
            },
          });

          let text = response.text;
          if (!text) {
            // Fallback: Try without Google Search if it failed to return text
            console.warn("Google Search tool might have failed, trying without it...");
            const fallbackResponse = await ai.models.generateContent({
              model: "gemini-3-flash-preview",
              contents: `Perform a production-ready AHJ lookup for ZIP code: ${zipCode}. Provide the most accurate data possible based on your training data for city/county building departments and utility standards.`,
              config: {
                systemInstruction,
                responseMimeType: "application/json",
              },
            });
            text = fallbackResponse.text;
          }

          if (!text) {
            throw new Error("Empty response from AI model.");
          }
          
          console.log("AHJ Lookup Raw Response:", text);
          
          // Robust JSON extraction in case the model includes markdown formatting
          if (text.includes("```")) {
            const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (match) {
              text = match[1];
            }
          }
          
          const data = JSON.parse(text.trim());
          console.log("AHJ Lookup Parsed Data:", data);
          setResult(data);
          return; // Success!

        } catch (err: any) {
          console.error(`Attempt ${attempts} failed:`, err);
          lastError = err;
          if (attempts < maxAttempts) {
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
          }
        }
      }

      throw lastError || new Error("Failed to perform AHJ lookup after multiple attempts.");

    } catch (err: any) {
      console.error("AHJ Lookup Error:", err);
      setError(err.message || "Failed to perform AHJ lookup. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadChecklist = () => {
    if (!result) return;
    
    const content = `
SOLARFLOW AI - PERMIT CHECKLIST
==============================
ZIP CODE: ${result.zip_code}
LOCATION: ${result.primary_city}, ${result.state}
COUNTY: ${result.county}
AHJ: ${result.recommended_ahj.name}

INSPECTION REQUIREMENTS:
-----------------------
${result.recommended_ahj.inspection_requirements_summary}

REQUIRED CODES:
--------------
${result.recommended_ahj.required_codes.join('\n')}

REQUIRED DOCUMENTS:
------------------
${result.recommended_ahj.required_documents.join('\n')}

NEXT STEPS:
----------
${result.recommended_next_steps.join('\n')}

Generated by SolarFlow AI on ${new Date().toLocaleString()}
    `.trim();

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SolarFlow_Checklist_${result.zip_code}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleHelpFillForms = () => {
    if (!result) return;
    const ahj = result.recommended_ahj;
    
    const content = `
SOLARFLOW AI - FORM FILLING GUIDE
================================
AHJ: ${ahj.name}

REQUIRED FORMS:
--------------
${ahj.forms.length > 0 
  ? ahj.forms.map(f => `- ${f.name}: ${f.url}`).join('\n')
  : 'No specific form URLs found. Please check the AHJ website: ' + ahj.contact.website}

COMMON REJECTION REASONS & MITIGATION:
------------------------------------
${ahj.common_rejection_reasons.map(r => `REASON: ${r.reason}\nMITIGATION: ${r.mitigation}`).join('\n\n')}

TIPS FOR SUCCESS:
----------------
1. Ensure all diagrams are to scale.
2. Double-check that the site plan matches the current satellite view.
3. Include the structural engineer's wet stamp if required.
4. Verify that the busbar rating matches the main breaker size for 120% rule compliance.

Generated by SolarFlow AI on ${new Date().toLocaleString()}
    `.trim();

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SolarFlow_Form_Guide_${result.zip_code}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDraftEmail = () => {
    if (!result) return;
    const ahj = result.recommended_ahj;
    
    const content = `
SOLARFLOW AI - DRAFT AHJ EMAIL
==============================
TO: ${ahj.contact.email || '[INSERT AHJ EMAIL]'}
SUBJECT: Permit Inquiry - Solar PV Installation - [PROJECT ADDRESS]

Dear ${ahj.name} Building Department,

I am writing to inquire about the permitting requirements for a residential solar PV installation at [PROJECT ADDRESS] (ZIP: ${result.zip_code}).

Based on our preliminary research, we understand the following:
- Primary AHJ: ${ahj.name}
- Adopted Codes: ${ahj.required_codes.join(', ')}

Could you please confirm:
1. The current turnaround time for residential solar permits?
2. If electronic plan review is available via ${ahj.permit_url || 'your online portal'}?
3. Any specific local amendments to the NEC that we should be aware of?

Thank you for your time and assistance.

Best regards,

[YOUR NAME]
[YOUR COMPANY]
[YOUR PHONE]

Generated by SolarFlow AI on ${new Date().toLocaleString()}
    `.trim();

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SolarFlow_Draft_Email_${result.zip_code}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleScheduleInspection = () => {
    if (!result) return;
    const ahj = result.recommended_ahj;
    
    const content = `
SOLARFLOW AI - INSPECTION SCHEDULING GUIDE
=========================================
AHJ: ${ahj.name}
PHONE: ${ahj.contact.phone || 'Not found'}
WEBSITE: ${ahj.contact.website || 'Not found'}

INSPECTION SUMMARY:
------------------
${ahj.inspection_requirements_summary}

SCHEDULING STEPS:
----------------
1. Call ${ahj.contact.phone || 'the building department'} or visit ${ahj.contact.website || 'the portal'} to request an inspection.
2. Have your permit number ready.
3. Ensure the site is accessible and a ladder is provided for the inspector.
4. Keep a printed copy of the approved plan set on-site.

Generated by SolarFlow AI on ${new Date().toLocaleString()}
    `.trim();

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SolarFlow_Inspection_Guide_${result.zip_code}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col bg-[#0a0a0a] font-mono text-white">
      {/* Search Header */}
      <div className="p-8 border-b border-[#222222] bg-[#111111]">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-2 text-[#f97316] text-[11px] uppercase tracking-[0.2em] font-bold">
            <MapPin size={14} />
            <span>AHJ Intelligence Engine</span>
          </div>
          
          <h2 className="text-2xl font-bold uppercase tracking-tight">Jurisdiction Lookup</h2>
          <p className="text-[10px] text-white/40 uppercase tracking-widest leading-relaxed">
            Enter a ZIP code to identify the primary permitting authority, local code adoptions, and utility interconnection standards.
          </p>

          <form onSubmit={handleLookup} className="flex gap-4">
            <input 
              type="text"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
              placeholder="ENTER ZIP CODE (E.G. 90210)"
              className="flex-1 bg-[#0a0a0a] border border-[#222222] px-6 py-4 text-sm focus:border-[#f97316] outline-none transition-all placeholder:text-white/10"
              maxLength={5}
            />
            <button 
              type="submit"
              disabled={isLoading || zipCode.length < 5}
              className="bg-[#f97316] text-white px-8 py-4 text-[11px] font-bold uppercase tracking-widest hover:bg-[#f97316]/90 transition-all disabled:opacity-20 flex items-center gap-2"
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              <span>Lookup</span>
            </button>
          </form>
        </div>
      </div>

      {/* Results Area */}
      {!result && !isLoading && !error && (
        <div className="p-8 flex flex-col items-center justify-center text-center opacity-20 py-20">
          <Globe size={64} className="mb-6" />
          <p className="text-xs uppercase tracking-[0.3em]">Awaiting Input Parameters</p>
        </div>
      )}

      {isLoading && (
        <div className="p-8 flex flex-col items-center justify-center space-y-6 py-20">
          <Loader2 size={48} className="animate-spin text-[#f97316]" />
          <div className="text-center space-y-2">
            <p className="text-[10px] uppercase tracking-widest font-bold animate-pulse">Scanning AHJ Databases...</p>
            <p className="text-[8px] text-white/40 uppercase tracking-widest">Verifying NEC Adoptions & Utility Tariffs</p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-8">
          <div className="max-w-2xl mx-auto p-8 border border-red-500/20 bg-red-500/5 text-center space-y-6">
            <AlertTriangle size={40} className="text-red-500 mx-auto" />
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-red-500">Lookup Error</h3>
              <p className="text-[10px] text-white/60 uppercase leading-relaxed">{error}</p>
            </div>
            <button 
              onClick={() => setError(null)}
              className="px-6 py-2 border border-red-500/30 text-[9px] uppercase font-bold tracking-widest hover:bg-red-500 hover:text-white transition-all"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {result && result.recommended_ahj && (
        <div className="p-8">
          <div className="max-w-5xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Summary Header */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-[#111111] border border-[#222222] p-6 space-y-1">
                <p className="text-[9px] text-white/40 uppercase tracking-widest font-bold">ZIP Code</p>
                <p className="text-lg font-bold">{result.zip_code}</p>
              </div>
              <div className="bg-[#111111] border border-[#222222] p-6 space-y-1">
                <p className="text-[9px] text-white/40 uppercase tracking-widest font-bold">Location</p>
                <p className="text-lg font-bold truncate">{result.primary_city}, {result.state}</p>
              </div>
              <div className="bg-[#111111] border border-[#222222] p-6 space-y-1">
                <p className="text-[9px] text-white/40 uppercase tracking-widest font-bold">County</p>
                <p className="text-lg font-bold">{result.county}</p>
              </div>
              <div className="bg-[#111111] border border-[#222222] p-6 space-y-1">
                <p className="text-[9px] text-white/40 uppercase tracking-widest font-bold">Grid Operator</p>
                <p className="text-lg font-bold truncate">{result.nearest_grid_operator}</p>
              </div>
            </div>

            {/* Recommended AHJ Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between border-l-4 border-[#f97316] pl-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-bold uppercase tracking-[0.2em]">Recommended AHJ</h3>
                  <div className="px-2 py-0.5 bg-[#f97316]/20 text-[#f97316] text-[9px] font-bold uppercase tracking-widest rounded">
                    Primary Authority
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[8px] text-white/40 uppercase font-bold tracking-widest">Readiness Score</p>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1 bg-[#222222] rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#f97316] transition-all duration-1000" 
                          style={{ width: `${getReadinessScore(result.recommended_ahj)}%` }} 
                        />
                      </div>
                      <span className="text-[10px] font-bold">{getReadinessScore(result.recommended_ahj)}%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* AHJ Card */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-[#111111] border border-[#222222]">
                    <div className="p-8 space-y-8">
                      <div className="flex justify-between items-start">
                        <div className="space-y-2">
                          <h4 className="text-xl font-bold uppercase tracking-tight">{result.recommended_ahj.name}</h4>
                          <div className="flex items-center gap-4 text-[10px] text-white/40 uppercase tracking-widest font-bold">
                            <span className="flex items-center gap-1"><MapPin size={12} /> {result.recommended_ahj.type}</span>
                            <span className="flex items-center gap-1"><Globe size={12} /> {result.recommended_ahj.address}</span>
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <div className="text-[9px] text-white/40 uppercase font-bold tracking-widest">Confidence</div>
                          <div className={cn(
                            "text-lg font-bold",
                            result.recommended_ahj.confidence_score > 0.8 ? "text-[#f97316]" : "text-yellow-500"
                          )}>
                            {(result.recommended_ahj.confidence_score * 100).toFixed(0)}%
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                          <div className="space-y-4">
                            <h5 className="text-[10px] font-bold uppercase tracking-widest text-white/40 border-b border-[#222222] pb-2">Requirements Summary</h5>
                            <p className="text-[11px] leading-relaxed uppercase tracking-wider">
                              {result.recommended_ahj.inspection_requirements_summary}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {result.recommended_ahj.required_codes.map((code, i) => (
                                <span key={i} className="px-2 py-1 bg-[#222222] text-[9px] font-bold uppercase tracking-widest border border-white/5">
                                  {code}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-4">
                            <h5 className="text-[10px] font-bold uppercase tracking-widest text-white/40 border-b border-[#222222] pb-2">Required Documents</h5>
                            <ul className="space-y-2">
                              {result.recommended_ahj.required_documents.map((doc, i) => (
                                <li key={i} className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-white/60">
                                  <div className="w-1 h-1 bg-[#f97316] rounded-full" />
                                  {doc}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        <div className="space-y-6">
                          <div className="space-y-4">
                            <h5 className="text-[10px] font-bold uppercase tracking-widest text-white/40 border-b border-[#222222] pb-2">Contact & Access</h5>
                            <div className="space-y-3">
                              <a href={`tel:${result.recommended_ahj.contact.phone}`} className="flex items-center gap-3 text-[11px] hover:text-[#f97316] transition-colors">
                                <Phone size={14} className="text-white/30" />
                                <span>{result.recommended_ahj.contact.phone}</span>
                              </a>
                              <a href={`mailto:${result.recommended_ahj.contact.email}?subject=Permit Requirements Inquiry&body=Requesting permit requirements for project at [ADDRESS].`} className="flex items-center gap-3 text-[11px] hover:text-[#f97316] transition-colors">
                                <Mail size={14} className="text-white/30" />
                                <span>{result.recommended_ahj.contact.email}</span>
                              </a>
                              <a href={result.recommended_ahj.contact.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-[11px] hover:text-[#f97316] transition-colors">
                                <Globe size={14} className="text-white/30" />
                                <span className="truncate">Visit Official Site</span>
                                <ExternalLink size={10} className="opacity-40" />
                              </a>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <h5 className="text-[10px] font-bold uppercase tracking-widest text-white/40 border-b border-[#222222] pb-2">Official Forms</h5>
                            <div className="space-y-2">
                              {result.recommended_ahj.forms.map((form, i) => (
                                <a 
                                  key={i} 
                                  href={form.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-between p-2 bg-[#222222] hover:bg-[#333333] transition-colors group"
                                >
                                  <span className="text-[9px] font-bold uppercase tracking-widest truncate max-w-[150px]">{form.name}</span>
                                  <Download size={12} className="opacity-40 group-hover:opacity-100 group-hover:text-[#f97316]" />
                                </a>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-6 border-t border-[#222222] flex flex-wrap gap-4">
                        <button 
                          onClick={handleDownloadChecklist}
                          className="border border-[#222222] text-white/60 px-6 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-white/5 transition-all flex items-center gap-2"
                        >
                          <Download size={14} />
                          Download Checklist
                        </button>
                      </div>
                    </div>
                    
                    <div className="bg-[#111111] border-t border-[#222222] p-4 px-8 flex justify-between items-center text-[9px] uppercase tracking-widest text-white/30">
                      <div className="flex items-center gap-2">
                        <Info size={12} />
                        <span>Source: {new URL(result.recommended_ahj.source).hostname}</span>
                      </div>
                      <span>Last Verified: {new Date(result.recommended_ahj.last_verified).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Common Rejection Reasons */}
                  <div className="bg-[#111111] border border-[#222222] p-8 space-y-6">
                    <h5 className="text-[10px] font-bold uppercase tracking-widest text-red-500 flex items-center gap-2">
                      <AlertTriangle size={14} />
                      Common Rejection Reasons
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {result.recommended_ahj.common_rejection_reasons.map((item, i) => (
                        <div key={i} className="space-y-2">
                          <p className="text-[10px] font-bold uppercase tracking-wider">{item.reason}</p>
                          <p className="text-[9px] text-white/40 uppercase leading-relaxed italic">Mitigation: {item.mitigation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sidebar Info */}
                <div className="space-y-6">
                  <div className="bg-[#111111] border border-[#222222] p-6 space-y-4">
                    <h5 className="text-[10px] font-bold uppercase tracking-widest text-[#f97316]">Confidence Rationale</h5>
                    <p className="text-[10px] leading-relaxed uppercase tracking-wider text-white/60">
                      {result.recommended_ahj.confidence_rationale}
                    </p>
                    {result.recommended_ahj.confidence_score < 0.75 && (
                      <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500">
                        <AlertTriangle size={14} className="flex-none mt-0.5" />
                        <p className="text-[9px] font-bold uppercase leading-tight">Manual verification required before submission</p>
                      </div>
                    )}
                  </div>

                  <div className="bg-[#111111] border border-[#222222] p-6 space-y-4">
                    <h5 className="text-[10px] font-bold uppercase tracking-widest text-white/40">Timeline Estimator</h5>
                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <div className="space-y-1">
                          <p className="text-[8px] text-white/20 uppercase font-bold tracking-widest">Avg Turnaround</p>
                          <p className="text-xl font-bold">{result.recommended_ahj.avg_turnaround_days} Days</p>
                        </div>
                        <div className="text-right space-y-1">
                          <p className="text-[8px] text-white/20 uppercase font-bold tracking-widest">Confidence Adj.</p>
                          <p className="text-[10px] font-bold text-white/60">
                            +{( (1 - result.recommended_ahj.confidence_score) * result.recommended_ahj.avg_turnaround_days ).toFixed(0)} Days
                          </p>
                        </div>
                      </div>
                      <div className="pt-4 border-t border-[#222222] space-y-2">
                        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                          <span className="text-white/40">Permit Fee</span>
                          <span>{result.recommended_ahj.avg_permit_fee}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                          <span className="text-white/40">Bond Required</span>
                          <span className={result.recommended_ahj.bond_required ? "text-red-500" : "text-green-500"}>
                            {result.recommended_ahj.bond_required ? "YES" : "NO"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                          <span className="text-white/40">Insurance Req.</span>
                          <span className={result.recommended_ahj.insurance_required ? "text-red-500" : "text-green-500"}>
                            {result.recommended_ahj.insurance_required ? "YES" : "NO"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#111111] border border-[#222222] p-6 space-y-4">
                    <h5 className="text-[10px] font-bold uppercase tracking-widest text-white/40">Utility Interconnection</h5>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-[8px] text-white/20 uppercase font-bold tracking-widest">Net Metering</p>
                          <p className="text-[10px] font-bold">{result.utility_interconnection_info.net_metering_allowed ? "ENABLED" : "DISABLED"}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[8px] text-white/20 uppercase font-bold tracking-widest">Limit (kW)</p>
                          <p className="text-[10px] font-bold">{result.utility_interconnection_info.interconnection_limit_kw}kW</p>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[8px] text-white/20 uppercase font-bold tracking-widest">Tariff Ref</p>
                        <p className="text-[9px] uppercase tracking-wider text-white/60 line-clamp-2">{result.utility_interconnection_info.tariff_reference}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#f97316]/5 border border-[#f97316]/20 p-6 space-y-4">
                    <h5 className="text-[10px] font-bold uppercase tracking-widest text-[#f97316]">Recommended Next Steps</h5>
                    <ul className="space-y-3">
                      {result.recommended_next_steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <span className="text-[10px] font-bold text-[#f97316]">{i + 1}.</span>
                          <p className="text-[10px] uppercase tracking-wider leading-relaxed">{step}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Other Jurisdictions */}
            {result.ahj_list.length > 1 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-l-4 border-[#222222] pl-4">
                  <h3 className="text-sm font-bold uppercase tracking-[0.2em]">Overlapping Jurisdictions</h3>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest">Other candidate authorities for this ZIP</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {result.ahj_list.filter(a => a.ahj_id !== result.recommended_ahj.ahj_id).map((ahj, i) => (
                    <div key={i} className="bg-[#111111] border border-[#222222] p-6 space-y-4 hover:border-[#f97316]/30 transition-all group">
                      <div className="flex justify-between items-start">
                        <h4 className="text-xs font-bold uppercase tracking-widest group-hover:text-[#f97316] transition-colors">{ahj.name}</h4>
                        <span className="text-[9px] font-bold text-white/20 uppercase">{ahj.type}</span>
                      </div>
                      <p className="text-[10px] leading-relaxed uppercase tracking-wider text-white/40 line-clamp-2">
                        {ahj.inspection_requirements_summary}
                      </p>
                      <div className="flex justify-between items-center pt-4 border-t border-[#222222]">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-white/20">Confidence</span>
                        <span className="text-[10px] font-bold">{(ahj.confidence_score * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Assistant Prompt */}
            <div className="bg-[#111111] border border-[#f97316]/20 p-8 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#f97316] flex items-center justify-center rounded">
                  <Globe size={16} className="text-white" />
                </div>
                <h4 className="text-xs font-bold uppercase tracking-widest">SolarFlow Assistant</h4>
              </div>
              <p className="text-[11px] uppercase tracking-wider text-white/60 leading-relaxed">
                I'm ready to help you move forward. I can help you fill out the permit forms, draft a professional email to the AHJ contact, or guide you through the inspection scheduling process. What would you like to do next?
              </p>
              <div className="flex flex-wrap gap-3">
                <button 
                  onClick={handleHelpFillForms}
                  className="px-4 py-2 bg-[#222222] text-[9px] font-bold uppercase tracking-widest hover:bg-[#f97316] hover:text-white transition-all"
                >
                  Help me fill forms
                </button>
                <button 
                  onClick={handleDraftEmail}
                  className="px-4 py-2 bg-[#222222] text-[9px] font-bold uppercase tracking-widest hover:bg-[#f97316] hover:text-white transition-all"
                >
                  Draft AHJ Email
                </button>
                <button 
                  onClick={handleScheduleInspection}
                  className="px-4 py-2 bg-[#222222] text-[9px] font-bold uppercase tracking-widest hover:bg-[#f97316] hover:text-white transition-all"
                >
                  Schedule Inspection
                </button>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="p-8 bg-[#111111] border border-[#222222] space-y-4">
              <div className="flex items-center gap-2 text-yellow-500">
                <AlertTriangle size={16} />
                <h5 className="text-[10px] font-bold uppercase tracking-widest">SolarFlow Compliance Notice</h5>
              </div>
              <p className="text-[10px] leading-relaxed uppercase tracking-widest text-white/40">
                AI-produced summaries are for guidance only and must be verified with the AHJ before permit submission. SolarFlow AI recommends a human verification workflow to confirm current local amendments and utility interconnection requirements. This data was last verified on {new Date(result.recommended_ahj.last_verified).toLocaleDateString()}.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
