import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import DeleteTripButton from "@/components/DeleteTripButton";

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: jest.fn(),
  }),
}));

jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      delete: () => ({
        eq: () => Promise.resolve({ data: null, error: null }),
      }),
    }),
  }),
}));

describe("DeleteTripButton", () => {
  it("renders Delete button initially", () => {
    render(<DeleteTripButton tripId="t1" />);
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("shows confirmation buttons after clicking Delete", () => {
    render(<DeleteTripButton tripId="t1" />);
    fireEvent.click(screen.getByText("Delete"));
    expect(screen.getByText("Confirm")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("hides confirmation and returns to Delete button on Cancel", () => {
    render(<DeleteTripButton tripId="t1" />);
    fireEvent.click(screen.getByText("Delete"));
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.getByText("Delete")).toBeInTheDocument();
    expect(screen.queryByText("Confirm")).not.toBeInTheDocument();
  });
});
