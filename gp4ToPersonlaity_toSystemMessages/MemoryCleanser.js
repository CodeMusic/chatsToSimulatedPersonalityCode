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
  const files = fs.readdirSync(directory).filter(file => file.endsWith('.txt') && !file.endsWith('_processed.txt'));
  for (const file of files) {
      await processFile(path.join(directory, file));
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processFile(filePath) {
  const processedFilePath = filePath.replace(/\.txt$/, '_processed.txt');
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
            console.log("Error trying to processChunkWithAi, trying again (attempt " + attempt + ") after 5 seconds");
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
              content: `You are an editor who produces AI training material based on a provided chunk of text. 
                        You have only been given a chunk of the content, about ${chunkSize} characters; You want to remove anything unhelpful to the training of the AI, while trying to maintain the original content as much as possible.
                        These are transcriptions of the original material, we are trying to describe the original content, not the transcription. The content result should be of similar length to the original content, and as unchanged as possible.
                        Remove non-standard characters, and replace dialog with a story paragraph. This material is for use as AI training.` 
          },
          {
              role: "assistant",
              content: `
              Document Name: ${textFileName}
              Size of Chunk: ${PROCESS_CHUNKS} characters
              Chunk Number: ${chunkNumber / PROCESS_CHUNKS} / ${chunkSize}
              Previous Content: ${previousContent}
              Please process the following data chunk,
              you are to continue from the previous chunk ${(chunkNumber/PROCESS_CHUNKS) - 1} / ${chunkSize}'s output.
              ###
              ${JSON.stringify(chunkOfData)}
              ###
              Repond in plain text.
              eg:
              This will contain the original content of the document, unchanged just edited to be more readable and AI friendly.
              `,
          },
      ],
  };
  console.log("---Payload---\n");
  console.log(payload);

  const response = await openai.createChatCompletion(payload);
  console.log(response.data.choices[0].message);
  let originalContent;
  try {
      originalContent = response.data.choices[0].message.content;
  } catch (e) {
      console.log("Error in JSON Parse", e);
      originalContent = e.message + " " + e.type + " " + e.stack + " " + e.name + " " + e.cause;
  }

  return originalContent;
}


processFilesInDirectory("memories");
processFilesInDirectory("memories");