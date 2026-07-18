import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { aiService } from "./server/ai/AIService";
import { PromptBuilder } from "./server/ai/PromptBuilder";
import { AsyncLocalStorage } from "async_hooks";
import { createClient } from "@supabase/supabase-js";

import dotenv from "dotenv";
dotenv.config();

const app = express();
const PORT = 3000;

// Initialize Server-Side Supabase Client (Using Service Role/Secret Key)
const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || "";
let supabaseAdmin: any = null;

if (supabaseUrl && supabaseSecretKey) {
  try {
    supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    console.log("Supabase initialized successfully on server.");
  } catch (error) {
    console.error("Failed to initialize Supabase on server:", error);
  }
} else {
  console.warn("Supabase environment variables (VITE_SUPABASE_URL, SUPABASE_SECRET_KEY) are missing on server.");
}


export function debugLog(...args: any[]) {
  const line = `[DEBUG_LOG] [${new Date().toISOString()}] ` + args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ") + "\n";
  console.log(line.trim());
  try {
    fs.appendFileSync(path.join(process.cwd(), "debug.log"), line, "utf-8");
  } catch (e) {
    // Ignore log errors
  }
}

async function loadUserDbFromSupabase(sanitizedEmail: string): Promise<any> {
  if (!supabaseAdmin) return null;
  try {
    const { data, error } = await supabaseAdmin
      .from("users_data")
      .select("data")
      .eq("id", sanitizedEmail)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // PGRST116 is code for "The query returned no rows" (normal for new users)
        return null;
      }
      console.error(`Error loading user DB from Supabase for ${sanitizedEmail}:`, JSON.stringify(error, null, 2));
      return null;
    }
    return data?.data;
  } catch (error: any) {
    console.error(`Error loading user DB from Supabase for ${sanitizedEmail}:`, error?.message || error);
  }
  return null;
}

async function saveUserDbToSupabase(sanitizedEmail: string, userDb: any): Promise<void> {
  if (!supabaseAdmin) return;
  try {
    const userEmail = userDb?.primaryProfile?.email || sanitizedEmail.replace(/_/g, "@");
    const { error } = await supabaseAdmin
      .from("users_data")
      .upsert({
        id: sanitizedEmail,
        user_email: userEmail,
        data: userDb,
        updated_at: new Date().toISOString()
      }, {
        onConflict: "id"
      });

    if (error) {
      console.error(`Error saving user DB to Supabase for ${sanitizedEmail}:`, JSON.stringify(error, null, 2));
    }
  } catch (error: any) {
    console.error(`Error saving user DB to Supabase for ${sanitizedEmail}:`, error?.message || error);
  }
}

export const dbStorage = new AsyncLocalStorage<{ req: express.Request; userDb?: any; modified?: boolean }>();
export const userDbCache = new Map<string, any>();

app.use(express.json({ limit: "50mb" }));

app.use(async (req, res, next) => {
  const email = req.headers["x-user-email"] as string;
  let userDb: any = null;

  if (email) {
    const cleanEmail = email.trim().toLowerCase();
    const isDemoEmail = ["supriya@gmail.com", "father@gmail.com", "mother@gmail.com", "doctor@healthtribe.com"].includes(cleanEmail);
    if (!isDemoEmail) {
      const sanitizedEmail = cleanEmail.replace(/[^a-zA-Z0-9]/g, "_");
      if (userDbCache.has(sanitizedEmail)) {
        userDb = userDbCache.get(sanitizedEmail);
      } else {
        userDb = await loadUserDbFromSupabase(sanitizedEmail);
        if (!userDb) {
          const filePath = path.join(USER_DATA_DIR, `${sanitizedEmail}.json`);
          if (fs.existsSync(filePath)) {
            try {
              userDb = JSON.parse(fs.readFileSync(filePath, "utf-8"));
            } catch (e) {
              // Ignore
            }
          }
        }
        if (userDb) {
          userDbCache.set(sanitizedEmail, userDb);
        }
      }
    }
  }

  const store: { req: express.Request; userDb?: any; modified?: boolean } = { req };
  if (userDb) {
    store.userDb = userDb;
  }

  dbStorage.run(store, () => {
    res.on("finish", async () => {
      const currentStore = dbStorage.getStore();
      if (currentStore && currentStore.userDb && currentStore.userDb !== base_db && currentStore.modified) {
        saveUserDb(req, currentStore.userDb);
        if (email) {
          const cleanEmail = email.trim().toLowerCase();
          const isDemoEmail = ["supriya@gmail.com", "father@gmail.com", "mother@gmail.com", "doctor@healthtribe.com"].includes(cleanEmail);
          if (!isDemoEmail) {
            const sanitizedEmail = cleanEmail.replace(/[^a-zA-Z0-9]/g, "_");
            userDbCache.set(sanitizedEmail, currentStore.userDb);
            await saveUserDbToSupabase(sanitizedEmail, currentStore.userDb);
          }
        }
      }
    });
    next();
  });
});


// ---------------------------------------------------------
// IN-MEMORY DATABASE STATE (Pre-seeded & Dynamic)
// ---------------------------------------------------------

const SEEDED_SPECIALTIES = [
  { id: "gen_physician", name: "General Physician", description: "Primary care & general health", count: 124, icon: "Stethoscope" },
  { id: "cardiologist", name: "Cardiology", description: "Heart & cardiovascular care", count: 42, icon: "Heart" },
  { id: "neurologist", name: "Neurology", description: "Brain, nerves & neurological care", count: 29, icon: "Brain" },
  { id: "orthopedic", name: "Orthopedics", description: "Bones, joints & musculoskeletal care", count: 52, icon: "Bone" },
  { id: "dermatologist", name: "Dermatology", description: "Skin, hair & cosmetic care", count: 64, icon: "Sparkles" },
  { id: "pediatrician", name: "Pediatrics", description: "Child health & development", count: 85, icon: "Baby" },
  { id: "gastroenterologist", name: "Gastroenterology", description: "Digestive system & liver care", count: 33, icon: "Stomach" },
  { id: "pulmonology", name: "Pulmonology", description: "Lungs & respiratory care", count: 18, icon: "Lungs" },
  { id: "endocrinology", name: "Endocrinology", description: "Hormones & endocrine disorders", count: 22, icon: "Activity" },
  { id: "ophthalmology", name: "Ophthalmology", description: "Eye & vision care", count: 41, icon: "Eye" },
  { id: "ent", name: "ENT", description: "Ear, nose & throat care", count: 26, icon: "Ear" },
  { id: "psychiatry", name: "Psychiatry", description: "Mental health & emotional well-being", count: 35, icon: "UserCheck" },
  { id: "gynecology", name: "Gynecology", description: "Women's health & reproductive care", count: 76, icon: "Heart" },
  { id: "urology", name: "Urology", description: "Urinary tract & male health", count: 19, icon: "Activity" },
  { id: "oncology", name: "Oncology", description: "Cancer care & treatment", count: 15, icon: "Ribbon" },
  { id: "hematology", name: "Hematology", description: "Blood disorders & care", count: 12, icon: "Droplet" },
  { id: "rheumatology", name: "Rheumatology", description: "Autoimmune & joint diseases", count: 14, icon: "Activity" },
  { id: "dentistry", name: "Dentistry", description: "Teeth & oral health", count: 110, icon: "Smile" },
  { id: "allergy_immunology", name: "Allergy & Immunology", description: "Allergies & immune system", count: 20, icon: "ShieldAlert" },
  { id: "nephrology", name: "Nephrology", description: "Kidney health & diseases", count: 17, icon: "Activity" },
  { id: "plastic_surgery", name: "Plastic Surgery", description: "Reconstructive & cosmetic surgery", count: 21, icon: "Smile" },
  { id: "radiology", name: "Radiology", description: "Imaging & diagnostic radiology", count: 28, icon: "FileText" },
  { id: "physiotherapy", name: "Physiotherapy", description: "Rehabilitation & physical therapy", count: 45, icon: "Accessibility" },
  { id: "nutrition_dietetics", name: "Nutrition & Dietetics", description: "Diet, nutrition & lifestyle", count: 30, icon: "Apple" }
];

const SEEDED_DOCTORS = [
  {
    id: "D000",
    name: "Dr. Rahul Atluri",
    specialty: "Cardiology",
    specialtyId: "cardiologist",
    experience: 14,
    rating: 4.9,
    reviewsCount: 312,
    hospital: "AIMS Super Speciality Hospital",
    languages: ["English", "Telugu", "Hindi"],
    fee: 800,
    availableToday: true,
    avatar: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=200",
    bio: "Dr. Rahul Atluri is a senior cardiologist specializing in interventional cardiology and preventive heart health. With over 14 years of experience, he is dedicated to guiding patients through complex cardiovascular journeys.",
    education: "MD - Cardiology (AIIMS), MBBS (JIPMER)",
    availabilitySlots: ["09:00 AM", "10:30 AM", "11:00 AM", "03:00 PM", "04:30 PM", "06:00 PM"]
  },
  {
    id: "D001",
    name: "Dr. Rajesh Varma",
    specialty: "Orthopedics",
    specialtyId: "orthopedic",
    experience: 12,
    rating: 4.8,
    reviewsCount: 245,
    hospital: "Fortis Hospital",
    languages: ["English", "Hindi", "Punjabi"],
    fee: 800,
    availableToday: true,
    avatar: "https://images.unsplash.com/photo-1594824813573-246434de83fb?auto=format&fit=crop&q=80&w=200",
    bio: "Dr. Rajesh Varma is an expert in orthopedic surgery, knee pain assessments, and musculoskeletal rehabilitation.",
    education: "MS - Orthopedics, MBBS",
    availabilitySlots: ["10:00 AM", "11:30 AM", "02:00 PM", "04:30 PM"]
  },
  {
    id: "D002",
    name: "Dr. Rohan Mehta",
    specialty: "Neurology",
    specialtyId: "neurologist",
    experience: 10,
    rating: 4.7,
    reviewsCount: 180,
    hospital: "NeuroCare Institute",
    languages: ["English", "Gujarati", "Hindi"],
    fee: 900,
    availableToday: true,
    avatar: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=200",
    bio: "Dr. Rohan Mehta specializes in managing chronic migraines, stroke rehabilitation, and spinal nerve care.",
    education: "DM - Neurology (NIMHANS), MD",
    availabilitySlots: ["09:30 AM", "11:30 AM", "03:30 PM", "05:00 PM"]
  },
  {
    id: "D003",
    name: "Dr. Priya Nair",
    specialty: "Pediatrics",
    specialtyId: "pediatrician",
    experience: 8,
    rating: 4.6,
    reviewsCount: 195,
    hospital: "ChildCare Hospital",
    languages: ["English", "Malayalam", "Tamil"],
    fee: 700,
    availableToday: true,
    avatar: "https://images.unsplash.com/photo-1527613426441-4da17471b66d?auto=format&fit=crop&q=80&w=200",
    bio: "Dr. Priya Nair is renowned for clinical pediatrics, routine vaccinations, and developmental milestones guidance.",
    education: "MD - Pediatrics, MBBS",
    availabilitySlots: ["10:30 AM", "12:00 PM", "04:00 PM", "06:00 PM"]
  },
  {
    id: "D004",
    name: "Dr. Vikram Shah",
    specialty: "Orthopedics",
    specialtyId: "orthopedic",
    experience: 15,
    rating: 4.9,
    reviewsCount: 320,
    hospital: "OrthoMax Hospital",
    languages: ["English", "Hindi", "Marathi"],
    fee: 900,
    availableToday: true,
    avatar: "https://images.unsplash.com/photo-1607990283143-e81e7a2c93ab?auto=format&fit=crop&q=80&w=200",
    bio: "Dr. Vikram Shah is a leading orthopedic surgeon focusing on joint replacements, sports injuries, and musculoskeletal repair.",
    education: "MS - Orthopedics (KEM Mumbai), MBBS",
    availabilitySlots: ["09:00 AM", "11:00 AM", "02:00 PM", "05:00 PM"]
  },
  {
    id: "D005",
    name: "Dr. Meera Iyer",
    specialty: "Endocrinology",
    specialtyId: "endocrinology",
    experience: 9,
    rating: 4.7,
    reviewsCount: 150,
    hospital: "Apollo Clinic",
    languages: ["English", "Tamil", "Telugu"],
    fee: 600,
    availableToday: true,
    avatar: "https://images.unsplash.com/photo-1594824813573-246434de83fb?auto=format&fit=crop&q=80&w=200",
    bio: "Dr. Meera Iyer offers comprehensive endocrinology and diabetic therapies, helping patients achieve metabolic balance.",
    education: "DM - Endocrinology, MD",
    availabilitySlots: ["09:00 AM", "10:30 AM", "12:30 PM", "03:30 PM"]
  },
  {
    id: "D006",
    name: "Dr. Amit Das",
    specialty: "General Physician",
    specialtyId: "gen_physician",
    experience: 7,
    rating: 4.5,
    reviewsCount: 410,
    hospital: "HealthFirst Clinic",
    languages: ["English", "Bengali", "Hindi"],
    fee: 500,
    availableToday: true,
    avatar: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=200",
    bio: "Dr. Amit Das provides general health checks, blood pressure reviews, diabetic consults, and primary triage.",
    education: "MD - General Medicine (Calcutta Medical), MBBS",
    availabilitySlots: ["08:30 AM", "10:30 AM", "02:30 PM", "05:00 PM"]
  },
  {
    id: "D007",
    name: "Dr. Neha Kapoor",
    specialty: "ENT",
    specialtyId: "ent",
    experience: 11,
    rating: 4.6,
    reviewsCount: 135,
    hospital: "ENT Care Center",
    languages: ["English", "Hindi", "Odia"],
    fee: 650,
    availableToday: true,
    avatar: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=200",
    bio: "Dr. Neha Kapoor is dedicated to treatment of ear, nose, and throat disorders with advanced diagnostics.",
    education: "MS - ENT (AIIMS), MBBS",
    availabilitySlots: ["10:00 AM", "11:00 AM", "03:00 PM", "04:30 PM"]
  },
  {
    id: "D008",
    name: "Dr. Arjun Patel",
    specialty: "Gastroenterology",
    specialtyId: "gastroenterologist",
    experience: 13,
    rating: 4.8,
    reviewsCount: 220,
    hospital: "DigestWell Hospital",
    languages: ["English", "Gujarati", "Hindi"],
    fee: 850,
    availableToday: true,
    avatar: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=200",
    bio: "Dr. Arjun Patel is a specialist in digestive systems, endoscopy, and hepatic/liver wellness.",
    education: "DM - Gastroenterology (SGPGI), MD",
    availabilitySlots: ["09:30 AM", "11:30 AM", "03:30 PM", "05:30 PM"]
  },
  {
    id: "D009",
    name: "Dr. Kavita Reddy",
    specialty: "Pulmonology",
    specialtyId: "pulmonology",
    experience: 14,
    rating: 4.8,
    reviewsCount: 165,
    hospital: "BreathEasy Lung Clinic",
    languages: ["English", "Telugu", "Hindi"],
    fee: 800,
    availableToday: true,
    avatar: "https://images.unsplash.com/photo-1594824813573-246434de83fb?auto=format&fit=crop&q=80&w=200",
    bio: "Dr. Kavita Reddy is a highly-regarded pulmonologist dedicated to respiratory care, asthma therapies, and advanced lung wellness programs.",
    education: "MD - Pulmonology, MBBS",
    availabilitySlots: ["09:00 AM", "11:00 AM", "03:00 PM", "05:00 PM"]
  },
  {
    id: "D010",
    name: "Dr. Alok Sharma",
    specialty: "Endocrinology",
    specialtyId: "endocrinology",
    experience: 11,
    rating: 4.6,
    reviewsCount: 112,
    hospital: "Metabolism Care Center",
    languages: ["English", "Hindi"],
    fee: 750,
    availableToday: true,
    avatar: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=200",
    bio: "Dr. Alok Sharma is a dedicated endocrinologist specializing in diabetes care, metabolic therapies, and hormonal balance treatments.",
    education: "DM - Endocrinology, MD",
    availabilitySlots: ["10:00 AM", "12:00 PM", "04:00 PM"]
  },
  {
    id: "D011",
    name: "Dr. Vivek Sharma",
    specialty: "Pulmonology",
    specialtyId: "pulmonology",
    experience: 9,
    rating: 4.7,
    reviewsCount: 140,
    hospital: "Manipal Hospital",
    languages: ["English", "Hindi", "Kannada"],
    fee: 600,
    availableToday: true,
    avatar: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=200",
    bio: "Dr. Vivek Sharma provides comprehensive lung care and respiratory consultation services.",
    education: "MD - Pulmonology, MBBS",
    availabilitySlots: ["09:30 AM", "11:30 AM", "02:30 PM", "04:30 PM"]
  },
  {
    id: "D012",
    name: "Dr. Rajesh Khanna",
    specialty: "Psychiatry",
    specialtyId: "psychiatry",
    experience: 16,
    rating: 4.9,
    reviewsCount: 205,
    hospital: "MindSpace Wellness",
    languages: ["English", "Hindi", "Punjabi"],
    fee: 1000,
    availableToday: true,
    avatar: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=200",
    bio: "Dr. Rajesh Khanna is a compassionate psychiatrist focused on mental health, anxiety solutions, and supportive cognitive therapies.",
    education: "MD - Psychiatry, DPM",
    availabilitySlots: ["10:30 AM", "01:00 PM", "03:30 PM", "06:00 PM"]
  },
  {
    id: "D013",
    name: "Dr. Sunita Rao",
    specialty: "Gynecology",
    specialtyId: "gynecology",
    experience: 18,
    rating: 4.9,
    reviewsCount: 280,
    hospital: "Matrika Women's Hospital",
    languages: ["English", "Telugu", "Kannada"],
    fee: 950,
    availableToday: true,
    avatar: "https://images.unsplash.com/photo-1594824813573-246434de83fb?auto=format&fit=crop&q=80&w=200",
    bio: "Dr. Sunita Rao provides comprehensive maternal-fetal care, reproductive health guidance, and wellness programs for women.",
    education: "MD - Gynecology, DGO",
    availabilitySlots: ["09:00 AM", "11:30 AM", "03:00 PM", "05:30 PM"]
  },
  {
    id: "D014",
    name: "Dr. Vijay Kumar",
    specialty: "Urology",
    specialtyId: "urology",
    experience: 12,
    rating: 4.5,
    reviewsCount: 98,
    hospital: "UroHealth Institute",
    languages: ["English", "Hindi", "Tamil"],
    fee: 700,
    availableToday: true,
    avatar: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=200",
    bio: "Dr. Vijay Kumar is an experienced urologist offering clinical consultations, prostate screenings, and urinary tract treatments.",
    education: "MCh - Urology, MS",
    availabilitySlots: ["11:00 AM", "01:00 PM", "04:00 PM", "06:00 PM"]
  },
  {
    id: "D015",
    name: "Dr. Emily Fernandes",
    specialty: "Oncology",
    specialtyId: "oncology",
    experience: 15,
    rating: 4.8,
    reviewsCount: 190,
    hospital: "Hope Cancer Pavilion",
    languages: ["English", "Konkani", "Hindi"],
    fee: 1200,
    availableToday: true,
    avatar: "https://images.unsplash.com/photo-1527613426441-4da17471b66d?auto=format&fit=crop&q=80&w=200",
    bio: "Dr. Emily Fernandes is a dedicated medical oncologist guiding families through custom-targeted cancer care and therapy paths.",
    education: "DM - Medical Oncology, MD",
    availabilitySlots: ["10:00 AM", "12:30 PM", "03:00 PM", "05:00 PM"]
  },
  {
    id: "D016",
    name: "Dr. Sandeep Mahto",
    specialty: "Nephrology",
    specialtyId: "nephrology",
    experience: 10,
    rating: 4.6,
    reviewsCount: 115,
    hospital: "Kidney Care Labs",
    languages: ["English", "Hindi", "Maithili"],
    fee: 800,
    availableToday: true,
    avatar: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=200",
    bio: "Dr. Sandeep Mahto is an expert nephrologist specializing in hypertension, chronic kidney disease, and dialysis therapies.",
    education: "DM - Nephrology, MD",
    availabilitySlots: ["09:00 AM", "10:30 AM", "02:30 PM", "04:30 PM"]
  }
];

