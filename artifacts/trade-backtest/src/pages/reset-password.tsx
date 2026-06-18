import React, { useEffect } from "react";
import { useLocation } from "wouter";

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/auth/signin");
  }, [setLocation]);

  return null;
}
