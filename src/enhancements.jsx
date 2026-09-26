import React, { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Camera,
  Mic,
  Square,
  Plus,
  LoaderCircle,
  CheckCircle2,
  Phone,
  X,
} from "lucide-react";
import { api } from "./api";
const readData = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
export function SmartOrder({ session, menu, onAdd, notify }) {
  const [open, setOpen] = useState(false),
    [text, setText] = useState(""),
    [media, setMedia] = useState(null),
    [recording, setRecording] = useState(false),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState(null),
    [error, setError] = useState("");
  const recorder = useRef(null),
    stream = useRef(null),
    timer = useRef(null),
    mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
      clearTimeout(timer.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  async function record() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError(
        "Recording is unavailable in this browser. Type your order below.",
      );
      return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      if (!mounted.current) {
        stream.current.getTracks().forEach((t) => t.stop());
        return;
      }
      const mime = ["audio/webm", "audio/mp4", "audio/ogg"].find((m) =>
        MediaRecorder.isTypeSupported(m),
      );
      const r = new MediaRecorder(
        stream.current,
        mime ? { mimeType: mime } : undefined,
      );
      recorder.current = r;
      const chunks = [];
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      r.onstop = async () => {
        clearTimeout(timer.current);
        stream.current?.getTracks().forEach((t) => t.stop());
        if (!mounted.current) return;
        setRecording(false);
        const blob = new Blob(chunks, { type: r.mimeType.split(";")[0] });
        if (blob.size > 4_000_000) {
          setError("Recording is too large. Please try a shorter request.");
          return;
        }
        setMedia({
          mimeType: blob.type,
          data: await readData(blob),
          name: "Your voice order",
        });
        setResult(null);
      };
      r.start();
      setRecording(true);
      timer.current = setTimeout(() => {
        if (r.state === "recording") r.stop();
      }, 20000);
    } catch {
      setError(
        "Microphone access was not available. You can type your order instead.",
      );
    }
  }
  return (
    <section className="smart-order">
      <button
        className="smart-order-toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="ai-symbol">
          <Sparkles size={21} />
        </span>
        <span>
          <strong>A little help choosing?</strong>
          <small>Say it, show it, or describe your craving.</small>
        </span>
        <span className="badge green">Gemini</span>
      </button>
      {open && (
        <div className="smart-order-body">
          {!session.aiEnabled && (
            <p className="demo-banner">
              Gemini is not connected. Photo and voice ordering will be
              available once the café connects its API key.
            </p>
          )}
          <label className="field">
            What would you like?
            <textarea
              placeholder="Two flat whites with oat milk and a butter croissant…"
              value={text}
              maxLength={1500}
              onChange={(e) => {
                setText(e.target.value);
                setResult(null);
              }}
            />
          </label>
          <div className="ai-inputs">
            <label className="secondary upload-button">
              <Camera size={17} />
              Add a photo
              <input
                aria-label="Upload food photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setError("");
                  if (file.size > 4_000_000) {
                    setError("Choose an image smaller than 4 MB.");
                    return;
                  }
                  if (
                    !["image/jpeg", "image/png", "image/webp"].includes(
                      file.type,
                    )
                  ) {
                    setError("Choose a JPEG, PNG or WebP image.");
                    return;
                  }
                  setMedia({
                    mimeType: file.type,
                    data: await readData(file),
                    name: file.name,
                  });
                  setResult(null);
                }}
              />
            </label>
            <button
              className={recording ? "primary" : "secondary"}
              disabled={busy}
              onClick={() => (recording ? recorder.current?.stop() : record())}
            >
              {recording ? <Square size={17} /> : <Mic size={17} />}{" "}
              {recording ? "Stop recording" : "Record order"}
            </button>
          </div>
          {recording && (
            <p role="status" className="muted">
              Listening… Recording stops after 20 seconds.
            </p>
          )}
          {media && (
            <div className="ai-attachment">
              <span>{media.name}</span>
              <button
                className="icon-button"
                aria-label="Remove attachment"
                onClick={() => setMedia(null)}
              >
                <X size={16} />
              </button>
            </div>
          )}
          <p className="muted ai-disclosure">
            When you tap Ask Gemini, your request and attached photo or
            recording are sent to Google for analysis. Suggestions may be wrong;
            review before adding. Photos can’t verify allergens.
          </p>
          <div className="ai-inputs">
            <button
              className="primary"
              disabled={
                busy ||
                recording ||
                !session.aiEnabled ||
                (!text.trim() && !media)
              }
              onClick={async () => {
                setBusy(true);
                setError("");
                setResult(null);
                try {
                  setResult(await api("/ai/suggest", { text, media }));
                } catch (e) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <Sparkles size={17} />
              )}
              Ask Gemini
            </button>
            {!session.aiEnabled && session.demo && (
              <button
                className="secondary"
                onClick={() => {
                  setResult({
                    sample: true,
                    message: "Sample draft — not generated from your input.",
                    items: [
                      { id: "flat-white", milk: "Oat", quantity: 2 },
                      { id: "croissant", milk: "Standard", quantity: 1 },
                    ],
                  });
                  setError("");
                }}
              >
                Try sample draft
              </button>
            )}
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {result && (
            <div className="ai-result" aria-live="polite">
              <h3>Review your proposed order</h3>
              <p>{result.message}</p>
              {result.transcript && (
                <blockquote>“{result.transcript}”</blockquote>
              )}
              {result.items.map((item, i) => (
                <div key={i}>
                  <span>
                    {item.quantity}×{" "}
                    {menu.find((m) => m.id === item.id)?.name || item.id}
                  </span>
                  <small>
                    {item.milk === "Standard"
                      ? "Original recipe"
                      : `${item.milk} milk`}
                  </small>
                </div>
              ))}
              {!!result.items.length && (
                <button
                  className="primary full"
                  onClick={() => {
                    const unavailable = result.items.some(
                      (i) => !menu.find((m) => m.id === i.id)?.available,
                    );
                    if (unavailable) {
                      setError(
                        "An item is now unavailable. Please choose from the menu.",
                      );
                      return;
                    }
                    for (const i of result.items)
                      onAdd(
                        menu.find((m) => m.id === i.id),
                        i.milk,
                        i.quantity,
                      );
                    setResult(null);
                    notify(
                      "Reviewed items added. Check your cart before placing the order.",
                    );
                  }}
                >
                  <Plus size={17} />
                  Add reviewed items to cart
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
export function PhoneLogin({ session, onSession, notify }) {
  const [phone, setPhone] = useState(""),
    [code, setCode] = useState(""),
    [consent, setConsent] = useState(false),
    [confirmation, setConfirmation] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const verifier = useRef(null),
    container = useRef(null),
    auth = useRef(null);
  useEffect(() => () => verifier.current?.clear(), []);
  async function reload() {
    onSession(await api("/session", {}));
  }
  return (
    <section className="phone-login">
      <div className="phone-login-title">
        <Phone size={23} />
        <div>
          <h2>
            {session.account ? "Welcome back." : "Your visits, together."}
          </h2>
          <p>
            {session.account
              ? `Verified phone ending ${session.account.phoneLast4}`
              : "Sign in with a one-time code to access your orders across devices."}
          </p>
        </div>
      </div>
      {session.account ? (
        <button
          className="secondary"
          onClick={async () => {
            await api("/auth/logout", {});
            if (auth.current) {
              const { signOut } = await import("firebase/auth");
              await signOut(auth.current);
            }
            await reload();
            notify("Signed out. Your account orders stay private.");
          }}
        >
          Sign out
        </button>
      ) : (
        <>
          {!session.firebaseConfig && (
            <p className="demo-banner">
              Phone login needs Firebase configuration. You can continue
              ordering as a guest.
            </p>
          )}
          <label className="field">
            Phone number
            <input
              type="tel"
              autoComplete="tel"
              placeholder="+91 98765 43210"
              value={phone}
              disabled={!!confirmation || busy}
              onChange={(e) => setPhone(e.target.value.replace(/[\s()-]/g, ""))}
            />
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={consent}
              disabled={busy || !!confirmation}
              onChange={(e) => setConsent(e.target.checked)}
            />
            Send me a login code. Google processes this number for
            authentication and abuse prevention.
          </label>
          <div ref={container} />
          {confirmation ? (
            <>
              <label className="field">
                Verification code
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  maxLength={6}
                  placeholder="6-digit code"
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                />
              </label>
              <button
                className="primary"
                disabled={busy || code.length !== 6}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const user = await confirmation.confirm(code);
                    await api("/auth/firebase", {
                      idToken: await user.user.getIdToken(true),
                    });
                    setConfirmation(null);
                    setCode("");
                    await reload();
                    notify(
                      "Phone verified. Your orders are linked to your account.",
                    );
                  } catch (e) {
                    setError(
                      e.message?.includes("Firebase")
                        ? "That code is invalid or expired. Please try again."
                        : e.message,
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={17} />
                ) : (
                  <CheckCircle2 size={17} />
                )}
                Verify & sign in
              </button>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  setConfirmation(null);
                  setCode("");
                  verifier.current?.clear();
                  verifier.current = null;
                }}
              >
                Use another number / resend
              </button>
            </>
          ) : (
            <button
              className="primary"
              disabled={
                !session.firebaseConfig ||
                busy ||
                !consent ||
                !/^\+[1-9]\d{7,14}$/.test(phone)
              }
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const [
                    { getApps, initializeApp },
                    { getAuth, RecaptchaVerifier, signInWithPhoneNumber },
                  ] = await Promise.all([
                    import("firebase/app"),
                    import("firebase/auth"),
                  ]);
                  const app =
                    getApps().find((a) => a.name === "cafe-auth") ||
                    initializeApp(session.firebaseConfig, "cafe-auth");
                  auth.current = getAuth(app);
                  verifier.current?.clear();
                  verifier.current = new RecaptchaVerifier(
                    auth.current,
                    container.current,
                    { size: "normal" },
                  );
                  await verifier.current.render();
                  setConfirmation(
                    await signInWithPhoneNumber(
                      auth.current,
                      phone,
                      verifier.current,
                    ),
                  );
                } catch {
                  setError(
                    "Could not send a code. Check the phone number or try again later.",
                  );
                  verifier.current?.clear();
                  verifier.current = null;
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <Phone size={17} />
              )}
              Send verification code
            </button>
          )}
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
