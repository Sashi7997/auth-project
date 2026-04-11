import React, { useState } from "react";
import axios from "axios";

type Props = {
  email: string;
};

const VerifyOtp: React.FC<Props> = ({ email }) => {
  const [otp, setOtp] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [token, setToken] = useState<string>("");

  const handleVerify = async () => {
    try {
      const res = await axios.post("http://localhost:5000/auth/verify-otp", {
        email,
        otp,
      });

      setMessage("Login successful 🎉");
      setToken(res.data.token);
    } catch (error: any) {
      setMessage(error.response?.data?.message || "Invalid OTP");
    }
  };

  return (
    <div className="container">
      <h2>Enter OTP</h2>

      <input
        type="text"
        placeholder="Enter OTP"
        value={otp}
        onChange={(e) => setOtp(e.target.value)}
      />

      <button onClick={handleVerify}>Verify</button>

      {message && <p>{message}</p>}

      {token && (
        <div>
          <p><strong>Your Token:</strong></p>
          <textarea value={token} readOnly rows={4} />
        </div>
      )}
    </div>
  );
};

export default VerifyOtp;