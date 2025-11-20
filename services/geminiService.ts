
import { GoogleGenAI, Type, SchemaType } from "@google/genai";
import { ResearchResponse } from "../types";

// Initialize the client with the system environment key
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Define the schema for the structured response
const paperSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Title of the research paper" },
    authors: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING }, 
      description: "List of authors" 
    },
    year: { type: Type.STRING, description: "Publication year" },
    summary: { type: Type.STRING, description: "A concise summary of the paper's contribution (max 2 sentences)" },
    reason: { type: Type.STRING, description: "Why is this paper correlated? e.g., 'Follow up work', 'Rebuttal', 'Seminal paper in same topic'" },
    labOrInstitution: { type: Type.STRING, description: "The primary lab or institution associated (if known)" },
    relevanceScore: { type: Type.NUMBER, description: "A score from 1-100 indicating how strongly correlated or relevant this paper is to the source." }
  },
  required: ["title", "authors", "year", "summary", "reason", "relevanceScore"]
};

const researchResponseSchema = {
  type: Type.OBJECT,
  properties: {
    originalPaperContext: { type: Type.STRING, description: "A brief, one-sentence identification of the combined topic or intersection of the input papers." },
    correlatedPapers: {
      type: Type.ARRAY,
      items: paperSchema,
      description: "List of 5 papers strongly correlated with the topic or follow-ups."
    },
    authorContextPapers: {
      type: Type.ARRAY,
      items: paperSchema,
      description: "List of 5 papers from the same author(s) or research lab that explore similar themes."
    }
  },
  required: ["originalPaperContext", "correlatedPapers", "authorContextPapers"]
};

const suggestionSchema = {
  type: Type.ARRAY,
  items: { type: Type.STRING },
  description: "List of suggested paper titles"
};

export const getPaperSuggestions = async (query: string): Promise<string[]> => {
  if (!query || query.length < 3) return [];
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Provide exactly 5 real, publicly known academic research paper titles that match or are relevant to the partial search query: "${query}". 
      Return ONLY a JSON array of strings. Do not include fake papers.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: suggestionSchema,
      },
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text) as string[];
  } catch (error) {
    console.error("Autocomplete Error:", error);
    return [];
  }
};

export const analyzePaper = async (paperTitles: string[]): Promise<ResearchResponse> => {
  try {
    const contextString = paperTitles.map((t, i) => `${i + 1}. "${t}"`).join("\n");
    const prompt = `I have a research context consisting of the following paper(s):
${contextString}

Please analyze this collection as a research cluster. 
1. Briefly identify the common theme, intersection, or progression represented by this cluster.
2. Provide a list of 5 strongly correlated papers that are relevant to this *combined* context (e.g., connecting the dots between them, or future work based on both).
3. Provide a list of 5 other papers from the SAME author(s) or labs involved in these papers, specifically looking for other works where these researchers collaborated or explored adjacent topics.

Ensure the papers are real, publicly known academic works. Provide a relevance score (0-100) for how closely tied they are to this cluster.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: researchResponseSchema,
        systemInstruction: "You are a world-class academic research assistant. You are precise, helpful, and knowledgeable about scientific literature across Computer Science, Biology, Physics, and Social Sciences.",
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response from Gemini");
    }

    return JSON.parse(text) as ResearchResponse;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
