import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthLayout, SocialButtons } from "@/components/auth/auth-layout";
import { DeltaInput } from "@/components/ui/delta-input";
import { DeltaButton } from "@/components/ui/delta-button";
import { Mail, Lock, User } from "lucide-react";

export const Route = createFileRoute("/signup")({
  component: Signup,
});

function Signup() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setError("");
    setIsLoading(true);
    // Simulate signup delay
    setTimeout(() => {
      setIsLoading(false);
      navigate({ to: "/" });
    }, 800);
  };

  return (
    <AuthLayout>
      <div className="flex flex-col gap-2 mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Create an account</h1>
        <p className="text-sm text-muted-foreground">Get started with Delta Meet today</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && <div className="text-sm text-destructive">{error}</div>}
        <DeltaInput
          type="text"
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          icon={<User className="h-4 w-4" />}
          required
        />
        <DeltaInput
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          icon={<Mail className="h-4 w-4" />}
          required
        />
        <DeltaInput
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          icon={<Lock className="h-4 w-4" />}
          required
        />
        <DeltaInput
          type="password"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          icon={<Lock className="h-4 w-4" />}
          required
        />

        <div className="flex items-center gap-2 text-sm mt-1">
          <input type="checkbox" className="rounded border-glass-border bg-glass" required />
          <span className="text-muted-foreground">
            I agree to the{" "}
            <a href="#" className="text-primary hover:text-primary-glow transition-colors">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="#" className="text-primary hover:text-primary-glow transition-colors">
              Privacy Policy
            </a>
          </span>
        </div>

        <DeltaButton type="submit" block className="mt-2" disabled={isLoading}>
          {isLoading ? "Creating account..." : "Create Account"}
        </DeltaButton>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-glass-border"></div>
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
        </div>
      </div>

      <SocialButtons />

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          to="/login"
          className="text-primary hover:text-primary-glow font-medium transition-colors"
        >
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
