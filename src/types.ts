export interface AHJ {
  ahj_id: string;
  name: string;
  type: "city" | "county" | "state" | "utility";
  address: string;
  contact: {
    phone: string;
    email: string;
    website: string;
  };
  permit_authority: boolean;
  permit_url: string;
  inspection_authority: boolean;
  inspection_requirements_summary: string;
  required_codes: string[];
  avg_permit_fee: string;
  response_latency_days: number;
  avg_turnaround_days: number;
  common_rejection_reasons: { reason: string; mitigation: string }[];
  required_documents: string[];
  forms: { name: string; url: string }[];
  bond_required: boolean;
  insurance_required: boolean;
  last_verified: string;
  source: string;
  confidence_score: number;
  confidence_rationale: string;
}

export interface AHJLookupResult {
  zip_code: string;
  primary_city: string;
  county: string;
  state: string;
  recommended_ahj: AHJ;
  ahj_list: AHJ[];
  nearest_grid_operator: string;
  utility_interconnection_info: {
    net_metering_allowed: boolean;
    interconnection_limit_kw: number;
    tariff_reference: string;
    application_link: string;
  };
  parcel_level_override: boolean;
  recommended_next_steps: string[];
  map_bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

export interface Jurisdiction {
  state: string;
  county: string;
  city: string;
  adopted_nec: string;
  saved_at: string;
  data_age_months: number;
  is_stale?: boolean;
}

export type MessageRole = "user" | "assistant";

export interface Message {
  role: MessageRole;
  content: string;
  timestamp: string;
  type?: "compliance_check" | "permit_checklist" | "120_rule" | "rapid_shutdown" | "general" | "refused";
  groundingUrls?: string[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  timestamp: string;
}

export interface CalculationInputs {
  busbarRating: number;
  mainBreakerSize: number;
  proposedSolarBreaker: number;
}
