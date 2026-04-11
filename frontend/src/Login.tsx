import React, { useState } from "react";
import axios from "axios";

type Props = {
  setEmail: (email: string) => void;
};

const Login: React.FC<Props> = ({ setEmail }) => {
  const [email, setLocalEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [message, setMessage] = useState<string>("");

  const handleLogin = async () => {
    try {
      const apiBase = process.env.REACT_APP_API_URL || "http://localhost:5000";
      const res = await axios.post(`${apiBase}/auth/login`, {
        email,
        password,
      });

      setMessage(res.data.message);
      setEmail(email); // pass email to OTP page
    } catch (error: any) {
      setMessage(error.response?.data?.message || "Login failed");
    }
  };

  return (
    <div className="container">
      <h2>Login</h2>

      <input
        type="email"
        placeholder="Enter email"
        value={email}
        onChange={(e) => setLocalEmail(e.target.value)}
      />

      <input
        type="password"
        placeholder="Enter password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button onClick={handleLogin}>Login</button>

      {message && <p>{message}</p>}
    </div>
  );
};

export default Login;