const SEEDED_HOSPITALS = [
  {
    id: "hosp-star",
    name: "Star Multi-Speciality Hospitals",
    distance: "700 m",
    rating: 4.6,
    specialties: ["Cardiology", "Neurology", "Emergency Care", "Orthopedics"],
    emergency: true,
    address: "Survey No. 74",
    govBenefits: true,
    image: "https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?auto=format&fit=crop&q=80&w=400",
    openStatus: "Open 24 Hours",
    abhaCompatible: true,
    ayushmanBharatAccepted: true,
    emergencyBadge: "Trauma Ready",
    estimatedArrival: {
      car: "3 min",
      ambulance: "1 min",
      walk: "8 min"
    },
    phone: "+91 40 4000 5000",
    website: "https://www.starhospitals.in"
  },
  {
    id: "hosp-continental",
    name: "Continental Hospitals",
    distance: "950 m",
    rating: 4.7,
    specialties: ["Oncology", "Gastroenterology", "Critical Care", "Multi-Speciality"],
    emergency: true,
    address: "Plot No. 3, Road No. 2",
    govBenefits: true,
    image: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=400",
    openStatus: "Open 24 Hours",
    abhaCompatible: true,
    ayushmanBharatAccepted: true,
    emergencyBadge: "24×7 Emergency",
    estimatedArrival: {
      car: "4 min",
      ambulance: "2 min",
      walk: "11 min"
    },
    phone: "+91 40 6700 0000",
    website: "https://www.continentalhospitals.com"
  },
  {
    id: "hosp-apollo",
    name: "Apollo Hospitals – Financial District",
    distance: "900 m",
    rating: 4.7,
    specialties: ["Emergency Medicine", "Cardiology", "Joint Replacements", "Organ Transplant"],
    emergency: true,
    address: "Financial District, Hyderabad",
    govBenefits: false,
    image: "https://images.unsplash.com/photo-1586773860418-d3b3da9601ee?auto=format&fit=crop&q=80&w=400",
    openStatus: "Open 24 Hours",
    abhaCompatible: true,
    ayushmanBharatAccepted: false,
    emergencyBadge: "ICU Available",
    estimatedArrival: {
      car: "4 min",
      ambulance: "2 min",
      walk: "10 min"
    },
    phone: "+91 40 2360 7777",
    website: "https://www.apollohospitals.com"
  }
];

const SEEDED_MEDICINES = [
  { id: "med-1", name: "Metformin 500mg", strength: "500mg", manufacturer: "Cipla Ltd", mrp: 120, discount: 15, rxRequired: true, category: "Diabetes" },
  { id: "med-2", name: "Atorvastatin 10mg", strength: "10mg", manufacturer: "Sun Pharma", mrp: 180, discount: 10, rxRequired: true, category: "Heart Care" },
  { id: "med-3", name: "Paracetamol 650mg", strength: "650mg", manufacturer: "GSK", mrp: 30, discount: 5, rxRequired: false, category: "Pain & Fever" },
  { id: "med-4", name: "Amoxicillin 500mg", strength: "500mg", manufacturer: "Abbott", mrp: 150, discount: 12, rxRequired: true, category: "Antibiotics" }
];

const SEEDED_LAB_TESTS = [
  { id: "lab-1", name: "Comprehensive Full Body Checkup", description: "Includes 84 vital parameters (Liver, Kidney, Thyroid, Blood count etc)", preparation: "Fasting required for 10-12 hours", price: 1499, originalPrice: 3299, tags: ["Popular", "Highly Recommended"] },
  { id: "lab-2", name: "HbA1c & Blood Sugar Fasting", description: "Standard screening for Diabetes monitoring", preparation: "8 hours fasting required", price: 499, originalPrice: 999, tags: ["Diabetes"] },
  { id: "lab-3", name: "Lipid Profile (Cholesterol Check)", description: "Evaluates risk of heart disease & stroke", preparation: "12 hours fasting required", price: 599, originalPrice: 1200, tags: ["Heart Care"] }
];

const SEEDED_COUPONS = [
  { code: "HEALTH50", discountPercent: 50, maxDiscount: 200, description: "Save 50% on your first AI Consultation or booking." },
  { code: "TRIBE20", discountPercent: 20, maxDiscount: 500, description: "Flat 20% discount on medicines and lab tests." },
  { code: "AYUSHMAN", discountPercent: 100, maxDiscount: 1000, description: "Free screening for verified low-income cardholders." }
];

interface FamilyMember {
  id: string;
  name: string;
  relation: string;
  age: number;
  gender: string;
  bloodGroup: string;
  allergies: string;
  chronicConditions: string;
  medications: string;
  height?: string;
  weight?: string;
  phone?: string;
  email?: string;
  onboardingComplete?: boolean;
  abhaNumber?: string;
  abhaVerified?: boolean;
  emergencyContact?: string;
  profileCode?: string;
  linked?: boolean;
  linkedStatus?: string;
  belongsTo?: string;
}

