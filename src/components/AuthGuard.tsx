import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface AuthGuardProps {
  children: React.ReactNode;
}

const AuthGuard = ({ children }: AuthGuardProps) => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!session) {
          navigate("/login", { replace: true });
        } else {
          setReady(true);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/login", { replace: true });
      } else {
        setReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (!ready) return null;

  return <>{children}</>;
};

export default AuthGuard;
