import React, { useState, useEffect, useRef } from 'react';
import { Clock, Fullscreen, Play, FileText, CheckCircle, XCircle, ChevronLeft, ChevronRight, LayoutGrid, List, Loader2, Headphones, PenTool, Mic, Pause, Square, Camera, Upload, History } from 'lucide-react';

type TestMode = 'full' | 'part' | null;
type ExamSection = 'Reading' | 'Listening' | 'Writing' | 'Speaking';

import { ResultsDashboard } from './ResultsDashboard';
import { TestHistory } from './TestHistory';

export function ExamMode() {
  const [showHistory, setShowHistory] = useState(false);
  const [testMode, setTestMode] = useState<TestMode>(null);
  const [examSection, setExamSection] = useState<ExamSection>('Reading');
  const [isTestActive, setIsTestActive] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [testData, setTestData] = useState<any>(null);
  
  // Player state
  const [timeLeft, setTimeLeft] = useState(0);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  
  // Navigation / answers status
  const [currentPart, setCurrentPart] = useState<number>(1);
  const [activeQuestion, setActiveQuestion] = useState<number>(1);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  
  // Speaking specific state
  const [isRecording, setIsRecording] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [micError, setMicError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const currentPartRef = useRef<number>(1);
  const [speakingIndex, setSpeakingIndex] = useState(0);
  const speakingIndexRef = useRef<number>(0);
  const examSectionRef = useRef<ExamSection>('Reading');

  useEffect(() => { speakingIndexRef.current = speakingIndex; }, [speakingIndex]);
  useEffect(() => { examSectionRef.current = examSection; }, [examSection]);
  const sessionBaseAnswerRef = useRef<string>('');

  // Listening Audio specific state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isAudioPaused, setIsAudioPaused] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Writing specific state
  const [writingMode, setWritingMode] = useState<'cbt' | 'paper'>('cbt');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  // Stop TTS on unmount or when component unmounts
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handlePlayTTS = () => {
    if (!window.speechSynthesis) {
      alert("Text-to-speech is not supported in this browser.");
      return;
    }

    if (isAudioPaused) {
      window.speechSynthesis.resume();
      setIsPlayingAudio(true);
      setIsAudioPaused(false);
      return;
    }

    const currentTrack = parsedContext.parts[currentPart - 1];
    const textToSpeak = currentTrack?.transcript || currentTrack?.content || "No transcript available.";
    
    window.speechSynthesis.cancel(); // Stop any currently playing audio

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    
    // Voice Selection (Prefer British or Australian)
    const voices = window.speechSynthesis.getVoices();
    const preferredVoices = voices.filter(v => v.lang === 'en-GB' || v.lang === 'en-AU');
    if (preferredVoices.length > 0) {
       utterance.voice = preferredVoices[0]; // Just take the first matching voice
    } else {
       const engVoices = voices.filter(v => v.lang.startsWith('en'));
       if (engVoices.length > 0) utterance.voice = engVoices[0];
    }

    utterance.onend = () => {
        setIsPlayingAudio(false);
        setIsAudioPaused(false);
    };
    utterance.onerror = (e) => {
        console.error("TTS Error:", e);
        setIsPlayingAudio(false);
        setIsAudioPaused(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setIsPlayingAudio(true);
    setIsAudioPaused(false);
  };

  const handlePauseTTS = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.pause();
      setIsPlayingAudio(false);
      setIsAudioPaused(true);
    }
  };

  const handleStopTTS = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      setIsAudioPaused(false);
    }
  };

  // Stop TTS when part changes
  useEffect(() => {
    if (examSection === 'Listening') {
       handleStopTTS();
    }
  }, [currentPart, examSection]);

  useEffect(() => {
    if (isRecording) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e){}
      }
      setIsRecording(false);
    }
    currentPartRef.current = currentPart;
  }, [currentPart]);



  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result as string);
        // Also set something in answers so we know we have an answer to pass validation
        setAnswers(prev => ({ ...prev, [`task-${currentPart}`]: `[IMAGE_UPLOADED] ${file.name}` }));
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleRecording = () => {
    setMicError(null);
    
    if (isRecording) {
       try { 
         recognitionRef.current?.stop(); 
         recognitionRef.current = null;
       } catch(e){}
       setIsRecording(false);
    } else {
       try {
           setIsRecording(true);
           setInterimTranscript('');

           if (!recognitionRef.current) {
             const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
             if (!SpeechRecognition) {
                setMicError("Speech Recognition API is not supported in this browser.");
                setIsRecording(false);
                return;
             }

             const recognition = new SpeechRecognition();
             recognition.continuous = true;
             recognition.interimResults = true;
             recognition.lang = 'en-US';

             recognition.onresult = (event: any) => {
               let newFinal = '';
               let interim = '';

               for (let i = event.resultIndex; i < event.results.length; i++) {
                 const t = event.results[i][0].transcript;
                 if (event.results[i].isFinal) {
                   newFinal += t;
                 } else {
                   interim += t;
                 }
               }

               if (newFinal) {
                 setAnswers(prev => {
                    const activeKey = examSectionRef.current === 'Speaking' ? `speaking-${speakingIndexRef.current}` : `part-${currentPartRef.current}`;
                    const existing = prev[activeKey] || '';
                    return { ...prev, [activeKey]: existing + newFinal };
                 });
               }
               
               setInterimTranscript(interim);
             };

             recognition.onerror = (event: any) => {
               console.error("Speech recognition error", event.error);
               if (event.error === 'not-allowed') {
                  setMicError("Microphone access is denied. If you are viewing this in a preview iframe, please open the app in a new tab to enable microphone access.");
               }
               if (event.error !== 'no-speech') {
                   setIsRecording(false);
                   setInterimTranscript('');
               }
             };
             
             recognition.onend = () => {
                setIsRecording(false);
                setInterimTranscript('');
             };

             recognitionRef.current = recognition;
           }

           if (examSection === 'Speaking') {
               sessionBaseAnswerRef.current = answers[`speaking-${speakingIndex}`] || '';
           } else {
               sessionBaseAnswerRef.current = answers[`part-${currentPart}`] || '';
           }
           recognitionRef.current.start();
       } catch (err: any) {
           console.error("Speech recognition start error:", err);
           if (err.name === 'InvalidStateError') {
               // Already started, ignore
           } else {
               setIsRecording(false);
           }
       }
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);

  // Flatten API data to handle mapping between questions and passages
  const parsedContext = React.useMemo(() => {
    if (!testData) return { questions: [], parts: [] };
    const questionsList: any[] = [];
    const parts = testData.passages || testData.tracks || testData.tasks || testData.parts || [];
    
    parts.forEach((part: any, partIndex: number) => {
      if (part.questions) {
        part.questions.forEach((q: any, qIndex: number) => {
          questionsList.push({
             ...q,
             partIndex,
             localIndex: qIndex
          });
        });
      }
    });

    return { questions: questionsList, parts };
  }, [testData]);

  const speakingQuestions = React.useMemo(() => {
    if (examSection !== 'Speaking' || !testData?.parts) return [];
    const qs: { partTitle: string, question: string }[] = [];
    testData.parts.forEach((part: any) => {
       if (part.cue_card) {
          qs.push({
             partTitle: part.title,
             question: part.cue_card + (part.bullet_points ? ("\n" + part.bullet_points.join(", ")) : "")
          });
       } else if (part.prompts) {
          part.prompts.forEach((p: string) => qs.push({ partTitle: part.title, question: p }));
       }
    });
    return qs;
  }, [testData, examSection]);

  useEffect(() => {
    if (examSection === 'Speaking' && isTestActive && speakingQuestions.length > 0) {
       const text = speakingQuestions[speakingIndex]?.question;
       if (text && window.speechSynthesis) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = 'en-US';
          window.speechSynthesis.speak(utterance);
       }
    }
  }, [speakingIndex, isTestActive, speakingQuestions, examSection]);

  // Initialize Timer locally if not from API
  useEffect(() => {
    if (!isTestActive) return;
    setHasSubmitted(false);
    setActiveQuestion(1);
    setCurrentPart(1);
    setAnswers({});
  }, [isTestActive]);

  // Countdown Logic
  useEffect(() => {
    if (!isTestActive || hasSubmitted || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isTestActive, hasSubmitted, timeLeft]);

  const toggleFullScreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn("Fullscreen request failed", err);
    }
  };

  const startTest = async () => {
    if (!testMode) return;
    setIsGenerating(true);
    setErrorMsg(null);
    
    let attempt = 0;
    const maxRetries = 3;
    let success = false;

    while (attempt < maxRetries && !success) {
      try {
        const resp = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            testMode: testMode === 'full' ? 'Full Mock Test' : 'Part Test',
            section: examSection,
            testType: 'Academic',
            includePYQs: true,
            numberOfQuestions: testMode === 'full' ? 40 : 10
          })
        });
        
        if (!resp.ok) throw new Error("API failed to generate test");
        
        const data = await resp.json();
        setTestData(data);
        
        // Set timer dynamically
        let t = 60 * 60; // Reading & Writing: 60 mins
        if (examSection === 'Listening') t = 30 * 60;
        if (examSection === 'Speaking') t = 15 * 60;
        setTimeLeft(t);
        
        setIsGenerating(false);
        setIsTestActive(true);
        toggleFullScreen();
        success = true;
      } catch (err: any) {
        attempt++;
        if (attempt < maxRetries) {
          console.warn(`Fetch failed (attempt ${attempt}/${maxRetries}). Retrying in 1s...`, err);
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          console.error("API failed entirely, falling back to rich mock data to prevent blocking...", err);
          
          let mockData: any = {};
          if (examSection === 'Reading') {
            mockData = {
               section: "Reading",
               passages: [
                 {
                   id: 1, title: "The Evolution of Modern Architecture",
                   content: "Architecture has continuously evolved, mirroring the technological advancements and cultural shifts of society. In the early 20th century, the advent of steel and reinforced concrete allowed architects to push the boundaries of height and scale.\n\nFollowing the industrial revolution, the Modernist movement emerged, championed by figures like Le Corbusier and Ludwig Mies van der Rohe. They advocated for functionalism, famously encapsulating their philosophy in the maxim 'form follows function.'\n\nToday, architecture faces a new imperative: sustainability. Contemporary architects are tasked with minimizing the environmental impact of their constructions.",
                   questions: [
                     { id: 1, type: "fill_in_blank", prompt: "The integration of __________ and reinforced concrete redefined building limits.", answer: "steel" },
                     { id: 2, type: "mcq", prompt: "Who were the champions of the Modernist movement?", options: ["Renaissance artists", "Le Corbusier and Mies van der Rohe", "Victorian builders", "Gothic designers"], answer: "Le Corbusier and Mies van der Rohe" },
                     { id: 3, type: "fill_in_blank", prompt: "The famous maxim of the Modernist movement is 'form follows __________.'", answer: "function" },
                     { id: 4, type: "mcq", prompt: "What is the new imperative in contemporary architecture?", options: ["Ornamentation", "Cost reduction", "Sustainability", "Speed of construction"], answer: "Sustainability" },
                     { id: 5, type: "fill_in_blank", prompt: "Contemporary architects aim to minimize the __________ impact of their buildings.", answer: "environmental" },
                     { id: 6, type: "mcq", prompt: "When did the Modernist movement primarily emerge?", options: ["Ancient Rome", "Middle Ages", "Following the industrial revolution", "The 21st century"], answer: "Following the industrial revolution" },
                     { id: 7, type: "fill_in_blank", prompt: "Architecture mirrors __________ advancements of society.", answer: "technological" },
                     { id: 8, type: "mcq", prompt: "Which material was crucial for pushing the boundaries of scale?", options: ["Wood", "Brick", "Steel", "Glass"], answer: "Steel" },
                     { id: 9, type: "fill_in_blank", prompt: "Early 20th-century materials allowed to push boundaries of __________ and scale.", answer: "height" },
                     { id: 10, type: "mcq", prompt: "What philosophy did Le Corbusier advocate?", options: ["Brutalism", "Functionalism", "Post-modernism", "Deconstructivism"], answer: "Functionalism" },
                     { id: 11, type: "fill_in_blank", prompt: "Architecture evolution mirrors cultural __________ of society.", answer: "shifts" },
                     { id: 12, type: "mcq", prompt: "Architects today are tasked with:", options: ["Maximizing space", "Minimizing environmental impact", "Building higher", "Using traditional materials"], answer: "Minimizing environmental impact" },
                     { id: 13, type: "fill_in_blank", prompt: "The advent of steel happened in the early __________ century.", answer: "20th" }
                   ]
                 },
                 {
                   id: 2, title: "The Deep Sea Exploration",
                   content: "The deep sea remains one of the most unexplored frontiers on Earth. With extreme pressure, freezing temperatures, and total darkness, it presents immense challenges for researchers. Recent advancements in remotely operated vehicles (ROVs) have opened up new possibilities for discovering unique marine species and geological features.",
                   questions: [
                     { id: 14, type: "mcq", prompt: "What makes the deep sea challenging?", options: ["Extreme pressure", "Lack of funding", "Too much light", "Overpopulation of fish"], answer: "Extreme pressure" },
                     { id: 15, type: "fill_in_blank", prompt: "Researchers face challenges such as freezing temperatures and total __________.", answer: "darkness" },
                     { id: 16, type: "mcq", prompt: "What do ROVs stand for?", options: ["Remotely Operated Vehicles", "Robotic Ocean Vessels", "Research Observing Vans", "Rapid Ocean Vehicles"], answer: "Remotely Operated Vehicles" },
                     { id: 17, type: "fill_in_blank", prompt: "ROVs help in discovering unique marine __________.", answer: "species" },
                     { id: 18, type: "mcq", prompt: "The deep sea is described as one of the most ________ frontiers on Earth.", options: ["Explored", "Populated", "Unexplored", "Polluted"], answer: "Unexplored" },
                     { id: 19, type: "fill_in_blank", prompt: "Besides biological discoveries, ROVs find new __________ features.", answer: "geological" },
                     { id: 20, type: "mcq", prompt: "Which of the following is NOT a challenge of deep sea exploration?", options: ["Freezing temperatures", "High salinity", "Total darkness", "Extreme pressure"], answer: "High salinity" },
                     { id: 21, type: "fill_in_blank", prompt: "ROVs represent recent __________ in marine technology.", answer: "advancements" },
                     { id: 22, type: "mcq", prompt: "What does the extreme environment of the deep sea possess?", options: ["Warm water", "Immense challenges", "Abundant vegetation", "Sunlight access"], answer: "Immense challenges" },
                     { id: 23, type: "fill_in_blank", prompt: "New possibilities refer to discovering new __________ and features.", answer: "species" },
                     { id: 24, type: "mcq", prompt: "ROVs have opened new _________ for discovery.", options: ["Paths", "Possibilities", "Hazards", "Mysteries"], answer: "Possibilities" },
                     { id: 25, type: "fill_in_blank", prompt: "The deep sea is a frontier on __________.", answer: "Earth" },
                     { id: 26, type: "mcq", prompt: "Who are primarily studying the deep sea?", options: ["Tourists", "Researchers", "Fishermen", "Divers"], answer: "Researchers" },
                     { id: 27, type: "fill_in_blank", prompt: "Extreme ________ is a major hurdle for deep-sea submarines.", answer: "pressure" }
                   ]
                 },
                 {
                   id: 3, title: "Artificial Intelligence in Education",
                   content: "The integration of AI in education is transforming how students learn and teachers instruct. Adaptive learning platforms can tailor content to individual student needs, providing personalized feedback. However, concerns regarding data privacy and the potential for a digital divide persist.",
                   questions: [
                     { id: 28, type: "fill_in_blank", prompt: "Adaptive learning platforms provide __________ feedback to students.", answer: "personalized" },
                     { id: 29, type: "mcq", prompt: "What is AI transforming in education?", options: ["School buildings", "How students learn", "Sports teams", "Cafeteria food"], answer: "How students learn" },
                     { id: 30, type: "fill_in_blank", prompt: "AI can tailor content to individual student __________.", answer: "needs" },
                     { id: 31, type: "mcq", prompt: "What is a major concern with AI in education?", options: ["Too much homework", "Data privacy", "Teacher shortages", "Slow internet"], answer: "Data privacy" },
                     { id: 32, type: "fill_in_blank", prompt: "There is a potential for a digital __________ due to AI integration.", answer: "divide" },
                     { id: 33, type: "mcq", prompt: "What kind of platforms tailor content?", options: ["Social media", "Adaptive learning platforms", "Streaming services", "Gaming platforms"], answer: "Adaptive learning platforms" },
                     { id: 34, type: "fill_in_blank", prompt: "Integration of AI changes the way teachers __________.", answer: "instruct" },
                     { id: 35, type: "mcq", prompt: "Personalized feedback is a benefit for:", options: ["Administrators", "Individual students", "Parents", "Software developers"], answer: "Individual students" },
                     { id: 36, type: "fill_in_blank", prompt: "Concerns regarding data __________ persist.", answer: "privacy" },
                     { id: 37, type: "mcq", prompt: "The word 'persist' in the passage means:", options: ["To stop", "To continue to exist", "To transform", "To ignore"], answer: "To continue to exist" },
                     { id: 38, type: "fill_in_blank", prompt: "AI in education is __________ traditional learning methods.", answer: "transforming" },
                     { id: 39, type: "mcq", prompt: "What does AI tailor?", options: ["Clothing", "Content", "Schedules", "Grading scales"], answer: "Content" },
                     { id: 40, type: "fill_in_blank", prompt: "A digital divide is a ________ concern of AI.", answer: "potential" }
                   ]
                 }
               ].slice(0, testMode === 'full' ? 3 : 1)
            };
          } else if (examSection === 'Listening') {
            mockData = {
              section: "Listening",
              tracks: [
                {
                  id: 1, title: `Part 1 - Accommodation Inquiry`,
                  transcript: `Because the generation timed out, we are using fallback offline data. This simulates a typical listening test recording. The student is asking about off-campus housing. The monthly rent is 450 pounds.`,
                  questions: [
                    { id: 1, type: "fill_in_blank", prompt: "What is the student calling about?", answer: "housing" },
                    { id: 2, type: "mcq", prompt: "Where is the housing located?", options: ["On-campus", "Off-campus", "In the city center", "Rural area"], answer: "Off-campus" },
                    { id: 3, type: "fill_in_blank", prompt: "The monthly rent is ________ pounds.", answer: "450" },
                    { id: 4, type: "mcq", prompt: "Who is making the inquiry?", options: ["A landlord", "A student", "A real estate agent", "A university official"], answer: "A student" },
                    { id: 5, type: "fill_in_blank", prompt: "The audio simulates a __________ test recording.", answer: "listening" },
                    { id: 6, type: "mcq", prompt: "What kind of inquiry is this?", options: ["Flight booking", "Accommodation inquiry", "Job interview", "Doctor appointment"], answer: "Accommodation inquiry" },
                    { id: 7, type: "fill_in_blank", prompt: "The fallback uses __________ offline data.", answer: "fallback" },
                    { id: 8, type: "mcq", prompt: "Why is the fallback data used?", options: ["Generation timed out", "User requested it", "No internet", "Testing mode"], answer: "Generation timed out" },
                    { id: 9, type: "fill_in_blank", prompt: "The typical test _________ is simulated here.", answer: "recording" },
                    { id: 10, type: "mcq", prompt: "Is the student looking for on-campus housing?", options: ["Yes", "No", "Not mentioned", "Only for summer"], answer: "No" }
                  ]
                },
                {
                  id: 2, title: `Part 2 - Campus Tour`,
                  transcript: `Welcome to the campus tour. First, we will visit the grand library, built in 1902. Then we'll walk past the new science block, completed last year. The cafeteria serves meals from 7 AM to 8 PM daily.`,
                  questions: [
                    { id: 11, type: "fill_in_blank", prompt: "The first stop on the tour is the grand ________.", answer: "library" },
                    { id: 12, type: "mcq", prompt: "When was the library built?", options: ["1900", "1902", "1920", "2002"], answer: "1902" },
                    { id: 13, type: "fill_in_blank", prompt: "The new science block was completed last ________.", answer: "year" },
                    { id: 14, type: "mcq", prompt: "What time does the cafeteria open?", options: ["6 AM", "7 AM", "8 AM", "9 AM"], answer: "7 AM" },
                    { id: 15, type: "fill_in_blank", prompt: "The cafeteria serves meals until 8 ________ daily.", answer: "PM" },
                    { id: 16, type: "mcq", prompt: "What kind of block was recently completed?", options: ["Arts", "Humanities", "Science", "Sports"], answer: "Science" },
                    { id: 17, type: "fill_in_blank", prompt: "The cafeteria is open __________.", answer: "daily" },
                    { id: 18, type: "mcq", prompt: "What is the purpose of the audio?", options: ["Lecture", "Campus tour", "Interview", "News report"], answer: "Campus tour" },
                    { id: 19, type: "fill_in_blank", prompt: "The guide welcomes listeners to the ________ tour.", answer: "campus" },
                    { id: 20, type: "mcq", prompt: "Is it a newly built library?", options: ["Yes", "No", "It is being built", "Not mentioned"], answer: "No" }
                  ]
                },
                {
                  id: 3, title: `Part 3 - Research Project Discussion`,
                  transcript: `John and Mary are discussing their biology project. John suggests studying local bird populations. Mary prefers focusing on water pollution in the nearby river. They decide to ask their professor tomorrow.`,
                  questions: [
                    { id: 21, type: "fill_in_blank", prompt: "John and Mary are discussing a ________ project.", answer: "biology" },
                    { id: 22, type: "mcq", prompt: "What does John suggest studying?", options: ["Plant life", "Bird populations", "Fish species", "Soil quality"], answer: "Bird populations" },
                    { id: 23, type: "fill_in_blank", prompt: "Mary prefers focusing on water ________.", answer: "pollution" },
                    { id: 24, type: "mcq", prompt: "Where is the pollution Mary wants to study?", options: ["In the ocean", "In the nearby river", "In lakes", "In groundwater"], answer: "In the nearby river" },
                    { id: 25, type: "fill_in_blank", prompt: "They decide to ask their ________ for advice.", answer: "professor" },
                    { id: 26, type: "mcq", prompt: "When will they ask for advice?", options: ["Today", "Tomorrow", "Next week", "After class"], answer: "Tomorrow" },
                    { id: 27, type: "fill_in_blank", prompt: "John's idea is about ________ bird populations.", answer: "local" },
                    { id: 28, type: "mcq", prompt: "Who are the two students?", options: ["Tom and Jerry", "John and Mary", "Paul and Sarah", "Mike and Emma"], answer: "John and Mary" },
                    { id: 29, type: "fill_in_blank", prompt: "They are having a ________ about their project.", answer: "discussion" },
                    { id: 30, type: "mcq", prompt: "Have they made a final decision on the topic?", options: ["Yes", "No", "They finished the project", "Not mentioned"], answer: "No" }
                  ]
                },
                {
                  id: 4, title: `Part 4 - Academic Lecture on Climate`,
                  transcript: `Today's lecture covers the impact of urban heat islands. Cities trap heat due to concrete and asphalt, making them significantly warmer than surrounding rural areas. Planting more trees is one proposed solution.`,
                  questions: [
                    { id: 31, type: "fill_in_blank", prompt: "The lecture is about the impact of urban heat ________.", answer: "islands" },
                    { id: 32, type: "mcq", prompt: "What traps heat in cities?", options: ["Trees and parks", "Concrete and asphalt", "Rivers and lakes", "Cars and buses"], answer: "Concrete and asphalt" },
                    { id: 33, type: "fill_in_blank", prompt: "Cities are significantly ________ than rural areas.", answer: "warmer" },
                    { id: 34, type: "mcq", prompt: "What is a proposed solution?", options: ["Building taller", "Painting roofs black", "Planting more trees", "Reducing traffic"], answer: "Planting more trees" },
                    { id: 35, type: "fill_in_blank", prompt: "The lecture is an ________ presentation.", answer: "academic" },
                    { id: 36, type: "mcq", prompt: "What kind of areas are cooler?", options: ["Urban areas", "Industrial zones", "Surrounding rural areas", "City centers"], answer: "Surrounding rural areas" },
                    { id: 37, type: "fill_in_blank", prompt: "Concrete and ________ are common city materials.", answer: "asphalt" },
                    { id: 38, type: "mcq", prompt: "What does the city trap?", options: ["Water", "Heat", "Cold air", "Wind"], answer: "Heat" },
                    { id: 39, type: "fill_in_blank", prompt: "One proposed ________ is to plant trees.", answer: "solution" },
                    { id: 40, type: "mcq", prompt: "What is the main topic?", options: ["Global warming", "Urban heat islands", "Deforestation", "Air quality"], answer: "Urban heat islands" }
                  ]
                }
              ].slice(0, testMode === 'full' ? 4 : 1)
            };
          } else if (examSection === 'Writing') {
            mockData = {
              section: "Writing",
              tasks: [
                { 
                  id: 1, 
                  title: "Task 1", 
                  prompt: "The table below shows the proportion of energy production from different sources in three countries in 2020. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.\n\n| Source | Country A | Country B | Country C |\n|---|---|---|---|\n| Coal | 45% | 15% | 5% |\n| Solar | 10% | 40% | 20% |\n| Wind | 5% | 25% | 60% |\n| Nuclear | 40% | 20% | 15% |", 
                  min_words: 150 
                },
                { 
                  id: 2, 
                  title: "Task 2", 
                  prompt: "Some people believe that university education should be free for everyone. Others think that students should pay for their higher education. Discuss both views and give your opinion.", 
                  min_words: 250 
                }
              ].slice(0, testMode === 'full' ? 2 : 1)
            };
          } else if (examSection === 'Speaking') {
            mockData = {
              section: "Speaking",
              parts: [
                { id: 1, title: "Part 1 - Introduction", prompts: ["What is your name?", "Where are you from?", "Do you work or study?", "What do you like to do in your free time?"] },
                { id: 2, title: "Part 2 - Long Turn", cue_card: "Describe a memorable journey you have made.", bullet_points: ["Where did you go?", "Who did you go with?", "Why was it memorable?"] },
                { id: 3, title: "Part 3 - Discussion", prompts: ["How has travel changed in your country in the last few decades?", "Do you think tourism brings more harm or good to local cultures?"] }
              ].slice(0, testMode === 'full' ? 3 : 1)
            };
          }

          setTestData(mockData);
          
          let t = 60 * 60; 
          if (examSection === 'Listening') t = 30 * 60;
          if (examSection === 'Speaking') t = 15 * 60;
          setTimeLeft(t);
          
          setIsGenerating(false);
          setIsTestActive(true);
          toggleFullScreen();
          success = true;
          console.warn("Using offline mock data due to API failure.");
        }
      }
    }
  };

  const handleSubmit = () => {
    let finalAnswers = { ...answers };
    
    // Prevent blank submissions
    if (examSection === 'Speaking') {
      const history = speakingQuestions.map((sq, i) => ({
         question: sq.question,
         answer: answers[`speaking-${i}`] || ''
      }));
      finalAnswers = { ...answers, speaking_history: JSON.stringify(history) };
      setAnswers(finalAnswers);
      
      const hasAnswer = history.some(item => item.answer && item.answer.trim().length > 0);
      if (!hasAnswer && timeLeft > 0) {
         alert("Please provide an answer before submitting!");
         return;
      }
    } else if (examSection === 'Writing') {
      const hasAnswer = (Object.values(answers) as string[]).some(val => val && val.trim().length > 0);
      if (!hasAnswer && timeLeft > 0) {
         alert("Please provide an answer before submitting!");
         return;
      }
    } else {
       const hasAnswer = (Object.values(answers) as string[]).some(val => val && val.trim().length > 0);
       if (!hasAnswer && timeLeft > 0) {
          if (!window.confirm("You have not answered any questions. Are you sure you want to submit?")) {
             return;
          }
       }
    }
    
    setHasSubmitted(true);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(console.warn);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getTimerColor = () => {
    if (timeLeft <= 5 * 60) return 'text-red-600 animate-pulse font-bold';
    if (timeLeft <= 10 * 60) return 'text-orange-600 font-semibold';
    return 'text-slate-800 font-medium';
  };

  const handleAnswerChange = (key: string | number, currentVal: string) => {
    setAnswers(prev => ({ ...prev, [key]: currentVal }));
  };

  const renderPromptText = (text: string) => {
    if (!text) return null;
    if (!text.includes('|')) return <p className="mb-4 text-gray-700 whitespace-pre-wrap">{text}</p>;

    try {
      const firstPipe = text.indexOf('|');
      const lastPipe = text.lastIndexOf('|');
      
      const beforeTable = text.substring(0, firstPipe).trim();
      const tableString = text.substring(firstPipe, lastPipe + 1);
      const afterTable = text.substring(lastPipe + 1).trim();

      let tableRows: string[][] = [];

      if (!tableString.includes('\n')) {
          const rawCells = tableString.split('|');
          const sepIndex = rawCells.findIndex(c => /^:?-+:?$/.test(c.trim()));
          if (sepIndex > 0) {
             let cols = 0;
             let i = sepIndex;
             while (i < rawCells.length && /^:?-+:?$/.test(rawCells[i].trim())) {
                 cols++;
                 i++;
             }
             
             if (cols > 0) {
                 const extractedRows: string[][] = [];
                 let currentGroup: string[] = [];
                 for (let j = 0; j < rawCells.length; j++) {
                     const cellText = rawCells[j].trim();
                     if (currentGroup.length === 0 && cellText === '') continue;
                     currentGroup.push(cellText);
                     if (currentGroup.length === cols) {
                         extractedRows.push([...currentGroup]);
                         currentGroup = [];
                     }
                 }
                 tableRows = extractedRows.filter(row => !row.every(c => /^:?-+:?$/.test(c)));
             }
          }
      } else {
          const lines = tableString.split('\n').map(l => l.trim()).filter(l => l.includes('|'));
          for (const line of lines) {
              if (line.includes('---')) continue;
              const cells = line.split('|').map(c => c.trim());
              if (cells.length > 0 && cells[0] === '') cells.shift();
              if (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
              if (cells.length > 0) {
                  tableRows.push(cells);
              }
          }
      }

      if (tableRows.length === 0) {
        return <p className="mb-4 text-gray-700 whitespace-pre-wrap">{text}</p>;
      }

      return (
        <div className="w-full">
          {beforeTable && <p className="mb-4 text-gray-700 whitespace-pre-wrap">{beforeTable}</p>}
          <div className="overflow-x-auto my-4 rounded-lg border border-gray-300">
            <table className="w-full text-left border-collapse bg-white text-sm">
              <thead className="bg-gray-100">
                <tr>
                  {tableRows[0].map((cell, idx) => (
                    <th key={idx} className="border-b-2 border-gray-300 px-4 py-2 font-semibold text-gray-700">
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.slice(1).map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-50 transition-colors">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="border-b border-gray-200 px-4 py-2 text-gray-600">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {afterTable && <p className="mt-4 text-gray-700 whitespace-pre-wrap">{afterTable}</p>}
        </div>
      );
    } catch (e) {
      return <p className="mb-4 text-gray-700 whitespace-pre-wrap">{text}</p>;
    }
  };

  const maxParts = parsedContext.parts.length || 4;
  const maxQuestions = (testMode === 'full' ? 40 : 10);
  
  const handleNext = () => {
    if (examSection === 'Speaking') {
      if (speakingIndex < speakingQuestions.length - 1) {
         setSpeakingIndex(prev => prev + 1);
         if (isRecording) {
            try { recognitionRef.current.stop(); } catch(e){}
            setIsRecording(false);
            setInterimTranscript('');
         }
      }
      return;
    }

    if (examSection === 'Writing') {
      if (currentPart < maxParts) setCurrentPart(prev => prev + 1);
      return;
    }
    
    // For Reading and Listening, progress by question number
    if (activeQuestion < maxQuestions) {
      const nextQ = activeQuestion + 1;
      handleQuestionSelect(nextQ);
      setTimeout(() => {
         const globalQ = getGlobalQuestionNumber(nextQ);
         const el = document.getElementById(`question-box-${globalQ}`);
         if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    } else if (testMode === 'part' && currentPart < maxParts) {
      setCurrentPart(prev => prev + 1);
      setActiveQuestion(1);
    }
  };

  const handlePrev = () => {
    if (examSection === 'Speaking') {
      if (speakingIndex > 0) {
         setSpeakingIndex(prev => prev - 1);
         if (isRecording) {
            try { recognitionRef.current.stop(); } catch(e){}
            setIsRecording(false);
            setInterimTranscript('');
         }
      }
      return;
    }

    if (examSection === 'Writing') {
      if (currentPart > 1) setCurrentPart(prev => prev - 1);
      return;
    }

    if (activeQuestion > 1) {
      const prevQ = activeQuestion - 1;
      handleQuestionSelect(prevQ);
      setTimeout(() => {
         const globalQ = getGlobalQuestionNumber(prevQ);
         const el = document.getElementById(`question-box-${globalQ}`);
         if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    } else if (testMode === 'part' && currentPart > 1) {
      setCurrentPart(prev => prev - 1);
      setActiveQuestion(10);
    }
  };

  const handlePartSwitch = (part: number) => {
    setCurrentPart(part);
    if (examSection !== 'Writing' && examSection !== 'Speaking') {
        // Find the first question in this part
        const firstQ = parsedContext.questions.findIndex(q => q.partIndex === part - 1);
        if (firstQ !== -1) {
           setActiveQuestion(firstQ + 1);
        } else {
           setActiveQuestion(1);
        }
    }
  };

  const handleQuestionSelect = (q: number) => {
    setActiveQuestion(q);
    const globalQ = getGlobalQuestionNumber(q);
    if (examSection === 'Listening') {
       setCurrentPart(Math.ceil(globalQ / 10));
    } else {
       const mapping = parsedContext.questions[globalQ - 1];
       if (mapping) {
          setCurrentPart(mapping.partIndex + 1);
       }
    }
  };

  const getQuestionsList = () => {
    return Array.from({ length: maxQuestions }, (_, i) => i + 1);
  };

  const getGlobalQuestionNumber = (localQ: number) => {
    if (testMode === 'part') {
      return (currentPart - 1) * 10 + localQ;
    }
    return localQ;
  };

  const [isReviewMode, setIsReviewMode] = useState(false);

  if (hasSubmitted && !isReviewMode) {
    return (
      <ResultsDashboard 
        examSection={examSection}
        testData={testData}
        answers={answers}
        onReview={() => setIsReviewMode(true)}
        onGoHome={() => {
          setIsTestActive(false);
          setHasSubmitted(false);
          setTestMode(null);
          setTestData(null);
          setIsReviewMode(false);
        }}
      />
    );
  }

  if (isTestActive) {
    return (
      <div 
        ref={containerRef}
        className="fixed inset-0 z-50 bg-white flex flex-col font-sans selection:bg-indigo-100 selection:text-indigo-900"
      >
        {/* Top Header Bar */}
        <div className="h-16 bg-slate-50 border-b border-gray-200 flex items-center justify-between px-6 shrink-0 relative shadow-sm z-30">
          <div className="text-slate-800 font-bold text-lg flex items-center gap-2 z-10 w-1/3">
            IDP | British Council
            <span className="text-xs bg-indigo-600 text-white px-2.5 py-1 rounded-md ml-3 uppercase tracking-widest font-semibold shadow-sm">
              {examSection} Mode
            </span>
          </div>
          
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-1/3">
            {isReviewMode ? (
              <div className="text-lg font-bold px-8 py-2 rounded-xl bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100 flex items-center gap-3">
                <CheckCircle className="w-5 h-5" />
                Reviewing Answers
              </div>
            ) : (
              <div className={`text-2xl font-mono px-8 py-2 rounded-xl bg-white shadow-sm border border-gray-100 flex items-center gap-3 transition-colors ${getTimerColor()}`}>
                <Clock className={`w-5 h-5 ${timeLeft <= 5 * 60 ? 'text-red-500' : 'text-slate-400'}`} />
                <span className="tracking-tight">
                  {formatTime(timeLeft)}
                </span>
              </div>
            )}
          </div>

          <div className="space-x-3 flex items-center justify-end z-10 w-1/3">
            <button onClick={toggleFullScreen} className="p-2 text-slate-400 hover:text-slate-700 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <Fullscreen className="w-5 h-5" />
            </button>
            {isReviewMode ? (
              <button 
                onClick={() => setIsReviewMode(false)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm tracking-wide"
              >
                Back to Dashboard
              </button>
            ) : (
              <button 
                onClick={handleSubmit}
                className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-5 py-2.5 rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm tracking-wide"
              >
                Finish Test
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          
          {examSection === 'Listening' && (
            <div className="h-24 bg-slate-800 flex flex-col items-center justify-center border-b border-slate-700 shrink-0">
               <div className="flex items-center gap-6 bg-slate-900 px-8 py-4 rounded-full text-white border border-slate-700 shadow-xl">
                  <div className="flex items-center gap-3 border-r border-slate-700 pr-6">
                    <Headphones className="w-6 h-6 text-indigo-400" />
                    <span className="font-bold text-sm tracking-wide">Listening Track - Part {currentPart}</span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                     {!isPlayingAudio ? (
                       <button 
                         onClick={handlePlayTTS} 
                         disabled={timeLeft === 0}
                         className="w-10 h-10 rounded-full bg-indigo-500 hover:bg-indigo-400 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                         title="Play audio"
                       >
                         <Play className="w-5 h-5 fill-white text-white ml-0.5" />
                       </button>
                     ) : (
                       <button 
                         onClick={handlePauseTTS} 
                         className="w-10 h-10 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center transition-colors"
                         title="Pause audio"
                       >
                         <Pause className="w-5 h-5 fill-white text-white" />
                       </button>
                     )}
                     
                     <button 
                       onClick={handleStopTTS}
                       disabled={!isPlayingAudio && !isAudioPaused}
                       className="w-10 h-10 rounded-full bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                       title="Stop audio"
                     >
                       <Square className="w-4 h-4 fill-white text-white" />
                     </button>
                  </div>
                  {(isPlayingAudio || isAudioPaused) && (
                     <div className="flex items-center gap-2 ml-2 pl-6 border-l border-slate-700">
                        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
                        <span className="text-xs text-indigo-200 uppercase tracking-widest">{isPlayingAudio ? 'Playing...' : 'Paused'}</span>
                     </div>
                  )}
               </div>
            </div>
          )}

          {/* Reading & Listening Shared Questions View */}
          {(examSection === 'Reading' || examSection === 'Listening') && (
            <div className="flex-1 flex overflow-hidden">
              {/* Left Pane: Passage or Transcript Details (Listening might just show text if needed, or we collapse left pane) */}
              {examSection === 'Reading' && (
                <div className="w-1/2 flex flex-col border-r border-gray-200 bg-slate-50">
                  <div className="h-14 bg-gray-100/70 border-b border-gray-200 flex items-center px-8 shrink-0">
                    <h3 className="font-bold text-slate-800 text-sm tracking-widest uppercase">
                      Passage {currentPart}
                    </h3>
                  </div>
                  <div className="flex-1 overflow-y-auto p-8 lg:p-14 prose prose-slate prose-lg max-w-none text-slate-800 font-sans leading-relaxed">
                    <h1 className="text-3xl font-extrabold text-slate-900 mb-8 tracker-tight">
                      {testData?.passages?.[currentPart - 1]?.title || 'Reading Passage Placeholder'}
                    </h1>
                    <p className="whitespace-pre-wrap">
                       {testData?.passages?.[currentPart - 1]?.content || 'Content generation in progress...'}
                    </p>
                  </div>
                </div>
              )}

              {/* Right Pane: Questions */}
              <div className={examSection === 'Reading' ? 'w-1/2 flex flex-col bg-white' : 'w-full max-w-5xl mx-auto flex flex-col bg-white border-x border-gray-200'}>
                <div className="h-14 bg-white border-b border-gray-200 flex items-center px-8 shrink-0 justify-between">
                  <h3 className="font-bold text-slate-800 text-sm tracking-widest uppercase">
                    Questions {testMode === 'part' ? `${(currentPart - 1) * 10 + 1} - ${currentPart * 10}` : 'Active Set'}
                  </h3>
                </div>
                <div className="flex-1 overflow-y-auto p-8 lg:p-14" id="questions-container">
                    <div className="space-y-12">
                      {getQuestionsList().filter(q => {
                        const globalQ = getGlobalQuestionNumber(q);
                        if (examSection === 'Listening') {
                           return Math.ceil(globalQ / 10) === currentPart;
                        }
                        const qData = parsedContext.questions[globalQ - 1];
                        return qData && qData.partIndex === currentPart - 1;
                      }).map(q => {
                        const globalQ = getGlobalQuestionNumber(q);
                        const qData = parsedContext.questions[globalQ - 1] || {};
                        const expectedAnswer = qData.answer;

                        return (
                          <div key={globalQ} id={`question-box-${globalQ}`} className={`p-6 rounded-xl border transition-colors ${activeQuestion === q ? 'border-indigo-200 bg-indigo-50/50 shadow-sm' : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50/50'}`}>
                             <div className="flex gap-4">
                               <span className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 shrink-0">
                                 {globalQ}
                               </span>
                               <div className="flex-1">
                                 <p className="font-medium text-slate-800 mb-4 whitespace-pre-wrap">{qData?.prompt || `Question ${globalQ} prompt...`}</p>
                                 
                                 {qData.type === 'mcq' && qData.options ? (
                                    <div className="space-y-2 mt-4">
                                      {qData.options.map((opt: string, i: number) => {
                                         const isSelected = answers[globalQ] === opt;
                                         const isCorrectAnswer = isReviewMode && expectedAnswer && expectedAnswer === opt;
                                         const isWrongSelection = isReviewMode && isSelected && expectedAnswer !== opt;
                                         
                                         let labelClass = "flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-slate-50 transition-colors";
                                         if (isReviewMode) {
                                            if (isCorrectAnswer) labelClass = "flex items-center gap-3 p-3 rounded-lg border-2 border-emerald-500 bg-emerald-50 cursor-default";
                                            else if (isWrongSelection) labelClass = "flex items-center gap-3 p-3 rounded-lg border-2 border-red-400 bg-red-50 cursor-default";
                                            else labelClass = "flex items-center gap-3 p-3 rounded-lg border border-gray-200 opacity-50 cursor-default";
                                         }

                                         return (
                                         <label key={i} className={labelClass}>
                                            <input 
                                              type="radio" 
                                              name={`q-${globalQ}`}
                                              value={opt}
                                              checked={isSelected}
                                              onChange={e => handleAnswerChange(globalQ, e.target.value)}
                                              disabled={timeLeft === 0 || isReviewMode}
                                              className={`w-4 h-4 ${isReviewMode && isCorrectAnswer ? 'text-emerald-600' : isReviewMode && isWrongSelection ? 'text-red-500' : 'text-indigo-600'}`}
                                            />
                                            <span className={`text-slate-700 ${isReviewMode && isCorrectAnswer ? 'font-bold text-emerald-800' : isReviewMode && isWrongSelection ? 'line-through text-red-500' : ''}`}>{opt}</span>
                                            {isReviewMode && isCorrectAnswer && <CheckCircle className="w-5 h-5 text-emerald-500 ml-auto" />}
                                            {isReviewMode && isWrongSelection && <XCircle className="w-5 h-5 text-red-500 ml-auto" />}
                                         </label>
                                      )})}
                                    </div>
                                 ) : (
                                   <div className="space-y-4">
                                     <input 
                                       type="text" 
                                       value={answers[globalQ] || ''}
                                       onChange={e => handleAnswerChange(globalQ, e.target.value)}
                                       disabled={timeLeft === 0 || isReviewMode} 
                                       className={`w-full max-w-md border-b-2 py-2 outline-none font-semibold transition-colors
                                          ${isReviewMode ? 
                                             (answers[globalQ]?.trim() === expectedAnswer?.trim() ? 'border-emerald-500 text-emerald-700 bg-emerald-50 px-3 rounded-t-md' : 'border-red-400 text-red-600 bg-red-50 px-3 rounded-t-md') 
                                             : 'border-slate-300 bg-gray-50 px-3 focus:border-indigo-600 focus:bg-white text-indigo-700'
                                          } 
                                          ${timeLeft === 0 && !isReviewMode ? 'opacity-50 cursor-not-allowed' : ''}`} 
                                       placeholder="Type answer here..."
                                     />
                                     {isReviewMode && (
                                       <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-4 py-2 rounded-lg max-w-md border border-emerald-100">
                                         <CheckCircle className="w-4 h-4" />
                                         <span className="font-bold">Correct Answer:</span> {expectedAnswer || 'N/A'}
                                       </div>
                                     )}
                                   </div>
                                 )}
                                 
                               </div>
                             </div>
                          </div>
                        );
                      })}
                    </div>
                </div>
              </div>
            </div>
          )}

          {/* Writing Section UI */}
          {examSection === 'Writing' && (
            <div className="flex-1 flex overflow-hidden">
               <div className="w-1/2 lg:w-5/12 bg-slate-50 border-r border-gray-200 flex flex-col">
                  <div className="h-14 bg-gray-100/70 border-b border-gray-200 flex items-center px-8 shrink-0">
                    <h3 className="font-bold text-slate-800 text-sm tracking-widest uppercase">
                      Writing Task {currentPart}
                    </h3>
                  </div>
                  <div className="flex-1 p-8 overflow-y-auto">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                      <div className="inline-flex items-center gap-2 text-indigo-600 font-semibold mb-6">
                          <FileText className="w-5 h-5"/> Prompt
                      </div>
                      <div className="prose prose-slate prose-sm max-w-none text-slate-800">
                        <p className="font-bold">You should spend about {currentPart === 1 ? '20' : '40'} minutes on this task.</p>
                        <div className="mt-4 bg-slate-50 p-6 border border-slate-200 rounded-lg overflow-x-auto text-slate-800">
                          {(() => {
                            const promptText = testData?.tasks?.[currentPart - 1]?.prompt || `Writing Task ${currentPart} specific prompt will appear here...`;
                            
                            if (currentPart === 1 && !promptText.includes('|')) {
                              return renderPromptText(promptText + `\n\nFallback Data Table (Museum Visitors 2018-2022):\n\n| Year | Science Museum | History Museum | Art Gallery |\n|---|---|---|---|\n| 2018 | 400,000 | 350,000 | 200,000 |\n| 2019 | 420,000 | 380,000 | 210,000 |\n| 2020 | 150,000 | 120,000 | 80,000 |\n| 2021 | 250,000 | 200,000 | 150,000 |\n| 2022 | 450,000 | 400,000 | 280,000 |`);
                            }
                            
                            return renderPromptText(promptText);
                          })()}
                        </div>
                        <p className="mt-4 font-bold tracking-tight">Write at least {testData?.tasks?.[currentPart - 1]?.min_words || (currentPart === 1 ? '150' : '250')} words.</p>
                      </div>
                    </div>
                  </div>
               </div>
               <div className="w-1/2 lg:w-7/12 bg-white flex flex-col">
                 <div className="h-14 bg-white border-b border-gray-200 flex items-center px-8 shrink-0 justify-between">
                    <div className="flex rounded-md bg-gray-100 p-1">
                      <button
                        onClick={() => setWritingMode('cbt')}
                        className={`px-4 py-1.5 text-sm font-semibold rounded-sm transition-colors ${writingMode === 'cbt' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        CBT Mode (Typed)
                      </button>
                      <button
                        onClick={() => setWritingMode('paper')}
                        className={`px-4 py-1.5 text-sm font-semibold rounded-sm transition-colors ${writingMode === 'paper' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        Paper Mode (Handwritten Photo)
                      </button>
                    </div>
                    {writingMode === 'cbt' && (
                      <div className="text-sm font-semibold text-slate-500 bg-gray-100 px-3 py-1 rounded-md">
                        Word Count: {(answers[`task-${currentPart}`] || '').trim().replace(/\[IMAGE_UPLOADED\].*/, '').trim() ? (answers[`task-${currentPart}`] || '').trim().replace(/\[IMAGE_UPLOADED\].*/, '').trim().split(/\s+/).length : 0}
                      </div>
                    )}
                 </div>
                 
                 {writingMode === 'cbt' ? (
                   <textarea 
                     value={(answers[`task-${currentPart}`] || '').replace(/\[IMAGE_UPLOADED\].*/, '')}
                     onChange={(e) => handleAnswerChange(`task-${currentPart}`, e.target.value)}
                     disabled={timeLeft === 0}
                     placeholder="Type your essay here..."
                     className={`flex-1 p-8 lg:p-12 resize-none outline-none text-slate-800 text-lg leading-loose custom-scrollbar ${timeLeft === 0 ? 'bg-gray-50 opacity-50 cursor-not-allowed' : ''}`}
                   />
                 ) : (
                   <div className="flex-1 p-8 lg:p-12 flex flex-col items-center justify-center bg-slate-50">
                     <label className="w-full max-w-2xl h-80 border-4 border-dashed border-gray-300 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 hover:border-gray-400 transition-all bg-white relative overflow-hidden group">
                       <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={timeLeft === 0} />
                       {uploadedImage ? (
                         <>
                           <img src={uploadedImage} alt="Uploaded essay" className="absolute inset-0 w-full h-full object-contain p-4 opacity-30 group-hover:opacity-10 transition-opacity" />
                           <div className="relative z-10 flex flex-col items-center gap-4">
                             <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                               <CheckCircle className="w-8 h-8" />
                             </div>
                             <span className="font-bold text-slate-800 text-lg">Image Uploaded Successfully</span>
                             <span className="text-sm text-slate-500 font-semibold bg-white/80 px-4 py-1.5 rounded-full shadow-sm backdrop-blur-sm border border-slate-200">Tap to replace</span>
                           </div>
                         </>
                       ) : (
                         <div className="flex flex-col items-center gap-4 text-slate-500">
                           <Camera className="w-16 h-16 text-slate-400" />
                           <div className="text-center">
                             <h4 className="font-bold text-slate-700 text-xl">Upload/Capture Photo</h4>
                             <p className="mt-1 text-sm">Tap to Upload or Take a Photo of Your Handwritten Essay</p>
                           </div>
                         </div>
                       )}
                     </label>
                   </div>
                 )}
               </div>
            </div>
          )}

          {/* Speaking Section UI */}
          {examSection === 'Speaking' && (
            <div className="flex-1 flex flex-col items-center p-12 bg-slate-50 overflow-y-auto">
               <div className="max-w-3xl w-full bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-slate-900 p-8 text-center text-white">
                    <h2 className="text-2xl font-bold tracking-tight">{speakingQuestions[speakingIndex]?.partTitle || 'Speaking Part'}</h2>
                    <p className="text-slate-400 mt-2">Interactive AI Examiner</p>
                  </div>
                  <div className="p-10 space-y-8 text-center">
                    <div className="space-y-6">
                      <h4 className="font-bold text-slate-500 uppercase tracking-widest text-sm">Examiner Asks</h4>
                      <div className="text-slate-800 text-2xl font-medium bg-slate-50 p-6 rounded-xl border border-gray-100 shadow-inner whitespace-pre-wrap">
                        {speakingQuestions[speakingIndex]?.question}
                      </div>
                    </div>

                    <div className="pt-8 flex flex-col items-center gap-4 border-t border-gray-100">
                      <button 
                        onClick={toggleRecording}
                        className={`flex items-center gap-2 px-8 py-4 rounded-full font-bold shadow-sm transition-all focus:ring-4 focus:ring-opacity-50 ${isRecording ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 focus:ring-rose-200' : 'bg-slate-900 text-white hover:bg-slate-800 focus:ring-slate-300'}`}
                      >
                        {isRecording ? <Square className="w-5 h-5 fill-current" /> : <Mic className="w-5 h-5" />}
                        {isRecording ? 'Stop Recording' : 'Hold & Speak Answer'}
                      </button>
                      {micError && <p className="text-rose-500 text-sm">{micError}</p>}
                      
                      <div className="w-full relative mt-4 text-left">
                          <p className="text-slate-500 text-sm mb-2 font-medium">Your Transcribed Answer:</p>
                          <textarea
                            value={answers[`speaking-${speakingIndex}`] || ''}
                            onChange={(e) => handleAnswerChange(`speaking-${speakingIndex}`, e.target.value)}
                            disabled={timeLeft === 0}
                            placeholder="Your spoken answer will appear here..."
                            className={`w-full h-40 p-5 border border-gray-200 rounded-xl resize-none outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 custom-scrollbar text-slate-700 leading-relaxed ${timeLeft === 0 ? 'bg-gray-50 opacity-50 cursor-not-allowed' : ''}`}
                          />
                          {isRecording && interimTranscript && (
                            <div className="absolute bottom-6 left-5 right-5 text-left pointer-events-none overflow-hidden text-ellipsis whitespace-nowrap">
                              <span className="bg-white/90 backdrop-blur-sm text-slate-500 italic px-2 py-1 rounded shadow-sm border border-slate-100 text-sm">
                                ... {interimTranscript}
                              </span>
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
               </div>
            </div>
          )}

        </div>

        {/* Bottom Navigation Bar */}
        <div className="h-28 bg-white border-t border-gray-200 shrink-0 flex flex-col shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-30">
          {(!testMode || testMode === 'part' || examSection === 'Writing' || examSection === 'Speaking') && (
            <div className="flex bg-slate-50 border-b border-gray-200">
               {Array.from({ length: maxParts }).map((_, idx) => {
                 const partNum = idx + 1;
                 const isActive = currentPart === partNum;
                 return (
                   <button
                     key={partNum}
                     onClick={() => handlePartSwitch(partNum)}
                     className={`flex-1 py-2 text-sm font-bold uppercase tracking-wider transition-colors border-r border-gray-200 last:border-0
                       ${isActive ? 'bg-indigo-50 text-indigo-700 shadow-[inset_0_-3px_0_0_#4f46e5]' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}
                     `}
                   >
                     {examSection === 'Writing' ? `Task ${partNum}` : `Part ${partNum}`}
                   </button>
                 );
               })}
            </div>
          )}
          
          <div className="flex-1 flex items-center justify-between px-6 lg:px-10 overflow-hidden">
            <button 
              onClick={handlePrev}
              disabled={
                examSection === 'Speaking' ? speakingIndex === 0 : (examSection === 'Writing' ? currentPart === 1 : (activeQuestion === 1 && (testMode === 'full' || currentPart === 1)))
              }
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gray-200 font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-5 h-5" /> Previous
            </button>
            
            {(examSection === 'Reading' || examSection === 'Listening') && (
              <div className="flex-1 px-8 overflow-x-auto flex justify-center custom-scrollbar">
                <div className="flex items-center gap-1.5">
                  {getQuestionsList().filter(q => {
                        const globalQ = getGlobalQuestionNumber(q);
                        if (examSection === 'Listening') {
                           return Math.ceil(globalQ / 10) === currentPart;
                        }
                        const qData = parsedContext.questions[globalQ - 1];
                        return qData && qData.partIndex === currentPart - 1;
                  }).map(q => {
                    const globalQ = getGlobalQuestionNumber(q);
                    const isAnswered = !!answers[globalQ] && answers[globalQ].trim().length > 0;
                    const isActive = activeQuestion === q;
                    
                    let btnColor = "bg-white text-slate-600 border border-gray-300 hover:border-indigo-400";
                    if (isActive) {
                      btnColor = "bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-200 ring-offset-1";
                    } else if (isAnswered) {
                      btnColor = "bg-slate-800 text-white border-slate-800";
                    }

                    return (
                       <button
                         key={q}
                         onClick={() => {
                            handleQuestionSelect(q);
                            // Scroll the right pane to the selected question
                            const el = document.getElementById(`question-box-${globalQ}`);
                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                         }}
                         className={`w-9 h-9 md:w-10 md:h-10 shrink-0 flex items-center justify-center rounded-md font-semibold text-sm transition-all focus:outline-none ${btnColor}`}
                       >
                         {globalQ}
                       </button>
                    );
                  })}
                </div>
              </div>
            )}
            
            {(examSection === 'Writing') && (
              <div className="flex-1 flex justify-center gap-4">
                 <button 
                    onClick={() => {
                       // Logic to submit just this essay
                       alert('Sending essay to API for analysis...');
                       handleSubmit();
                    }}
                    className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-2.5 rounded-lg font-bold shadow-md shadow-orange-500/20 transition-all hover:scale-105"
                 >
                    Analyze Essay
                 </button>
                 <button 
                    onClick={handleSubmit}
                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-6 py-2.5 rounded-lg font-bold shadow-md transition-all hover:scale-105"
                 >
                    Finish Test
                 </button>
              </div>
            )}
            
            {(examSection === 'Speaking') && (
              <div className="flex-1 flex justify-center">
                 <span className="text-slate-400 font-bold tracking-widest text-sm uppercase">Navigation</span>
              </div>
            )}

            <button 
              onClick={handleNext}
              disabled={
                examSection === 'Speaking' ? speakingIndex === speakingQuestions.length - 1 : (examSection === 'Writing' ? currentPart === maxParts : (activeQuestion === maxQuestions && (testMode === 'full' || currentPart === maxParts)))
              }
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gray-200 font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Next <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showHistory) {
    return <TestHistory onBack={() => setShowHistory(false)} />;
  }

  // Pre-test configuration view
  return (
    <div className="animate-in fade-in duration-500 bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-gray-100">
      <div className="text-center mb-10">
         <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Select Test Mode</h2>
         <p className="text-slate-500 mt-3 text-lg max-w-xl mx-auto">Choose your preferred simulation. The exam player perfectly mirrors the official Computer-Delivered format.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto mb-10">
        {(['Reading', 'Listening', 'Writing', 'Speaking'] as ExamSection[]).map(s => (
          <button
            key={s}
            onClick={() => setExamSection(s)}
            className={`p-4 rounded-2xl font-bold transition-all border-2 ${examSection === s ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-100 bg-white text-slate-600 hover:border-gray-200'}`}
          >
             {s}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-10">
        <div 
          onClick={() => setTestMode('full')}
          className={`cursor-pointer rounded-3xl p-8 border-2 transition-all duration-300 relative overflow-hidden bg-white
            ${testMode === 'full' ? 'border-indigo-600 shadow-xl shadow-indigo-100 ring-4 ring-indigo-50 scale-[1.02]' : 'border-gray-100 shadow-sm hover:border-gray-300 hover:shadow-md'}
          `}
        >
          {testMode === 'full' && <div className="absolute top-0 right-0 bg-indigo-600 text-white text-xs font-bold px-4 py-1.5 rounded-bl-xl tracking-wider">SELECTED</div>}
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-colors ${testMode === 'full' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-slate-500'}`}>
             <LayoutGrid className="w-7 h-7" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-2">Full Mock Test</h3>
          <p className="text-slate-500 leading-relaxed font-medium">Official exam format. Ideal for full exam simulation and accurate band scoring.</p>
        </div>

        <div 
          onClick={() => setTestMode('part')}
          className={`cursor-pointer rounded-3xl p-8 border-2 transition-all duration-300 relative overflow-hidden bg-white
            ${testMode === 'part' ? 'border-indigo-600 shadow-xl shadow-indigo-100 ring-4 ring-indigo-50 scale-[1.02]' : 'border-gray-100 shadow-sm hover:border-gray-300 hover:shadow-md'}
          `}
        >
          {testMode === 'part' && <div className="absolute top-0 right-0 bg-indigo-600 text-white text-xs font-bold px-4 py-1.5 rounded-bl-xl tracking-wider">SELECTED</div>}
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-colors ${testMode === 'part' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-slate-500'}`}>
             <List className="w-7 h-7" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-2">Part Test</h3>
          <p className="text-slate-500 leading-relaxed font-medium">Modular practice. Small distinct parts targeted for focused drilling.</p>
        </div>
      </div>

      {errorMsg && (
        <div className="max-w-2xl mx-auto mb-8 p-4 bg-red-50 text-red-600 rounded-xl text-center font-medium border border-red-100">
          {errorMsg}
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-center gap-4 mt-6">
        <button
          onClick={startTest}
          disabled={!testMode || isGenerating}
          className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-lg h-16 px-12 rounded-2xl flex items-center justify-center gap-3 transition-all hover:scale-[1.02] shadow-lg shadow-slate-900/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none min-w-[300px]"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating Content... (May take 10s)
            </>
          ) : (
            <>
              <Play className="w-5 h-5 fill-current" />
              Start Exam Environment
            </>
          )}
        </button>
        <button
          onClick={() => setShowHistory(true)}
          disabled={isGenerating}
          className="bg-white hover:bg-slate-50 text-slate-700 border-2 border-gray-200 font-bold text-lg h-16 px-8 rounded-2xl flex items-center justify-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <History className="w-5 h-5" />
          History
        </button>
      </div>
    </div>
  );
}