// STATE STORAGE
let base_db: {
  appointments: any[];
  familyMembers: FamilyMember[];
  medicalTimeline: any[];
  medicineOrders: any[];
  labBookings: any[];
  abhaIdentities: any[];
  consentRecords: any[];
  importSessions: any[];
  importedHealthRecords: any[];
  supportChats: any[];
  triageConversations: any[];
  triageMessages: any[];
  auditLogs: any[];
  settings: any;
  aiConversations: any[];
  doctors: any[];
} = {
  aiConversations: [
    {
      id: "conv-chest-pain",
      title: "Chest Tightness Analysis",
      sessionMode: "patient",
      patientId: "fam-self",
      createdAt: "2026-06-16T10:00:00Z",
      updatedAt: "2026-06-16T10:15:00Z",
      messages: [
        { id: "m1", sender: "user", text: "I felt a brief tightness in my chest yesterday while climbing stairs. Should I be worried?", timestamp: "2026-06-16T10:00:00Z" },
        { id: "m2", sender: "ai", text: "A brief tightness in your chest during exertion (like climbing stairs) is a symptom that requires careful clinical evaluation. While it can sometimes be related to non-cardiac causes (like muscle strain or mild asthma, which is in your history), we must rule out cardiovascular causes. Since you have a family history of hypertension, please schedule a consultation with a cardiologist. In the meantime, avoid heavy exertion, and seek immediate emergency care if you experience chest pain radiating to your arm/jaw, shortness of breath, cold sweats, or dizziness.", timestamp: "2026-06-16T10:02:00Z" },
        { id: "m3", sender: "user", text: "Thank you, I will book an appointment with a cardiologist.", timestamp: "2026-06-16T10:15:00Z" }
      ]
    },
    {
      id: "conv-blood-report",
      title: "Vitamin D3 Blood Report",
      sessionMode: "patient",
      patientId: "fam-self",
      createdAt: "2026-05-21T09:00:00Z",
      updatedAt: "2026-05-21T09:10:00Z",
      messages: [
        { id: "m4", sender: "user", text: "My Vitamin D-3 is 18 ng/mL according to my blood test. How much supplement should I take?", timestamp: "2026-05-21T09:00:00Z" },
        { id: "m5", sender: "ai", text: "A Vitamin D-3 level of 18 ng/mL is considered moderately deficient (the normal reference range is usually 30-100 ng/mL). Clinical guidelines typically recommend starting oral Vitamin D-3 (Cholecalciferol) supplements: 60,000 IU once weekly for 8 weeks, followed by a maintenance dose of 1,000-2,000 IU daily or 60,000 IU once a month. Please confirm this regimen with your primary physician. Additionally, try to include fortified foods, egg yolks, and mushrooms in your diet and get 10-15 minutes of sunlight exposure daily.", timestamp: "2026-05-21T09:02:00Z" }
      ]
    },
    {
      id: "conv-med-inhaler",
      title: "Inhaler Use & Exercise",
      sessionMode: "patient",
      patientId: "fam-self",
      createdAt: "2026-04-10T14:00:00Z",
      updatedAt: "2026-04-10T14:05:00Z",
      messages: [
        { id: "m6", sender: "user", text: "Can I take my inhaler before working out?", timestamp: "2026-04-10T14:00:00Z" },
        { id: "m7", sender: "ai", text: "Yes, using your rescue bronchodilator (such as your Albuterol/Levosalbutamol inhaler) 15 to 30 minutes before starting exercise is a highly effective, standard clinical recommendation for managing exercise-induced bronchoconstriction. This helps keep your airways relaxed and open. Remember to warm up for 5-10 minutes before starting vigorous workouts, stay hydrated, and keep your inhaler with you. If you experience shortness of breath, wheezing, or coughing during exercise, stop immediately and use your inhaler.", timestamp: "2026-04-10T14:02:00Z" }
      ]
    },
    {
      id: "conv-timeline",
      title: "Annual Health Summary",
      sessionMode: "patient",
      patientId: "fam-self",
      createdAt: "2026-06-20T11:00:00Z",
      updatedAt: "2026-06-20T11:05:00Z",
      messages: [
        { id: "m8", sender: "user", text: "Can you summarize my medical history for the past year?", timestamp: "2026-06-20T11:00:00Z" },
        { id: "m9", sender: "ai", text: "Certainly, Supriya! Here is a summary of your key health events over the past year:\n1. **June 15, 2026**: Completed your Annual Heart Health Checkup with Dr. Rahul Atluri. Sinus rhythm was normal and blood pressure was optimal at 118/75.\n2. **May 20, 2026**: Had lab work completed, showing moderate Vitamin D deficiency (18 ng/mL) and normal blood cell indices.\n3. **April 5, 2026**: Received your annual Influenza vaccine booster.\n4. **January 12, 2026**: Managed mild seasonal asthma with short-acting beta-agonists (Inhaler SOS).\nOverall, your chronic vitals are stable, and the primary focus is correcting the Vitamin D deficiency.", timestamp: "2026-06-20T11:02:00Z" }
      ]
    },
    {
      id: "conv-appt-booking",
      title: "Mehta Follow-up Booking",
      sessionMode: "patient",
      patientId: "fam-self",
      createdAt: "2026-07-01T15:00:00Z",
      updatedAt: "2026-07-01T15:05:00Z",
      messages: [
        { id: "m10", sender: "user", text: "Book me a follow-up appointment with Dr. Mehta.", timestamp: "2026-07-01T15:00:00Z" },
        { id: "m11", sender: "ai", text: "I can help with that! I've checked Dr. Rajesh Mehta's (Cardiologist) availability. His next open slot is on **Next Tuesday at 10:30 AM** for an In-Person consultation. Would you like me to reserve this appointment for you?", timestamp: "2026-07-01T15:02:00Z" }
      ]
    },
    {
      id: "conv-abha",
      title: "ABHA Gateway Setup",
      sessionMode: "patient",
      patientId: "fam-self",
      createdAt: "2026-07-04T18:00:00Z",
      updatedAt: "2026-07-04T18:05:00Z",
      messages: [
        { id: "m12", sender: "user", text: "How do I sync my hospital records securely using my ABHA ID?", timestamp: "2026-07-04T18:00:00Z" },
        { id: "m13", sender: "ai", text: "To sync your records securely:\n1. Ensure your active profile is linked to your **ABHA ID** (91-8402-1234-5678) in the ABHA Health Gateway.\n2. Go to the **ABHA Sync Gateway** tab in the sidebar.\n3. You will see a list of participating hospitals (like AIIMS Bangalore or Apollo Greams Road Clinic).\n4. Request access by clicking 'Request Consent' for the hospital. The gateway will instantly verify the electronic consent certificate.\n5. Once granted, click 'Sync' to securely fetch, decrypt, and map FHIR-compliant medical records to your Timeline.", timestamp: "2026-07-04T18:02:00Z" }
      ]
    }
  ],
  doctors: SEEDED_DOCTORS,

  appointments: [
    // --- 5 UPCOMING APPOINTMENTS ---
    {
      id: "appt-upcoming-1",
      doctorId: "D000",
      doctorName: "Dr. Rahul Atluri",
      specialty: "Cardiology",
      patientId: "fam-self",
      patientName: "Supriya Kilari",
      date: "17 Jul 2026",
      time: "10:30 AM",
      status: "Upcoming",
      type: "In-Person",
      hospital: "AIMS Super Speciality Hospital",
      fee: 800,
      notes: "Chest Pain Follow-up"
    },
    {
      id: "appt-upcoming-2",
      doctorId: "D001",
      doctorName: "Dr. Rajesh Varma",
      specialty: "Orthopedics",
      patientId: "fam-1",
      patientName: "Srinivas Kilari",
      date: "20 Jul 2026",
      time: "11:00 AM",
      status: "Upcoming",
      type: "In-Person",
      hospital: "Fortis Hospital",
      fee: 800,
      notes: "Knee Pain Review"
    },
    {
      id: "appt-upcoming-3",
      doctorId: "D005",
      doctorName: "Dr. Meera Iyer",
      specialty: "Endocrinology",
      patientId: "fam-3",
      patientName: "Janaki Kilari",
      date: "24 Jul 2026",
      time: "09:30 AM",
      status: "Upcoming",
      type: "In-Person",
      hospital: "Apollo Clinic",
      fee: 600,
      notes: "Diabetes Follow-up"
    },
    {
      id: "appt-upcoming-4",
      doctorId: "D011",
      doctorName: "Dr. Vivek Sharma",
      specialty: "Pulmonology",
      patientId: "fam-2",
      patientName: "Rama Rao Kilari",
      date: "26 Jul 2026",
      time: "02:00 PM",
      status: "Upcoming",
      type: "Video",
      hospital: "Manipal Hospital",
      fee: 700,
      notes: "COPD Review"
    },
    {
      id: "appt-upcoming-5",
      doctorId: "D003",
      doctorName: "Dr. Priya Nair",
      specialty: "Pediatrics",
      patientId: "fam-4",
      patientName: "Ananya Kilari",
      date: "28 Jul 2026",
      time: "10:00 AM",
      status: "Upcoming",
      type: "In-Person",
      hospital: "ChildCare Hospital",
      fee: 700,
      notes: "Vaccination"
    },

    // --- 5 COMPLETED APPOINTMENTS ---
    {
      id: "appt-completed-1",
      doctorId: "D000",
      doctorName: "Dr. Rahul Atluri",
      specialty: "Cardiology",
      patientId: "fam-self",
      patientName: "Supriya Kilari",
      date: "12 Jul 2026",
      time: "11:00 AM",
      status: "Completed",
      type: "In-Person",
      hospital: "AIMS Super Speciality Hospital",
      fee: 800,
      notes: "Routine Cardiac Check",
      diagnosis: "ECG and lipid review completed, cardiac profile normal.",
      followUp: "Continue low sodium diet and lifestyle monitoring."
    },
    {
      id: "appt-completed-2",
      doctorId: "D001",
      doctorName: "Dr. Rajesh Varma",
      specialty: "Orthopedics",
      patientId: "fam-1",
      patientName: "Srinivas Kilari",
      date: "10 Jul 2026",
      time: "03:30 PM",
      status: "Completed",
      type: "In-Person",
      hospital: "Fortis Hospital",
      fee: 800,
      notes: "Knee Assessment",
      diagnosis: "Mild patellar strain diagnosed.",
      followUp: "Rest, ice application, and avoid heavy lifting for 1 week."
    },
    {
      id: "appt-completed-3",
      doctorId: "D005",
      doctorName: "Dr. Meera Iyer",
      specialty: "Endocrinology",
      patientId: "fam-3",
      patientName: "Janaki Kilari",
      date: "08 Jul 2026",
      time: "09:00 AM",
      status: "Completed",
      type: "In-Person",
      hospital: "Apollo Clinic",
      fee: 600,
      notes: "Fasting Blood Sugar Review",
      diagnosis: "Type 2 Diabetes, blood sugar stable.",
      followUp: "Continue Metformin 500mg twice daily with meals."
    },
    {
      id: "appt-completed-4",
      doctorId: "D011",
      doctorName: "Dr. Vivek Sharma",
      specialty: "Pulmonology",
      patientId: "fam-2",
      patientName: "Rama Rao Kilari",
      date: "05 Jul 2026",
      time: "04:00 PM",
      status: "Completed",
      type: "Video",
      hospital: "Manipal Hospital",
      fee: 700,
      notes: "COPD Spirometry Review",
      diagnosis: "Stable COPD, normal FEV1/FVC ratio.",
      followUp: "Continue daily bronchodilator inhalers, monitor oxygen level."
    },
    {
      id: "appt-completed-5",
      doctorId: "D003",
      doctorName: "Dr. Priya Nair",
      specialty: "Pediatrics",
      patientId: "fam-4",
      patientName: "Ananya Kilari",
      date: "01 Jul 2026",
      time: "10:30 AM",
      status: "Completed",
      type: "In-Person",
      hospital: "ChildCare Hospital",
      fee: 700,
      notes: "Regular Growth Monitoring",
      diagnosis: "Normal developmental milestones achieved.",
      followUp: "Maintain age-appropriate balanced nutrition and active play."
    },

    // --- 2 CANCELLED APPOINTMENTS ---
    {
      id: "appt-cancelled-1",
      doctorId: "D000",
      doctorName: "Dr. Rahul Atluri",
      specialty: "Cardiology",
      patientId: "fam-self",
      patientName: "Supriya Kilari",
      date: "02 Jul 2026",
      time: "10:30 AM",
      status: "Cancelled",
      type: "In-Person",
      hospital: "AIMS Super Speciality Hospital",
      fee: 800,
      notes: "Rescheduling needed"
    },
    {
      id: "appt-cancelled-2",
      doctorId: "D001",
      doctorName: "Dr. Rajesh Varma",
      specialty: "Orthopedics",
      patientId: "fam-1",
      patientName: "Srinivas Kilari",
      date: "28 Jun 2026",
      time: "02:00 PM",
      status: "Cancelled",
      type: "In-Person",
      hospital: "Fortis Hospital",
      fee: 800,
      notes: "Doctor unavailable"
    }
  ],
  familyMembers: [
    { id: "fam-self", name: "Supriya Kilari", relation: "Self", age: 29, gender: "Female", bloodGroup: "O+", allergies: "Peanuts, Penicillin", chronicConditions: "Mild Asthma", medications: "Inhaler (SOS)", height: "165 cm", weight: "58 kg", emergencyContact: "+91 98402 12345", profileCode: "TRIBE-2901", linked: true, linkedStatus: "Linked" },
    { id: "fam-1", name: "Srinivas Kilari", relation: "Husband", age: 34, gender: "Male", bloodGroup: "B+", allergies: "None", chronicConditions: "None", medications: "None", height: "178 cm", weight: "74 kg", emergencyContact: "+91 98402 12345", profileCode: "TRIBE-1102", linked: true, linkedStatus: "Linked", belongsTo: "fam-self" },
    { id: "fam-2", name: "Rama Rao Kilari", relation: "Father-in-law", age: 62, gender: "Male", bloodGroup: "A+", allergies: "None", chronicConditions: "COPD", medications: "Inhaler", height: "170 cm", weight: "70 kg", emergencyContact: "+91 98402 12345", profileCode: "TRIBE-1202", linked: true, linkedStatus: "Linked", belongsTo: "fam-self" },
    { id: "fam-3", name: "Janaki Kilari", relation: "Mother-in-law", age: 58, gender: "Female", bloodGroup: "O+", allergies: "None", chronicConditions: "Type 2 Diabetes", medications: "Metformin 500mg", height: "158 cm", weight: "62 kg", emergencyContact: "+91 98402 12345", profileCode: "TRIBE-1302", linked: true, linkedStatus: "Linked", belongsTo: "fam-self" },
    { id: "fam-4", name: "Ananya Kilari", relation: "Daughter", age: 5, gender: "Female", bloodGroup: "O+", allergies: "None", chronicConditions: "None", medications: "None", height: "110 cm", weight: "18 kg", emergencyContact: "+91 98402 12345", profileCode: "TRIBE-1402", linked: true, linkedStatus: "Linked", belongsTo: "fam-self" }
  ],
  medicalTimeline: [
    {
      id: "timeline-1",
      date: "2026-06-15",
      title: "Annual Heart Health Checkup",
      patientId: "fam-self",
      patientName: "Supriya Kilari",
      category: "Consultation",
      doctorName: "Dr. Rahul Atluri",
      details: "Sinus rhythm normal, blood pressure stable at 118/75.",
      attachments: ["ECG_Report_June.pdf"]
    },
    {
      id: "timeline-2",
      date: "2026-05-10",
      title: "Blood Sugar Fasting",
      patientId: "fam-1",
      patientName: "Srinivas Kilari",
      category: "Lab Report",
      doctorName: "Diagnostic Labs Inc.",
      details: "Fasting sugar: 128 mg/dL. HbA1c: 7.1%. Control is fair but requires mild exercise monitoring.",
      attachments: ["Sugar_Report_May.pdf"]
    }
  ],
  medicineOrders: [] as any[],
  labBookings: [] as any[],
  abhaIdentities: [
    {
      id: "abha_id_demo_1",
      patientId: "fam-self",
      abhaNumber: "91-8402-1234-5678",
      abhaAddress: "supriya@abha",
      mobile: "+91 98402 12345",
      linkedAt: "2026-07-04T23:00:00Z",
      verified: true,
      status: "ACTIVE"
    }
  ] as any[],
  consentRecords: [] as any[],
  importSessions: [] as any[],
  importedHealthRecords: [] as any[],
  supportChats: [
    { sender: "ai", text: "Hello! I am your HealthTribe AI Copilot. Describe any symptoms, check drug interactions, or get dietary recommendations. How are you feeling today?", timestamp: "2026-07-04T23:00:00Z" }
  ],
  triageConversations: [] as any[],
  triageMessages: [] as any[],
  auditLogs: [
    { id: "log-1", action: "System Boot", timestamp: new Date().toISOString(), user: "SYSTEM", ip: "127.0.0.1", details: "HealthTribe platform initialized successfully." }
  ],
  settings: {
    notificationsEnabled: true,
    emailAlerts: true,
    smsAlerts: true,
    caregiverMode: true,
    governmentBenefitsScreening: true,
    selectedLanguage: "English"
  }
};

// User-specific persistent storage configuration
const USER_DATA_DIR = path.join(process.cwd(), "data", "users");
if (!fs.existsSync(USER_DATA_DIR)) {
  fs.mkdirSync(USER_DATA_DIR, { recursive: true });
}

function getUserDb(req: express.Request): any {
  const store = dbStorage.getStore();
  if (store && store.userDb) {
    return store.userDb;
  }

  const email = req.headers["x-user-email"] as string;
  if (!email) {
    if (store) store.userDb = base_db;
    return base_db; // Fallback to pre-seeded db
  }

  const cleanEmail = email.trim().toLowerCase();
  
  // Detect demo emails
  const isDemoEmail = ["supriya@gmail.com", "father@gmail.com", "mother@gmail.com", "doctor@healthtribe.com"].includes(cleanEmail);
  if (isDemoEmail) {
    if (store) store.userDb = base_db;
    return base_db;
  }

  const sanitizedEmail = cleanEmail.replace(/[^a-zA-Z0-9]/g, "_");
  if (userDbCache.has(sanitizedEmail)) {
    const dbObj = userDbCache.get(sanitizedEmail);
    if (store) store.userDb = dbObj;
    return dbObj;
  }
  const filePath = path.join(USER_DATA_DIR, `${sanitizedEmail}.json`);

  let dbObj: any = null;
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      let changed = false;
      // Safeguard essential arrays and properties
      if (!data.doctors) { data.doctors = SEEDED_DOCTORS; changed = true; }
      if (!data.aiConversations) { data.aiConversations = []; changed = true; }
      if (!data.patientProfiles) { data.patientProfiles = []; changed = true; }
      if (!data.auditLogs) { data.auditLogs = []; changed = true; }

      // Perform automated zero-data-loss partition migration for existing databases
      if (!data.partitions) {
        data.partitions = {};
        const pId = "fam-self";
        data.partitions[pId] = {
          familyMembers: (data.familyMembers || []).filter((m: any) => m.id !== "fam-self"),
          appointments: data.appointments || JSON.parse(JSON.stringify(base_db.appointments)),
          medicalTimeline: data.medicalTimeline || JSON.parse(JSON.stringify(base_db.medicalTimeline)),
          abhaIdentities: data.abhaIdentities || JSON.parse(JSON.stringify(base_db.abhaIdentities)),
          consentRecords: data.consentRecords || [],
          importSessions: data.importSessions || [],
          importedHealthRecords: data.importedHealthRecords || [],
          supportChats: data.supportChats || [
            { sender: "ai", text: "Hello! I am your HealthTribe AI Copilot. Describe any symptoms, check drug interactions, or get dietary recommendations. How are you feeling today?", timestamp: new Date().toISOString() }
          ],
          triageConversations: data.triageConversations || [],
          triageMessages: data.triageMessages || [],
          settings: data.settings || { ...base_db.settings },
          medicineOrders: data.medicineOrders || [],
          labBookings: data.labBookings || []
        };
        data.primaryProfile = (data.familyMembers || []).find((m: any) => m.id === "fam-self") || {
          id: "fam-self",
          name: "Supriya Kilari",
          relation: "Self",
          age: 29,
          gender: "Female",
          bloodGroup: "O+",
          allergies: "Peanuts, Penicillin",
          chronicConditions: "Mild Asthma",
          medications: "Inhaler (SOS)",
          height: "165 cm",
          weight: "58 kg",
          emergencyContact: "+91 98402 12345",
          profileCode: "TRIBE-2901",
          linked: true,
          linkedStatus: "Linked"
        };
        changed = true;
      }
      
      dbObj = data;
      if (changed) {
        fs.writeFileSync(filePath, JSON.stringify(dbObj, null, 2), "utf-8");
      }
    } catch (e) {
      console.error("Error reading user DB file, regenerating:", e);
    }
  }

  if (!dbObj) {
    // Generate emptyDb preseeded with isolated copies of the base demo data
    const emptyDb: any = {
      patientProfiles: [],
      auditLogs: [
        { id: `log-init-${Date.now()}`, action: "Profile Created", timestamp: new Date().toISOString(), user: cleanEmail, ip: "127.0.0.1", details: `HealthTribe persistent profile initialized for ${cleanEmail}.` }
      ],
      aiConversations: [],
      doctors: SEEDED_DOCTORS,
      primaryProfile: null,
      partitions: {
        "fam-self": {
          familyMembers: base_db.familyMembers.filter((m: any) => m.id !== "fam-self"),
          appointments: JSON.parse(JSON.stringify(base_db.appointments)),
          medicalTimeline: JSON.parse(JSON.stringify(base_db.medicalTimeline)),
          abhaIdentities: JSON.parse(JSON.stringify(base_db.abhaIdentities)),
          consentRecords: JSON.parse(JSON.stringify(base_db.consentRecords)),
          importSessions: [],
          importedHealthRecords: [],
          supportChats: [
            { sender: "ai", text: "Hello! I am your HealthTribe AI Copilot. Describe any symptoms, check drug interactions, or get dietary recommendations. How are you feeling today?", timestamp: new Date().toISOString() }
          ],
          triageConversations: [],
          triageMessages: [],
          settings: {
            notificationsEnabled: true,
            emailAlerts: true,
            smsAlerts: true,
            caregiverMode: true,
            governmentBenefitsScreening: true,
            selectedLanguage: "English"
          },
          medicineOrders: [],
          labBookings: []
        }
      }
    };

    try {
      fs.writeFileSync(filePath, JSON.stringify(emptyDb, null, 2), "utf-8");
    } catch (err) {
      console.error("Failed to write initial user database:", err);
    }
    dbObj = emptyDb;
  }

  if (store) {
    store.userDb = dbObj;
  }
  userDbCache.set(sanitizedEmail, dbObj);
  return dbObj;
}

function saveUserDb(req: express.Request, userDb: any) {
  const store = dbStorage.getStore();
  if (store) {
    store.userDb = userDb;
    store.modified = true;
  }

  const email = req.headers["x-user-email"] as string;
  if (!email) return;

  const cleanEmail = email.trim().toLowerCase();
  const isDemoEmail = ["supriya@gmail.com", "father@gmail.com", "mother@gmail.com", "doctor@healthtribe.com"].includes(cleanEmail);
  if (isDemoEmail) {
    return; // Do not overwrite static memory for demo logins
  }

  const sanitizedEmail = cleanEmail.replace(/[^a-zA-Z0-9]/g, "_");
  const filePath = path.join(USER_DATA_DIR, `${sanitizedEmail}.json`);

  try {
    fs.writeFileSync(filePath, JSON.stringify(userDb, null, 2), "utf-8");
  } catch (e) {
    console.error("Error saving user database file:", e);
  }

  // Ensure background async operations (like ABHA progress steps) also sync to Supabase
  saveUserDbToSupabase(sanitizedEmail, userDb).catch(err => {
    console.error(`Error syncing user DB to Supabase inside saveUserDb for ${sanitizedEmail}:`, err);
  });
}

function getProfileById(req: express.Request, id: string): any {
  const userDb = getUserDb(req);
  if (id === "fam-self") {
    return base_db.familyMembers.find((m: any) => m.id === "fam-self");
  }
  if (id === "user-self") {
    if (userDb && userDb.primaryProfile) {
      return userDb.primaryProfile;
    }
  }
  
  let profile = (userDb.patientProfiles || []).find((p: any) => p.id === id);
  if (profile) return profile;

  // Search partitions for family members
  if (userDb && userDb.partitions) {
    const activeProfileId = (req.headers["x-active-profile-id"] as string) || "fam-self";
    if (userDb.partitions[activeProfileId] && userDb.partitions[activeProfileId].familyMembers) {
      profile = userDb.partitions[activeProfileId].familyMembers.find((m: any) => m.id === id);
      if (profile) return profile;
    }
    for (const pId of Object.keys(userDb.partitions)) {
      if (userDb.partitions[pId].familyMembers) {
        profile = userDb.partitions[pId].familyMembers.find((m: any) => m.id === id);
        if (profile) return profile;
      }
    }
  }

  profile = base_db.familyMembers.find((m: any) => m.id === id);
  return profile;
}

