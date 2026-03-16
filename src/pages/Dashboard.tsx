import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Shield, LogOut, FileText, Users, ClipboardCheck, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

const Dashboard = () => {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserEmail(user.email ?? null);
    };
    getUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logget ud.");
    navigate("/");
  };

  const today = formatDate(new Date());

  const navItems = [
    { icon: BarChart3, label: "Oversigt", active: true },
    { icon: FileText, label: "Møder" },
    { icon: Users, label: "Medlemmer" },
    { icon: ClipboardCheck, label: "Handlingspunkter" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b border-border">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="text-base font-semibold tracking-display">Vedtægt</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{userEmail}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Nav */}
      <nav className="border-b border-border">
        <div className="container flex gap-0">
          {navItems.map((item) => (
            <button
              key={item.label}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-medium transition-colors press-effect ${
                item.active
                  ? "border-b-2 border-foreground text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="container py-12">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-2">
          {today}
        </p>
        <h1 className="text-3xl font-semibold tracking-display mb-8">Oversigt</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border ring-1 ring-border rounded-sm overflow-hidden">
          {[
            { label: "Aktive møder", value: "0" },
            { label: "Åbne handlingspunkter", value: "0" },
            { label: "Medlemmer", value: "0" },
          ].map((stat) => (
            <div key={stat.label} className="bg-background p-6">
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{stat.label}</p>
              <p className="text-2xl font-semibold tabular-nums">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 ring-1 ring-border rounded-sm">
          <div className="p-6 border-b border-border">
            <h2 className="text-sm font-semibold">Seneste aktivitet</h2>
          </div>
          <div className="p-6">
            <p className="text-sm text-muted-foreground">
              Ingen aktivitet endnu. Opret dit første møde for at komme i gang.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
