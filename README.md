# HealthTribe AI

<div align="center">
  <p align="center">
    <strong>The Unified AI-First Federated Patient Identity & Collaborative Clinical Care Ecosystem</strong>
  </p>
  <p align="center">
    A production-ready full-stack digital health gateway bridging the gap between patient self-care and professional clinician workflows, built in modern React 19, Tailwind CSS v4, and Node.js.
  </p>
</div>

---

HealthTribe AI is a high-performance digital health orchestrator designed to resolve the multi-layered fragmentation of modern healthcare systems. Positioned as an intelligent gateway for both individuals and practitioners, HealthTribe integrates the statutory trust of the **Ayushman Bharat Digital Mission (ABDM)** and **Ayushman Bharat Health Account (ABHA)** federated identity systems with real-time, context-aware large language model (LLM) intelligence. The platform translates complex, multi-year medical histories, raw laboratory biomarkers, and physical prescriptions into plain-language, bilingual patient companions, while simultaneously automating administrative charting (SOAP notes), clinical briefs, and diagnostic differentials for clinicians.

> **The Vision:** To establish a secure, continuous, and frictionless digital health thread that demystifies clinical complexity—transforming raw, inactive medical records into dynamic, bilingual, and conversational clinical companions that work tirelessly for both the patient at home and the doctor in the clinic.

---

## 🚀 Key Architectural Overview

```
                      +---------------------------------------+
                      |       HealthTribe React Client        |
                      |  - Family Health Vault & Voice AI HUD |
                      |  - Clinical Practitioner Dashboard    |
                      +───────────────────┬───────────────────+
                                          │
                  Global fetch monkeypatch (Context Injection headers)
                                          │
                                          ▼
                      +───────────────────────────────────────+
                      |        Express Server Gateway         |
                      |  - REST API Routes & JSON Schema     |
                      |  - In-Memory User Session Database   |
                      +───────────────────┬───────────────────+
                                          │
                      ┌───────────────────┴───────────────────┐
                      ▼                                       ▼
        +───────────────────────────+           +───────────────────────────+
        |   ABDM Consent Manager    |           |   AI Orchestration Core   |
        |  - OTP Handshake Gateway  |           |  - PromptBuilder Context  |
        |  - Care Context Import    |           |  - Exponential Backoff    |
        +───────────────────────────+           +─────────────┬─────────────+
                                                              │
                                            ┌─────────────────┴─────────────────┐
                                            ▼                                   ▼
                             +─────────────────────────────+     +─────────────────────────────+
                             |     Gemini-3.5-Flash        |     |   Llama-3.3-70B (Groq)      |
                             |  - High-Speed Multimodal   |     |  - High-Density Reasoning   |
                             +─────────────────────────────+     +─────────────────────────────+
```

---

## 📋 Executive Summary

Modern healthcare delivery is plagued by deep structural failures. Historical medical records exist in isolated silos across multiple hospitals and clinics; patients struggle to decipher complex medical jargon, which is almost exclusively written in English; and clinicians spend up to 40% of their day on administrative charting instead of active patient engagement.

HealthTribe AI represents a major architectural shift. It moves beyond standard appointment booking apps to deliver a unified, double-sided clinical ecosystem:

*   **For Patients:** It consolidates multi-generational medical records under a single-guardian family vault, provides bilingual AI symptom triage, translates lab reports, checks for drug-drug interactions, and generates custom recovery diet plans.
*   **For Clinicians:** It provides a high-density clinical dashboard featuring an active patient queue, automatic history summaries, and real-time AI-drafted SOAP notes to optimize the point of care.
*   **ABHA Compatibility:** Built on simulated National Health Authority (NHA) APIs, it implements secure OTP-based federated identity linking and care context consents, creating a production-ready model for ABDM compliance.

---

## 🎯 Product Overview