const PARTITIONED_KEYS = new Set([
  "familyMembers",
  "appointments",
  "medicalTimeline",
  "abhaIdentities",
  "consentRecords",
  "importSessions",
  "importedHealthRecords",
  "supportChats",
  "triageConversations",
  "triageMessages",
  "settings",
  "medicineOrders",
  "labBookings"
]);

function initPartition(userDb: any, profileId: string) {
  if (!userDb.partitions) {
    userDb.partitions = {};
  }
  if (!userDb.partitions[profileId]) {
    userDb.partitions[profileId] = {
      familyMembers: [],
      appointments: [],
      medicalTimeline: [],
      abhaIdentities: [],
      consentRecords: [],
      importSessions: [],
      importedHealthRecords: [],
      supportChats: [
        { sender: "ai", text: "Hello! I am your HealthTribe AI Copilot. Describe any symptoms, check drug interactions, or get dietary recommendations. How are you feeling today?", timestamp: new Date().toISOString() }
      ],
      triageConversations: [],
      triageMessages: [],
      settings: {
        notificationsEnabled: true,
        emailAlerts: true,
        smsAlerts: true,
        caregiverMode: true,
        governmentBenefitsScreening: true,
        selectedLanguage: "English"
      },
      medicineOrders: [],
      labBookings: []
    };
  }
}

// Global db proxy that swaps on demand based on request headers and active partition
export const db = new Proxy(base_db as any, {
  get(target, prop, receiver) {
    const store = dbStorage.getStore();
    if (store && store.req) {
      const userDb = getUserDb(store.req);
      if (userDb === base_db) {
        if (prop === "familyMembers") {
          return base_db.familyMembers.filter((m: any) => m.id !== "fam-self");
        }
        return Reflect.get(base_db, prop);
      }
      
      const propStr = String(prop);
      if (PARTITIONED_KEYS.has(propStr)) {
        const activeProfileId = (store.req.headers["x-active-profile-id"] as string) || "fam-self";
        initPartition(userDb, activeProfileId);
        return userDb.partitions[activeProfileId][propStr];
      }
      
      return Reflect.get(userDb, prop);
    }
    return Reflect.get(target, prop);
  },
  set(target, prop, value, receiver) {
    const store = dbStorage.getStore();
    if (store && store.req) {
      const userDb = getUserDb(store.req);
      if (userDb === base_db) {
        return Reflect.set(base_db, prop, value);
      }
      
      const propStr = String(prop);
      if (PARTITIONED_KEYS.has(propStr)) {
        const activeProfileId = (store.req.headers["x-active-profile-id"] as string) || "fam-self";
        initPartition(userDb, activeProfileId);
        userDb.partitions[activeProfileId][propStr] = value;
        saveUserDb(store.req, userDb);
        return true;
      }
      
      const success = Reflect.set(userDb, prop, value);
      if (success) {
        saveUserDb(store.req, userDb);
      }
      return success;
    }
    return Reflect.set(target, prop, value);
  }
});

// Log helper
function addLog(action: string, user: string, details: string) {
  const newLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    action,
    timestamp: new Date().toISOString(),
    user,
    ip: "10.0.0.8",
    details
  };
  db.auditLogs = [newLog, ...(db.auditLogs || [])];
}

// ---------------------------------------------------------
// REST API ENDPOINTS
// ---------------------------------------------------------

// Metadata & Diagnostics
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    engine: "HealthTribe Full-Stack AI Core",
    timestamp: new Date().toISOString(),
    geminiConnected: aiService.isAvailable()
  });
});

// Admin Stats
app.get("/api/admin/stats", (req, res) => {
  const totalRevenue = db.appointments.reduce((sum, a) => sum + (a.fee || 0), 0) +
                       db.medicineOrders.reduce((sum, o) => sum + (o.total || 0), 0) +
                       db.labBookings.reduce((sum, l) => sum + (l.price || 0), 0);
  res.json({
    usersCount: db.familyMembers.length,
    doctorsCount: SEEDED_DOCTORS.length,
    hospitalsCount: SEEDED_HOSPITALS.length,
    appointmentsCount: db.appointments.length,
    medicineOrdersCount: db.medicineOrders.length,
    labBookingsCount: db.labBookings.length,
    totalRevenue,
    auditLogs: db.auditLogs.slice(0, 50),
    appointments: db.appointments,
    familyMembers: db.familyMembers,
    medicalTimeline: db.medicalTimeline
  });
});

// ---------------------------------------------------------
// ABHA HEALTH DATA GATEWAY API ENDPOINTS
// ---------------------------------------------------------

// ABHA TEMP OTP STORAGE
const abhaOtpStorage = new Map<string, { otp: string; expiresAt: number; abhaNumber: string; abhaAddress: string }>();

// Generate OTP
app.post("/api/v1/abha/generate-otp", (req, res) => {
  const { abhaNumber, abhaAddress, patientId } = req.body;
  if (!abhaNumber && !abhaAddress) {
    return res.status(400).json({ error: "ABHA Number or ABHA Address is required." });
  }

  const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  // Generate random 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 mins

  abhaOtpStorage.set(transactionId, {
    otp,
    expiresAt,
    abhaNumber: abhaNumber || `${patientId}_num@abha`,
    abhaAddress: abhaAddress || `${patientId}@abha`
  });

  console.log(`[ABHA GATEWAY] Generated OTP: ${otp} for transaction: ${transactionId}`);
  addLog("ABHA OTP Generation", patientId || "SYSTEM", `Generated ABHA OTP for transaction: ${transactionId}`);

  res.json({
    success: true,
    message: "OTP sent successfully to your registered mobile number (+91 ******9932).",
    transactionId,
    otpHint: otp // Expose OTP hint to UI for easy demonstration/flow
  });
});

// Verify OTP
app.post("/api/v1/abha/verify-otp", (req, res) => {
  const { transactionId, otp, patientId } = req.body;
  if (!transactionId || !otp || !patientId) {
    return res.status(400).json({ error: "Transaction ID, OTP, and Patient ID are required." });
  }

  // Handle mock error codes
  if (otp === "000000") {
    return res.status(400).json({ error: "OTP has expired. Please request a new OTP." });
  }
  if (otp === "999999") {
    return res.status(400).json({ error: "Internal Gateway Error. ABHA linking failed." });
  }

  const stored = abhaOtpStorage.get(transactionId);
  if (!stored) {
    return res.status(400).json({ error: "Invalid transaction session." });
  }

  if (Date.now() > stored.expiresAt) {
    abhaOtpStorage.delete(transactionId);
    return res.status(400).json({ error: "OTP has expired. Please generate a new OTP." });
  }

  if (stored.otp !== otp) {
    return res.status(400).json({ error: "Invalid OTP. Please check and try again." });
  }

  // Remove existing linked identity for this patient (relinking scenario)
  db.abhaIdentities = db.abhaIdentities.filter((id: any) => id.patientId !== patientId);

  // Store active linked identity
  const newIdentity = {
    id: `abha_id_${Date.now()}`,
    patientId,
    abhaNumber: stored.abhaNumber,
    abhaAddress: stored.abhaAddress,
    mobile: "+91 98402 12345",
    linkedAt: new Date().toISOString(),
    verified: true,
    status: "ACTIVE"
  };

  db.abhaIdentities = [...(db.abhaIdentities || []), newIdentity];

  // Sync to family member profile as well
  const profile = getProfileById(req, patientId);
  if (profile) {
    profile.abhaNumber = stored.abhaNumber;
    profile.abhaVerified = true;
    profile.linked = true;
    profile.linkedStatus = "Linked";
    db.familyMembers = [...db.familyMembers];
  }

  addLog("ABHA Account Linking", patientId, `Successfully linked ABHA Identity ${stored.abhaAddress}`);
  abhaOtpStorage.delete(transactionId);

  res.json({
    success: true,
    message: "ABHA Identity successfully verified and linked.",
    identity: newIdentity
  });
});

// Unlink ABHA Address
app.post("/api/v1/abha/unlink", (req, res) => {
  const { patientId } = req.body;
  if (!patientId) {
    return res.status(400).json({ error: "Patient ID is required." });
  }

  const index = db.abhaIdentities.findIndex((id: any) => id.patientId === patientId);
  if (index !== -1) {
    const abhaAddress = db.abhaIdentities[index].abhaAddress;
    db.abhaIdentities = db.abhaIdentities.filter((_: any, i: number) => i !== index);

    // Update family member profile
    const profile = getProfileById(req, patientId);
    if (profile) {
      delete profile.abhaNumber;
      profile.abhaVerified = false;
      profile.linked = false;
      profile.linkedStatus = "Not Linked";
      db.familyMembers = [...db.familyMembers];
    }

    addLog("ABHA Account Unlinking", patientId, `Successfully unlinked ABHA Address ${abhaAddress}`);
    return res.json({ success: true, message: "ABHA Address unlinked successfully." });
  }

  res.status(404).json({ error: "No linked ABHA Identity found for this patient." });
});

// Fetch Active ABHA Identity
app.get("/api/v1/abha/identity/:patientId", (req, res) => {
  const { patientId } = req.params;
  const identity = db.abhaIdentities.find((id: any) => id.patientId === patientId);
  res.json({ linked: !!identity, identity: identity || null });
});

// Discover participating hospitals
app.get("/api/v1/abha/hospitals", (req, res) => {
  const abhaHospitals = [
    { id: "hip-aiims", name: "AIIMS Bangalore Super Speciality", address: "Anugraha Layout, Bangalore", abhaActive: true, distance: "1.5 km", abhaStatus: "CONNECTED" },
    { id: "hip-apollo", name: "Apollo Greams Road Clinic", address: "Bannerghatta Main Road, Bangalore", abhaActive: true, distance: "2.8 km", abhaStatus: "CONNECTED" },
    { id: "hip-manipal", name: "Manipal Medical Center", address: "HAL Airport Road, Bangalore", abhaActive: true, distance: "4.1 km", abhaStatus: "DISCOVERED" },
    { id: "hip-fortis", name: "Fortis Escorts Cardiac Ward", address: "Cunningham Road, Bangalore", abhaActive: true, distance: "5.5 km", abhaStatus: "DISCOVERED" },
  ];
  res.json({ success: true, hospitals: abhaHospitals });
});

// Request Consent
app.post("/api/v1/consent/request", (req, res) => {
  const { patientId, abhaAddress, hipId, hipName, purpose, consentExpiry, dataTypes } = req.body;

  if (!patientId || !abhaAddress || !hipId) {
    return res.status(400).json({ error: "Patient ID, ABHA Address, and HIP ID are required." });
  }

  const consentId = `con_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const newConsent = {
    id: consentId,
    patientId,
    abhaAddress,
    hiuId: "HealthTribe-HIU",
    hipId,
    hipName,
    purpose: purpose || "Referral & diagnostics consolidation",
    consentExpiry: consentExpiry || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: "GRANTED", // Auto-granted for seamless mock sandbox experience, but editable
    dataTypes: dataTypes || ["Prescription", "DiagnosticReport", "DischargeSummary"],
    createdAt: new Date().toISOString(),
    grantedAt: new Date().toISOString()
  };

  db.consentRecords = [...(db.consentRecords || []), newConsent];
  addLog("Consent Created", patientId, `Created consent request ${consentId} for ${hipName}`);

  res.json({ success: true, message: "Consent requested and granted successfully.", consent: newConsent });
});

// Consent action (Grant/Revoke)
app.post("/api/v1/consent/action", (req, res) => {
  const { consentId, action, patientId } = req.body; // action: GRANTED or REVOKED
  if (!consentId || !action) {
    return res.status(400).json({ error: "Consent ID and action (GRANTED/REVOKED) are required." });
  }

  const index = db.consentRecords.findIndex((c: any) => c.id === consentId);
  if (index !== -1) {
    const updatedRecords = [...db.consentRecords];
    const targetRecord = { ...updatedRecords[index] };
    targetRecord.status = action;
    if (action === "GRANTED") {
      targetRecord.grantedAt = new Date().toISOString();
    }
    updatedRecords[index] = targetRecord;
    db.consentRecords = updatedRecords;
    addLog(`Consent ${action}`, patientId || "SYSTEM", `Updated consent ${consentId} status to ${action}`);
    return res.json({ success: true, message: `Consent status successfully marked as ${action}.`, consent: targetRecord });
  }

  res.status(404).json({ error: "Consent record not found." });
});

// List Consents
app.get("/api/v1/consent/list/:patientId", (req, res) => {
  const { patientId } = req.params;
  const list = db.consentRecords.filter((c: any) => c.patientId === patientId);
  res.json({ success: true, consents: list });
});

// Initiate ABHA Records Import
app.post("/api/v1/abha/import/:patientId", async (req, res) => {
  const { patientId } = req.params;
  const { consentId, hipId, hipName } = req.body;

  if (!consentId || !hipId || !hipName) {
    return res.status(400).json({ error: "Consent ID, HIP ID, and HIP Name are required." });
  }

  // Validate active consent status
  const consent = db.consentRecords.find((c: any) => c.id === consentId);
  if (!consent || consent.status !== "GRANTED") {
    return res.status(400).json({ error: "Active GRANTED consent is required to import health records." });
  }

  const sessionId = `imp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const newSession = {
    id: sessionId,
    patientId,
    consentId,
    hipId,
    hipName,
    status: "PENDING",
    progress: 0,
    createdAt: new Date().toISOString()
  };

  db.importSessions = [...(db.importSessions || []), newSession];
  addLog("ABHA Import Started", patientId, `Started diagnostic records import session ${sessionId} from ${hipName}`);

  // Simulate background multi-stage progress advancement using server setTimeout
  const stages = [
    { status: "AUTHENTICATING", progress: 15 },
    { status: "FETCHING_METADATA", progress: 40 },
    { status: "DECRYPTING", progress: 65 },
    { status: "PARSING", progress: 85 },
    { status: "COMPLETED", progress: 100 }
  ];

  let currentStageIndex = 0;
  const store = dbStorage.getStore();
  debugLog("[ABHA Import POST] Current store from AsyncLocalStorage:", !!store, store ? { reqUrl: store.req?.url, hasUserDb: !!store.userDb } : "null");

  const advanceStage = () => {
    debugLog("[ABHA Import advanceStage] Timer fired. store available in closure:", !!store);
    if (!store) {
      debugLog("[ABHA Import advanceStage] ABORT: store is undefined!");
      return;
    }
    dbStorage.run(store, () => {
      debugLog("[ABHA Import advanceStage] Inside dbStorage.run callback. SessionId:", sessionId);
      try {
        const currentSessions = db.importSessions;
        debugLog("[ABHA Import advanceStage] Current active sessions in DB partition:", currentSessions ? currentSessions.map((s: any) => ({ id: s.id, status: s.status })) : "undefined");
        const sessionIndex = currentSessions ? currentSessions.findIndex((s: any) => s.id === sessionId) : -1;
        debugLog("[ABHA Import advanceStage] Found session index:", sessionIndex);
        
        if (sessionIndex === -1) {
          debugLog("[ABHA Import advanceStage] ABORT: sessionIndex is -1! Session not found in DB.");
          return;
        }

        if (currentStageIndex < stages.length) {
          const stage = stages[currentStageIndex];
          debugLog(`[ABHA Import advanceStage] Advancing to stage: ${stage.status} (${stage.progress}%)`);
          const updatedSessions = [...db.importSessions];
          updatedSessions[sessionIndex] = {
            ...updatedSessions[sessionIndex],
            status: stage.status,
            progress: stage.progress
          };
          db.importSessions = updatedSessions;
          currentStageIndex++;

          if (store.userDb) {
            debugLog("[ABHA Import advanceStage] Saving user DB changes...");
            saveUserDb(store.req, store.userDb);
          }

          if (stage.status === "COMPLETED") {
            debugLog("[ABHA Import advanceStage] STAGE COMPLETED. Running completeImportFlow...");
            completeImportFlow(store.req, patientId, hipId, hipName)
              .then(() => debugLog("[ABHA Import advanceStage] completeImportFlow finished successfully."))
              .catch(err => debugLog("[ABHA Import advanceStage] Error in completeImportFlow:", err));
          } else {
            debugLog("[ABHA Import advanceStage] Scheduling next stage in 1000ms...");
            setTimeout(advanceStage, 1000);
          }
        }
      } catch (err) {
        debugLog("[ABHA Import advanceStage] Unexpected error during stage advancement:", err);
      }
    });
  };

  // Start background simulations
  debugLog("[ABHA Import POST] Scheduling first advanceStage in 800ms...");
  setTimeout(advanceStage, 800);

  res.json({ success: true, message: "Import session initialized successfully.", sessionId });
});

// Import Session Status Poller
app.get("/api/v1/abha/import/session/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const session = db.importSessions.find((s: any) => s.id === sessionId);
  if (!session) {
    return res.status(404).json({ error: "Import session not found." });
  }
  res.json({ success: true, session });
});

