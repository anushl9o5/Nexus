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
    originalPaperContext: { type: Type.STRING, description: "A brief, one-sentence identification of the input paper provided by the user." },
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

export const analyzePaper = async (query: string): Promise<ResearchResponse> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `I have a research paper inquiry: "${query}". 
      
      Please identify this paper (or the topic if it's general) and provide:
      1. A list of 5 strongly correlated papers (direct follow-ups, rebuttals, or foundational papers in the exact same niche).
      2. A list of 5 other papers specifically from the SAME author(s) or the SAME research lab/group that cover similar or adjacent work.
      
      Ensure the papers are real, publicly known academic works. Provide a relevance score (0-100) for how closely tied they are to the original.`,
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