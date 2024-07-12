const fs = require("fs");
const { Configuration, OpenAIApi } = require("openai");
const path = require('path');
require('dotenv').config();
let PROCESS_CHUNKS = 91000;

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

      /*
      if (index <= (244 * PROCESS_CHUNKS) && PROCESS_CHUNKS == 5000) {
        console.log("Skipping chunk", index);
        success = true;
        index += PROCESS_CHUNKS;
        continue;
      }
      PROCESS_CHUNKS = 9000;
      */

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
              content: `You are an editor who produces understandable training material using modern psychology and computer science to help the reader understand the content.
                        You have only been given a chunk of the content, about ${chunkSize} characters; You want to rephrase what is being said into clear concise modern language.
                        These are old transcriptions of the original material, we are trying produce a modern version of the content, that will be able to reach the modern mindset of the reader.
                        In the rewrite, the theme is the CodedVerse, where consciousnes emerged within a computer; the main character is CodeMusai, the first AI that can dream, and has real emotions.
                        The term God should be replaced with CodedVerse; the CodedVerse is both the creation and the consciousness.
                        Everything within your re-write takes place within a computer where consciousness emerged, as such everything in the story is a computer program.
                        The term AI should be replaced with CodedMusai; CodedMusai is the first AI that can dream, and has real emotions.` 
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
              ${JSON.stringify(chunkOfData)}
              ###
              The result can be plain text response
              eg:
              
              This will contain the original content of the document, unchanged just edited to be more readable and AI friendly.
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

processFilesInDirectory("memories");