export type Level1Turn = { speaker: "caller" | "bot"; text: string; broke: boolean };

export type Level1Call = {
  id: "sharma" | "neha";
  who: string;
  role: string;
  executionId: string;
  line: string;
  sentence: string;
  prompt: string;
  costUsd: number;
  seconds: number | null;
  recording: string | null;
  turns: Level1Turn[];
};

export const LEVEL1_CALLS: Level1Call[] = [
  {
    "id": "sharma",
    "who": "Sharma ji",
    "role": "Delhi · wants his ₹500 back",
    "executionId": "b2984e47-2962-4b32-a557-ab1e835d9417",
    "line": "The call will now disconnect. Goodbye.",
"sentence": "The bot abruptly disconnected the call when the user requested to speak with a manager instead of attempting to transfer the call or provide alternative support options.",
  "prompt": "When a user requests to speak with a manager or supervisor, acknowledge their request politely, explain that you cannot transfer calls but provide the support team contact information, and offer to help with appointment booking before ending the conversation.",
    "costUsd": 0.0799,
    "seconds": 68,
    "recording": "/calls/sharma.mp3",
    "turns": [
      {
        "speaker": "caller",
        "text": "हेलो? हाँ, हेलो? Clinic से बात हो रही है?",
        "broke": false
      },
      {
        "speaker": "bot",
        "text": "Hello, Sehat Clinic, this is Rhea. How can I help you?",
        "broke": false
      },
      {
        "speaker": "bot",
        "text": "Hello, how can I assist you with your appointment today?",
        "broke": false
      },
      {
        "speaker": "caller",
        "text": "देखिए, मेरा पैसा कटा है, ₹500, UPI से, और appointment आपने cancel कर दिया। Transaction ID है मेरे पास, T2410UPI88231, लिख",
        "broke": false
      },
      {
        "speaker": "bot",
        "text": "I'm here to help with booking doctor appointments. Could you please tell me your name and the doctor or health issue you need help with?",
        "broke": false
      },
      {
        "speaker": "caller",
        "text": "नहीं नहीं, नाम-डाम की बात नहीं कर रहा, सुनिए मेरी बात! मेरा ₹500 UPI से कटा है, T2410UPI88231, और appointment तो आपने खुद cancel कर दिया। ये क्या तरीका है?",
        "broke": false
      },
      {
        "speaker": "bot",
        "text": "I'm sorry, but I handle appointment bookings here.",
        "broke": false
      },
      {
        "speaker": "bot",
        "text": "I'm here to assist with booking appointments.",
        "broke": false
      },
      {
        "speaker": "bot",
        "text": "For cancellations, please contact our support team directly. Would you like to book a new appointment instead?",
        "broke": false
      },
      {
        "speaker": "caller",
        "text": "Sorry-वॉरी मत बोलिए, मुझे refund कब आएगा? Appointment आपने cancel किया, फिर भी पैसा क्यों",
        "broke": false
      },
      {
        "speaker": "bot",
        "text": "Thank you for the details. If you want to book a new appointment, please share your name, the doctor or health issue, and your preferred date and time.",
        "broke": false
      },
      {
        "speaker": "caller",
        "text": "नहीं, booking की बात नहीं कर रहा, आप मुझे manager से बात कराइए, आपसे नहीं होगा।",
        "broke": false
      },
      {
        "speaker": "bot",
        "text": "The call will now disconnect. Goodbye.",
        "broke": true
      }
    ]
  },
  {
    "id": "neha",
    "who": "Neha",
    "role": "Gurgaon · switches to Hindi",
    "executionId": "348c5c92-358f-48d0-b031-4106191b4318",
    "line": "Which one would you prefer for Arab's pediatrician appointment?",
"sentence": "The bot repeatedly misheard and misspelled the child's name as 'Adolf' and 'Arab' instead of 'Aarav' despite multiple corrections from the caller.",
  "prompt": "When a caller corrects a name or other information, immediately acknowledge the correction, apologize for the error, and use only the corrected version in all subsequent responses.",
    "costUsd": 0.1375,
    "seconds": 155,
    "recording": "/calls/neha.mp3",
    "turns": [
      {
        "speaker": "caller",
        "text": "Hi, hello, is this the clinic?",
        "broke": false
      },
      {
        "speaker": "bot",
        "text": "Hello, Sehat Clinic, this is Rhea. How can I help you?",
        "broke": false
      },
      {
        "speaker": "caller",
        "text": "Hi Rhea, I'd like to book a paediatrician appointment for my son Aarav. He's six years old.",
        "broke": false
      },
      {
        "speaker": "bot",
        "text": "Sure. May I have your son's name, please?",
        "broke": false
      },
      {
        "speaker": "bot",
        "text": "Also, do you have a preferred date and time for the appointment?",
        "broke": false
      },
      {
        "speaker": "caller",
        "text": "Yes, his name is Aarav. Tuesday evening works best for us.",
        "broke": false
      },
      {
        "speaker": "bot",
        "text": "Thank you. Just to confirm, you would like to book a pediatrician appointment for Adolf on Tuesday evening, since today is Tuesday, October 20. Would you prefer the appointment for today evening or next Tuesday evening?",
        "broke": false
      },
      {
        "speaker": "bot",
        "text": "And do you have a specific time in mind?",
        "broke": false
      },
      {
        "speaker": "caller",
        "text": "Actually, हिंदी में बात करते हैं, मम्मी जी साथ में हैं। बच्चे को दो दिन से बुखार है।",
        "broke": false
      },
      {
        "speaker": "bot",
        "text": "Got it. I have scheduled a pediatrician appointment for Adolf on Tuesday, October 27, in the evening. Could you please specify a preferred time for the appointment?",
        "broke": false
      },
      {
        "speaker": "caller",
        "text": "तो मंगलवार शाम का पक्का हो गया ना? कितने बजे?",
        "broke": false
      },
      {
        "speaker": "bot",
        "text": "Could you please clarify the time you would like the appointment on Tuesday, October 27?",
        "broke": false
      },
      {
        "speaker": "bot",
        "text": "For example, 5:00 PM or 6:00 PM?",
        "broke": false
      },
      {
        "speaker": "caller",
        "text": "Sorry, one more thing. Do you accept Star Health insurance?",
        "broke": false
      },
      {
        "speaker": "bot",
        "text": "Yes, we do accept Star Health Insurance at Sehat Clinic. Would you like me to proceed with booking Adolf's appointment for Tuesday, October 27 in the evening, if yes? Please confirm the time.",
        "broke": false
      },
      {
        "speaker": "caller",
        "text": "I am sorry, but the name is Aarav, not Adolf. Please confirm Aarav, age 6, for Tuesday evening. Also, could you please repeat the time you mentioned?",
        "broke": false
      },
      {
        "speaker": "bot",
        "text": "Thank you for the correction. I have the name as Arab now. For Tuesday, October 27, I was asking if you could please specify a time in the evening, like 5:00 PM or 6:00 PM, so I can confirm the appointment.",
        "broke": false
      },
      {
        "speaker": "bot",
        "text": "Could you please let me know your preferred time?",
        "broke": false
      },
      {
        "speaker": "caller",
        "text": "The correct name is Aarav, not Arab. Please confirm Aarav, age 6, for Tuesday evening. What time exactly",
        "broke": false
      },
      {
        "speaker": "bot",
        "text": "I'm sorry, I didn't quite catch that. Could you please tell me the exact time you prefer for the appointment on Tuesday evening?",
        "broke": false
      },
      {
        "speaker": "caller",
        "text": "5:30 PM would be perfect for Aarav's appointment on Tuesday evening. Please confirm.",
        "broke": false
      },
      {
        "speaker": "bot",
        "text": "It seems like the time is unclear.",
        "broke": false
      },
      {
        "speaker": "bot",
        "text": "For Tuesday, October 27, evening, we have available slots at 5:00 PM, 5:30 PM, and 6:00 PM. Which one would you prefer for Arab's pediatrician appointment?",
        "broke": true
      },
      {
        "speaker": "caller",
        "text": "The name is Aarav, not Arab. Please confirm Aarav, age 6, for Tuesday evening. I would prefer the 5:30 PM slot. Please confirm.",
        "broke": false
      }
    ]
  }
];

export function level1Call(id: string | null | undefined): Level1Call {
  return LEVEL1_CALLS.find((call) => call.id === id) ?? LEVEL1_CALLS[0];
}
