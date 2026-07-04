import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

async function test() {
  const geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  console.log("Connecting to live API...");
  try {
    const session = await geminiClient.live.connect({
      model: 'models/gemini-2.0-flash-exp',
      config: {
        responseModalities: ['AUDIO']
      } as any,
      callbacks: {
        onmessage: (data) => {
           console.log('Message received');
           if ((data as any).serverContent?.modelTurn) {
               console.log("Model spoke!");
           }
        },
        onclose: () => console.log('Closed'),
        onerror: (err) => console.error('Error:', err)
      }
    });
    console.log("Connected successfully!");
    
    (session as any).sendClientContent({
      turns: [{ role: 'user', parts: [{ text: 'Hello' }] }],
      turnComplete: true
    });

    setTimeout(() => {
      console.log("Closing...");
      process.exit(0);
    }, 5000);
  } catch (e) {
    console.error("Connection failed:", e);
    process.exit(1);
  }
}
test();
