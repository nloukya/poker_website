import React, { createContext, useContext, useState, useEffect } from "react";
import { cloud, sharedRequired } from "./cloud";

const AccessContext = createContext({ canEdit: !cloud });
export const useTableAccess = () => useContext(AccessContext);

export function SharedAccess({ children }) {
  const [session, setSession] = useState(null);
  useEffect(() => {
    if (!cloud) return;
    let active = true;
    cloud.auth
      .getSession()
      .then(({ data }) => {
        if (active) setSession(data.session);
      })
      .catch(() => {});
    const {
      data: { subscription },
    } = cloud.auth.onAuthStateChange((_event, session) => {
      if (active) setSession(session);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  if (!cloud && sharedRequired)
    return (
      <main className="access-screen">
        <section className="access-card">
          <div className="brand">
            <span className="brand-icon">♠</span>
            <span>soberSem3</span>
          </div>
          <h1>Shared table</h1>
          <p>The owner hasn’t connected the shared table yet.</p>
        </section>
      </main>
    );
  return (
    <AccessContext.Provider value={{ canEdit: !cloud || Boolean(session) }}>
      {children}
    </AccessContext.Provider>
  );
}

export function SignInForm({ onSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          const { error } = await cloud.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
          if (error) throw error;
          setPassword("");
          onSuccess();
        } catch {
          setError(
            "Couldn’t sign in. Check your email and password, or ask the table owner for access.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Sign in to edit</h2>
      <label className="form-label">
        Email
        <input
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>
      <label className="form-label">
        Password
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button className="button primary" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </div>
    </form>
  );
}
