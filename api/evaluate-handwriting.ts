import type { Request, Response } from 'express';

export default async function handler(req: any, res: any) {
  try {
    const { section, originalPrompt, imageBase64, imageMimeType } = req.body;

    const prompt = `System Persona:
Act as a strict, official IDP/British Council certified IELTS Examiner and an expert handwriting analyst.
Inputs Provided:
Mode: Paper-Based (Handwritten Image Attached)
Section: ${section}
Original Question: ${originalPrompt}
Task:
Carefully read and transcribe the handwritten text from the attached image.
Evaluate the transcribed text based on the official IELTS public band descriptors.
Provide a strict band score (0.0 to 9.0) and detailed feedback.
Strict Output Format (JSON ONLY):
Output ONLY a minified JSON object in the exact structure below. Do not add any markdown formatting or extra text outside the JSON block.{
  "evaluation": {
    "transcribed_text": "Put the exact text you read from the handwriting here...",
    "handwriting_legibility": "Good / Average / Poor - Give a 1-line feedback on whether the examiner would struggle to read this.",
    "overall_band_score": 6.5,
    "criteria_scores": {
      "task_response": 6.0,
      "coherence_and_cohesion": 6.5,
      "lexical_resource": 7.0,
      "grammatical_range_and_accuracy": 6.5
    },
    "detailed_feedback": {
      "strengths": ["...", "..."],
      "weaknesses": ["...", "..."]
    },
    "corrections": [
      {
        "original_text": "incorrect sentence from transcription",
        "corrected_text": "correct sentence",
        "explanation": "why it was wrong"
      }
    ],
    "tips_for_improvement": "..."
  }
}`;

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    if (!process.env.GROK_API_KEY) throw new Error("GROK_API_KEY is missing from environment variables.");

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROK_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.2-90b-vision-preview",
        messages: [
          { role: "system", content: "You are an API that only returns raw JSON. Do not return markdown blocks. Reply with pure JSON." },
          { 
            role: "user", 
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:${imageMimeType || "image/jpeg"};base64,${base64Data}` } }
            ] 
          }
        ],
        temperature: 0.2
      })
    });

    if (!response.ok) {
       const errText = await response.text();
       throw new Error(`Grok API Error (vision): ${response.status} ${response.statusText} - ${errText}`);
    }

    const data = await response.json();
    const rawContent = data.choices[0]?.message?.content || "";
    const jsonStr = rawContent.replace(/```json\n?/gi, '').replace(/```/g, '').trim();

    if (!jsonStr) {
        throw new Error("Empty response from AI");
    }
    
    res.setHeader('Content-Type', 'application/json');
    res.send(jsonStr);

  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || "Failed to generate evaluation" });
  }
}
