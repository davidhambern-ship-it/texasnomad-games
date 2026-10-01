import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { UserPlus } from "lucide-react";

import AuthLayout from "@/components/AuthLayout";

export default function Register() {
  const bernaverseSignup =
    "https://bernaverse.hireberna.app/?auth=signup&app=tng";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.location.replace(bernaverseSignup);
    }, 350);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <AuthLayout
      icon={UserPlus}
      title="Create Your BERNAverse Account"
      subtitle="New TNG accounts now begin in the BERNAverse so your membership, Tac wallet, and TNG identity stay connected."
      footer={
        <>
          Already have a TNG account?{" "}
          <Link to="/login" style={{ color: "#BC13FE", fontWeight: 600 }}>
            Log in
          </Link>
        </>
      }
    >
      <div
        style={{
          marginBottom: 20,
          padding: "14px",
          borderRadius: 10,
          border: "1px solid rgba(255,215,0,0.4)",
          background: "rgba(255,215,0,0.06)",
          textAlign: "center",
          color: "rgba(255,255,255,0.68)",
          lineHeight: 1.7,
          fontSize: 13,
        }}
      >
        Sending you to the BERNAverse signup…
      </div>

      <a
        href={bernaverseSignup}
        style={{
          width: "100%",
          height: 46,
          borderRadius: 10,
          border: "2px solid #FFD700",
          background:
            "linear-gradient(135deg, rgba(255,215,0,0.2), rgba(188,19,254,0.18))",
          color: "#FFD700",
          fontFamily: "'Teko', sans-serif",
          fontSize: 18,
          letterSpacing: "0.12em",
          textDecoration: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxSizing: "border-box",
        }}
      >
        CONTINUE TO BERNAVERSE →
      </a>
    </AuthLayout>
  );
}
