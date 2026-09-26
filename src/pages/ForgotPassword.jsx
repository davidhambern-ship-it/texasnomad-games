import React, { useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "@/lib/neonAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authClient.requestPasswordReset({
        email: email.trim().toLowerCase(),
        redirectTo: `${window.location.origin}/reset-password`,
      });
    } catch {
      // Always show the same result so account existence is not exposed.
    } finally {
      setLoading(false);
      setSent(true);
    }
  };

  return (
    <AuthLayout
      icon={Mail}
      title="Reset password"
      subtitle="We'll send you a link to reset it"
      footer={
        <Link to="/login" className="text-primary font-medium hover:underline">
          <ArrowLeft className="w-3 h-3 inline mr-1" />Back to log in
        </Link>
      }
    >
      {sent ? (
        <div className="space-y-4 text-center">
          <p className="text-sm text-foreground">
            If a TNG sign-in exists with that email, you'll receive a password reset link shortly.
          </p>
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 text-left text-xs leading-5 text-muted-foreground">
            <strong className="text-yellow-400">No reset email?</strong>{' '}
            If your TNG Profile was created before the new sign-in system and you never made TNG email/password credentials, there is no password to reset yet. Create a TNG login with the same email and TNG will reconnect you to your existing Profile.
          </div>
          <Link to="/register" className="inline-block text-sm font-medium text-primary hover:underline">
            Create a TNG login
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs leading-5 text-muted-foreground">
            <strong className="text-yellow-400">Old TNG Profile?</strong>{' '}
            Only use password reset if you already created TNG email/password credentials. If you never did, create a TNG login using the same email instead.
          </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-12"
                required
              />
            </div>
          </div>
          <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              "Send reset link"
            )}
          </Button>
        </form>
        </div>
      )}
    </AuthLayout>
  );
}