### The Problem
*   **Hyper-Fragmented Records:** Patient histories are stored in disconnected physical folders or proprietary hospital portals, creating clinical blind spots during emergencies.
*   **Vernacular Exclusion:** Clinical reports and recommendations are printed in complex technical English, building deep comprehension barriers for patients speaking regional languages.
*   **Administrative Burnout:** Clinicians suffer severe documentation fatigue from manually writing consultation notes, reviewing PDF reports, and keying in metrics.
*   **Isolated Care Structures:** Family guardians have no centralized, secure framework to oversee elderly parents' chronic medication lists or children's pediatric charts.

### The Solution
HealthTribe AI introduces a closed-loop digital health thread. By connecting patients and doctors through a shared API layer, the platform automates data extraction, coordinates specialist bookings, and uses conversational AI to translate medical records into clear, actionable advice.

| Feature | Legacy Systems | HealthTribe AI |
| :--- | :--- | :--- |
| **Interoperability** | Missing records, manual paper files | Federated ABDM care context sync & import |
| **Language** | Exclusively technical English | Interactive Voice AI in English, Hindi, & Telugu |
| **Documentation** | Manual typing of consultation notes | Real-time, AI-drafted SOAP charting |
| **Family Care** | Fragmented accounts per individual | Unified guardian vault with rapid profile switching |

### Target Users & Impact
1.  **Multi-generational Families:** Centralize pediatric histories and geriatric prescriptions under one guardian.
2.  **Specialist Clinicians:** Reduce chart retrieval delays and administrative workload through automated briefings and SOAP notes.
3.  **Clinic Networks:** Modernize active patient routing, simplify queue management, and support bilingual consultations.

---

## ✨ Feature Highlights

### 🏠 Patient Experience
*   **Interactive Health Dashboard:** A card-based dashboard that displays vital statistics, active prescriptions, and upcoming appointments.
*   **Bilingual Voice AI HUD:** Speak to the conversational assistant in English, Hindi, or Telugu to ask about records, schedule bookings, or review prescriptions.
*   **Address & Checkout Controls:** Easily configure diagnostic lab or medicine delivery locations with interactive modals.

### 🩺 Doctor Experience
*   **Clinical Workspace Portal:** Switch contexts to a high-density workstation featuring practice statistics and active schedules.
*   **Active Patient Queue:** An interactive patient queue that auto-binds clinical context (history, medications, allergies) for the selected patient.
*   **AI SOAP Note Drafts:** During consultation, the AI compiles findings and drafts subjective, objective, assessment, and planning notes with one click.

### 🧠 AI Capabilities
*   **Symptom Triage Engine:** Instantly assesses symptom inputs, maps urgency categories, recommends matching specialists, and guides next steps.
*   **Drug Interaction Checker:** Checks active medications against known patient allergies to flag cross-reactions and highlight warnings.
*   **Diet Plan Generator:** Tailors scientific post-consultation meal plans based on diagnosis, medications, and food preferences.

### 📈 Healthcare Intelligence
*   **Chronological Timeline:** A multi-year medical history timeline that highlights AI summaries in purple, ABHA-synced records in emerald, and local appointments in blue.
*   **Biomarker Highlighting:** Flags high, low, or normal laboratory values in detailed, interactive tables.
*   **ABHA Scientific Summary:** Instantly compiles and summarizes imported external health records into a clean, scannable clinical paragraph.

### 📂 ABDM & ABHA Gateway
*   **OTP Identity Handshake:** Input ABHA IDs to generate and verify statutory OTP transactions, updating the profile status to "ABHA-Verified."
*   **Dynamic Consent Management:** Issue, review, or revoke care context requests to connected diagnostic labs and hospitals.
*   **Secure Record Import Pipeline:** A multi-stage pipeline (`PENDING` ➔ `FETCHING` ➔ `DECRYPTING` ➔ `PARSING` ➔ `COMPLETED`) that decrypts and parses external clinical records directly into the patient's active timeline.

### 🏥 Emergency Care
*   **Emergency Locator Panel:** Instantly locate nearest critical care hubs, displaying real-time distance, rating, and quick Google Maps routing links.

