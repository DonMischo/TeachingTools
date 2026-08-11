import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FirstRunSetup } from "@/components/FirstRunSetup";
import * as apiModule from "@/lib/api";
import { AuthProvider } from "@/contexts/AuthContext";
import { makeTeacher } from "./helpers";

const mockTeacher = makeTeacher({ first_name: "", last_name: "admin", role: "admin" });

function renderSetup(onComplete = vi.fn()) {
  return render(
    <AuthProvider>
      <FirstRunSetup onComplete={onComplete} />
    </AuthProvider>
  );
}

async function fillForm(username = "admin", pw = "secure123", confirm = "secure123") {
  await userEvent.type(screen.getByRole("textbox"), username);
  const [pwField, confirmField] = document.querySelectorAll<HTMLInputElement>('input[type="password"]');
  await userEvent.type(pwField, pw);
  await userEvent.type(confirmField, confirm);
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("FirstRunSetup", () => {
  it("renders a welcome heading", () => {
    renderSetup();
    expect(screen.getByText(/willkommen/i)).toBeInTheDocument();
  });

  it("has a single username field and two password fields", () => {
    renderSetup();
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(document.querySelectorAll('input[type="password"]')).toHaveLength(2);
  });

  it("calls the API and onComplete when the form is submitted correctly", async () => {
    vi.spyOn(apiModule.api.setup, "createAdmin").mockResolvedValue({
      access_token: "tok",
      token_type: "bearer",
      teacher: mockTeacher,
    });
    const onComplete = vi.fn();
    renderSetup(onComplete);

    await fillForm();
    await userEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
    expect(apiModule.api.setup.createAdmin).toHaveBeenCalledWith("admin", "secure123");
  });

  it("stores the token in localStorage after successful setup", async () => {
    vi.spyOn(apiModule.api.setup, "createAdmin").mockResolvedValue({
      access_token: "tok123",
      token_type: "bearer",
      teacher: mockTeacher,
    });
    renderSetup();

    await fillForm();
    await userEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(localStorage.getItem("hp_token")).toBe("tok123"));
  });

  it("shows an error when passwords do not match", async () => {
    renderSetup();
    await fillForm("admin", "password1", "password2");
    await userEvent.click(screen.getByRole("button"));

    expect(screen.getByText(/stimmen nicht überein/i)).toBeInTheDocument();
  });

  it("shows an error when the password is too short", async () => {
    renderSetup();
    await fillForm("admin", "abc", "abc");
    await userEvent.click(screen.getByRole("button"));

    expect(screen.getByText(/mindestens 6/i)).toBeInTheDocument();
  });

  it("shows an error when the username is empty", async () => {
    renderSetup();
    const [pwField, confirmField] = document.querySelectorAll<HTMLInputElement>('input[type="password"]');
    await userEvent.type(pwField, "secure123");
    await userEvent.type(confirmField, "secure123");
    await userEvent.click(screen.getByRole("button"));

    expect(screen.getByText(/benutzernamen/i)).toBeInTheDocument();
  });

  it("does not call the API when validation fails", async () => {
    const spy = vi.spyOn(apiModule.api.setup, "createAdmin");
    renderSetup();
    await fillForm("admin", "short", "short");
    await userEvent.click(screen.getByRole("button"));

    expect(spy).not.toHaveBeenCalled();
  });

  it("shows an error message when the API call fails", async () => {
    vi.spyOn(apiModule.api.setup, "createAdmin").mockRejectedValue(new Error("Setup already complete"));
    renderSetup();

    await fillForm();
    await userEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(screen.getByText(/setup already complete/i)).toBeInTheDocument());
  });

  it("disables the submit button while the request is in flight", async () => {
    vi.spyOn(apiModule.api.setup, "createAdmin").mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ access_token: "t", token_type: "bearer", teacher: mockTeacher }), 200))
    );
    renderSetup();

    await fillForm();
    await userEvent.click(screen.getByRole("button"));

    expect(screen.getByRole("button")).toBeDisabled();
  });
});
