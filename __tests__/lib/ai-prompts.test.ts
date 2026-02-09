import { buildSuggestionsPrompt, buildItineraryPrompt, buildChatPrompt, buildModifyPlanPrompt } from "@/lib/ai/prompts";

describe("buildSuggestionsPrompt", () => {
  it("includes city name in the prompt", () => {
    const prompt = buildSuggestionsPrompt("Tokyo", "Japan", []);
    expect(prompt).toContain("Tokyo");
    expect(prompt).toContain("Japan");
  });

  it("includes kid-friendly note when young children are present", () => {
    const travelers = [
      { name: "Parent", age: 35 },
      { name: "Child", age: 5 },
    ];
    const prompt = buildSuggestionsPrompt("Paris", "France", travelers);
    expect(prompt).toContain("kid-friendly");
    expect(prompt).toContain("young children");
  });

  it("does not include kid-friendly note for adult-only trips", () => {
    const travelers = [
      { name: "Adult 1", age: 30 },
      { name: "Adult 2", age: 28 },
    ];
    const prompt = buildSuggestionsPrompt("Paris", "France", travelers);
    expect(prompt).not.toContain("young children");
  });

  it("lists traveler names and ages", () => {
    const travelers = [{ name: "Alice", age: 25 }];
    const prompt = buildSuggestionsPrompt("Rome", null, travelers);
    expect(prompt).toContain("Alice");
    expect(prompt).toContain("age 25");
  });
});

describe("buildItineraryPrompt", () => {
  it("includes city name and date range", () => {
    const prompt = buildItineraryPrompt(
      "Santiago",
      "2026-07-10",
      "2026-07-14",
      [],
      [],
      [],
      null
    );
    expect(prompt).toContain("Santiago");
    expect(prompt).toContain("2026-07-10");
    expect(prompt).toContain("2026-07-14");
  });

  it("includes arrival time note when provided", () => {
    const prompt = buildItineraryPrompt(
      "Santiago",
      "2026-07-10",
      "2026-07-14",
      [],
      [],
      [],
      "14:30"
    );
    expect(prompt).toContain("arrival is at 14:30");
  });

  it("lists available attractions and restaurants", () => {
    const attractions = [
      { id: "a1", name: "Museum", opening_time: "09:00", closing_time: "17:00", duration_minutes: 90, is_kid_friendly: true, category: "museum" },
    ];
    const restaurants = [
      { id: "r1", name: "Bistro", opening_time: "12:00", closing_time: "22:00", cuisine_type: "French", is_kid_friendly: true },
    ];
    const prompt = buildItineraryPrompt("Paris", "2026-07-10", "2026-07-14", attractions, restaurants, [], null);
    expect(prompt).toContain("Museum");
    expect(prompt).toContain("Bistro");
  });
});

describe("buildModifyPlanPrompt", () => {
  it("includes the modification request", () => {
    const prompt = buildModifyPlanPrompt(
      "Replace museum with park",
      "Tokyo",
      [],
      [],
      [],
      "city-123"
    );
    expect(prompt).toContain("Replace museum with park");
    expect(prompt).toContain("Tokyo");
  });

  it("includes current block information", () => {
    const blocks = [
      {
        id: "b1",
        date: "2026-07-10",
        block_type: "morning",
        attraction_id: "a1",
        attraction_name: "Art Museum",
        restaurant_id: null,
        restaurant_name: null,
      },
    ];
    const prompt = buildModifyPlanPrompt("change something", "Paris", blocks, [], [], "city-1");
    expect(prompt).toContain("Art Museum");
    expect(prompt).toContain("b1");
  });
});

describe("buildChatPrompt", () => {
  it("includes trip destination and dates", () => {
    const prompt = buildChatPrompt(
      "What should I pack?",
      "Tokyo, Kyoto",
      { start: "2026-07-10", end: "2026-07-20" },
      [],
      [],
      []
    );
    expect(prompt).toContain("Tokyo, Kyoto");
    expect(prompt).toContain("2026-07-10");
  });

  it("includes recent conversation history", () => {
    const history = [{ message: "Hello", response: "Hi there!" }];
    const prompt = buildChatPrompt("Follow up", "Paris", { start: "2026-07-10", end: "2026-07-15" }, [], [], history);
    expect(prompt).toContain("Hello");
    expect(prompt).toContain("Hi there!");
  });
});
