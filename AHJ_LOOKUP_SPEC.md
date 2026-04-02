# AHJ Lookup Service Specification

## 1. Feature Spec & API Schema (OpenAPI)

### Overview
A single-ZIP lookup service that returns a recommended AHJ (Authority Having Jurisdiction) and a sorted list of potential AHJs with confidence scores.

### OpenAPI 3.0.0 Specification
```yaml
openapi: 3.0.0
info:
  title: SolarFlow AHJ Lookup API
  version: 1.0.0
  description: Service to resolve ZIP codes to solar-relevant AHJs.
paths:
  /api/ahj/lookup:
    get:
      summary: Lookup AHJ by ZIP code
      parameters:
        - name: zip
          in: query
          required: true
          schema:
            type: string
            pattern: '^\d{5}$'
      responses:
        '200':
          description: Successful lookup
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AHJLookupResponse'
        '400':
          description: Invalid ZIP code
        '500':
          description: Server error

components:
  schemas:
    AHJLookupResponse:
      type: object
      properties:
        zip_code: { type: string }
        primary_city: { type: string }
        county: { type: string }
        state: { type: string }
        recommended_ahj: { $ref: '#/components/schemas/AHJ' }
        ahj_list:
          type: array
          items: { $ref: '#/components/schemas/AHJ' }
        nearest_grid_operator: { type: string }
        utility_interconnection_info: { type: string }
        map_bounds:
          type: object
          properties:
            ne: { type: object, properties: { lat: { type: number }, lng: { type: number } } }
            sw: { type: object, properties: { lat: { type: number }, lng: { type: number } } }

    AHJ:
      type: object
      properties:
        ahj_id: { type: string }
        name: { type: string }
        type: { type: string, enum: [city, county, state, fire_district] }
        address: { type: string }
        contact:
          type: object
          properties:
            phone: { type: string }
            email: { type: string }
        permit_authority: { type: boolean }
        permit_url: { type: string }
        inspection_authority: { type: boolean }
        inspection_requirements_summary: { type: string, maxLength: 280 }
        required_codes:
          type: array
          items: { type: string }
        avg_permit_fee: { type: number }
        response_latency_days: { type: number }
        last_verified: { type: string, format: date-time }
        source: { type: string }
        confidence_score: { type: number, minimum: 0, maximum: 1 }
        confidence_rationale: { type: string }
```

## 2. AI Task Definitions & Prompt Templates

### Task A: Requirements Extraction & Summarization
**Goal**: Extract NEC editions and local amendments from public source docs.
**Prompt Template**:
```text
Analyze the following building department documentation for [AHJ_NAME], [STATE]:
[DOCUMENT_TEXT]

Extract:
1. Adopted NEC edition (e.g., 2020).
2. Local solar-specific amendments.
3. Permit submission URL.
4. Primary contact for solar permits.

Summarize the inspection requirements in under 280 characters.
If a fact is missing, return null. Do not invent data.
```

### Task B: Confidence Scoring & Rationale
**Goal**: Compute confidence score (0-1) based on source provenance and data completeness.
**Prompt Template**:
```text
Evaluate the data extracted for [AHJ_NAME].
Sources provided: [SOURCE_LIST]
Data completeness: [EXTRACTED_FIELDS]

Assign a confidence score from 0.0 to 1.0.
Explain the rationale (e.g., "Direct match from city website" or "Inferred from county-wide rules").
Flag as 'low_confidence' if score < 0.7.
```

## 3. Data Pipeline Design

### Sources & Provenance
- **Primary**: City/County Building Depts, State Code Bodies.
- **Secondary**: Utility Tariffs, Fire Marshal, Assessor Parcels.
- **Provenance**: Every field must store `source_url` and `last_verified` timestamp.