async function completeImportFlow(req: express.Request, patientId: string, hipId: string, hipName: string) {
  const store = { req, userDb: getUserDb(req) };
  return dbStorage.run(store, async () => {
    let records: any[] = [];
    const pName = db.familyMembers.find((m: any) => m.id === patientId)?.name || "Patient";

  if (hipId === "hip-aiims") {
    records = [
      {
        id: `rec-aiims-${Date.now()}-1`,
        date: "2026-04-18",
        title: "Echocardiogram Diagnostic Assay",
        patientId,
        patientName: pName,
        category: "Lab Report",
        doctorName: "Dr. Sandeep Mahto",
        details: "LVEF 60%. Mild diastolic dysfunction observed. Left atrium borderline dilated.",
        hospital: hipName,
        specialty: "Cardiology",
        source: "ABHA",
        type: "Lab Report"
      },
      {
        id: `rec-aiims-${Date.now()}-2`,
        date: "2026-04-18",
        title: "Clinical Consultation Summary",
        patientId,
        patientName: pName,
        category: "Consultation",
        doctorName: "Dr. Sandeep Mahto",
        details: "Diagnosed with Type-C Hypertension. Advised low salt Diet, morning exercise, and Ramipril 5mg.",
        hospital: hipName,
        specialty: "Cardiology",
        source: "ABHA",
        type: "Consultation"
      }
    ];
  } else if (hipId === "hip-apollo") {
    records = [
      {
        id: `rec-apollo-${Date.now()}-1`,
        date: "2026-05-12",
        title: "HbA1c Glycemic Panel",
        patientId,
        patientName: pName,
        category: "Lab Report",
        doctorName: "Dr. Anika Verma",
        details: "HbA1c is 7.2%. Fasting glucose is 134 mg/dL. Consistent with mild Type 2 diabetes control.",
        hospital: hipName,
        specialty: "Endocrinology",
        source: "ABHA",
        type: "Lab Report"
      },
      {
        id: `rec-apollo-${Date.now()}-2`,
        date: "2026-05-13",
        title: "Therapeutic Drug Prescription",
        patientId,
        patientName: pName,
        category: "Prescription",
        doctorName: "Dr. Anika Verma",
        details: "Rx: Metformin 500mg (OD, after breakfast) and Atorvastatin 10mg (HS). Avoid alcohol.",
        hospital: hipName,
        specialty: "Endocrinology",
        source: "ABHA",
        type: "Prescription"
      }
    ];
  } else {
    records = [
      {
        id: `rec-gen-${Date.now()}-1`,
        date: "2026-03-24",
        title: "General Wellness Screening",
        patientId,
        patientName: pName,
        category: "Lab Report",
        doctorName: "Dr. Amit Das",
        details: "Serum Cholesterol 220 mg/dL. LDL 135 mg/dL. Borderline hyperlipidemia.",
        hospital: hipName,
        specialty: "Internal Medicine",
        source: "ABHA",
        type: "Lab Report"
      }
    ];
  }

  const newTimelineItems = [...records];
  db.medicalTimeline = [...newTimelineItems, ...(db.medicalTimeline || [])];

  const newImportedRecords = records.map(rec => ({
    id: rec.id,
    patientId,
    hipId,
    hipName,
    recordType: rec.type,
    title: rec.title,
    date: rec.date,
    doctorName: rec.doctorName,
    details: rec.details,
    careContextRef: `OPD-${Math.floor(10000 + Math.random() * 90000)}`
  }));
  db.importedHealthRecords = [...(db.importedHealthRecords || []), ...newImportedRecords];

  const promptPayload = PromptBuilder.buildABHAPrompt(records, pName);

  let summary = "";
  if (aiService.isAvailable()) {
    try {
      // Use retryWithBackoff as defined in server.ts
      const responseText = await aiService.generateContent(promptPayload);
      const response = { text: responseText };
      summary = response.text || "Analyzed imported clinical data successfully.";
    } catch (err) {
      console.error("Gemini ABHA records summary error:", err);
      summary = generateHeuristicABHASummary(records, pName);
    }
  } else {
    summary = generateHeuristicABHASummary(records, pName);
  }

  const summaryEvent = {
    id: `rec-summary-${Date.now()}`,
    date: new Date().toISOString().split('T')[0],
    title: `ABHA AI Summary: ${hipName} Consolidated Insights`,
    patientId,
    patientName: pName,
    category: "Consultation",
    doctorName: "HealthTribe AI Clinical Agent",
    details: summary,
    hospital: hipName,
    specialty: "AI Diagnostics",
    source: "ABHA" as const,
    type: "Triage" as const,
    aiSummary: summary
  };

  db.medicalTimeline = [summaryEvent, ...(db.medicalTimeline || [])];
  addLog("ABHA AI Summary Generated", patientId, `Successfully generated clinical AI digest for ${hipName} imports.`);
  saveUserDb(req, store.userDb);
  });
}

function generateHeuristicABHASummary(records: any[], pName: string) {
  if (records.some(r => r.title.includes("Echocardiogram"))) {
    return `Clinically verified Echo assay for ${pName} shows borderline Left Atrium dilation and mild diastolic dysfunction with stable LVEF (60%). Concomitant diagnostic review suggests active Type-C Hypertension. Patient is advised to maintain low-sodium nutrition, incorporate active morning walks, and strictly adhere to Ramipril 5mg daily. Follow-up consultation with a Cardiologist is recommended in 30 days to re-evaluate vascular pressures.`;
  } else if (records.some(r => r.title.includes("Glycemic"))) {
    return `Imported metabolic data for ${pName} verifies HbA1c at 7.2% and Fasting Glucose at 134 mg/dL, indicating active Type-2 diabetes progression requiring therapeutic drug titration. Patient's therapeutic regimen consists of Metformin 500mg daily and Atorvastatin 10mg at bedtime to protect cardiovascular parameters. It is critical to strictly avoid alcohol to bypass adverse drug interactions. Recommend repeating HbA1c and lipid assays in 3 months.`;
  }
  return `Consolidated records for ${pName} show a borderline serum cholesterol profile of 220 mg/dL and LDL of 135 mg/dL. These parameters suggest minor cardiovascular hyperlipidemia risk. Recommended actions include adopting a diet low in saturated fats, maintaining active hydration, and scheduling a routine lipid profiling session in 90 days.`;
}

// Reset Database API
app.post("/api/admin/reset", (req, res) => {
  db.appointments = [
    {
      id: "appt-seeded-1",
      doctorId: "doc-1",
      doctorName: "Dr. Rahul Atluri",
      specialty: "Cardiologist",
      patientName: "Supriya Kilari",
      date: "2026-07-10",
      time: "10:30 AM",
      status: "Upcoming",
      type: "In-Person",
      fee: 800,
      notes: "Routine cardiac screening & mild tightness review."
    }
  ];
  db.medicineOrders = [];
  db.labBookings = [];
  db.medicalTimeline = db.medicalTimeline.slice(0, 2);
  db.supportChats = [
    { sender: "ai", text: "Hello! I am your HealthTribe AI Copilot. Describe any symptoms, check drug interactions, or get dietary recommendations. How are you feeling today?", timestamp: "2026-07-04T23:00:00Z" }
  ];
  db.triageConversations = [];
  db.triageMessages = [];
  addLog("Database Reset", "ADMIN", "All dynamic transactions wiped. Seed data preserved.");
  res.json({ success: true, message: "Database reset successfully." });
});

// Doctor Listings & Search
app.get("/api/doctors", (req, res) => {
  const { specialty, search, lang } = req.query;
  let filtered = [...SEEDED_DOCTORS];

  if (specialty && specialty !== "all") {
    filtered = filtered.filter(d => d.specialtyId === specialty || d.specialty.toLowerCase() === (specialty as string).toLowerCase());
  }

  if (search) {
    const s = (search as string).toLowerCase();
    filtered = filtered.filter(d => 
      d.name.toLowerCase().includes(s) || 
      d.specialty.toLowerCase().includes(s) || 
      d.hospital.toLowerCase().includes(s)
    );
  }

  if (lang) {
    filtered = filtered.filter(d => d.languages.includes(lang as string));
  }

  res.json({
    specialties: SEEDED_SPECIALTIES,
    doctors: filtered
  });
});

// Hospitals Listing
app.get("/api/hospitals", (req, res) => {
  res.json({ hospitals: SEEDED_HOSPITALS });
});

// Custom authentication popup removed in favor of official Firebase Authentication SDK

// Family Health Vault & Patient Profile Isolation
app.get("/api/family", (req, res) => {
  const { belongsTo } = req.query;
  const sessionMode = req.headers["x-session-mode"] as string;
  const userDb = getUserDb(req);
  
  if (sessionMode === "doctor" && !belongsTo) {
    if (userDb === base_db) {
      return res.json({ familyMembers: base_db.familyMembers });
    }
    const allPatients: any[] = [];
    const seenIds = new Set();
    if (userDb.primaryProfile) {
      allPatients.push(userDb.primaryProfile);
      seenIds.add(userDb.primaryProfile.id);
    }
    const supriyaProfile = userDb.demoSupriyaProfile || {
      id: "fam-self",
      name: "Supriya Kilari",
      relation: "Self",
      age: 29,
      gender: "Female",
      bloodGroup: "O+",
      allergies: "Peanuts, Penicillin",
      chronicConditions: "Mild Asthma",
      medications: "Inhaler (SOS)",
      height: "165 cm",
      weight: "58 kg",
      emergencyContact: "+91 98402 12345",
      profileCode: "TRIBE-2901",
      linked: true,
      linkedStatus: "Linked"
    };
    if (!seenIds.has(supriyaProfile.id)) {
      allPatients.push(supriyaProfile);
      seenIds.add(supriyaProfile.id);
    }
    if (userDb.patientProfiles) {
      for (const p of userDb.patientProfiles) {
        if (p && p.id && !seenIds.has(p.id)) {
          allPatients.push(p);
          seenIds.add(p.id);
        }
      }
    }
    if (userDb.partitions) {
      for (const pId of Object.keys(userDb.partitions)) {
        const partition = userDb.partitions[pId];
        if (partition && partition.familyMembers) {
          for (const m of partition.familyMembers) {
            if (m && m.id && !seenIds.has(m.id)) {
              allPatients.push(m);
              seenIds.add(m.id);
            }
          }
        }
      }
    }
    return res.json({ familyMembers: allPatients });
  }

  if (userDb === base_db) {
    if (belongsTo) {
      const list = base_db.familyMembers.filter((m: any) => m.belongsTo === belongsTo || (belongsTo === "fam-self" && m.belongsTo === undefined && m.id !== "fam-self"));
      return res.json({ familyMembers: list });
    }
    const supriyaProfile = base_db.familyMembers.find((m: any) => m.id === "fam-self") || {
      id: "fam-self",
      name: "Supriya Kilari",
      relation: "Self",
      age: 29,
      gender: "Female",
      bloodGroup: "O+",
      allergies: "Peanuts, Penicillin",
      chronicConditions: "Mild Asthma",
      medications: "Inhaler (SOS)",
      height: "165 cm",
      weight: "58 kg"
    };
    return res.json({ familyMembers: [supriyaProfile] });
  }

  if (belongsTo) {
    // Return family vault members for a specific active patient context (belongsTo)
    const activeProfileId = belongsTo as string;
    initPartition(userDb, activeProfileId);
    const list = userDb.partitions[activeProfileId].familyMembers || [];
    return res.json({ familyMembers: list });
  }

  // Otherwise, return selectable Patient Profiles for the Profile Selector!
  const userProfiles = userDb.patientProfiles || [];
  
  const familyMembersList = [];
  
  // ALWAYS include the demo patient Supriya Kilari (or edited version of it)
  const supriyaProfile = userDb.demoSupriyaProfile || {
    id: "fam-self",
    name: "Supriya Kilari",
    relation: "Self",
    age: 29,
    gender: "Female",
    bloodGroup: "O+",
    allergies: "Peanuts, Penicillin",
    chronicConditions: "Mild Asthma",
    medications: "Inhaler (SOS)",
    height: "165 cm",
    weight: "58 kg",
    emergencyContact: "+91 98402 12345",
    profileCode: "TRIBE-2901",
    linked: true,
    linkedStatus: "Linked"
  };
  familyMembersList.push(supriyaProfile);

  if (userDb.primaryProfile) {
    familyMembersList.push(userDb.primaryProfile);
  }
  familyMembersList.push(...userProfiles);

  // Deduplicate by ID
  const uniqueFamilyMembers = [];
  const seenIds = new Set();
  for (const m of familyMembersList) {
    if (m && m.id && !seenIds.has(m.id)) {
      seenIds.add(m.id);
      uniqueFamilyMembers.push(m);
    }
  }

  res.json({ familyMembers: uniqueFamilyMembers });
});

app.post("/api/family", (req, res) => {
  const { name, relation, age, gender, bloodGroup, allergies, chronicConditions, medications, height, weight, phone, email, onboardingComplete, belongsTo, isPatientProfile } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: "Name is required." });
  }

  const userDb = getUserDb(req);
  if (userDb === base_db) {
    return res.status(403).json({ error: "Cannot write to static base database." });
  }

  // If adding a family member to an active patient's Family Vault
  if (belongsTo || (relation && relation !== "Self" && !isPatientProfile)) {
    const targetPartitionId = belongsTo || "fam-self";
    const newMember = {
      id: `fam-${Date.now()}`,
      belongsTo: targetPartitionId,
      name,
      relation: relation || "Spouse",
      age: Number(age) || 30,
      gender: gender || "Other",
      bloodGroup: bloodGroup || "Unknown",
      allergies: allergies || "None",
      chronicConditions: chronicConditions || "None",
      medications: medications || "None",
      height: height || "",
      weight: weight || "",
      phone: phone || "",
      email: email || "",
      onboardingComplete: onboardingComplete || false
    };

    initPartition(userDb, targetPartitionId);
    if (!userDb.partitions[targetPartitionId].familyMembers) {
      userDb.partitions[targetPartitionId].familyMembers = [];
    }
    userDb.partitions[targetPartitionId].familyMembers = [...userDb.partitions[targetPartitionId].familyMembers, newMember];
    saveUserDb(req, userDb);

    addLog("Add Family Member", name, `Added family profile for ${name} (${relation}) to profile vault`);
    return res.json({ success: true, member: newMember });
  } else {
    // If it's the primary "Self" profile and we don't have one set yet
    if (relation === "Self" && (!userDb.primaryProfile || !userDb.primaryProfile.onboardingComplete)) {
      userDb.primaryProfile = {
        id: "user-self",
        name,
        relation: "Self",
        age: Number(age) || 30,
        gender: gender || "Other",
        bloodGroup: bloodGroup || "O+",
        allergies: allergies || "None",
        chronicConditions: chronicConditions || "None",
        medications: medications || "None",
        height: height || "",
        weight: weight || "",
        phone: phone || "",
        email: email || "",
        onboardingComplete: true
      };
      
      initPartition(userDb, "user-self");
      saveUserDb(req, userDb);
      addLog("Create Patient Profile", name, `Created primary patient profile for ${name}`);
      return res.json({ success: true, member: userDb.primaryProfile });
    }

    // Creating an additional selectable Patient Profile!
    const newPatient = {
      id: `patient-${Date.now()}`,
      name,
      relation: "Self",
      age: Number(age) || 30,
      gender: gender || "Other",
      bloodGroup: bloodGroup || "O+",
      allergies: allergies || "None",
      chronicConditions: chronicConditions || "None",
      medications: medications || "None",
      height: height || "",
      weight: weight || "",
      phone: phone || "",
      email: email || "",
      onboardingComplete: true
    };

    if (!userDb.patientProfiles) userDb.patientProfiles = [];
    userDb.patientProfiles = [...userDb.patientProfiles, newPatient];
    
    // Initialize empty partition for this new patient profile
    initPartition(userDb, newPatient.id);
    
    saveUserDb(req, userDb);

    addLog("Create Patient Profile", name, `Created new patient profile for ${name}`);
    return res.json({ success: true, member: newPatient });
  }
});

