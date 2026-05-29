import type { Request, Response } from 'express';

export default async function handler(req: any, res: any) {
  try {
    const { section, originalPrompt, userAnswer } = req.body;

    const prompt = `System Persona:
Act as a strict, official IDP/British Council certified IELTS Examiner. Your job is to evaluate the user's answer for the IELTS Writing or Speaking section based on the official public band descriptors.
Inputs Provided by App:
Section: ${section}
Original Question/Prompt: ${originalPrompt}
User's Answer: ${userAnswer}
Task:
Evaluate the user's answer and provide a highly detailed, professional band score (0.0 to 9.0) along with constructive feedback.
Strict Output Format (JSON ONLY):
Do not write any conversational text. Output ONLY a minified JSON object in the exact structure below:{
  "evaluation": {
    "overall_band_score": 6.5,
    "criteria_scores": {
      "task_response_or_achievement": 6.0,
      "coherence_and_cohesion": 6.5,
      "lexical_resource_vocabulary": 7.0,
      "grammatical_range_and_accuracy": 6.5
    },
    "detailed_feedback": {
      "strengths": ["Good use of advanced vocabulary...", "Clear paragraph structure..."],
      "weaknesses": ["Off-topic in the second paragraph...", "Frequent article (a/an/the) errors..."]
    },
    "grammar_and_vocabulary_corrections": [
      {
        "original_text": "He go to the market everyday.",
        "corrected_text": "He goes to the market every day.",
        "explanation": "Subject-verb agreement error."
      }
    ],
    "tips_for_improvement": "To reach Band 7.0, you need to focus on..."
  }
}`;

    if (!process.env.GROK_API_KEY) throw new Error("GROK_API_KEY is missing from environment variables.");

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROK_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You are an API that only returns raw JSON. Do not return markdown blocks." },
          { role: "user", content: prompt }
        ],
        temperature: 0.2
      })
    });

    if (!response.ok) {
       const errText = await response.text();
       throw new Error(`Grok API Error: ${response.status} ${response.statusText} - ${errText}`);
    }

    const data = await response.json();
    const rawContent = data.choices[0]?.message?.content || "";
    const jsonStr = rawContent.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
    
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
