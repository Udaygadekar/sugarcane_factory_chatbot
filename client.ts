import { Client } from "@modelcontextprotocol/sdk/client/index.js"; // Import MCP client
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"; // Import transport to communicate with the MCP server
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js"; // Import schema to validate tool results
import OpenAI from "openai"; // Import OpenAI API
import { createInterface } from "node:readline/promises"; // Import interface to read user input
import { fileURLToPath } from "node:url"; // Convert file URLs into file paths
import dotenv from "dotenv"; // Import dotenv to load environment variables
dotenv.config(); // Load variables from the .env file

const farmerToolName = "get_farmer_data"; // Name of the MCP tool to call

// Check whether a value contains a text property of type string
function isTextContent(value: unknown): value is { text: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "text" in value &&
    typeof value.text === "string"
  );
}

// Main function that runs the farmer assistant
async function main(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY; // Read the OpenAI API key from environment variables

  // Stop execution if the API key is missing
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is missing. Set it in your environment before starting the client."
    );
  }

  const openai = new OpenAI({ apiKey }); // Create an OpenAI client using the API key

  // Prepare the terminal interface to accept the user's question
  const input = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Create the MCP client with its name and version
  const client = new Client({
    name: "sanjivani-farmer-client",
    version: "1.0.0",
  });

  // Get the absolute path of server.ts
  const serverPath = fileURLToPath(new URL("./server.ts", import.meta.url));

  // Configure how the client starts and communicates with the MCP server
  const transport = new StdioClientTransport({
    command: process.execPath, // Use the current Node.js executable
    args: ["--import", "tsx", serverPath], // Run server.ts using tsx
    cwd: fileURLToPath(new URL(".", import.meta.url)), // Set the working directory
  });

  try {
    // Ask the user to enter a question and remove extra spaces
    const question = (await input.question("Ask a farmer question: ")).trim();

    // Stop if the user enters an empty question
    if (!question) {
      throw new Error("Please enter a question before continuing.");
    }

    await client.connect(transport); // Connect the MCP client to the server

    // Ask the MCP server which tools are available
    const availableTools = await client.listTools();

    // Check whether the required farmer data tool exists
    if (!availableTools.tools.some((tool) => tool.name === farmerToolName)) {
      throw new Error(`The MCP server does not provide ${farmerToolName}.`);
    }

    // Call the get_farmer_data tool to retrieve farmer records
    const toolResult = await client.callTool({
      name: farmerToolName,
      arguments: {}, // The tool does not require input arguments
    }, CallToolResultSchema);

    // Check whether the tool returned content in an array
    if (!Array.isArray(toolResult.content)) {
      throw new Error("The farmer data tool returned an invalid response.");
    }

    // Extract text content from the tool result and combine it into a string
    const farmerData = toolResult.content
      .filter(isTextContent) // Keep only items containing text
      .map((item) => item.text) // Extract the text from each item
      .join("\n"); // Join the text items with new lines

    // Stop if the MCP tool reports an error
    if (toolResult.isError === true) {
      throw new Error(farmerData || "The farmer data tool failed.");
    }

    // Stop if no readable farmer data was returned
    if (!farmerData) {
      throw new Error("The farmer data tool returned no readable data.");
    }

    // Send the farmer data and user's question to OpenAI for an answer
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini", // Use the configured model or the default model
      messages: [
        {
          // Set the AI's role and rules for answering questions
          role: "system",
          content:
            "You help manage a sugarcane farm. Answer the user's question using only the farmer data provided. Do not invent records or values. Explain clearly in simple language, and say when the data does not contain the answer.",
        },
        {
          // Provide the retrieved farmer data and the user's question
          role: "user",
          content: `Farmer data from the database:\n${farmerData}\n\nQuestion: ${question}`,
        },
      ],
    });

    // Extract the AI's answer from the response
    const answer = response.choices[0]?.message.content;

    // Stop if OpenAI returns no answer
    if (!answer) {
      throw new Error("OpenAI returned an empty answer.");
    }

    console.log(`\n${answer}`); // Display the final answer in the terminal
  } finally {
    input.close(); // Close the terminal input interface
    await client.close(); // Close the MCP client connection
  }
}

// Start the application and handle any errors
main().catch((error: unknown) => {
  console.error(
    "Farmer assistant error:",
    error instanceof Error ? error.message : String(error)
  );
  process.exitCode = 1; // Mark the process as failed
});