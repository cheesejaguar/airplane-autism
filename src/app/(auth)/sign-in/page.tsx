import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { enabledSocialProviders } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return <AuthForm mode="sign-in" providers={enabledSocialProviders} />;
}