### ETL Steps
1. **Fetch**: Weekly automated scraping of AHJ portals.
2. **Extract**: LLM-based extraction of code versions and contact info.
3. **Validate**: Cross-reference with state-level adoption lists.
4. **Store**: PostgreSQL (or similar) with JSONB for flexible AHJ metadata.

### Timeliness & Staleness
- **Cadence**: Weekly automated checks; Quarterly manual re-verification.
- **Staleness Rule**: Flag items where `last_verified` > 180 days.

## 4. Verification & QA Plan

### Human-in-the-loop (HITL)
- **Threshold**: All items with confidence < 0.7 are queued for manual review.
- **Sampling**: 5% of high-confidence items are audited monthly.
- **Error Handling**: Automated alerts for 404s on source URLs or schema mismatches.

## 5. MVP Implementation Plan

### Timeline (4 Weeks)
- **Week 1**: Seed database with ZIP -> Recommended AHJ mapping for top 100 solar markets.
- **Week 2**: Implement Express API scaffold and Gemini extraction logic.
- **Week 3**: Build React frontend with "Verify before submitting" flags.
- **Week 4**: QA, documentation, and deployment.

### Cost Estimate (MVP: $500)
- **Compute (Cloud Run)**: $50
- **Database (Cloud SQL)**: $100
- **LLM API (Gemini)**: $150
- **Data Acquisition/Scraping**: $200
- **Full Rollout**: Est. $5,000 - $10,000 for nationwide coverage (data cleaning & manual verification).

## 6. Example JSON Response (ZIP 90210)

```json
{
  "zip_code": "90210",
  "primary_city": "Beverly Hills",
  "county": "Los Angeles",
  "state": "CA",
  "recommended_ahj": {
    "ahj_id": "bh-001",
    "name": "City of Beverly Hills Community Development",
    "type": "city",
    "address": "455 N Rexford Dr, Beverly Hills, CA 90210",
    "contact": {
      "phone": "(310) 285-1141",
      "email": "cdpermits@beverlyhills.org"
    },
    "permit_authority": true,
    "permit_url": "https://www.beverlyhills.org/departments/communitydevelopment/buildingandsafety/permits/",
    "inspection_authority": true,
    "inspection_requirements_summary": "NEC 2022 CA Building Code. Structural calcs required for all roof mounts. Rapid shutdown labeling mandatory.",
    "required_codes": ["NEC 2020", "2022 CRC", "2022 CEC"],
    "avg_permit_fee": 450.00,
    "response_latency_days": 5,
    "last_verified": "2026-03-15T10:00:00Z",
    "source": "https://www.beverlyhills.org/buildingandsafety",
    "confidence_score": 0.95,
    "confidence_rationale": "Direct match from official city portal."
  },
  "ahj_list": [
    {
      "ahj_id": "bh-001",
      "name": "City of Beverly Hills Community Development",
      "confidence_score": 0.95
    },
    {
      "ahj_id": "la-county-001",
      "name": "LA County Building and Safety (Unincorporated)",
      "confidence_score": 0.3,
      "confidence_rationale": "Secondary fallback for overlapping boundaries."
    }
  ],
  "nearest_grid_operator": "Southern California Edison (SCE)",
  "utility_interconnection_info": "Net Metering 3.0 applies. Online portal submission required via SCE PowerClerk."
}
```

## 7. UI Copy & Disclaimer

**Disclaimer**:
"SolarFlow AHJ summaries are provided for guidance only. AI-extracted requirements must be verified with the official AHJ documentation before permit submission. SolarFlow AI is not liable for submission errors based on stale or incorrect data."

**Verification CTA**:
"⚠️ Verify requirements with AHJ before submitting. [Open Permit Portal]"

## 8. Monitoring Metrics & Alerts

- **Cache Hit Rate**: Target > 80%.
- **Average Latency**: Target < 500ms (cached), < 2s (cold).
- **Staleness Ratio**: Alert if > 10% of active lookups are > 180 days old.
- **Confidence Trend**: Monitor average confidence score per region.