---

## 🛠️ Tech Stack

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Languages** | TypeScript 5.8+ | Strict type safety across client interfaces and server modules |
| **Frontend** | React 19, Vite 6 | Fast compilation, Hot Module Replacement (HMR) capabilities |
| **Animations** | Motion (Framer) | Fluid transitions, interactive sidebar animations, Voice HUD ripples |
| **Styles** | Tailwind CSS v4 | Utility-first styling with modern css `@theme` variables |
| **Backend** | Express 4.21, Node.js | Robust API router handling complex state orchestration |
| **AI SDKs** | `@google/genai` (Gemini), `groq-sdk` | Integrates `gemini-3.5-flash` and `llama-3.3-70b` |
| **OCR Engines**| `pdfjs-dist`, `pdf-parse` | Extracts structured text layers from uploaded files |
| **Charts & Icons**| Recharts, Lucide React | High-performance canvas graphs, consistent iconography |

---

## ⚙️ Engineering Highlights

### 📦 Modular & Decoupled Architecture
The system isolates UI rendering components from generative AI operations. To handle multiple model families cleanly, the backend uses a generic interface `AIProvider.ts` implemented by two providers:
1.  **`GeminiProvider.ts`:** Uses the modern `@google/genai` SDK to run fast, multimodal analysis with `gemini-3.5-flash`.
2.  **`GroqProvider.ts`:** Uses `groq-sdk` to run rapid, structured JSON completions with `llama-3.3-70b-versatile`.

### 🛡️ Resilient Exponential Backoff
To protect clinical workflows from upstream rate-limiting (HTTP 429) or temporary network drops, `AIService.ts` wraps generative API calls in an automatic retry engine:
```typescript
public static async retryWithBackoff<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries <= 0 || (error.status !== 429 && error.status !== 503)) {
      throw error;
    }
    console.warn(`[AI Service] Rate limited or server busy. Retrying in ${delay}ms... (${retries} retries left)`);
    await new Promise(resolve => setTimeout(resolve, delay));
    return this.retryWithBackoff(fn, retries - 1, delay * 2);
  }
}
```

### 🔌 Global fetch Monkeypatching
To avoid passing user session headers manually across hundreds of client-side queries, `src/App.tsx` globally wraps `window.fetch` to inject current user credentials automatically:
```typescript
if (typeof window !== "undefined") {
  try {
    if (!(window as any).__originalFetch) {
      (window as any).__originalFetch = window.fetch.bind(window);
    }
    const originalFetch = (window as any).__originalFetch;
    Object.defineProperty(window, "fetch", {
      value: async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const email = localStorage.getItem("healthtribe_logged_in_email") || "";
        const profileId = localStorage.getItem("healthtribe_active_profile_id") || "fam-self";
        
        const newInit: RequestInit = init ? { ...init } : {};
        const headers = new Headers(newInit.headers || {});
        if (email) headers.set("x-user-email", email);
        headers.set("x-active-profile-id", profileId);
        newInit.headers = headers;
        
        return originalFetch(input, newInit);
      }
    });
  } catch (e) {
    console.error("Failed to patch window.fetch", e);
  }
}
```

### ⚡ Optimized Production Bundling
During the production build phase, Vite compiles client assets to `dist/`, while `esbuild` bundles the entire Node.js Express backend into a single, self-contained CommonJS file (`dist/server.cjs`):
```bash
vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs
```
This process bundles all internal dependencies, compiles TypeScript type annotations, resolves import paths at compile time, and keeps external npm packages light—enabling incredibly fast cold-start times on containerized runtimes.

---

## 🤖 Deep Dive: AI Core & Prompt Engineering

HealthTribe uses highly structured prompts within `PromptBuilder.ts` to enforce clinical accuracy and return clean JSON objects:

