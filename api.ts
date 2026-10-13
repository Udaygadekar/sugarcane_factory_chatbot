import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import dotenv from "dotenv";
import express, { type ErrorRequestHandler } from "express";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";

dotenv.config();

interface FarmerRecord {
  farmer_id: string;
  farmer_name: string;
  village: string;
  sugarcane_tonnes: number;
  total_payment: number;
  amount_paid: number;
  payment_pending: number;
}

interface AskRequest {
  question: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readText(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error(`Farmer record has an invalid ${field} value.`);
  }

  const text = String(value).trim();
  if (!text) {
    throw new Error(`Farmer record is missing ${field}.`);
  }
  return text;
}

function readNumber(record: Record<string, unknown>, field: string): number {
  const value = record[field];
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && value.trim() === "")
  ) {
    throw new Error(`Farmer record has an invalid ${field} value.`);
  }

  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`Farmer record has an invalid ${field} value.`);
  }
  return number;
}

function isTextContent(value: unknown): value is { text: string } {
  return (
    isObject(value) &&
    "text" in value &&
    typeof value.text === "string"
  );
}

function parseFarmerRecords(text: string): FarmerRecord[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("The farmer data tool returned invalid JSON.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("The farmer data tool did not return a list of farmers.");
  }

  return parsed.map((item): FarmerRecord => {
    if (!isObject(item)) {
      throw new Error("The farmer data tool returned an invalid farmer record.");
    }

    return {
      farmer_id: readText(item, "farmer_id"),
      farmer_name: readText(item, "farmer_name"),
      village: readText(item, "village"),
      sugarcane_tonnes: readNumber(item, "sugarcane_tonnes"),
      total_payment: readNumber(item, "total_payment"),
      amount_paid: readNumber(item, "amount_paid"),
      payment_pending: readNumber(item, "payment_pending"),
    };
  });
}

async function getFarmerRecords(): Promise<FarmerRecord[]> {
  const client = new Client({
    name: "sanjivani-farmer-web-client",
    version: "1.0.0",
  });
  const serverPath = fileURLToPath(new URL("./server.ts", import.meta.url));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", "tsx", serverPath],
    cwd: fileURLToPath(new URL(".", import.meta.url)),
  });

  try {
    await client.connect(transport);
    const tools = await client.listTools();
    if (!tools.tools.some((tool) => tool.name === "get_farmer_data")) {
      throw new Error("The MCP server does not provide get_farmer_data.");
    }

    const result = await client.callTool(
      { name: "get_farmer_data", arguments: {} },
      CallToolResultSchema
    );

    if (!Array.isArray(result.content)) {
      throw new Error("The farmer data tool returned an invalid response.");
    }

    const text = result.content
      .filter(isTextContent)
      .map((item) => item.text)
      .join("\n");

    if (result.isError === true) {
      throw new Error(text || "The farmer data tool failed.");
    }
    if (!text) {
      throw new Error("The farmer data tool returned no readable data.");
    }

    return parseFarmerRecords(text);
  } finally {
    await client.close();
  }
}

function redactSecrets(message: string): string {
  let safeMessage = message;
  for (const secret of [
    process.env.OPENAI_API_KEY,
    process.env.MONGODB_URI,
  ]) {
    if (secret) {
      safeMessage = safeMessage.replaceAll(secret, "[REDACTED]");
    }
  }
  return safeMessage;
}

const app = express();
app.use(express.json({ limit: "20kb" }));

app.get("/api/farmers", async (_request, response) => {
  try {
    const farmers = await getFarmerRecords();
    response.json({ farmers });
  } catch (error) {
    const message =
      error instanceof Error ? redactSecrets(error.message) : "Unknown error.";
    console.error("Could not load farmer records:", message);
    response.status(503).json({
      error:
        "Could not load farmer records. Check that MongoDB is running and the farmers collection contains valid records.",
    });
  }
});

app.post("/api/ask", async (request, response) => {
  const body: unknown = request.body;
  const question =
    isObject(body) && typeof body.question === "string"
      ? body.question.trim()
      : "";

  if (!question) {
    response.status(400).json({ error: "Please enter a question." });
    return;
  }
  if (question.length > 1000) {
    response.status(400).json({
      error: "Please keep your question under 1,000 characters.",
    });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    response.status(503).json({
      error: "AI answers are not configured. Set OPENAI_API_KEY in your .env file.",
    });
    return;
  }

  try {
    const farmers = await getFarmerRecords();
    const openai = new OpenAI({ apiKey });
    const result = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a sugarcane farmer management assistant. Answer using only the supplied farmer records. Never invent names or financial values. For questions involving highest, lowest, totals, or averages, calculate the answer from the records. Explain in clear, simple English and state when records do not contain the answer.",
        },
        {
          role: "user",
          content: `Farmer records:\n${JSON.stringify(farmers)}\n\nQuestion: ${question}`,
        },
      ],
    });

    const answer = result.choices[0]?.message.content;
    if (!answer) {
      throw new Error("OpenAI returned an empty answer.");
    }
    response.json({ answer });
  } catch (error) {
    const message =
      error instanceof Error ? redactSecrets(error.message) : "Unknown error.";
    console.error("Could not answer farmer question:", message);
    response.status(502).json({
      error:
        "The assistant could not answer right now. Check the database connection, OpenAI API key, and model access, then try again.",
    });
  }
});

const clientDirectory = fileURLToPath(new URL("./dist/", import.meta.url));
const indexPath = fileURLToPath(new URL("./dist/index.html", import.meta.url));
if (existsSync(indexPath)) {
  app.use(express.static(clientDirectory));
  app.use((request, response, next) => {
    if (request.path.startsWith("/api/")) {
      next();
      return;
    }
    response.sendFile(indexPath);
  });
}

app.use((_request, response) => {
  response.status(404).json({ error: "This API route does not exist." });
});

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  const message =
    error instanceof Error ? redactSecrets(error.message) : "Unknown error.";
  console.error("API request failed:", message);
  response.status(400).json({ error: "The request could not be processed." });
};
app.use(errorHandler);

const port = Number(process.env.PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be a valid TCP port number.");
}

app.listen(port, "127.0.0.1", () => {
  console.log(`Farmer management API listening on http://localhost:${port}`);
});
