// routes/ProtectedRoute.test.js
//
// QE finding: ProtectedRoute only checks whether a token exists in
// localStorage -- it does not check role or permission. Combined with
// App.js routing every hr/* path through this same single guard, any
// authenticated user (any role) can reach /hr/payroll, /hr/users, etc.
// directly by URL.
//
// The first test below documents CURRENT (gap) behavior and passes
// today -- it exists so that if someone "fixes" this by making
// ProtectedRoute role-aware, this test will start failing and force a
// deliberate update rather than a silent behavior change going unnoticed.
//
// The second test (xfail) documents the DESIRED behavior once role-based
// route guarding is added -- flip it to a normal assertion and delete
// the first test once that's implemented.

import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import { HRAuthProvider } from "../contexts/HRAuthContext";

function renderProtected(initialPath, tokenPayload) {
  if (tokenPayload) {
    localStorage.setItem("access_token", tokenPayload);
  } else {
    localStorage.removeItem("access_token");
  }
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <HRAuthProvider>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route
          path="/hr/payroll"
          element={
            <ProtectedRoute>
              <div>Payroll Screen Content</div>
            </ProtectedRoute>
          }
        />
      </Routes>
      </HRAuthProvider>
    </MemoryRouter>
  );
}

afterEach(() => {
  localStorage.clear();
});

test("CURRENT BEHAVIOR (gap): any valid-looking token, regardless of role, reaches a sensitive route", () => {
  // token content is never actually validated client-side -- any
  // non-empty string in localStorage is treated as "authenticated"
  renderProtected("/hr/payroll", "fake-token-no-role-claim-at-all");
  expect(screen.getByText("Payroll Screen Content")).toBeInTheDocument();
});

test("no token at all still correctly redirects to login", () => {
  renderProtected("/hr/payroll", null);
  expect(screen.getByText("Login Page")).toBeInTheDocument();
});

test.skip("DESIRED: a token without payroll access should not reach the payroll route", () => {
  // Enable once ProtectedRoute (or a new RoleProtectedRoute) actually
  // decodes the JWT / checks HRAuthContext's can("payroll_read") before
  // rendering children, matching the fix direction noted in the QE review.
});