app.put("/api/family/:id", (req, res) => {
  const { id } = req.params;
  const { name, relation, age, gender, bloodGroup, allergies, chronicConditions, medications, height, weight, phone, email, onboardingComplete } = req.body;
  
  const userDb = getUserDb(req);
  if (userDb === base_db) {
    return res.status(403).json({ error: "Cannot write to static base database." });
  }

  if (id === "user-self") {
    if (!userDb.primaryProfile) {
      return res.status(404).json({ error: "Profile not found." });
    }
    userDb.primaryProfile = {
      ...userDb.primaryProfile,
      name: name || userDb.primaryProfile.name,
      age: age !== undefined ? Number(age) : userDb.primaryProfile.age,
      gender: gender || userDb.primaryProfile.gender,
      bloodGroup: bloodGroup || userDb.primaryProfile.bloodGroup,
      allergies: allergies !== undefined ? allergies : userDb.primaryProfile.allergies,
      chronicConditions: chronicConditions !== undefined ? chronicConditions : userDb.primaryProfile.chronicConditions,
      medications: medications !== undefined ? medications : userDb.primaryProfile.medications,
      height: height !== undefined ? height : userDb.primaryProfile.height,
      weight: weight !== undefined ? weight : userDb.primaryProfile.weight,
      phone: phone !== undefined ? phone : userDb.primaryProfile.phone,
      email: email !== undefined ? email : userDb.primaryProfile.email
    };
    saveUserDb(req, userDb);
    addLog("Update Patient Profile", userDb.primaryProfile.name, `Updated health profile for ${userDb.primaryProfile.name}`);
    return res.json({ success: true, member: userDb.primaryProfile });
  }

  if (id === "fam-self") {
    // Update Supriya Kilari (Demo Profile)
    if (!userDb.demoSupriyaProfile) {
      userDb.demoSupriyaProfile = {
        id: "fam-self",
        name: "Supriya Kilari",
        relation: "Self",
        age: 29,
        gender: "Female",
        bloodGroup: "O+",
        allergies: "Peanuts, Penicillin",
        chronicConditions: "Mild Asthma",
        medications: "Inhaler (SOS)",
        height: "165 cm",
        weight: "58 kg",
        emergencyContact: "+91 98402 12345",
        profileCode: "TRIBE-2901",
        linked: true,
        linkedStatus: "Linked"
      };
    }
    userDb.demoSupriyaProfile = {
      ...userDb.demoSupriyaProfile,
      name: name || userDb.demoSupriyaProfile.name,
      age: age !== undefined ? Number(age) : userDb.demoSupriyaProfile.age,
      gender: gender || userDb.demoSupriyaProfile.gender,
      bloodGroup: bloodGroup || userDb.demoSupriyaProfile.bloodGroup,
      allergies: allergies !== undefined ? allergies : userDb.demoSupriyaProfile.allergies,
      chronicConditions: chronicConditions !== undefined ? chronicConditions : userDb.demoSupriyaProfile.chronicConditions,
      medications: medications !== undefined ? medications : userDb.demoSupriyaProfile.medications,
      height: height !== undefined ? height : userDb.demoSupriyaProfile.height,
      weight: weight !== undefined ? weight : userDb.demoSupriyaProfile.weight,
      phone: phone !== undefined ? phone : userDb.demoSupriyaProfile.phone,
      email: email !== undefined ? email : userDb.demoSupriyaProfile.email
    };
    saveUserDb(req, userDb);
    addLog("Update Patient Profile", "Supriya Kilari", "Updated health profile for Supriya Kilari");
    return res.json({ success: true, member: userDb.demoSupriyaProfile });
  }

  if (id.startsWith("patient-")) {
    const idx = (userDb.patientProfiles || []).findIndex(p => p.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: "Patient profile not found." });
    }
    userDb.patientProfiles[idx] = {
      ...userDb.patientProfiles[idx],
      name: name || userDb.patientProfiles[idx].name,
      age: age !== undefined ? Number(age) : userDb.patientProfiles[idx].age,
      gender: gender || userDb.patientProfiles[idx].gender,
      bloodGroup: bloodGroup || userDb.patientProfiles[idx].bloodGroup,
      allergies: allergies !== undefined ? allergies : userDb.patientProfiles[idx].allergies,
      chronicConditions: chronicConditions !== undefined ? chronicConditions : userDb.patientProfiles[idx].chronicConditions,
      medications: medications !== undefined ? medications : userDb.patientProfiles[idx].medications,
      height: height !== undefined ? height : userDb.patientProfiles[idx].height,
      weight: weight !== undefined ? weight : userDb.patientProfiles[idx].weight,
      phone: phone !== undefined ? phone : userDb.patientProfiles[idx].phone,
      email: email !== undefined ? email : userDb.patientProfiles[idx].email,
      onboardingComplete: onboardingComplete !== undefined ? onboardingComplete : userDb.patientProfiles[idx].onboardingComplete
    };
    saveUserDb(req, userDb);
    addLog("Update Patient Profile", userDb.patientProfiles[idx].name, `Updated patient profile for ${userDb.patientProfiles[idx].name}`);
    return res.json({ success: true, member: userDb.patientProfiles[idx] });
  }

  // It is a Family Vault Member! Locate and update inside the active partition
  const activeProfileId = (req.headers["x-active-profile-id"] as string) || "fam-self";
  initPartition(userDb, activeProfileId);
  const idx = (userDb.partitions[activeProfileId].familyMembers || []).findIndex((m: any) => m.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "Profile not found." });
  }

  userDb.partitions[activeProfileId].familyMembers[idx] = {
    ...userDb.partitions[activeProfileId].familyMembers[idx],
    name: name || userDb.partitions[activeProfileId].familyMembers[idx].name,
    relation: relation || userDb.partitions[activeProfileId].familyMembers[idx].relation,
    age: age !== undefined ? Number(age) : userDb.partitions[activeProfileId].familyMembers[idx].age,
    gender: gender || userDb.partitions[activeProfileId].familyMembers[idx].gender,
    bloodGroup: bloodGroup || userDb.partitions[activeProfileId].familyMembers[idx].bloodGroup,
    allergies: allergies !== undefined ? allergies : userDb.partitions[activeProfileId].familyMembers[idx].allergies,
    chronicConditions: chronicConditions !== undefined ? chronicConditions : userDb.partitions[activeProfileId].familyMembers[idx].chronicConditions,
    medications: medications !== undefined ? medications : userDb.partitions[activeProfileId].familyMembers[idx].medications,
    height: height !== undefined ? height : userDb.partitions[activeProfileId].familyMembers[idx].height,
    weight: weight !== undefined ? weight : userDb.partitions[activeProfileId].familyMembers[idx].weight,
    phone: phone !== undefined ? phone : userDb.partitions[activeProfileId].familyMembers[idx].phone,
    email: email !== undefined ? email : userDb.partitions[activeProfileId].familyMembers[idx].email,
    onboardingComplete: onboardingComplete !== undefined ? onboardingComplete : userDb.partitions[activeProfileId].familyMembers[idx].onboardingComplete
  };

  saveUserDb(req, userDb);
  addLog("Update Profile", userDb.partitions[activeProfileId].familyMembers[idx].name, `Updated health profile for ${userDb.partitions[activeProfileId].familyMembers[idx].name}`);
  return res.json({ success: true, member: userDb.partitions[activeProfileId].familyMembers[idx] });
});

app.delete("/api/family/:id", (req, res) => {
  const { id } = req.params;
  const userDb = getUserDb(req);
  if (userDb === base_db) {
    return res.status(403).json({ error: "Cannot write to static base database." });
  }

  if (id === "fam-self") {
    return res.status(403).json({ error: "Cannot delete the demo patient profile." });
  }

  if (id.startsWith("patient-")) {
    const idx = (userDb.patientProfiles || []).findIndex(p => p.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: "Patient profile not found." });
    }
    const deletedName = userDb.patientProfiles[idx].name;
    userDb.patientProfiles = userDb.patientProfiles.filter((_: any, i: number) => i !== idx);
    
    // Clean up entire partition for this patient profile
    if (userDb.partitions && userDb.partitions[id]) {
      delete userDb.partitions[id];
    }

    saveUserDb(req, userDb);
    addLog("Delete Patient Profile", deletedName, `Deleted patient profile for ${deletedName}`);
    return res.json({ success: true });
  } else {
    const activeProfileId = (req.headers["x-active-profile-id"] as string) || "fam-self";
    initPartition(userDb, activeProfileId);
    const idx = (userDb.partitions[activeProfileId].familyMembers || []).findIndex((m: any) => m.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: "Profile not found." });
    }

    const deletedName = userDb.partitions[activeProfileId].familyMembers[idx].name;
    userDb.partitions[activeProfileId].familyMembers = userDb.partitions[activeProfileId].familyMembers.filter((_: any, i: number) => i !== idx);

    saveUserDb(req, userDb);
    addLog("Delete Profile", deletedName, `Deleted family profile for ${deletedName}`);
    return res.json({ success: true });
  }
});
// Medical Timeline
app.get("/api/timeline", (req, res) => {
  const { patientId } = req.query;
  let list = db.medicalTimeline;
  if (patientId && patientId !== "all") {
    list = list.filter(t => t.patientId === patientId);
  }
  res.json({ timeline: list });
});

app.post("/api/timeline", (req, res) => {
  const { title, patientId, category, doctorName, details, highlights, riskLevel, reportAnalysis } = req.body;
  if (!title || !patientId) {
    return res.status(400).json({ error: "Title and patientId are required." });
  }
  const patient = getProfileById(req, patientId);
  const newRecord = {
    id: `timeline-${Date.now()}`,
    date: new Date().toISOString().split("T")[0],
    title,
    patientId,
    patientName: patient ? patient.name : "Unknown",
    category: category || "Consultation",
    doctorName: doctorName || "HealthTribe Care Specialist",
    details: details || "",
    attachments: [],
    highlights: highlights || [],
    riskLevel: riskLevel || "Low",
    reportAnalysis: reportAnalysis || null
  };
  db.medicalTimeline = [newRecord, ...(db.medicalTimeline || [])];
  addLog("Create Timeline Event", newRecord.patientName, `Added health record: ${title}`);
  res.json({ success: true, record: newRecord });
});

// Medicine Ordering
app.get("/api/medicines", (req, res) => {
  res.json({ medicines: SEEDED_MEDICINES });
});

app.post("/api/medicines/order", (req, res) => {
  const { items, address, paymentMethod, couponCode } = req.body;
  if (!items || items.length === 0) {
    return res.status(400).json({ error: "No items in cart." });
  }

  let subtotal = 0;
  const processedItems = items.map((cartItem: any) => {
    const med = SEEDED_MEDICINES.find(m => m.id === cartItem.id);
    if (!med) return cartItem;
    const price = med.mrp * (1 - med.discount / 100);
    subtotal += price * cartItem.quantity;
    return { ...med, quantity: cartItem.quantity, finalPrice: price };
  });

  let discount = 0;
  if (couponCode) {
    const coupon = SEEDED_COUPONS.find(c => c.code.toUpperCase() === couponCode.toUpperCase());
    if (coupon) {
      discount = (subtotal * coupon.discountPercent) / 100;
      if (discount > coupon.maxDiscount) discount = coupon.maxDiscount;
    }
  }

  const finalTotal = Math.max(0, subtotal - discount) + 50; // 50 delivery charge

  const newOrder = {
    id: `order-${Date.now()}`,
    date: new Date().toISOString().split("T")[0],
    items: processedItems,
    subtotal,
    discount,
    deliveryFee: 50,
    total: finalTotal,
    address: address || "Default Address",
    paymentMethod: paymentMethod || "UPI",
    status: "Processing"
  };

  db.medicineOrders = [...db.medicineOrders, newOrder];
  addLog("Medicine Order", "User", `Placed medicine order ${newOrder.id} - Total: ₹${finalTotal.toFixed(2)}`);

  // Add auto-generated follow-up medicine reminder to patient timeline
  const newTimelineItem = {
    id: `timeline-order-${Date.now()}`,
    date: new Date().toISOString().split("T")[0],
    title: "Prescribed Medicine Delivery Scheduled",
    patientId: "fam-self",
    patientName: "Supriya Kilari",
    category: "Prescription",
    doctorName: "HealthTribe Pharmacy",
    details: `Delivery of ${processedItems.map((pi: any) => pi.name).join(", ")} is confirmed. Auto medicine alert activated.`,
    attachments: []
  };
  db.medicalTimeline = [newTimelineItem, ...db.medicalTimeline];

  res.json({ success: true, order: newOrder });
});

// Lab Testing
app.get("/api/labs", (req, res) => {
  res.json({ tests: SEEDED_LAB_TESTS });
});

app.post("/api/labs/book", (req, res) => {
  const { testId, patientId, date, slot, address } = req.body;
  const test = SEEDED_LAB_TESTS.find(t => t.id === testId);
  const patient = getProfileById(req, patientId);

  if (!test || !patient) {
    return res.status(404).json({ error: "Test or patient profile not found." });
  }

  const newBooking = {
    id: `lab-${Date.now()}`,
    testId,
    testName: test.name,
    patientId,
    patientName: patient.name,
    date,
    slot,
    address: address || "Home Visit Service",
    price: test.price,
    status: "Scheduled"
  };

  db.labBookings = [...db.labBookings, newBooking];
  addLog("Lab Booking", patient.name, `Booked ${test.name} for ${date} (${slot})`);

  // Add to medical timeline
  const newTimelineItem = {
    id: `timeline-lab-${Date.now()}`,
    date,
    title: `Lab Test Scheduled: ${test.name}`,
    patientId,
    patientName: patient.name,
    category: "Lab Report",
    doctorName: "HealthTribe Labs",
    details: `Home sample collection booked for ${date} at ${slot}. Preparation required: ${test.preparation}.`,
    attachments: []
  };
  db.medicalTimeline = [newTimelineItem, ...db.medicalTimeline];

  res.json({ success: true, booking: newBooking });
});

// Appointments (CRUD)
app.get("/api/appointments", (req, res) => {
  const sessionMode = req.headers["x-session-mode"] as string;
  const userDb = getUserDb(req);

  if (sessionMode === "doctor") {
    if (userDb === base_db) {
      return res.json({ appointments: base_db.appointments });
    }
    const allAppts: any[] = [];
    const seenIds = new Set();
    if (userDb.partitions) {
      for (const pId of Object.keys(userDb.partitions)) {
        const partition = userDb.partitions[pId];
        if (partition && partition.appointments) {
          for (const appt of partition.appointments) {
            if (appt && appt.id && !seenIds.has(appt.id)) {
              allAppts.push(appt);
              seenIds.add(appt.id);
            }
          }
        }
      }
    }
    return res.json({ appointments: allAppts });
  }

  res.json({ appointments: db.appointments });
});

app.post("/api/appointments", (req, res) => {
  const { doctorId, patientId, date, time, type, notes } = req.body;
  const doctor = SEEDED_DOCTORS.find(d => d.id === doctorId);
  const patient = getProfileById(req, patientId);

  if (!doctor || !patient) {
    return res.status(404).json({ error: "Doctor or Patient profile not found." });
  }

  const newAppt = {
    id: `appt-${Date.now()}`,
    doctorId,
    doctorName: doctor.name,
    specialty: doctor.specialty,
    patientId: patient.id,
    patientName: patient.name,
    date,
    time,
    status: "Upcoming",
    type: type || "In-Person",
    fee: doctor.fee,
    notes: notes || "Initial Consultation"
  };

  db.appointments = [...db.appointments, newAppt];
  addLog("Book Appointment", patient.name, `Scheduled consultation with ${doctor.name} on ${date} at ${time}`);

  // Create visit prep list and add to timeline automatically!
  const newTimelineItem = {
    id: `timeline-appt-${Date.now()}`,
    date,
    title: `Consultation with ${doctor.name}`,
    patientId: patient.id,
    patientName: patient.name,
    category: "Consultation",
    doctorName: doctor.name,
    details: `Scheduled ${type} visit. Notes: ${newAppt.notes}. Follow instructions for pre-visit checklist: bring all active medications and prior diagnostics.`,
    attachments: []
  };
  db.medicalTimeline = [newTimelineItem, ...db.medicalTimeline];

  res.json({ success: true, appointment: newAppt });
});

app.post("/api/appointments/cancel", (req, res) => {
  const { appointmentId } = req.body;
  const userDb = getUserDb(req);

  if (userDb === base_db) {
    const index = base_db.appointments.findIndex(a => a.id === appointmentId);
    if (index === -1) {
      return res.status(404).json({ error: "Appointment not found." });
    }
    const appt = { ...base_db.appointments[index], status: "Cancelled" };
    base_db.appointments[index] = appt;
    addLog("Cancel Appointment", appt.patientName, `Cancelled appointment with ${appt.doctorName}`);
    return res.json({ success: true, appointment: appt });
  }

  let foundAppt: any = null;
  if (userDb.partitions) {
    for (const pId of Object.keys(userDb.partitions)) {
      const partition = userDb.partitions[pId];
      if (partition && partition.appointments) {
        const index = partition.appointments.findIndex((a: any) => a.id === appointmentId);
        if (index !== -1) {
          const appt = { ...partition.appointments[index], status: "Cancelled" };
          partition.appointments[index] = appt;
          foundAppt = appt;
          saveUserDb(req, userDb);
          break;
        }
      }
    }
  }

  if (!foundAppt) {
    return res.status(404).json({ error: "Appointment not found." });
  }

  addLog("Cancel Appointment", foundAppt.patientName, `Cancelled appointment with ${foundAppt.doctorName}`);
  res.json({ success: true, appointment: foundAppt });
});

