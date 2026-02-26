import React from "react";
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import DynamicIslandToaster from "../dynamic-island-toaster";
import { useToast } from "@/hooks/use-toast";
import { X } from "lucide-react";

jest.mock("@/hooks/use-toast", () => ({
  useToast: jest.fn(),
}));
jest.mock("lucide-react", () => ({
  X: () => <svg />,
}));

const useToastMock = useToast as jest.Mock;

describe("DynamicIslandToaster", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders idle pill with no notifications when there are no toasts", async () => {
    useToastMock.mockReturnValue({ toasts: [] });
    render(<DynamicIslandToaster />);
    const status = await waitFor(() => screen.getByRole("status"));
    expect(status).toHaveAttribute("aria-label", "No notifications");
  });

  it("renders error toast with proper ARIA attributes on client", async () => {
    useToastMock.mockReturnValue({
      toasts: [
        {
          id: "1",
          title: "Error saving data",
          description: "Please try again",
          variant: "destructive",
        },
      ],
    });

    render(<DynamicIslandToaster />);

    const status = await waitFor(() => screen.getByRole("status"));
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-atomic", "true");
    expect(status).toHaveAttribute("aria-label", "Notification");
    expect(
      screen.getByText("Error saving data")
    ).toBeInTheDocument();
    expect(screen.getByText("Please try again")).toBeInTheDocument();
  });

  it("ignores success toasts and stays in idle state", async () => {
    useToastMock.mockReturnValue({
      toasts: [
        {
          id: "1",
          title: "Saved",
          description: "All good",
          variant: "success",
        },
      ],
    });

    render(<DynamicIslandToaster />);
    const status = await waitFor(() => screen.getByRole("status"));
    expect(status).toHaveAttribute("aria-label", "No notifications");
    expect(screen.queryByText("Saved")).toBeNull();
  });
});
