import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { enabledSocialProviders } from "@/lib/auth";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return <AuthForm mode="sign-up" providers={enabledSocialProviders} />;
}
