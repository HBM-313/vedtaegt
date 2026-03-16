import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";

const ResetPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    // Check if this is a recovery callback (user clicked link in email)
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setIsRecovery(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/nulstil-adgangskode`,
    });

    if (error) {
      toast.error(error.message);
    } else {
      setSent(true);
    }

    setLoading(false);
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Adgangskoden skal være mindst 8 tegn.");
      return;
    }
    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Din adgangskode er opdateret.");
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

        {isRecovery ? (
          <form onSubmit={handleSetNewPassword} className="space-y-4">
            <div>
              <h1 className="text-xl font-semibold tracking-display mb-1">Ny adgangskode</h1>
              <p className="text-sm text-muted-foreground">Indtast din nye adgangskode.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-xs">Ny adgangskode</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mindst 8 tegn"
                required
                minLength={8}
              />
            </div>

            <Button type="submit" className="w-full press-effect" size="sm" disabled={loading}>
              {loading ? "Opdaterer..." : "Opdater adgangskode"}
            </Button>
          </form>
        ) : sent ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold tracking-display">Tjek din indbakke</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Vi har sendt en e-mail til <strong>{email}</strong> med et link til at nulstille din adgangskode.
            </p>
            <p className="text-xs text-muted-foreground">
              Kan du ikke finde mailen? Tjek din spam-mappe.
            </p>
            <Link
              to="/login"
              className="inline-block text-xs text-foreground underline underline-offset-2"
            >
              Tilbage til login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleRequestReset} className="space-y-4">
            <div>
              <h1 className="text-xl font-semibold tracking-display mb-1">Nulstil adgangskode</h1>
              <p className="text-sm text-muted-foreground">
                Indtast din e-mailadresse, så sender vi et link til at nulstille din adgangskode.
              </p>
            </div>

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

            <Button type="submit" className="w-full press-effect" size="sm" disabled={loading}>
              {loading ? "Sender..." : "Send nulstillingslink"}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              <Link to="/login" className="text-foreground underline underline-offset-2">
                Tilbage til login
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
