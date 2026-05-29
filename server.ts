import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

export const app = express();
const PORT = process.env.PORT || 3000;

async function setupApp() {
  if (!process.env.GROK_API_KEY) {
    console.error("\n❌ ERROR: GROK_API_KEY is missing from environment variables.");
    console.error("Please add GROK_API_KEY to your .env file before running the application.\n");
  }

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  app.post("/api/generate", async (req, res) => {
    try {
      const { testMode, section, testType, includePYQs, numberOfQuestions } = req.body;

      const prompt = `Act as the backend test-generation engine for a highly professional, premium IELTS preparation application. You are an expert British Council/IDP certified IELTS examiner and a strict JSON data provider.
User Request Parameters (App Inputs):
Test Mode: ${testMode}
Section Requested: ${section}
Test Type: ${testType}
Include PYQs (Previous Year Questions): ${includePYQs ? "Yes - Focus heavily on PYQs for Essays and Speaking" : "No"}
Number of Questions: ${numberOfQuestions}
Task:
Generate highly realistic, professional-grade IELTS test content based on the parameters above.
Strict Output Format (JSON ONLY):
Return ONLY minified JSON mimicking this structure depending on the section requested.
If Section is Reading:
{
  "section": "Reading",
  "passages": [
    { "id": 1, "title": "Passage 1 Title", "content": "Full passage text (generate at least 4 paragraphs)...", "questions": [ { "id": 1, "type": "fill_in_blank", "prompt": "Question text with blank at the end...", "answer": "..." }, ... generate exactly 13 or 14 questions so total is 40 across 3 passages ] },
    { "id": 2, "title": "Passage 2 Title", "content": "Full passage text...", "questions": [ { "id": 14, "type": "mcq", "prompt": "Question text...", "options": ["A","B","C","D"], "answer": "A" } ] },
    { "id": 3, "title": "Passage 3 Title", "content": "Full passage text...", "questions": [ ... ] }
  ]
}
IMPORTANT: Number questions sequentially across passages (e.g., Passage 1 gets 1-13, Passage 2 gets 14-26, Passage 3 gets 27-40). DO NOT use placeholder text for questions! Write REAL questions related to the specific passage text.

If Section is Listening:
{
  "section": "Listening",
  "tracks": [
    { "id": 1, "title": "Part 1", "transcript": "Full dialogue or monologue for this part...", "questions": [ { "id": 1, "type": "fill_in_blank", "prompt": "Question text...", "answer": "..." }, ... generate exactly 10 questions for Part 1 (ids 1-10) ] },
    { "id": 2, "title": "Part 2", "transcript": "Full dialogue or monologue for this part...", "questions": [ { "id": 11, "type": "mcq", "prompt": "Question text...", "options": ["A","B","C"], "answer": "A" }, ... exactly 10 questions for Part 2 (ids 11-20) ] },
    { "id": 3, "title": "Part 3", "transcript": "...", "questions": [ ... exactly 10 questions for Part 3 (ids 21-30) ] },
    { "id": 4, "title": "Part 4", "transcript": "...", "questions": [ ... exactly 10 questions for Part 4 (ids 31-40) ] }
  ]
}
CRITICAL WARNING: You MUST generate EXACTLY 4 parts. Each part MUST contain exactly 10 questions. Your final output MUST be a JSON array of exactly 40 questions. Do NOT stop at Part 1. Do NOT truncate the output. IMPORTANT: Number questions sequentially (1-40). DO NOT use placeholder text for questions! Write REAL transcripts and REAL questions.
If Section is Writing:
{
  "section": "Writing",
  "tasks": [
    { 
      "id": 1, 
      "title": "Task 1", 
      "prompt": "CRITICAL: You MUST draw a detailed Markdown data table using the | character directly inside the prompt text. DO NOT just write 'the table below'. Include at least 4 rows and 3 columns. For General, provide a letter prompt.", 
      "min_words": 150 
    },
    { "id": 2, "title": "Task 2", "prompt": "Discuss both views...", "min_words": 250 }
  ]
}
If Section is Speaking:
{
  "section": "Speaking",
  "parts": [
    { "id": 1, "title": "Part 1 - Introduction", "prompts": ["Q1...", "Q2..."] },
    { "id": 2, "title": "Part 2 - Long Turn", "cue_card": "Describe a time...", "bullet_points": ["Point 1...", "Point 2..."] },
    { "id": 3, "title": "Part 3 - Discussion", "prompts": ["Q1...", "Q2..."] }
  ]
}
You MUST output valid, minified JSON format. DO NOT use markdown code blocks (\`\`\`json etc.). Return the raw minified JSON only.`;

      let responseText = "";
      try {
        if (!process.env.GROK_API_KEY) {
            throw new Error("GROK_API_KEY is missing from environment variables.");
        }

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
            temperature: 0.2,
            max_tokens: 8000
          })
        });

        if (!response.ok) {
           const errText = await response.text();
           throw new Error(`Grok API Error: ${response.status} ${response.statusText} - ${errText}`);
        }

        const data = await response.json();
        const rawContent = data.choices[0]?.message?.content || "";
        
        // Strict parser to strip markdown
        responseText = rawContent.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
      } catch (error: any) {
        console.warn("AI generation failed, returning mock data. Error:", error.message);
      }

      if (!responseText) {
        // Fallback Mock Data
        if (section === 'Reading') {
          responseText = JSON.stringify({
             section: "Reading",
             passages: [
               {
                 id: 1, title: "The Evolution of Modern Architecture",
                 content: "Architecture has continuously evolved, mirroring the technological advancements and cultural shifts of society. In the early 20th century, the advent of steel and reinforced concrete allowed architects to push the boundaries of height and scale.\n\nFollowing the industrial revolution, the Modernist movement emerged, championed by figures like Le Corbusier and Ludwig Mies van der Rohe. They advocated for functionalism, famously encapsulating their philosophy in the maxim 'form follows function.'\n\nToday, architecture faces a new imperative: sustainability. Contemporary architects are tasked with minimizing the environmental impact of their constructions.",
                 questions: Array(13).fill(null).map((_, i) => ({
                   id: i + 1,
                   type: "fill_in_blank",
                   prompt: `Based on Passage 1, the introduction of steel allowed architects to push the boundaries of _________ (Question ${i + 1})`,
                   answer: "height and scale"
                 }))
               },
               {
                 id: 2, title: "The Deep Sea Exploration",
                 content: "The deep sea remains one of the most unexplored frontiers on Earth. With extreme pressure, freezing temperatures, and total darkness, it presents immense challenges for researchers. Recent advancements in remotely operated vehicles (ROVs) have opened up new possibilities for discovering unique marine species and geological features.",
                 questions: Array(13).fill(null).map((_, i) => ({
                   id: i + 14,
                   type: "mcq",
                   prompt: `What is the primary challenge mentioned in Passage 2? (Question ${i + 14})`,
                   options: ["Extreme pressure", "Lack of funding", "Too much light", "Overpopulation of fish"],
                   answer: "Extreme pressure"
                 }))
               },
               {
                 id: 3, title: "Artificial Intelligence in Education",
                 content: "The integration of AI in education is transforming how students learn and teachers instruct. Adaptive learning platforms can tailor content to individual student needs, providing personalized feedback. However, concerns regarding data privacy and the potential for a digital divide persist.",
                 questions: Array(14).fill(null).map((_, i) => ({
                   id: i + 27,
                   type: "fill_in_blank",
                   prompt: `According to Passage 3, adaptive platforms provide __________ feedback. (Question ${i + 27})`,
                   answer: "personalized"
                 }))
               }
             ]
          });
        } else if (section === 'Listening') {
          responseText = JSON.stringify({
            section: "Listening",
            tracks: [
              {
                id: 1, title: "Part 1 - Accommodation Booking",
                transcript: "Good morning! Welcome to the accommodation booking center. How can I help you today? \n\nWell, I'm looking for a double room for two weeks starting from the 15th of next month.",
                questions: Array(numberOfQuestions || 10).fill(null).map((_, i) => ({
                  id: i + 1,
                  type: "mcq",
                  prompt: `Mock Listening Question ${i + 1}`,
                  options: ["Option A - Single Room", "Option B - Double Room", "Option C - Shared Dorm"],
                  answer: "Option B - Double Room"
                }))
              }
            ]
          });
        } else if (section === 'Writing') {
          responseText = JSON.stringify({
            section: "Writing",
            tasks: [
              { id: 1, title: "Task 1", prompt: "The chart below shows the number of cars produced in three different countries over a ten-year period. Summarise the information by selecting and reporting the main features.", min_words: 150 },
              { id: 2, title: "Task 2", prompt: "Some people believe that university education should be free for everyone. Others think that students should pay for their higher education. Discuss both views and give your opinion.", min_words: 250 }
            ].slice(0, testMode === 'Part Test' ? 1 : 2)
          });
        } else if (section === 'Speaking') {
          responseText = JSON.stringify({
            section: "Speaking",
            parts: [
              { id: 1, title: "Part 1 - Introduction", prompts: ["What is your name?", "Where are you from?", "Do you work or study?", "What do you like to do in your free time?"] },
              { id: 2, title: "Part 2 - Long Turn", cue_card: "Describe a memorable journey you have made.", bullet_points: ["Where did you go?", "Who did you go with?", "Why was it memorable?"] },
              { id: 3, title: "Part 3 - Discussion", prompts: ["How has travel changed in your country in the last few decades?", "Do you think tourism brings more harm or good to local cultures?"] }
            ]
          });
        } else {
          throw new Error("Invalid section requested");
        }
      }

      let parsedData;
      try {
        parsedData = JSON.parse(responseText);
        
        // Hybrid fallback for listening
        if (section === 'Listening' && parsedData.tracks) {
          while (parsedData.tracks.length < 4) {
            const nextPartId = parsedData.tracks.length + 1;
            parsedData.tracks.push({
              id: nextPartId,
              title: `Part ${nextPartId} - Mock Continuation`,
              transcript: `This is a mock transcript for Part ${nextPartId} because the AI generation was truncated. Please enjoy the mock audio for this part of the test.`,
              questions: Array(10).fill(null).map((_, i) => {
                 const qId = (nextPartId - 1) * 10 + i + 1;
                 return {
                    id: qId,
                    type: "mcq",
                    prompt: `Mock appended question ${qId} for Part ${nextPartId}.`,
                    options: ["A", "B", "C"],
                    answer: "A"
                 };
              })
            });
          }
          // Ensure each track has exactly 10 questions and they add up to 40
          let currentQId = 1;
          for (let partIdx = 0; partIdx < 4; partIdx++) {
            let track = parsedData.tracks[partIdx];
            if (!track) continue;
            if (!track.questions) track.questions = [];
            while (track.questions.length < 10) {
               track.questions.push({
                 id: currentQId,
                 type: "mcq",
                 prompt: `Mock fallback question ${currentQId}`,
                 options: ["A", "B", "C"],
                 answer: "A"
               });
               currentQId++;
            }
            // Just incase it generated more than 10 per part, truncate it
            if (track.questions.length > 10) {
                track.questions = track.questions.slice(0, 10);
            }
            // Fix IDs to be sequential
            for (let i=0; i<10; i++) {
                track.questions[i].id = (partIdx * 10) + i + 1;
            }
          }
        }
      } catch(e) {
        // It's not JSON or failed to parse, we fallback
        parsedData = JSON.parse(responseText);
      }

      const jsonStr = JSON.stringify(parsedData);
      res.setHeader('Content-Type', 'application/json');
      res.send(jsonStr);

    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message || "Failed to generate test content" });
    }
  });

  app.post("/api/evaluate", async (req, res) => {
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
  });

  app.post("/api/evaluate-handwriting", async (req, res) => {
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
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use((req, res, next) => {
      vite.middlewares.handle(req, res, next);
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

// Ensure the routes are set up synchronously for Vercel
setupApp();

// Only listen if not running as a Vercel serverless function
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
