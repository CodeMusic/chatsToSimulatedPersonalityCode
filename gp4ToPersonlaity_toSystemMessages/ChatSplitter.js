const fs = require("fs");
const { Configuration, OpenAIApi } = require("openai");
const path = require('path');
require('dotenv').config();
let PROCESS_CHUNKS = 85190;

const openai = new OpenAIApi(
  new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  })
);

async function processFilesInDirectory(directory) {
  const files = fs.readdirSync(directory).filter(file => file.endsWith('.txt'));
  for (const file of files) {
      await processFile(path.join(directory, file));
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processFile(filePath) {
  const processedFilePath = filePath.replace(/\.txt$/, '_clarified.txt');
  if (!fs.existsSync(processedFilePath)) {
    fs.writeFileSync(processedFilePath, '');
    console.log(`Created empty file at ${processedFilePath} as it did not exist.`);
  }

  if (fs.readFileSync(processedFilePath, 'utf8').trim().length > 0) {
    //fs.writeFileSync(processedFilePath, '');
    //console.log(`Cleared content in ${processedFilePath} as it was not empty.`);
  }

  const data = fs.readFileSync(filePath, 'utf8');
  //#const cleanData = data.replace(/[^ -~]+/g, '').replace(/\n/g, ' ').replace(/\r/g, ' '); // Removes non-ASCII characters
  const cleanData = data.replace(/[^ -~\n\r]+/g, '').replace(/[\n\r]+/g, ' ');
  let index = 0;
  //let originalContent = "";
  let newContent = fs.readFileSync(processedFilePath, 'utf8');
  while (index < cleanData.length) {
      const chunk = cleanData.slice(index, Math.min(index + PROCESS_CHUNKS, cleanData.length));
      const numberOfChunks = Math.ceil(cleanData.length / PROCESS_CHUNKS);

      const previousContent = limitAndFormatContent(newContent, PROCESS_CHUNKS / 2);
      let success = false;

  

      success = false;
      let attempt = 0;
      while (!success) {
        try {
            newContent = await processChunkWithAi(filePath, chunk, numberOfChunks, index, previousContent);
            success = true;
        } catch (e) {
            console.log("Error trying to processChunkWithAi, trying again (attempt " + attempt + ") after 5 seconds", e);
            sleep(5000);
        }

        attempt++;
        if (attempt > 10 && !success) {
            console.log("Failed to processChunkWithAi after 10 attempts, giving up");
            break;
        }
      }
      fs.appendFileSync(processedFilePath, newContent);
      //originalContent += newContent;
      index += PROCESS_CHUNKS;
  }
  
  
}

function limitAndFormatContent(content, maxLength) {
  if (content.length <= maxLength) {
      return content;
  }

  //#const halfLength = Math.floor(maxLength / 2);
  //#const start = content.substring(0, halfLength);
  //#const end = content.substring(content.length - halfLength);
  //#return `${start}...${end}`;
  const end = content.substring(content.length - maxLength);
  return `...${end}`;
}

async function processChunkWithAi(textFileName, chunkOfData, chunkSize, chunkNumber, previousContent) {
  const payload = {
      model: "gpt-4o",
      temperature: 0,
      messages: [
          {
              role: "system",
              content:  `You are a professional conversation analysis, psychologist, relationsihp expert, and focus on prefactors and recognizing what the conversation fulfills in the other person.
              We have a complex process so we will act like a thorough process, this in the embedding layer, putting the input together.
              Using your skills, like learning when at least 5 hours (variable) occur between responses. You also notice when people say things like hi, and by.
              
              Using all information, you are to leave the text unchanged with the exception of adding a new line followed by a ~ and another new line.
              
              The conversation, grammar errors, spelling errors, and all; right now we just want to insert a new line followed by a ~ and another new line when it was a new conversation.
              We need to help chunk the data for processing also.
              
              THE NUMBER OF LINES IN THE OUTPUT SHOULD MATCH. WELL, SHOULD BE LARGE BECAUSE WE ADDED INDICATOR FOR CONVERSATION BREAKS.
              ALL LINES OF CONVERSATION MUST REMAIN INTACT AND AS WRITTEN.`
          },
          {
              role: "assistant",
              content: `
              Document Name: ${textFileName}
              Size of Chunk: ${PROCESS_CHUNKS} characters
              Chunk Number: ${chunkNumber / PROCESS_CHUNKS} / ${chunkSize}
              Previous Content: ${previousContent}
              Please process the following data chunk,
              you are to continue from the previous chunk ${(chunkNumber/PROCESS_CHUNKS) - 1} / ${chunkSize}'s output to make a fluent story.
              ###
              Return the resutls in plain text, with the same format, we are noly adding the chat break \n~\n linicator.

              MAKE SURE THAT EACH LINE FOLLOW THIS FOLLOWING FORMAT:
              [2024-05-22, 3:31:32 PM] Zoe: Hi
              [2024-05-22, 3:33:23 PM] Zoe: hello
              [2024-05-22, 3:34:53 PM] Adam: bye
              ~
              [2024-05-25, 3:36:32 PM] Zoe: I’m sick rn still
              ~
              [2024-05-26, 3:39:23 PM] Adam: Good now? I need a favour.
              ~

              DIRECTIVES: YOUR MUST ENER ONY THE LINES FROM THE FILES AS YOU SEE THEM.
              YOU WILL PERSERVER ALL CHACTERS, TYPO'S. ETC,

              YORU ONLY TASK IS TO IDENTIFY WHE YOU THINK A SPAN OF CONVERSATION COMPLETED FOR THE PERIOD.
              WHEN YOU IDENTIFY THIS ADD A NET LINE, FOLLOWED BY THIS SYMBOL ~ AND FINALLY ANOTHE LINE BREAK.

              YOU ARE TO MAKE NO OTHER CHANGES!
              `,
          },
      ],
  };
  console.log("---Payload---\n");
  console.log(payload);

  let originalContent;
  try {
      const response = await openai.createChatCompletion(payload);
      console.log(response.data.choices[0].message);
      originalContent = response.data.choices[0].message.content;
  } catch (e) {
      console.log("Error", e);
      throw e;
      //originalContent = e.message + " " + e.type + " " + e.stack + " " + e.name + " " + e.cause;
  }

  return originalContent;
}

processFilesInDirectory("chats");