### 🏥 Symptom Triage Prompting
Uses few-shot formatting and strict schema definitions to force the model to output structured assessment criteria. This allows the frontend to parse the result into color-coded urgency alerts:
```typescript
{
  "urgency": "RED" | "YELLOW" | "GREEN",
  "assessment": "Brief clinical assessment...",
  "urgencyColor": "red" | "yellow" | "green",
  "specialtySuggestion": "Cardiologist",
  "homeCareTips": ["Tip 1", "Tip 2"],
  "emergencyWarnings": ["Warning 1"],
  "aiDoctorResponse": "Empathetic patient explanation."
}
```

### 🧪 Smart OCR Biomarker Mapping
Instead of returning unformatted text, the OCR parser processes lab report details against previous medical records to identify anomalies and map historical trends:
```typescript
{
  "marker": "Hemoglobin",
  "value": "11.2",
  "referenceRange": "12.0 - 16.0",
  "status": "Low",
  "severity": "Mildly Decreased",
  "whyItMatters": "Hemoglobin is the iron-containing oxygen-transport metalloprotein in red blood cells.",
  "possibleCauses": "Inadequate dietary iron intake or poor absorption.",
  "trend": "Worsening"
}
```

---

## 🔒 Security & Privacy Blueprint

Healthcare applications process highly sensitive, protected health information (PHI). HealthTribe AI implements a comprehensive security model:

1.  **Session & Boundary Isolation:** User databases are partitioned on the backend. Files, timelines, and family profiles are isolated by sanitizing emails into safe keys (e.g., `kilarisupriya25_gmail_com.json`), preventing cross-tenant access.
2.  **Explicit Consent Lifecycles:** External ABDM Care Context consents default to strict, verifiable statuses (`GRANTED`, `REQUESTED`, `REVOKED`). When a user unlinks their ABHA profile, all active consent keys are purged instantly.
3.  **Practitioner Audit Logging:** The Doctor Portal features an immutable Security Audit Log. Every action—including reviewing patient timelines, viewing history summaries, or writing SOAP prescriptions—is tracked with timestamp, action category, and user credentials, ensuring complete accountability.

---

## 🗺️ Unified User Journeys

### 1. The Patient Care Journey
```
[OTP/Google Login] ➔ [Add Family Member] ➔ [Verify ABHA ID] ➔ [Bilingual Symptom Triage]
                                                                        │
[View Recovery Diet Plan] ◀── [Order Prescribed Meds] ◀── [Consult Doctor] ◀──┘
```

### 2. The Clinical Consultation Loop
```
[Doctor Portal Sign In] ➔ [View Daily Practice Stats] ➔ [Select Patient Queue]
                                                               │
[AI SOAP Notes Generated] ◀── [Telemetry / ECG Monitor] ◀── [Review AI Briefing]
```

### 3. The ABDM Consent & Sync Pipeline
```
[Input ABHA Identifier] ➔ [Verify Statutory OTP] ➔ [Approve Consent Request]
                                                               │
[Structured Timeline Event Card] ◀── [Decrypt & Parse FHIR Records] ◀──┘
```

---

## 📁 Repository Structure

```
├── /data/users             # Multi-tenant user databases (isolated by sanitized email)
├── /server                 # Backend Services & AI Architecture Core
│   └── /ai
│       ├── AIProvider.ts       # Unified Generative Provider Interface
│       ├── AIService.ts        # Resilient service manager (Exponential Backoff)
│       ├── GeminiProvider.ts   # Google Gemini 3.5-Flash integration
│       ├── GroqProvider.ts     # Groq Llama-3.3-70B-Versatile integration
│       └── PromptBuilder.ts    # Centralized System Instruction & Prompt factory
│
├── /src                    # Frontend Application Client
│   ├── /components
│   │   ├── ABHAGateway.tsx          # ABDM Statutory Verification & Record Import
│   │   ├── AICopilotWorkspace.tsx   # Voice AI HUD & Interactive Triage Panel
│   │   ├── AddressModal.tsx         # Delivery addresses selection modal
│   │   ├── ConfirmationModal.tsx    # Clinic appointment action overlays
│   │   ├── DoctorChatbot.tsx        # Practitioner Workspace chatbot helper
│   │   ├── HealthHistoryTimeline.tsx# Collapsible, multi-year chronological cards
│   │   ├── LiveECGMonitor.tsx       # Live patient cardiovascular vital graphics
│   │   └── ProfilePage.tsx          # Client biometric preferences configurations
│   │
│   ├── App.tsx             # Central Routing Core, Dashboard views, & layouts
│   ├── index.css           # Global Tailwind v4 configurations & CSS rules
│   ├── translations.ts     # Trilingual localization dictionaries (EN, HI, TE)
│   └── types.ts            # Global TypeScript data schemas and definitions
│
├── server.ts               # Core Node.js Express server entrypoint & REST API Router
├── metadata.json           # Platform integration capabilities metadata
└── .env.example            # Environment configuration template
```

