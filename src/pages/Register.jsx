import React, { useEffect } from "react";
import { UserPlus, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

const BERNA_SIGNUP_URL = "https://bernaverse.hireberna.app/?auth=signup&app=tng";

export default function Register() {
  useEffect(() => {
    window.location.replace(BERNA_SIGNUP_URL);
  }, []);

  return (
    <AuthLayout
      icon={UserPlus}
      title="BERNAverse Sign-Up"
      subtitle="TNG accounts now begin in the BERNAverse."
    >
      <div style={{ textAlign: "center", color: "rgba(255,255,255,0.68)", lineHeight: 1.7 }}>
        <Loader2 style={{ width: 22, height: 22, margin: "0 auto 14px", color: "#BC13FE", animation: "spin 0.8s linear infinite" }} />
        Sending you to the global BERNAverse sign-up…
        <div style={{ marginTop: 16 }}>
          <a href={BERNA_SIGNUP_URL} style={{ color: "#FFD700", fontWeight: 700 }}>
            Continue to BERNAverse
          </a>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </AuthLayout>
  );
}
