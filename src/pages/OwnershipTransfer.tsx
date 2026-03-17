import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

const OwnershipTransfer = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transfer, setTransfer] = useState<{
    id: string;
    org_id: string;
    from_member_id: string;
    to_email: string;
    expires_at: string;
    accepted_at: string | null;
  } | null>(null);
  const [orgName, setOrgName] = useState("");
  const [fromName, setFromName] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!token) { setError("Ugyldigt link."); setLoading(false); return; }

      // Must be logged in
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Du skal være logget ind for at acceptere ejerskab.");
        navigate("/login");
        return;
      }

      const { data: t } = await supabase
        .from("ownership_transfers")
        .select("id, org_id, from_member_id, to_email, expires_at, accepted_at")
        .eq("token", token)
        .single();

      if (!t) { setError("Overdragelseslinket er ugyldigt."); setLoading(false); return; }
      if (t.accepted_at) { setError("Ejerskabet er allerede overdraget."); setLoading(false); return; }
      if (new Date(t.expires_at!) < new Date()) { setError("Linket er udløbet."); setLoading(false); return; }

      // Verify current user's email matches
      if (user.email !== t.to_email) {
        setError("Dette link er ikke til din e-mailadresse.");
        setLoading(false);
        return;
      }

      setTransfer(t);

      // Fetch org name and from member name
      const [orgRes, memberRes] = await Promise.all([
        supabase.from("organizations").select("name").eq("id", t.org_id!).single(),
        supabase.from("members").select("name").eq("id", t.from_member_id!).single(),
      ]);
      if (orgRes.data) setOrgName(orgRes.data.name);
      if (memberRes.data) setFromName(memberRes.data.name);

      setLoading(false);
    };
    load();
  }, [token, navigate]);

  const handleAccept = async () => {
    if (!transfer) return;
    setAccepting(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get current owner member and new owner member
    const { data: fromMember } = await supabase
      .from("members")
      .select("id")
      .eq("id", transfer.from_member_id)
      .single();

    const { data: toMember } = await supabase
      .from("members")
      .select("id")
      .eq("org_id", transfer.org_id)
      .eq("user_id", user.id)
      .single();

    if (!fromMember || !toMember) {
      toast.error("Kunne ikke finde medlemsdata.");
      setAccepting(false);
      return;
    }

    // Demote old formand to bestyrelsesmedlem
    await supabase.from("members").update({ role: "bestyrelsesmedlem" }).eq("id", fromMember.id);
    // Promote new formand
    await supabase.from("members").update({ role: "formand" }).eq("id", toMember.id);
    // Mark transfer as accepted
    await supabase.from("ownership_transfers").update({ accepted_at: new Date().toISOString() }).eq("id", transfer.id);

    await logAuditEvent("org.ownership_transferred", "ownership_transfer", transfer.id, {
      from_member_id: fromMember.id,
      to_member_id: toMember.id,
    });

    toast.success(`Du er nu ejer af ${orgName}`);
    navigate("/dashboard");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <XCircle className="h-12 w-12 mx-auto text-destructive" />
            <p className="text-lg font-medium">{error}</p>
            <Button variant="outline" onClick={() => navigate("/dashboard")}>Gå til dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2">
            <AlertTriangle className="h-12 w-12 text-yellow-500" />
          </div>
          <CardTitle>Overdrag ejerskab</CardTitle>
          <CardDescription>
            Du er ved at overtage ejerskabet af <strong>{orgName}</strong> fra <strong>{fromName}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted rounded-lg p-4 text-sm text-muted-foreground">
            <p>Ved at acceptere vil du blive den nye formand. Den nuværende formand vil blive bestyrelsesmedlem.</p>
          </div>
          <Button className="w-full" onClick={handleAccept} disabled={accepting}>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {accepting ? "Accepterer..." : "Acceptér ejerskab"}
          </Button>
          <Button variant="outline" className="w-full" onClick={() => navigate("/dashboard")}>
            Annuller
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default OwnershipTransfer;
