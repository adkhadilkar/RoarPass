import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateTripSuggestion, TripAssistantRequest } from "./tripAssistantService";
import { callAiModel } from "./aiService";
import { Event } from "../models/Event";
import { FanProfile } from "../models/FanProfile";
import { CommunityTrip } from "../models/CommunityTrip";

// Mock the aiService module
vi.mock("./aiService", () => {
  return {
    callAiModel: vi.fn(),
  };
});

describe("tripAssistantService", () => {
  let mockRequest: TripAssistantRequest;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRequest = {
      locale: "en-US",
      rtl: false,
      fanProfile: {
        id: "fan-123",
        displayName: "John Doe",
        homeCountry: "US",
        communities: ["us-community"],
        locale: "en-US",
        verification: {
          tier: "unverified",
          trustScore: 50,
        },
        isLocalHelper: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Adding interests for the test
        interests: ["music", "food"],
      } as unknown as FanProfile, // Cast as unknown as FanProfile to bypass strict type checking if models differ slightly in test env
      event: {
        id: "evt-1",
        slug: "cool-event",
        name: "Cool Event",
        startsAt: new Date().toISOString(),
        endsAt: new Date().toISOString(),
        venue: {
          id: "v-1",
          name: "The Arena",
          city: "New York",
          countryCode: "US",
        },
        countryCommunityId: "cc-us",
      } as unknown as Event,
    };
  });

  describe("generateTripSuggestion", () => {
    it("should return parsed suggestion for happy path without a trip", async () => {
      const mockAiResponse = JSON.stringify({
        summary: "A great trip",
        suggestedHelpers: [{ id: "helper-1", name: "Alice" }],
        itinerary: [{ day: 1, activities: ["Visit park"] }],
      });
      vi.mocked(callAiModel).mockResolvedValue(mockAiResponse);

      const result = await generateTripSuggestion(mockRequest);

      expect(callAiModel).toHaveBeenCalledOnce();

      // Check the prompt generation (without trip)
      const promptCallArg = vi.mocked(callAiModel).mock.calls[0][0];
      expect(promptCallArg).toContain("Event: Cool Event (cc-us)");
      expect(promptCallArg).toContain("Locale: en-US");
      expect(promptCallArg).toContain("Interests: music, food");
      expect(promptCallArg).toContain("No existing trip");

      // Check context
      const contextCallArg = vi.mocked(callAiModel).mock.calls[0][1];
      expect(contextCallArg).toEqual({
        locale: "en-US",
        rtl: false,
        fanProfile: {
          id: "fan-123",
          locale: "en-US",
          interests: ["music", "food"],
        },
      });

      expect(result).toEqual({
        summary: "A great trip",
        suggestedHelpers: [{ id: "helper-1", name: "Alice" }],
        itinerary: [{ day: 1, activities: ["Visit park"] }],
      });
    });

    it("should include trip id in prompt if trip is provided", async () => {
       const mockTrip = {
         id: "trip-456",
       } as unknown as CommunityTrip;

       mockRequest.trip = mockTrip;

       const mockAiResponse = JSON.stringify({
        summary: "Trip with existing plan",
       });
       vi.mocked(callAiModel).mockResolvedValue(mockAiResponse);

       await generateTripSuggestion(mockRequest);

       const promptCallArg = vi.mocked(callAiModel).mock.calls[0][0];
       expect(promptCallArg).toContain("Existing trip: trip-456");
       expect(promptCallArg).not.toContain("No existing trip");
    });

    it("should handle invalid JSON from AI gracefully", async () => {
      vi.mocked(callAiModel).mockResolvedValue("This is not valid JSON");

      const result = await generateTripSuggestion(mockRequest);

      expect(result).toEqual({
        summary: "",
        suggestedHelpers: [],
        itinerary: [],
      });
    });

    it("should provide defaults for missing fields in JSON", async () => {
       const mockAiResponse = JSON.stringify({
        summary: "Partial response",
        // missing suggestedHelpers and itinerary
       });
       vi.mocked(callAiModel).mockResolvedValue(mockAiResponse);

       const result = await generateTripSuggestion(mockRequest);

       expect(result).toEqual({
         summary: "Partial response",
         suggestedHelpers: [],
         itinerary: [],
       });
    });

    it("should provide default summary if missing but other fields exist", async () => {
       const mockAiResponse = JSON.stringify({
         suggestedHelpers: [{ id: "helper-2" }],
         itinerary: [{ day: 2, activities: ["Concert"] }],
       });
       vi.mocked(callAiModel).mockResolvedValue(mockAiResponse);

       const result = await generateTripSuggestion(mockRequest);

       expect(result).toEqual({
         summary: "", // because String(undefined) is "undefined", we might want to check this behavior, but let's test the current implementation
         suggestedHelpers: [{ id: "helper-2" }],
         itinerary: [{ day: 2, activities: ["Concert"] }],
       });
    });
  });
});
