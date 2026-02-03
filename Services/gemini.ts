
import { GoogleGenAI, Type } from "@google/genai";
import { BusinessLead, SearchResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Utility to ensure phone numbers are in E.164 format with +1 for US dialing
 */
function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  // If it's 10 digits, add +1. If it starts with 1 and is 11 digits, add +.
  if (cleaned.length === 10) return `+1${cleaned}`;
  if (cleaned.length === 11 && cleaned.startsWith('1')) return `+${cleaned}`;
  return phone; // Return as is if it doesn't fit standard patterns
}

export async function discoverLeads(
  query: string,
  location?: { lat: number; lng: number }
): Promise<SearchResult> {
  // We use gemini-2.5-flash as it is optimized for Google Maps grounding
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Using Google Maps data, find as many businesses as possible (up to 20) matching this request: "${query}". 
    For each business, I need:
    1. Name
    2. Phone number
    3. Full Address
    4. Website (if available)
    5. Star rating
    6. Category
    
    Be comprehensive and ensure you search local Google Maps listings.`,
    config: {
      tools: [{ googleMaps: {} }],
      toolConfig: {
        retrievalConfig: location ? {
          latLng: {
            latitude: location.lat,
            longitude: location.lng
          }
        } : undefined
      }
    },
  });

  const text = response.text || "";
  const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  
  const sources = groundingChunks
    .map((chunk: any) => ({
      title: chunk.maps?.title || chunk.web?.title || "Google Maps Reference",
      uri: chunk.maps?.uri || chunk.web?.uri || "#"
    }))
    .filter((s: any) => s.uri !== "#");

  // Extraction pass to get structured JSON
  const extractionResponse = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Based on the Google Maps research provided, output a JSON array of up to 20 business objects.
    Research: ${text}
    
    JSON Schema:
    {
      "type": "ARRAY",
      "items": {
        "type": "OBJECT",
        "properties": {
          "name": { "type": "STRING" },
          "phone": { "type": "STRING", "description": "The business phone number" },
          "address": { "type": "STRING" },
          "website": { "type": "STRING" },
          "rating": { "type": "NUMBER" },
          "category": { "type": "STRING" }
        }
      }
    }`,
    config: {
      responseMimeType: "application/json"
    }
  });

  try {
    const rawLeads = JSON.parse(extractionResponse.text);
    const leads: BusinessLead[] = rawLeads.map((l: any, index: number) => ({
      ...l,
      phone: normalizePhone(l.phone || ""),
      id: `lead-${Date.now()}-${index}`,
      status: 'pending',
      notes: ''
    }));

    return { leads, groundingSources: sources };
  } catch (e) {
    console.error("Failed to parse leads JSON", e);
    return { leads: [], groundingSources: sources };
  }
}
