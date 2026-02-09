import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import TripCreator from "@/components/TripCreator";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
}));

// Mock supabase client
jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({}),
}));

describe("TripCreator", () => {
  it("renders the form with textarea and button", () => {
    render(<TripCreator />);
    expect(screen.getByPlaceholderText(/describe your trip/i)).toBeInTheDocument();
    expect(screen.getByText("Plan My Trip")).toBeInTheDocument();
  });

  it("disables submit button when textarea is empty", () => {
    render(<TripCreator />);
    expect(screen.getByText("Plan My Trip")).toBeDisabled();
  });

  it("enables submit button when textarea has content", () => {
    render(<TripCreator />);
    const textarea = screen.getByPlaceholderText(/describe your trip/i);
    fireEvent.change(textarea, { target: { value: "Trip to Paris" } });
    expect(screen.getByText("Plan My Trip")).not.toBeDisabled();
  });
});