app.post("/api/appointments/reschedule", (req, res) => {
  const { appointmentId, date, time } = req.body;
  const userDb = getUserDb(req);

  if (userDb === base_db) {
    const index = base_db.appointments.findIndex(a => a.id === appointmentId);
    if (index === -1) {
      return res.status(404).json({ error: "Appointment not found." });
    }
    const appt = { ...base_db.appointments[index], date, time, status: "Upcoming" };
    base_db.appointments[index] = appt;
    addLog("Reschedule Appointment", appt.patientName, `Rescheduled consultation with ${appt.doctorName} to ${date} at ${time}`);
    return res.json({ success: true, appointment: appt });
  }

  let foundAppt: any = null;
  if (userDb.partitions) {
    for (const pId of Object.keys(userDb.partitions)) {
      const partition = userDb.partitions[pId];
      if (partition && partition.appointments) {
        const index = partition.appointments.findIndex((a: any) => a.id === appointmentId);
        if (index !== -1) {
          const appt = { ...partition.appointments[index], date, time, status: "Upcoming" };
          partition.appointments[index] = appt;
          foundAppt = appt;
          saveUserDb(req, userDb);
          break;
        }
      }
    }
  }

  if (!foundAppt) {
    return res.status(404).json({ error: "Appointment not found." });
  }

  addLog("Reschedule Appointment", foundAppt.patientName, `Rescheduled consultation with ${foundAppt.doctorName} to ${date} at ${time}`);
  res.json({ success: true, appointment: foundAppt });
});

// Coupons Apply Validation
app.post("/api/coupons/apply", (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "Coupon code is required." });
  const coupon = SEEDED_COUPONS.find(c => c.code.toUpperCase() === code.toUpperCase());
  if (coupon) {
    res.json({ success: true, coupon });
  } else {
    res.status(400).json({ success: false, error: "Invalid coupon code." });
  }
});

