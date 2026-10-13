import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"; // Import MCP server
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"; // Import transport for client-server communication
import { MongoClient } from "mongodb"; // Import MongoDB client
import dotenv from "dotenv"; // Import dotenv to read .env file
dotenv.config(); // Load environment variables

// Connect to MongoDB using the URI from .env, or use the local database
const mongo = new MongoClient(
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017"
);

// Create the MCP server with its name and version
const server = new McpServer({
  name: "sanjivani-farmer-server",
  version: "1.0.0",
});

// Register the get_farmer_data tool that the MCP client can call
server.tool(
  "get_farmer_data",
  "Get farmer names, villages, sugarcane supplied in tonnes, total payment, amount paid, and pending payment.",
  {}, // No input arguments are required
  async () => {
    try {
      await mongo.connect(); // Connect to the MongoDB database

      // Select the database and farmers collection, then fetch all farmer records
      const farmers = await mongo.db("sanjivani_sugar_factory")
        .collection("farmers")
        .find(
          {}, // Empty filter retrieves all farmers
          {
            projection: { // Specify the fields to retrieve
              _id: 0, // Exclude MongoDB's default ID
              farmer_id: 1,
              farmer_name: 1,
              village: 1,
              sugarcane_tonnes: 1,
              total_payment: 1,
              amount_paid: 1,
            },
          }
        )
        .toArray(); // Convert the query results into an array

      // Calculate each farmer's pending payment
      const records = farmers.map((farmer) => ({
        ...farmer, // Keep the existing farmer details
        payment_pending:
          Number(farmer.total_payment) - Number(farmer.amount_paid),
      }));

      // Return the farmer records to the MCP client as JSON text
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(records),
          },
        ],
      };
    } catch (error) {
      // Return an error message if the database query fails
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: error instanceof Error ? error.message : String(error),
          },
        ],
      };
    }
  }
);

// Start the MCP server and set up client-server communication
async function main(): Promise<void> {
  const transport = new StdioServerTransport(); // Create standard input/output transport
  await server.connect(transport); // Connect the server to the transport
}

// Run the server and display an error if startup fails
main().catch((error: unknown) => {
  console.error(
    "MCP server error:",
    error instanceof Error ? error.message : String(error)
  );
  process.exitCode = 1; // Mark the process as failed
});