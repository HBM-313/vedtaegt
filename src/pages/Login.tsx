import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, Link } from "react-router-dom";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Logget ind.");
      navigate("/dashboard");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-full max-w-sm p-8">
        <div className="flex items-center gap-2 mb-8">
          <Shield className="h-5 w-5 text-primary" />
          <span className="text-base font-semibold tracking-display">Vedtægt</span>
        </div>

        <h1 className="text-xl font-semibold tracking-display mb-1">Log ind</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Log ind på din organisation.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs">E-mailadresse</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="navn@forening.dk"
              required
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-xs">Adgangskode</Label>
              <Link
                to="/nulstil-adgangskode"
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
              >
                Glemt adgangskode?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
            />
          </div>
          <Button type="submit" className="w-full press-effect" size="sm" disabled={loading}>
            {loading ? "Logger ind..." : "Log ind"}
          </Button>
        </form>

        <p className="mt-6 text-xs text-muted-foreground text-center">
          Har du ikke en konto?{" "}
          <Link to="/opret-konto" className="text-foreground underline underline-offset-2">
            Opret konto
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
