import React, { useState } from "react";
import "./App.css";

import Register from "./Register";
import Login from "./Login";
import VerifyOtp from "./VerifyOtp";

function App() {
  const [email, setEmail] = useState<string>("");
  const [step, setStep] = useState<"register" | "login" | "otp">("register");

  return (
    <div>
      <h1 style={{ textAlign: "center" }}>Auth System 🔐</h1>

      {/* Navigation Buttons */}
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <button onClick={() => setStep("register")}>Register</button>
        <button onClick={() => setStep("login")}>Login</button>
      </div>

      {/* Screens */}
      {step === "register" && <Register />}

      {step === "login" && (
        <Login
          setEmail={(email: string) => {
            setEmail(email);
            setStep("otp");
          }}
        />
      )}

      {step === "otp" && <VerifyOtp email={email} />}
    </div>
  );
}

export default App;