---

## 🖼️ Interface Previews & Bento Grids

### 📱 Patient Portal Dashboard
```
┌────────────────────────────────────────────────────────────────────────┐
│  HealthTribe AI • Patient Dashboard                         (🔔) [👤]   │
├────────────────────────────────────────────────────────────────────────┤
│  Hello, Supriya!                                                       │
│  [ Active ABHA: supriya@abha • Verified ✔ ]                           │
│                                                                        │
│  ┌─────────────────────────┐ ┌──────────────────────────────────────┐  │
│  │  Vitals Summary         │ │  Upcoming Consultations              │  │
│  │  - BP: 118/75 mmHg      │ │  - Dr. Rahul Atluri                  │  │
│  │  - Heart Rate: 72 bpm   │ │    Cardiology • Today, 10:30 AM      │  │
│  └─────────────────────────┘ └──────────────────────────────────────┘  │
│  ┌─────────────────────────┐ ┌──────────────────────────────────────┐  │
│  │  Active Medications     │ │  Active Family Vault                 │  │
│  │  - Metformin 500mg (QD) │ │  - Self • Srinivas • Rami            │  │
│  └─────────────────────────┘ └──────────────────────────────────────┘  │
│  [ Launch Voice AI HUD ]  [ Run Symptom Triage ]  [ Upload Lab Report ] │
└────────────────────────────────────────────────────────────────────────┘
```

### 🩺 Clinician Workspace
```
┌────────────────────────────────────────────────────────────────────────┐
│  Practitioner Portal • Live Practice Management Panel     [Dr. Rahul]  │
├──────────────────────────────────┬─────────────────────────────────────┤
│  Practice Stats Summary          │  Active Patient: Supriya Kilari     │
│  - Appointments Today: 12        ├─────────────────────────────────────┤
│  - Completed: 8                  │  AI Patient Summary Brief:          │
│  - Revenue: ₹9,600               │  Patient presents history of mild   │
│                                  │  asthma, stable BP, normal ECG.     │
│  Active Consultation Queue       ├─────────────────────────────────────┤
│  - Supriya Kilari (Active)       │  Live Consultation Telemetry        │
│  - Rami Kilari (Next)            │  - Pulse Rate: 72 bpm [Stable]      │
│  - Srinivas Kilari (Waiting)     │  - ECG Feed: Sinus Rhythm Normal    │
│                                  ├─────────────────────────────────────┤
│                                  │  [ AI SOAP NOTES GENERATOR ]        │
└──────────────────────────────────┴─────────────────────────────────────┘
```

