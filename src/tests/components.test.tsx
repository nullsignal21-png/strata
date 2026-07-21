import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TransactionTable } from "@/components/TransactionTable";
import { UploadCsvCard } from "@/components/UploadCsvCard";
import type { TransactionRow } from "@/lib/metrics";

afterEach(() => {
  vi.restoreAllMocks();
});

const jobs = [{ id: "job_1", name: "Patel HVAC" }];

const transaction: TransactionRow = {
  id: "transaction_1",
  date: "2026-06-01T00:00:00.000Z",
  merchant: "Home Depot",
  description: "Home Depot Cary Patel materials",
  memo: null,
  amount: 123.45,
  direction: "expense",
  aiCategory: "Materials",
  confidence: 0.96,
  status: "needs_review",
  jobId: null,
  jobName: null,
  suggestedJobId: "job_1",
  suggestedJobName: "Patel HVAC",
  matchConfidence: 0.82,
  matchReason: "customer name matched",
  uploadBatchId: "batch_1",
  uploadBatchFilename: "sample.csv",
};

describe("UploadCsvCard", () => {
  it("shows upload preview details", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        mappedColumns: { date: "date", amount: "amount", description: "description" },
        detectedSignConvention: "negative_expense",
        totalRows: 1,
        validRowCount: 1,
        invalidRowCount: 0,
        duplicateCount: 0,
        skippedRows: 0,
        incomeTotal: 0,
        expenseTotal: 123.45,
        errors: [],
        preview: [{ ...transaction, rawCategory: null, duplicate: false }],
      }),
    } as Response);

    const user = userEvent.setup();
    const { container } = render(<UploadCsvCard />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(input, new File(["date,description,amount\n2026-06-01,test,-1"], "sample.csv", { type: "text/csv" }));

    expect(await screen.findByText(/Previewed 1 importable rows/)).toBeInTheDocument();
    expect(screen.getByText("Home Depot")).toBeInTheDocument();
    expect(screen.getByText("Expenses $123.45")).toBeInTheDocument();
  });
});

describe("TransactionTable", () => {
  it("edits a transaction category", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ transaction: { ...transaction, aiCategory: "Fuel & Vehicle", status: "reviewed" } }),
    } as Response);

    const user = userEvent.setup();
    render(<TransactionTable initialTransactions={[transaction]} jobs={jobs} />);

    await user.selectOptions(screen.getByDisplayValue("Materials"), "Fuel & Vehicle");

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/api/transactions", expect.any(Object)));
    expect(await screen.findByText("Transaction updated.")).toBeInTheDocument();
  });

  it("shows an empty state", () => {
    render(<TransactionTable initialTransactions={[]} jobs={jobs} />);

    expect(screen.getByText("No transactions match the current filters.")).toBeInTheDocument();
  });

  it("shows an error state when updating fails", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Invalid category." }),
    } as Response);

    const user = userEvent.setup();
    render(<TransactionTable initialTransactions={[transaction]} jobs={jobs} />);

    const reviewButtons = screen.getAllByRole("button", { name: /review/i });
    await user.click(reviewButtons[reviewButtons.length - 1]);

    expect(await screen.findByText("Invalid category.")).toBeInTheDocument();
  });
});
