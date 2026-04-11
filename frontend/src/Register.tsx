import React, { useState } from "react";
import axios from "axios";

const Register = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [qr, setQr] = useState("");

  const handleRegister = async () => {
    const res = await axios.post("http://localhost:5000/auth/register", {
      email,
      password,
    });

    setQr(res.data.qrCode);
  };

  return (
    <div>
      <h2>Register</h2>
      <input placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
      <input placeholder="Password" onChange={(e) => setPassword(e.target.value)} />
      <button onClick={handleRegister}>Register</button>

      {qr && <img src={qr} alt="QR Code" />}
    </div>
  );
};

export default Register;