### 🗣️ Voice AI HUD
```
┌────────────────────────────────────────────────────────────────────────┐
│  HealthTribe AI • Bilingual Conversational Voice HUD                  │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│                        [ Speaking in Telugu ]                          │
│                                                                        │
│                             _  _  _  _                                 │
│                           _//_//_//_//_                                │
│                          // // // // //                                │
│                          Waveform Reactive                             │
│                                                                        │
│   "హలో సుప్రియ! నేను మీ హెల్త్‌ట్రైబ్ AI కోపైలట్. సహాయం కోసం చెప్పండి."   │
│                                                                        │
│   [ ⏸ Pause ]         [ ■ Stop Conversation ]         [ 🎙 Restart ]  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Installation & Setup

### Prerequisites
*   [Node.js](https://nodejs.org/) (v18.0.0 or higher)
*   [npm](https://www.npmjs.com/) (v9.0.0 or higher)

### Step 1: Clone and Navigate
```bash
git clone https://github.com/your-username/healthtribe-ai.git
cd healthtribe-ai
```

### Step 2: Install Full-Stack Dependencies
```bash
npm install
```

### Step 3: Configure Environment Variables
Copy the configuration template to create your local `.env.local` file:
```bash
cp .env.example .env.local
```
Open `.env.local` and add your api keys:
```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your_google_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
```

### Step 4: Run the Development Server
```bash
npm run dev
```
The server will boot up using `tsx` and automatically bind to port `3000`. Navigate to `http://localhost:3000` to view the application locally.

### Step 5: Production Compilation & Run
```bash
# Compile and bundle the full-stack app
npm run build

# Start the optimized server bundle
npm run start
```

---

## 📈 Future Roadmap

*   **Production ABDM Gateway Integration:** Replace simulated workflows with official National Health Authority (NHA) Sandboxes.
*   **Wearable Health IoT Integrations:** Sync real-time biometrics from Apple Watch or Fitbit directly into the AI Symptom Triage engine.
*   **Ambient Clinical Listening:** Enable background transcription during consultation sessions to automatically draft SOAP notes from conversational speech.
*   **Vernacular Expansion:** Expand bilingual translation services to support regional Indian languages, including Tamil, Kannada, Bengali, and Marathi.
*   **Predictive Health Alerts:** Use historical medical timelines to forecast potential wellness risks and alert clinicians to early symptoms of chronic conditions.

---

## 💡 Lessons Learned & Engineering Reflections

Building an AI-first, full-stack clinical platform highlighted several critical design and performance trade-offs:

1.  **Ensuring Structured LLM Outputs:** Initially, requesting raw text responses from models resulted in inconsistent JSON formatting, which broke frontend UI widgets. Transitioning to explicit schema guidelines inside `PromptBuilder.ts` and configuring `responseMimeType: "application/json"` completely resolved parsing issues.
2.  **Mitigating Latency in Voice AI:** Integrating Speech Recognition with LLM processing and Text-to-Speech synthesis created noticeable lag. Choosing `gemini-3.5-flash` for triage queries and caching system prompts significantly lowered latency, delivering a fast, responsive user experience in our voice HUD.
3.  **Managing Multi-Tenant Data Boundaries:** To ensure user privacy, we isolated files and timelines on the backend. This multi-tenant boundary ensures data security while maintaining fast access times across family profiles.
4.  **Bypassing ES Module Resolution Issues:** To simplify backend deployment, we replaced complex relative path structures with an optimized CJS compilation step using `esbuild`. This approach completely resolves import resolution issues, producing a single `dist/server.cjs` file that loads quickly in containerized environments.

---

## 👨‍💻 About the Developer

This project demonstrates professional full-stack development capability and strong product design thinking:

*   **Full-Stack Software Architecture:** Designed robust client-server communication using global fetch monkeypatching, Express routing, and isolated JSON file-based multi-tenant storage.
*   **AI-First Application Design:** Implemented modular model adapters, structured prompt templates, rate-limiting handlers, and multi-stage OCR parsing pipelines.
*   **Production Engineering Principles:** Set up clean dev/build scripts, optimized asset bundling with `esbuild`, ensured strict TypeScript type safety, and configured defensive error recovery.
*   **Responsive UX/UI Delivery:** Built a distinctive, high-contrast dashboard with Tailwind CSS v4, smooth Framer Motion micro-animations, and full-screen bility features (Voice AI HUD, 44px touch targets).
