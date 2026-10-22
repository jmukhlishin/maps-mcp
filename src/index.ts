#!/usr/bin/env node

import express, { Request, Response } from "express";
import cors from "cors";
import axios from "axios";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from "dotenv";

dotenv.config();

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const PORT = Number(process.env.PORT) || 3300;

if (!GOOGLE_MAPS_API_KEY) {
  console.error("Error: GOOGLE_MAPS_API_KEY environment variable is required.");
  process.exit(1);
}

/**
 * Helper to convert an address or "lat,lng" coordinate string into a Routes API v2 Waypoint object.
 */
function buildWaypoint(input: string) {
  const trimmed = input.trim();
  const coordMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (coordMatch) {
    return {
      location: {
        latLng: {
          latitude: parseFloat(coordMatch[1]),
          longitude: parseFloat(coordMatch[2]),
        },
      },
    };
  }
  return { address: trimmed };
}

/**
 * Normalize travelMode input to Google Routes API v2 RouteTravelMode enum:
 * 'DRIVE' | 'TWO_WHEELER' | 'BICYCLE' | 'WALK' | 'TRANSIT'
 */
function normalizeTravelMode(mode?: string): string {
  if (!mode) return "DRIVE";
  const upper = mode.trim().toUpperCase();
  switch (upper) {
    case "DRIVE":
    case "DRIVING":
      return "DRIVE";
    case "TWO_WHEELER":
    case "MOTORCYCLE":
    case "MOTOR":
      return "TWO_WHEELER";
    case "BICYCLE":
    case "BICYCLING":
      return "BICYCLE";
    case "WALK":
    case "WALKING":
      return "WALK";
    case "TRANSIT":
      return "TRANSIT";
    default:
      return "DRIVE";
  }
}

const TOOLS: Tool[] = [
  {
    name: "get_directions",
    description:
      "Get directions and route details between an origin and a destination using Google Routes API v2 (supports car, motorcycle/TWO_WHEELER, bicycle, walking, and transit).",
    inputSchema: {
      type: "object",
      properties: {
        origin: {
          type: "string",
          description:
            "The starting address, place name, or 'lat,lng' coordinates (e.g., '-6.2088,106.8456').",
        },
        destination: {
          type: "string",
          description:
            "The destination address, place name, or 'lat,lng' coordinates (e.g., '-6.1754,106.8272').",
        },
        travelMode: {
          type: "string",
          enum: [
            "DRIVE",
            "TWO_WHEELER",
            "BICYCLE",
            "WALK",
            "TRANSIT",
            "driving",
            "walking",
            "bicycling",
            "transit",
          ],
          description:
            "Mode of transport: 'DRIVE' (mobil), 'TWO_WHEELER' (motor), 'BICYCLE' (sepeda), 'WALK' (jalan kaki), or 'TRANSIT'. Default: 'DRIVE'.",
        },
        mode: {
          type: "string",
          description:
            "Alias for travelMode ('DRIVE', 'TWO_WHEELER', 'BICYCLE', 'WALK', 'TRANSIT').",
        },
      },
      required: ["origin", "destination"],
    },
  },
  {
    name: "search_places",
    description:
      "Search for places using a text query (e.g., restaurants, hotels, landmarks) via Google Places API (New) v1.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "The text string on which to search, for example: 'coffee shop in Jakarta'.",
        },
        location: {
          type: "string",
          description:
            "Optional 'latitude,longitude' around which to bias place results (e.g., '-6.2088,106.8456').",
        },
        radius: {
          type: "number",
          description:
            "Optional distance in meters within which to bias place results (default: 5000 when location is provided).",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "geocode_address",
    description:
      "Convert a human-readable address or place name into geographic coordinates (latitude and longitude) using Google Geocoding API.",
    inputSchema: {
      type: "object",
      properties: {
        address: {
          type: "string",
          description:
            "The street address or place name that you want to geocode.",
        },
      },
      required: ["address"],
    },
  },
  {
    name: "distance_matrix",
    description:
      "Calculate travel distance and time for multiple origins and destinations using Google Routes API v2 computeRouteMatrix.",
    inputSchema: {
      type: "object",
      properties: {
        origins: {
          type: "array",
          items: { type: "string" },
          description: "List of starting addresses or 'lat,lng' coordinates.",
        },
        destinations: {
          type: "array",
          items: { type: "string" },
          description: "List of destination addresses or 'lat,lng' coordinates.",
        },
        travelMode: {
          type: "string",
          enum: [
            "DRIVE",
            "TWO_WHEELER",
            "BICYCLE",
            "WALK",
            "TRANSIT",
            "driving",
            "walking",
            "bicycling",
            "transit",
          ],
          description:
            "Mode of transport: 'DRIVE', 'TWO_WHEELER', 'BICYCLE', 'WALK', or 'TRANSIT' (default: 'DRIVE').",
        },
        mode: {
          type: "string",
          description: "Alias for travelMode.",
        },
      },
      required: ["origins", "destinations"],
    },
  },
];

