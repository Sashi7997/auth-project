import React, { useState } from "react";
import axios from "axios";

const Register = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [qr, setQr] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleRegister = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    if (!email || !password) {
      setErrorMsg("Please provide email and password");
      return;
    }

    try {
      setLoading(true);
      const res = await axios.post("http://localhost:5000/auth/register", {
        email,
        password,
      });

      setQr(res.data.qrCode || "");
      setSuccessMsg(res.data.message || "Registered successfully");
    } catch (err: any) {
      console.error(err);
      // Prefer server-provided message when available
      const serverMessage = err?.response?.data?.message;
      if (serverMessage) setErrorMsg(serverMessage);
      else if (err.message) setErrorMsg(err.message);
      else setErrorMsg("Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <h2>Register</h2>

      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ display: "block", width: "100%", marginBottom: 8 }}
      />

      <input
        placeholder="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ display: "block", width: "100%", marginBottom: 8 }}
      />

      <button onClick={handleRegister} disabled={loading}>
        {loading ? "Registering..." : "Register"}
      </button>

      {errorMsg && (
        <div style={{ color: "#b00020", marginTop: 12 }}>{errorMsg}</div>
      )}

      {successMsg && (
        <div style={{ color: "green", marginTop: 12 }}>{successMsg}</div>
      )}

      {qr && (
        <div style={{ marginTop: 16 }}>
          <p>Scan this QR with your authenticator app:</p>
          <img src={qr} alt="QR Code" style={{ maxWidth: "100%" }} />
        </div>
      )}
    </div>
  );
};

export default Register;