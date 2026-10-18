import React, { useState, useEffect } from "react";
import { cloud, sharedRequired } from "./cloud";

export function SharedAccess({ children }) {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(Boolean(cloud));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!cloud) return;
    let active = true;
    cloud.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        setSession(data.session);
        setChecking(false);
        if (error)
          setError("Couldn’t restore your sign-in. Please sign in again.");
      })
      .catch(() => {
        if (active) {
          setChecking(false);
          setError("Couldn’t connect. Please try again.");
        }
      });
    const {
      data: { subscription },
    } = cloud.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setSession(session);
        setChecking(false);
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  if (!cloud && !sharedRequired) return children;
  if (cloud && session)
    return <React.Fragment key={session.user.id}>{children}</React.Fragment>;
  return (
    <main className="access-screen">
      <section className="access-card">
        <div className="brand">
          <span className="brand-icon">♠</span>
          <span>soberSem3</span>
        </div>
        {!cloud ? (
          <>
            <h1>Shared table</h1>
            <p>The owner hasn’t connected the shared table yet.</p>
          </>
        ) : checking ? (
          <p role="status">Connecting…</p>
        ) : (
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
              } catch {
                setError(
                  "Couldn’t sign in. Check your email and password, or ask the table owner for access.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <h1>Sign in</h1>
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
            <button className="button primary" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
