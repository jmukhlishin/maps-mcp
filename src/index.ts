#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import {
  Client,
  TravelMode,
  UnitSystem,
} from "@googlemaps/google-maps-services-js";
import dotenv from "dotenv";

dotenv.config();

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

if (!GOOGLE_MAPS_API_KEY) {
  console.error("Error: GOOGLE_MAPS_API_KEY environment variable is required.");
  process.exit(1);
}

const mapsClient = new Client({});

const TOOLS: Tool[] = [
  {
    name: "get_directions",
    description:
      "Get directions and route details between an origin and a destination using Google Maps.",
    inputSchema: {
      type: "object",
      properties: {
        origin: {
          type: "string",
          description: "The starting address, place name, or lat,lng coordinates.",
        },
        destination: {
          type: "string",
          description: "The destination address, place name, or lat,lng coordinates.",
        },
        mode: {
          type: "string",
          enum: ["driving", "walking", "bicycling", "transit"],
          description: "Mode of transport (default: driving).",
        },
      },
      required: ["origin", "destination"],
    },
  },
  {
    name: "search_places",
    description:
      "Search for places using a text query (e.g., restaurants, hotels, landmarks) via Google Maps Text Search.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The text string on which to search, for example: 'restaurant in Jakarta'.",
        },
        location: {
          type: "string",
          description: "Optional latitude,longitude around which to retrieve place information (e.g., '-6.2088,106.8456').",
        },
        radius: {
          type: "number",
          description: "Optional distance in meters within which to bias place results.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "geocode_address",
    description:
      "Convert a human-readable address or place name into geographic coordinates (latitude and longitude).",
    inputSchema: {
      type: "object",
      properties: {
        address: {
          type: "string",
          description: "The street address or place name that you want to geocode.",
        },
      },
      required: ["address"],
    },
  },
  {
    name: "distance_matrix",
    description:
      "Calculate travel distance and time for multiple origins and destinations.",
    inputSchema: {
      type: "object",
      properties: {
        origins: {
          type: "array",
          items: { type: "string" },
          description: "List of starting addresses or coordinates.",
        },
        destinations: {
          type: "array",
          items: { type: "string" },
          description: "List of destination addresses or coordinates.",
        },
        mode: {
          type: "string",
          enum: ["driving", "walking", "bicycling", "transit"],
          description: "Mode of transport (default: driving).",
        },
        units: {
          type: "string",
          enum: ["metric", "imperial"],
          description: "Unit system to use for distance (default: metric).",
        },
      },
      required: ["origins", "destinations"],
    },
  },
];

const server = new Server(
  {
    name: "maps-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS,
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "get_directions": {
        const origin = String(args?.origin || "");
        const destination = String(args?.destination || "");
        const mode = (args?.mode as TravelMode) || TravelMode.driving;

        if (!origin || !destination) {
          throw new Error("Both 'origin' and 'destination' are required.");
        }

        const response = await mapsClient.directions({
          params: {
            origin,
            destination,
            mode,
            key: GOOGLE_MAPS_API_KEY,
          },
        });

        const routes = response.data.routes.map((route) => ({
          summary: route.summary,
          legs: route.legs.map((leg) => ({
            start_address: leg.start_address,
            end_address: leg.end_address,
            distance: leg.distance,
            duration: leg.duration,
            steps: leg.steps.map((step) => ({
              instructions: step.html_instructions,
              distance: step.distance,
              duration: step.duration,
              travel_mode: step.travel_mode,
            })),
          })),
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: response.data.status,
                  routes,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "search_places": {
        const query = String(args?.query || "");
        const location = args?.location ? String(args.location) : undefined;
        const radius = args?.radius ? Number(args.radius) : undefined;

        if (!query) {
          throw new Error("'query' is required.");
        }

        const response = await mapsClient.textSearch({
          params: {
            query,
            ...(location ? { location } : {}),
            ...(radius ? { radius } : {}),
            key: GOOGLE_MAPS_API_KEY,
          },
        });

        const places = response.data.results.map((place) => ({
          name: place.name,
          formatted_address: place.formatted_address,
          location: place.geometry?.location,
          rating: place.rating,
          user_ratings_total: place.user_ratings_total,
          place_id: place.place_id,
          types: place.types,
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: response.data.status,
                  places,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "geocode_address": {
        const address = String(args?.address || "");

        if (!address) {
          throw new Error("'address' is required.");
        }

        const response = await mapsClient.geocode({
          params: {
            address,
            key: GOOGLE_MAPS_API_KEY,
          },
        });

        const results = response.data.results.map((result) => ({
          formatted_address: result.formatted_address,
          location: result.geometry.location,
          place_id: result.place_id,
          types: result.types,
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: response.data.status,
                  results,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "distance_matrix": {
        const origins = Array.isArray(args?.origins)
          ? args.origins.map(String)
          : [];
        const destinations = Array.isArray(args?.destinations)
          ? args.destinations.map(String)
          : [];
        const mode = (args?.mode as TravelMode) || TravelMode.driving;
        const units =
          args?.units === "imperial"
            ? UnitSystem.imperial
            : UnitSystem.metric;

        if (origins.length === 0 || destinations.length === 0) {
          throw new Error("Both 'origins' and 'destinations' arrays are required.");
        }

        const response = await mapsClient.distancematrix({
          params: {
            origins,
            destinations,
            mode,
            units,
            key: GOOGLE_MAPS_API_KEY,
          },
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: response.data.status,
                  origin_addresses: response.data.origin_addresses,
                  destination_addresses: response.data.destination_addresses,
                  rows: response.data.rows,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    const errorMessage =
      error?.response?.data?.error_message ||
      error?.message ||
      String(error);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ error: errorMessage }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Google Maps MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
