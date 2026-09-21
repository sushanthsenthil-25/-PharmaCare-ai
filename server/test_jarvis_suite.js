import mongoose from 'mongoose';
import dotenv from 'dotenv';
import geminiService from './services/geminiService.js';

dotenv.config();

const runTests = async () => {
  console.log('--- STARTING JARVIS SUITE TESTS ---');
  await mongoose.connect(process.env.MONGODB_URI);

  // Test 1: "Show me paracetamol"
  console.log('\n[Test 1] Query: "Show me paracetamol"');
  let res1 = await geminiService.generateChatResponse({ message: 'Show me paracetamol', history: [] });
  console.log('Result count:', res1.products?.length);
  console.log('Products:', res1.products?.map((p) => p.name));
  console.log('JARVIS:', res1.message);

  // Test 2: "Show me paracetamol 650"
  console.log('\n[Test 2] Query: "Show me paracetamol 650"');
  let res2 = await geminiService.generateChatResponse({ message: 'Show me paracetamol 650', history: [] });
  console.log('Result count:', res2.products?.length);
  console.log('Products:', res2.products?.map((p) => p.name));
  console.log('JARVIS:', res2.message);

  // Test 3: "Find allergy medicine"
  console.log('\n[Test 3] Query: "Find allergy medicine"');
  let res3 = await geminiService.generateChatResponse({ message: 'Find allergy medicine', history: [] });
  console.log('Result count:', res3.products?.length);
  console.log('Products:', res3.products?.map((p) => p.name));

  // Test 4: "Show me acidity medicines"
  console.log('\n[Test 4] Query: "Show me acidity medicines"');
  let res4 = await geminiService.generateChatResponse({ message: 'Show me acidity medicines', history: [] });
  console.log('Result count:', res4.products?.length);
  console.log('Products:', res4.products?.map((p) => p.name));

  // Test 5: "Show me antibiotics"
  console.log('\n[Test 5] Query: "Show me antibiotics"');
  let res5 = await geminiService.generateChatResponse({ message: 'Show me antibiotics', history: [] });
  console.log('Result count:', res5.products?.length);
  console.log('Products:', res5.products?.map((p) => p.name));

  // Test 6: Multi-turn conversation flow
  console.log('\n[Test 6] Multi-turn Conversation Flow:');
  const history = [];

  // Turn 1: "Hey Jarvis."
  let turn1 = await geminiService.generateChatResponse({ message: 'Hey Jarvis.', history });
  console.log('User: Hey Jarvis.');
  console.log('JARVIS:', turn1.message);
  history.push({ role: 'user', message: 'Hey Jarvis.' });
  history.push({ role: 'assistant', message: turn1.message });

  // Turn 2: "Show me paracetamol."
  let turn2 = await geminiService.generateChatResponse({ message: 'Show me paracetamol.', history, context: turn1.context });
  console.log('User: Show me paracetamol.');
  console.log('JARVIS:', turn2.message);
  console.log('Products:', turn2.products.map(p => p.name));
  history.push({ role: 'user', message: 'Show me paracetamol.', products: turn2.products });
  history.push({ role: 'assistant', message: turn2.message, products: turn2.products });

  // Turn 3: "What's the price of the second one?"
  let turn3 = await geminiService.generateChatResponse({ message: "What's the price of the second one?", history, context: turn2.context });
  console.log("User: What's the price of the second one?");
  console.log('JARVIS:', turn3.message);
  history.push({ role: 'user', message: "What's the price of the second one?" });
  history.push({ role: 'assistant', message: turn3.message });

  // Turn 4: "Is it available?"
  let turn4 = await geminiService.generateChatResponse({ message: 'Is it available?', history, context: turn3.context });
  console.log('User: Is it available?');
  console.log('JARVIS:', turn4.message);
  history.push({ role: 'user', message: 'Is it available?' });
  history.push({ role: 'assistant', message: turn4.message });

  // Turn 5: "Add it to my cart."
  let turn5 = await geminiService.generateChatResponse({ message: 'Add it to my cart.', history, context: turn4.context });
  console.log('User: Add it to my cart.');
  console.log('JARVIS:', turn5.message);
  console.log('Action:', turn5.action, 'Added item:', turn5.addedProduct?.name);
  history.push({ role: 'user', message: 'Add it to my cart.' });
  history.push({ role: 'assistant', message: turn5.message });

  // Turn 6: "What is it used for?"
  let turn6 = await geminiService.generateChatResponse({ message: 'What is it used for?', history, context: turn5.context });
  console.log('User: What is it used for?');
  console.log('JARVIS:', turn6.message);

  // Turn 7: "Thanks Jarvis."
  let turn7 = await geminiService.generateChatResponse({ message: 'Thanks Jarvis.', history, context: turn6.context });
  console.log('User: Thanks Jarvis.');
  console.log('JARVIS:', turn7.message);

  // Test 7: General Conversation & Topic Switching
  console.log('\n[Test 7] Topic Switching Test:');
  let gen1 = await geminiService.generateChatResponse({ message: "Hey Jarvis, how's the weather?", history: [] });
  console.log("User: Hey Jarvis, how's the weather?");
  console.log('JARVIS:', gen1.message);

  let gen2 = await geminiService.generateChatResponse({ message: 'Tell me a joke.', history: [] });
  console.log('User: Tell me a joke.');
  console.log('JARVIS:', gen2.message);

  let gen3 = await geminiService.generateChatResponse({ message: "What's 25 times 4?", history: [] });
  console.log("User: What's 25 times 4?");
  console.log('JARVIS:', gen3.message);

  let gen4 = await geminiService.generateChatResponse({ message: 'Now show me something for acidity.', history: [] });
  console.log('User: Now show me something for acidity.');
  console.log('JARVIS:', gen4.message);
  console.log('Products:', gen4.products.map(p => p.name));

  // Test 8: Non-hallucination test
  console.log('\n[Test 8] Non-hallucination Test ("Do you have Dolo 650?"):');
  let nonHalluc = await geminiService.generateChatResponse({ message: 'Do you have Dolo 650?', history: [] });
  console.log('User: Do you have Dolo 650?');
  console.log('JARVIS:', nonHalluc.message);

  console.log('\n--- ALL JARVIS TESTS COMPLETED ---');
  process.exit(0);
};

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