function createMcpServer(): Server {
  const server = new Server(
    {
      name: "maps-mcp",
      version: "1.1.0",
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
          const rawMode = String(args?.travelMode || args?.mode || "DRIVE");
          const travelMode = normalizeTravelMode(rawMode);

          if (!origin || !destination) {
            throw new Error("Both 'origin' and 'destination' are required.");
          }

          const body: Record<string, any> = {
            origin: buildWaypoint(origin),
            destination: buildWaypoint(destination),
            travelMode,
            computeAlternativeRoutes: false,
            languageCode: "id-ID",
            units: "METRIC",
          };

          if (travelMode === "DRIVE" || travelMode === "TWO_WHEELER") {
            body.routingPreference = "TRAFFIC_AWARE";
          }

          const response = await axios.post(
            "https://routes.googleapis.com/directions/v2:computeRoutes",
            body,
            {
              headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY!,
                "X-Goog-FieldMask":
                  "routes.duration,routes.distanceMeters,routes.polyline,routes.legs",
              },
            }
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    travelMode,
                    routes: response.data.routes || [],
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case "search_places": {
          const textQuery = String(args?.query || "");
          const location = args?.location ? String(args.location) : undefined;
          const radius = args?.radius ? Number(args.radius) : 5000;

          if (!textQuery) {
            throw new Error("'query' is required.");
          }

          const body: Record<string, any> = {
            textQuery,
          };

          if (location) {
            const coordMatch = location
              .trim()
              .match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
            if (coordMatch) {
              body.locationBias = {
                circle: {
                  center: {
                    latitude: parseFloat(coordMatch[1]),
                    longitude: parseFloat(coordMatch[2]),
                  },
                  radius,
                },
              };
            }
          }

          const response = await axios.post(
            "https://places.googleapis.com/v1/places:searchText",
            body,
            {
              headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY!,
                "X-Goog-FieldMask":
                  "places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount",
              },
            }
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    places: response.data.places || [],
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

          const response = await axios.get(
            "https://maps.googleapis.com/maps/api/geocode/json",
            {
              params: {
                address,
                key: GOOGLE_MAPS_API_KEY!,
              },
            }
          );

          if (
            response.data.status !== "OK" &&
            response.data.status !== "ZERO_RESULTS"
          ) {
            throw new Error(
              response.data.error_message ||
                `Geocoding API returned status: ${response.data.status}`
            );
          }

          const results = (response.data.results || []).map((result: any) => ({
            formatted_address: result.formatted_address,
            location: result.geometry?.location,
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
          const rawMode = String(args?.travelMode || args?.mode || "DRIVE");
          const travelMode = normalizeTravelMode(rawMode);

          if (origins.length === 0 || destinations.length === 0) {
            throw new Error(
              "Both 'origins' and 'destinations' arrays are required."
            );
          }

          const body: Record<string, any> = {
            origins: origins.map((o) => ({ waypoint: buildWaypoint(o) })),
            destinations: destinations.map((d) => ({
              waypoint: buildWaypoint(d),
            })),
            travelMode,
          };

          if (travelMode === "DRIVE" || travelMode === "TWO_WHEELER") {
            body.routingPreference = "TRAFFIC_AWARE";
          }

          const response = await axios.post(
            "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
            body,
            {
              headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY!,
                "X-Goog-FieldMask":
                  "originIndex,destinationIndex,duration,distanceMeters,status,condition",
              },
            }
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    travelMode,
                    origins,
                    destinations,
                    matrix: response.data,
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
      const apiError =
        error?.response?.data?.error?.message ||
        error?.response?.data?.error_message ||
        (error?.response?.data ? JSON.stringify(error.response.data) : null) ||
        error?.message ||
        String(error);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: apiError }, null, 2),
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

const app = express();
app.use(cors());

// Store active SSE transports by sessionId
const transports = new Map<string, SSEServerTransport>();

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "maps-mcp",
    version: "1.1.0",
    activeSessions: transports.size,
  });
});

// SSE connection initialization endpoint
app.get("/sse", async (req: Request, res: Response) => {
  console.log("New SSE connection established");
  const transport = new SSEServerTransport("/messages", res);
  const server = createMcpServer();

  transports.set(transport.sessionId, transport);

  res.on("close", () => {
    console.log(`SSE connection closed for session: ${transport.sessionId}`);
    transports.delete(transport.sessionId);
    server.close().catch(() => {});
  });

  await server.connect(transport);
});

// Endpoint to receive messages from MCP client
app.post("/messages", async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string | undefined;

  let transport: SSEServerTransport | undefined;
  if (sessionId) {
    transport = transports.get(sessionId);
  } else if (transports.size === 1) {
    transport = Array.from(transports.values())[0];
  }

  if (!transport) {
    res.status(400).json({ error: "No active SSE transport found for sessionId" });
    return;
  }

  await transport.handlePostMessage(req, res);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Google Maps MCP Server (SSE) listening on http://0.0.0.0:${PORT}`);
  console.log(`- SSE Endpoint: http://0.0.0.0:${PORT}/sse`);
  console.log(`- Messages Endpoint: http://0.0.0.0:${PORT}/messages`);
  console.log(`- Health Endpoint: http://0.0.0.0:${PORT}/health`);
});