// ---------------------------------------------------------
// Helper for retrying AI calls with exponential backoff
async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    const isQuota = err.status === "RESOURCE_EXHAUSTED" || err.status === 429 || err.status === 503 || (err.message && (err.message.includes("429") || err.message.includes("503")));
    const isNetwork = err.message && (err.message.includes("fetch failed") || err.message.includes("ECONNRESET") || err.message.includes("socket hang up"));
    if (retries > 0 && (isQuota || isNetwork)) {
      console.log(`Error: ${err.message}, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryWithBackoff(fn, retries - 1, delay * 2);
    }
    throw err;
  }
}

// AI Doctor Assistant Chatbot
app.post("/api/doctor-chat", async (req, res) => {
  const { query = "", history = [] } = req.body || {};
  if (!aiService.isAvailable()) {
    return res.json({ response: "AI service currently unavailable." });
  }

  // Gather context from DB
  const doctorContext = {
    appointments: (db.appointments || []).filter(a => a.doctorId === "D000"), // assuming Dr Rahul
    patients: db.familyMembers || [],
    today: new Date().toISOString().split("T")[0]
  };
  
  // Use PromptBuilder
  const promptPayload = PromptBuilder.buildDoctorPrompt(doctorContext, history, query, db.medicalTimeline || []);
  
  try {

    const responseText = await aiService.generateContent(promptPayload);
    const response = { text: responseText };
    res.json({ response: response.text || "I am currently unable to provide an AI response, please try again." });
  } catch (err: any) {
    console.error("Doctor Chat Error:", err);
    res.json({ response: "AI service is currently busy or unavailable, returning heuristic response. Patient condition seems stable. Please monitor carefully." });
  }
});


// Triage Conversations API
app.get("/api/triage/conversations", (req, res) => {
  res.json({ conversations: db.triageConversations || [] });
});

app.post("/api/triage/conversations", (req, res) => {
  const { title } = req.body;
  const newConversation = {
    id: "conv-" + Date.now(),
    title: title || "Symptom Triage",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  db.triageConversations = [newConversation, ...(db.triageConversations || [])];
  res.json({ conversation: newConversation });
});

app.get("/api/triage/conversations/:id/messages", (req, res) => {
  const { id } = req.params;
  const messages = (db.triageMessages || []).filter(m => m.conversationId === id);
  res.json({ messages });
});

app.post("/api/triage/conversations/:id/messages", (req, res) => {
  const { id } = req.params;
  const { message, sender, triage, status } = req.body;
  
  const newMessage = {
    id: "msg-" + Date.now() + Math.random(),
    conversationId: id,
    sender,
    text: message,
    triage,
    status: status || "complete",
    timestamp: new Date().toISOString()
  };
  
  db.triageMessages = [...(db.triageMessages || []), newMessage];
  
  // Update conversation updatedAt
  const convIndex = db.triageConversations.findIndex(c => c.id === id);
  if (convIndex !== -1) {
    const updatedConversations = [...db.triageConversations];
    updatedConversations[convIndex] = {
      ...updatedConversations[convIndex],
      updatedAt: new Date().toISOString()
    };
    db.triageConversations = updatedConversations;
  }
  
  res.json({ message: newMessage });
});

// Update specific message (for streaming / status updates)
app.put("/api/triage/messages/:msgId", (req, res) => {
  const { msgId } = req.params;
  const { status, triage, text } = req.body;
  
  const index = db.triageMessages.findIndex(m => m.id === msgId);
  if (index !== -1) {
    const updatedMessages = [...db.triageMessages];
    const updatedMsg = { ...updatedMessages[index] };
    if (status) updatedMsg.status = status;
    if (triage) updatedMsg.triage = triage;
    if (text !== undefined) updatedMsg.text = text;
    updatedMessages[index] = updatedMsg;
    db.triageMessages = updatedMessages;
    res.json({ message: updatedMsg });
  } else {
    res.status(404).json({ error: "Message not found" });
  }
});

// AI Chatbot Symptom Copilot & Smart Triage
app.post("/api/triage", async (req, res) => {
  const { message, history, familyMemberId } = req.body;
  const patient = getProfileById(req, familyMemberId) || db.familyMembers[0];

  const systemPrompt = `You are a real-time, high-performance Triage Copilot for HealthTribe AI.
Analyze symptoms instantly and provide structured health guidance.
Strictly respond ONLY with this JSON schema:
{
  "assessment": "Short assessment summary",
  "urgency": "RED" | "ORANGE" | "YELLOW" | "GREEN" | "BLUE",
  "clinicalCategories": string[],
  "followUpQuestions": string[],
  "recommendations": string[],
  "specialist": "General Physician" | "Cardiologist" | "Pediatrician" | "Dermatologist" | "Neurologist" | "Orthopedic" | "ENT" | "Gastroenterologist" | "Pulmonologist" | "Endocrinologist" | "Ophthalmologist" | "Psychiatrist" | "Gynecologist" | "Urologist" | "Oncologist" | "Nephrologist" | "Plastic Surgeon" | "Radiologist" | "Physiotherapist" | "Nutritionist",
  "emergencyWarnings": string[],
  "nearbyHospitalRecommendation": string,
  "aiDoctorResponse": "Friendly, professional medical response"
}
Guidelines:
1. Identify red-flags immediately.
2. Distinguish: Emergency, Urgent, 24h, Routine, Self-care.
3. Explain why this classification was made.
4. Include a medical disclaimer.
5. Patient: ${patient.name}, Age: ${patient.age}, Gender: ${patient.gender}, Chronic: ${patient.chronicConditions || "None"}.`;

  if (aiService.isAvailable()) {
    try {
      const promptPayload = PromptBuilder.buildTriagePrompt(patient, message, history);
      const responseText = await aiService.generateContent(promptPayload);
      const response = { text: responseText };

      const triageResult = JSON.parse(response.text || "{}");
      
      // Update persistent memory
      db.supportChats = [
        ...(db.supportChats || []),
        {
          sender: "user",
          text: message,
          timestamp: new Date().toISOString()
        },
        {
          sender: "ai",
          text: "Triage assessment provided.",
          triage: triageResult,
          timestamp: new Date().toISOString()
        }
      ];

      res.json(triageResult);
    } catch (err) {
      console.error("Gemini triage error:", err);
      const fallbackResult = generateHeuristicTriage(message, patient);
      db.supportChats = [
        ...(db.supportChats || []),
        {
          sender: "user",
          text: message,
          timestamp: new Date().toISOString()
        },
        {
          sender: "ai",
          text: "Triage assessment provided (fallback).",
          triage: fallbackResult,
          timestamp: new Date().toISOString()
        }
      ];
      res.json(fallbackResult);
    }
  } else {
    const fallbackResult = generateHeuristicTriage(message, patient);
    db.supportChats = [
      ...(db.supportChats || []),
      {
        sender: "user",
        text: message,
        timestamp: new Date().toISOString()
      },
      {
        sender: "ai",
        text: "Triage assessment provided (fallback).",
        triage: fallbackResult,
        timestamp: new Date().toISOString()
      }
    ];
    res.json(fallbackResult);
  }
});

// Heuristic fallback for Triage
function generateHeuristicTriage(message: string, patient: any) {
  const msg = message.toLowerCase();
  let urgency = "GREEN";
  let urgencyColor = "green";
  let specialty = "General Physician";
  let assessment = "We evaluated your symptoms and recommend general monitoring.";
  let warnings = ["High fever over 103°F", "Severe body pain"];
  let homeCare = ["Rest adequately", "Keep hydrated with fluids", "Track temperature twice daily"];
  let followups = ["How long have you been feeling this way?", "Do you have any fever or headache?"];
  let responseText = "Hello! Based on a quick assessment of your description, your symptoms appear manageable, but we recommend scheduling a routine general consultation to ensure prompt guidance.";

  if (msg.includes("chest") || msg.includes("heart") || msg.includes("breathing") || msg.includes("cardiac") || msg.includes("stroke")) {
    urgency = "RED";
    urgencyColor = "red";
    specialty = "Cardiologist";
    assessment = "Potential cardiac or respiratory emergency suspected. Immediate evaluation required.";
    warnings = ["Crushing chest pain radiating to left arm/jaw", "Sudden short of breath", "Cold sweats, dizziness or fainting"];
    homeCare = ["Sit down and stay calm", "Loosen tight clothing", "Do not exert yourself. Prepare for emergency transport."];
    followups = ["Is the pain radiating anywhere else?", "Are you experiencing shortness of breath?", "Do you have history of heart disease?"];
    responseText = "⚠️ WARNING: Chest pain or difficulty breathing are critical indicators. Please activate the Emergency SOS trigger immediately, contact our featured emergency hospital, and seek care right away.";
  } else if (msg.includes("skin") || msg.includes("rash") || msg.includes("acne") || msg.includes("allergy") || msg.includes("spots")) {
    urgency = "YELLOW";
    urgencyColor = "yellow";
    specialty = "Dermatologist";
    assessment = "Mild-to-moderate skin inflammation or allergic reaction detected.";
    warnings = ["Rapid swelling of face, lips, or tongue", "Difficulty swallowing", "Severe spreading blisters"];
    homeCare = ["Avoid scratching or harsh soaps", "Apply cooling calamine lotion", "Keep track of active food/contact triggers"];
    followups = ["Is the rash itchy or painful?", "Have you eaten new foods or touched new plants?", "Is there any facial swelling?"];
    responseText = "Based on your description, this looks like a dermatological concern. I suggest keeping the skin clean, avoiding triggers, and scheduling a consultation with a certified dermatologist.";
  } else if (msg.includes("fever") || msg.includes("cough") || msg.includes("headache") || msg.includes("cold") || msg.includes("stomach")) {
    urgency = "YELLOW";
    urgencyColor = "yellow";
    specialty = "General Physician";
    assessment = "Viral, flu-like symptoms or acute gastritis checkup recommended.";
    warnings = ["Persistent high fever over 3 days", "Severe abdominal pain", "Blood in vomit or stool"];
    homeCare = ["Use paracetamol if fever persists", "Eat light, non-spicy meals", "Drink warm oral rehydration solution"];
    followups = ["What is your current body temperature?", "Do you have vomiting or loose stools?", "Are you able to hold down liquids?"];
    responseText = "Your symptoms resemble a standard viral infection or digestive irritation. Stay well hydrated, eat light bland food, and speak to a General Physician if there is no improvement within 24 hours.";
  }

  return {
    urgency,
    assessment,
    urgencyColor,
    specialtySuggestion: specialty,
    homeCareTips: homeCare,
    emergencyWarnings: warnings,
    followupQuestions: followups,
    aiDoctorResponse: responseText
  };
}

// AI Diet Plan Generator Post-Consultation
app.post("/api/diet", async (req, res) => {
  const { diagnosis, medications, allergies, foodPreference } = req.body;

  const prompt = `You are a certified Clinical Nutrition Specialist Agent.
Generate a tailored post-consultation recovery diet plan for a patient with:
- Diagnosis: "${diagnosis || "General recovery"}"
- Active Medications: "${medications || "None"}"
- Allergies: "${allergies || "None"}"
- Food Preferences: "${foodPreference || "Vegetarian (Indian style)"}"

The diet plan must support recovery based strictly on medical science, respecting allergies and medicines (e.g., low sodium for hypertension, simple digestible foods for gastritis, low glycemic index for diabetes).

You MUST respond ONLY with a JSON object following this exact schema:
{
  "scientificRationale": "Clinical reason why this nutrition setup matches the recovery need.",
  "breakfast": "Meal recommendation with healthy ingredients",
  "lunch": "Full balanced recovery lunch plan",
  "dinner": "Light recovery dinner plan",
  "snacks": "Recovery snacks, hydration guidance, and foods to avoid"
}
Return only the raw json, no backticks, formatting, or extra text.`;

  if (aiService.isAvailable()) {
    try {
      const promptPayload = PromptBuilder.buildDietPrompt(diagnosis, medications, foodPreference, null);
      const responseText = await aiService.generateContent(promptPayload);
      const response = { text: responseText };
      res.json(JSON.parse(response.text || "{}"));
    } catch (err) {
      console.error("Gemini diet generation error:", err);
      res.json(generateHeuristicDiet(diagnosis, foodPreference));
    }
  } else {
    res.json(generateHeuristicDiet(diagnosis, foodPreference));
  }
});

function generateHeuristicDiet(diagnosis: string, foodPref: string) {
  const diag = (diagnosis || "").toLowerCase();
  if (diag.includes("heart") || diag.includes("cardiac") || diag.includes("hypertension")) {
    return {
      scientificRationale: "Focuses on a DASH-inspired, low-sodium regimen to ease cardiac workload and stabilize arterial pressures.",
      breakfast: "Oatmeal with sliced almonds, chia seeds, and fresh berries. Green tea.",
      lunch: "Brown rice or 2 whole-wheat rotis with boiled dal, steamed spinach, and low-fat curd.",
      dinner: "Roti with baked paneer / grilled chicken, cucumber salad, and stir-fried bottle gourd (lauki).",
      snacks: "Unsalted walnuts, fresh coconut water. Avoid pickles, papads, and excessive salt."
    };
  } else if (diag.includes("diabetes") || diag.includes("sugar")) {
    return {
      scientificRationale: "Emphasizes complex carbohydrates, low glycemic index foods, and high fiber to prevent glycemic spikes.",
      breakfast: "Moong dal chilla with vegetable stuffing or vegetable daliya.",
      lunch: "Quinoa or brown rice with high-fiber mixed veg curry, roasted chana, and methi saag.",
      dinner: "Multigrain chapati with light paneer bhurji and raw sprout salad.",
      snacks: "Roasted makhana, buttermilk, green apples. Avoid sweet juices and white bread."
    };
  }

  return {
    scientificRationale: "Balanced light nutrition rich in vitamins, minerals, and clean proteins to accelerate general tissue healing and energy recovery.",
    breakfast: "Oats porridge with almonds, soft-boiled egg or steamed idlis.",
    lunch: "Warm khichdi with mixed vegetables, low-fat yogurt, and stir-fried carrots.",
    dinner: "Warm vegetable soup, soft roti with bottle gourd curry or grilled fish.",
    snacks: "Fresh papaya, herbal chamomile tea, roasted almonds. Avoid deep-fried, heavy or highly spiced items."
  };
}

// Medicine Interaction Warning Alert Engine
app.post("/api/interaction-check", async (req, res) => {
  const { medicines, patientAllergies } = req.body;

  if (!medicines || !Array.isArray(medicines) || medicines.length === 0) {
    return res.status(400).json({ error: "Provide a list of medicines to evaluate." });
  }

  const prompt = `You are an automated Drug Safety and Interaction Check Agent.
Analyze the following active medicine list: [${medicines.join(", ")}]
Patient known drug/food allergies: "${patientAllergies || "None"}"

Check for:
1. Drug-Drug Interactions (critical safety warnings).
2. Food/Alcohol Interactions.
3. Duplicate therapies or overlapping dosage classes.
4. Specific warnings related to the allergies.

You MUST respond ONLY with a JSON object following this exact schema:
{
  "safe": boolean,
  "alertsCount": number,
  "alerts": [
    {
      "severity": "CRITICAL" | "MODERATE" | "WARNING",
      "interaction": "E.g. Metformin + Alcohol or Ramipril + Ibuprofen",
      "risk": "Description of the physiological risk or adverse effect.",
      "advice": "Clear clinical advice on what action the patient should discuss with their provider."
    }
  ]
}
Return only the raw json, no backticks or extra text.`;

  if (aiService.isAvailable()) {
    try {
      const promptPayload = PromptBuilder.buildInteractionPrompt(medicines, patientAllergies, null);
      const responseText = await aiService.generateContent(promptPayload);
      const response = { text: responseText };
      res.json(JSON.parse(response.text || "{}"));
    } catch (err) {
      console.error("Gemini safety alert check error:", err);
      res.json(generateHeuristicInteractions(medicines));
    }
  } else {
    res.json(generateHeuristicInteractions(medicines));
  }
});

function generateHeuristicInteractions(medicines: string[]) {
  const meds = medicines.map(m => m.toLowerCase());
  const alerts = [];

  // Metformin + Alcohol interaction
  const hasMetformin = meds.some(m => m.includes("metformin"));
  const hasStatins = meds.some(m => m.includes("atorvastatin") || m.includes("statin"));
  const hasAntibiotic = meds.some(m => m.includes("amoxicillin") || m.includes("penicillin"));

  if (hasMetformin) {
    alerts.push({
      severity: "CRITICAL",
      interaction: "Metformin + Alcohol Intake",
      risk: "Concomitant use may significantly elevate the risk of lactic acidosis—a rare but potentially life-threatening emergency.",
      advice: "Do not consume alcohol while taking Metformin unless explicitly cleared by your physician."
    });
  }

  if (hasStatins) {
    alerts.push({
      severity: "WARNING",
      interaction: "Atorvastatin + Grapefruit Juice",
      risk: "Grapefruit inhibits CYP3A4 enzymes, leading to increased plasma concentrations of Atorvastatin, which can elevate risks of myopathy (muscle pain) or liver strain.",
      advice: "Avoid drinking grapefruit juice or eating grapefruit in large quantities while on this cholesterol therapy."
    });
  }

  if (hasAntibiotic && meds.some(m => m.includes("contraceptive") || m.includes("dairy"))) {
    alerts.push({
      severity: "MODERATE",
      interaction: "Amoxicillin + Calcium Rich Foods",
      risk: "Heavy calcium supplements can slightly slow absorption of certain oral antibiotics, reducing immediate peak effectiveness.",
      advice: "Take Amoxicillin at least 1 hour before or 2 hours after consuming calcium-fortified juices or dairy products."
    });
  }

  return {
    safe: alerts.length === 0,
    alertsCount: alerts.length,
    alerts: alerts.length > 0 ? alerts : [
      {
        severity: "WARNING",
        interaction: "General Precaution",
        risk: "No severe drug-drug interactions detected among the listed entries.",
        advice: "Always consult your physician before starting or altering any drug routine."
      }
    ]
  };
}

// AI Report Parsing & Explanation
app.post("/api/analyze-report", async (req, res) => {
  const { reportText, files } = req.body;

  if (!reportText && (!files || files.length === 0)) {
    return res.status(400).json({ error: "Report text or files are required for analysis." });
  }

  const prompt = `You are a Clinical Diagnostics Expert Agent.
Analyze the provided medical report documents and/or text parameters.

Explain the key biomarkers, highlight abnormal values, simplify the medical jargon for the patient, and recommend safe, logical next steps without offering a definitive medical diagnosis.

You MUST respond ONLY with a JSON object following this exact schema:
{
  "summary": "High-level patient-friendly summary of the report.",
  "findings": [
    { "marker": "Marker name", "value": "Value", "status": "High" | "Normal" | "Low", "description": "What this marker means." }
  ],
  "concerns": ["List of any key values of potential concern."],
  "nextSteps": ["Safe next actions e.g. consult Cardiologist, repeat test in 3 months"],
  "extractedText": "Optional full text extracted from the document via OCR"
}
Return only raw json, no markdown formatting.`;

  let parts = [];
  if (files && files.length > 0) {
    for (const f of files) {
      parts.push({
        inlineData: {
          data: f.data,
          mimeType: f.mimeType
        }
      });
    }
  }
  
  parts.push({ text: prompt });
  
  if (reportText) {
    parts.push({ text: "User provided parameters/text:\n" + reportText });
  }

  if (aiService.isAvailable()) {
    try {
      const previousReports = req.body.patientId ? db.medicalTimeline.filter(t => t.patientId === req.body.patientId) : [];
      const promptPayload = PromptBuilder.buildOCRPrompt(reportText, null, previousReports);
      const responseText = await aiService.generateContent(promptPayload);
      const response = { text: responseText };
      res.json(JSON.parse(response.text || "{}"));
    } catch (err) {
      console.error("Gemini report parsing error:", err);
      res.status(500).json({ error: "Unable to generate analysis. Please try again." });
    }
  } else {
    res.status(500).json({ error: "Unable to generate analysis. Please try again." });
  }
});

function generateHeuristicReport(reportText: string) {
  const text = reportText.toLowerCase();
  let summary = "We simplified your diagnostic parameters to make them readable.";
  let findings = [
    { marker: "Total Cholesterol", value: "220 mg/dL", status: "High", description: "Lipid transport count. Values above 200 suggest mild risk elevation." },
    { marker: "HDL (Good) Cholesterol", value: "48 mg/dL", status: "Normal", description: "Helps clear fatty build-ups from arterial channels." },
    { marker: "LDL (Bad) Cholesterol", value: "135 mg/dL", status: "High", description: "Contributes to plaque build-up in arteries." }
  ];
  let concerns = ["Total Cholesterol and LDL levels are elevated beyond optimum ranges."];
  let nextSteps = ["Adopt low-saturated-fat recovery diet", "Consult with a Cardiologist or General Physician", "Engage in 30 mins cardiovascular exercise daily"];

  if (text.includes("sugar") || text.includes("diabetes") || text.includes("hba1c") || text.includes("glucose")) {
    summary = "Your blood sugar parameters indicate insulin resistance levels.";
    findings = [
      { marker: "HbA1c", value: "7.1%", status: "High", description: "Average blood glucose level over the past 3 months. Normal is below 5.7%." },
      { marker: "Fasting Blood Glucose", value: "128 mg/dL", status: "High", description: "Glucose concentration after overnight fasting. Elevated above 126 is typically diabetic zone." }
    ];
    concerns = ["Both HbA1c and Fasting glucose exceed optimal standards, suggesting type-2 diabetes progression."];
    nextSteps = ["Consult General Physician or Endocrinologist for medication titration", "Follow the customized HealthTribe AI Diet Plan", "Schedule a follow-up test in 3 months"];
  }

  return {
    summary,
    findings,
    concerns,
    nextSteps
  };
}

// ---------------------------------------------------------
// VITE CLIENT DEVELOPMENT AND PRODUCTION ROUTING
// ---------------------------------------------------------

async function startServer() {
  // ==========================================
// AI COPILOT WORKSPACE API
// ==========================================

app.get("/api/ai-conversations", (req, res) => {
  const { sessionMode, patientId } = req.query; // 'patient' or 'doctor'
  const filter = sessionMode === 'doctor' ? ((c: any) => c.sessionMode === 'doctor') : ((c: any) => c.sessionMode !== 'doctor');
  let conversations = db.aiConversations.filter(filter);
  if (patientId) {
    conversations = conversations.filter((c: any) => c.patientId === patientId);
  }
  conversations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  res.json(conversations);
});

app.post("/api/ai-conversations", (req, res) => {
  const { title, sessionMode, patientId } = req.body;
  const newConv = {
    id: "conv-" + Date.now(),
    title: title || "New Conversation",
    sessionMode: sessionMode || "patient",
    patientId: patientId || null,
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  debugLog("[DEBUG] [POST /api/ai-conversations] Creating new conversation ID:", newConv.id);
  debugLog("[DEBUG] [POST /api/ai-conversations] current db.aiConversations BEFORE adding:", (db.aiConversations || []).map((c: any) => c.id));
  db.aiConversations = [...(db.aiConversations || []), newConv];
  debugLog("[DEBUG] [POST /api/ai-conversations] current db.aiConversations AFTER adding:", (db.aiConversations || []).map((c: any) => c.id));
  res.json(newConv);
});

app.get("/api/ai-conversations/:id", (req, res) => {
  const conv = db.aiConversations.find(c => c.id === req.params.id);
  if (!conv) return res.status(404).json({ error: "Not found" });
  res.json(conv);
});

app.put("/api/ai-conversations/:id", (req, res) => {
  const index = db.aiConversations.findIndex(c => c.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Not found" });
  
  const updatedConv = { ...db.aiConversations[index] };
  if (req.body.title) updatedConv.title = req.body.title;
  if (req.body.patientId !== undefined) updatedConv.patientId = req.body.patientId;
  updatedConv.updatedAt = new Date().toISOString();
  
  const updatedConvs = [...db.aiConversations];
  updatedConvs[index] = updatedConv;
  db.aiConversations = updatedConvs;
  
  res.json(updatedConv);
});

app.delete("/api/ai-conversations/:id", (req, res) => {
  db.aiConversations = db.aiConversations.filter(c => c.id !== req.params.id);
  res.json({ success: true });
});

app.post("/api/ai-conversations/:id/messages", async (req, res) => {
  debugLog("[DEBUG] [POST /api/ai-conversations/:id/messages] START");
  debugLog("[DEBUG] 1. Conversation ID received by route parameter :id:", req.params.id);
  debugLog("[DEBUG] 2. Conversation ID received from frontend (body):", req.body?.conversationId || "None in body");
  debugLog("[DEBUG] 3. Conversation IDs inside db.aiConversations immediately BEFORE lookup:", (db.aiConversations || []).map((c: any) => c.id));
  
  const convIndex = db.aiConversations.findIndex(c => c.id === req.params.id);
  debugLog("[DEBUG] 4. Result of index lookup (convIndex):", convIndex);
  
  if (convIndex === -1) {
    debugLog("[DEBUG] 5. conv is undefined (convIndex is -1). Terminating with 404.");
    return res.status(404).json({ error: "Not found" });
  }

  const conv = db.aiConversations[convIndex];
  debugLog("[DEBUG] 5. conv exists! (convIndex is " + convIndex + ")");
  debugLog("[DEBUG] 6. conv.messages size:", conv.messages?.length || 0, "messages content:", JSON.stringify(conv.messages));

  const { text, sender, patientContext, language } = req.body;
  
  const userMsg = {
    id: "msg-" + Date.now(),
    sender: "user",
    text,
    timestamp: new Date().toISOString()
  };

  // Create updated conversation object
  const updatedConv = {
    ...conv,
    messages: [...(conv.messages || []), userMsg],
    updatedAt: new Date().toISOString()
  };
  
  // If title is "New Conversation", generate one
  if (updatedConv.messages.length === 1 && updatedConv.title === "New Conversation") {
    if (aiService.isAvailable()) {
      try {
        const titleResText = await aiService.generateContent({
           prompt: "Generate a very short title (max 5 words) for this medical query: " + text
        });
        const titleRes = { text: titleResText };
        if (titleRes.text) {
           updatedConv.title = titleRes.text.replace(/["']/g, "").trim();
        }
      } catch(e) {}
    } else {
      updatedConv.title = text.substring(0, 30) + "...";
    }
  }

  // Generate AI Response
  let aiText = "I am currently offline or AI is unavailable. Please try again later.";
  let widgetType = undefined;
  let widgetData = undefined;
  
  if (aiService.isAvailable()) {
    try {
      const history = Array.from(updatedConv.messages.slice(0, -1));
      
      // Orchestration Phase
      const orchestrationPrompt = PromptBuilder.buildOrchestrationPrompt(text, history);
      debugLog("[DEBUG] 7. Log immediately BEFORE calling Gemini/OpenAI (orchestration)");
      const orchestrationResText = await aiService.generateContent(orchestrationPrompt);
      debugLog("[DEBUG] 8. Log immediately AFTER AI returns (orchestration):", orchestrationResText ? "Success" : "Empty");
      
      let orchestrationResult = { action: "NONE", specialty: null };
      try {
        orchestrationResult = JSON.parse(orchestrationResText.replace(/^[\s\S]*?```json/m, '').replace(/```[\s\S]*$/m, '').trim());
      } catch(e) {
        // sometimes LLMs just output JSON directly
        try { orchestrationResult = JSON.parse(orchestrationResText); } catch(e2) {}
      }
      
      let contextData = null;
      
      if (orchestrationResult.action === "FETCH_DOCTORS") {
        let docs = db.doctors || [];
        if (orchestrationResult.specialty) {
           docs = docs.filter(d => d.specialty.toLowerCase().includes(orchestrationResult.specialty.toLowerCase()));
           if (docs.length === 0) docs = db.doctors; // fallback to all
        }
        contextData = docs.slice(0, 3);
        widgetType = "doctors";
        widgetData = contextData;
      } else if (orchestrationResult.action === "FETCH_TIMELINE") {
        contextData = db.medicalTimeline || [];
        widgetType = "timeline";
        widgetData = contextData.slice(0, 5);
      } else if (orchestrationResult.action === "FETCH_MEDICATIONS") {
        contextData = db.medicineOrders || [];
      } else if (orchestrationResult.action === "FETCH_APPOINTMENTS") {
        contextData = db.appointments || [];
      }
      
      let promptPayload;
      if (updatedConv.sessionMode === "doctor") {
        const doctorContext = {
          doctorName: "Dr. Rahul Atluri",
          specialty: "Cardiology",
          currentPatient: patientContext
        };
        promptPayload = PromptBuilder.buildDoctorPrompt(doctorContext, history, text, contextData || db.medicalTimeline);
      } else {
        promptPayload = PromptBuilder.buildPatientPrompt(patientContext, history, text, contextData);
      }

      // Prepend language formatting directive if a specific language is selected
      if (language === "hi") {
        promptPayload.systemInstruction += "\n\nCRITICAL LANGUAGE MANDATE: You MUST reply entirely in the Hindi (हिन्दी) language. Do not use English words or English alphabets for your response (except for specific brand/medical names where absolutely needed).";
      } else if (language === "te") {
        promptPayload.systemInstruction += "\n\nCRITICAL LANGUAGE MANDATE: You MUST reply entirely in the Telugu (తెలుగు) language. Do not use English words or English alphabets for your response (except for specific brand/medical names where absolutely needed).";
      } else if (language === "en") {
        promptPayload.systemInstruction += "\n\nCRITICAL LANGUAGE MANDATE: You MUST reply entirely in English.";
      } else {
        promptPayload.systemInstruction += "\n\nCRITICAL LANGUAGE MANDATE: If the user spoke or queried in Hindi, reply in Hindi. If in Telugu, reply in Telugu. Otherwise, default to English.";
      }

      debugLog("[DEBUG] 7. Log immediately BEFORE calling Gemini/OpenAI (main model call)");
      const responseText = await aiService.generateContent(promptPayload);
      debugLog("[DEBUG] 8. Log immediately AFTER AI returns (main model call):", responseText ? "Success" : "Empty");
      
      aiText = responseText || "No response generated.";
    } catch (err) {
      console.error("[DEBUG] Gemini fallback triggered due to error:", err.message);
      aiText = "# Assessment\n\nBased on your query: **\"" + text + "\"**\n\n# Key Findings\n* Mild to moderate presentation of requested symptoms.\n* Vital parameters remain within standard deviation limits.\n\n# Next Steps\n1. Monitor for changes over the next 48 hours.\n2. Consult a specialist if condition worsens.\n\n*(Note: This is a heuristic fallback response due to temporary AI unavailability)*";
    }
  } else {
    aiText = `# Assessment\n\nBased on your query: **"${text}"**\n\n# Key Findings\n* Finding 1\n* Finding 2\n\n# Next Steps\n1. Please consult a specialist.\n2. Monitor your symptoms.\n`;
  }

  const aiMsg = {
    id: "msg-" + Date.now() + 1,
    sender: "ai",
    text: aiText,
    timestamp: new Date().toISOString(),
    ...(widgetType && { widget: widgetType, widgetData })
  };
  
  updatedConv.messages = [...updatedConv.messages, aiMsg];
  updatedConv.updatedAt = new Date().toISOString();

  // Save the updated conversations array back to the DB to trigger Proxy setter
  debugLog("[DEBUG] 9. Log immediately BEFORE persistence of updatedConv (saving to db.aiConversations)");
  const updatedConvs = [...db.aiConversations];
  updatedConvs[convIndex] = updatedConv;
  db.aiConversations = updatedConvs;
  debugLog("[DEBUG] 10. Log immediately AFTER persistence of updatedConv");

  res.json({ userMessage: userMsg, aiMessage: aiMsg, title: updatedConv.title });
});



  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  
app.listen(PORT, "0.0.0.0", () => {
    console.log(`HealthTribe AI Server successfully running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
