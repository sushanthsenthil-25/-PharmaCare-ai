import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

async function testGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log('Testing GEMINI_API_KEY:', apiKey ? apiKey.substring(0, 8) + '...' : 'NONE');

  const genAI = new GoogleGenerativeAI(apiKey);

  const modelsToTest = [
    'gemini-3.6-flash',
    'gemini-3.7-flash',
    'gemini-3.0-flash',
    'gemini-3-flash',
  ];

  for (const modelName of modelsToTest) {
    try {
      console.log(`Testing model: ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent('Hello PharmaCare! Briefly introduce yourself in one sentence.');
      console.log(`\n🎉 SUCCESS for ${modelName}:`, result.response.text());
      return modelName;
    } catch (err) {
      console.log(`Failed for ${modelName}: ${err.message}`);
    }
  }
}

testGemini();
