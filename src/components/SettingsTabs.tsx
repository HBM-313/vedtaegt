import { NavLink } from "@/components/NavLink";
import { Building2, Users } from "lucide-react";

const tabs = [
  { to: "/indstillinger/forening", label: "Forening", icon: Building2 },
  { to: "/indstillinger/team", label: "Team", icon: Users },
];

const SettingsTabs = () => (
  <div className="flex gap-1 border-b border-border mb-6">
    {tabs.map((tab) => (
      <NavLink
        key={tab.to}
        to={tab.to}
        className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground border-b-2 border-transparent -mb-px transition-colors"
        activeClassName="text-foreground border-primary font-medium"
      >
        <tab.icon className="h-4 w-4" />
        {tab.label}
      </NavLink>
    ))}
  </div>
);

export default SettingsTabs;
