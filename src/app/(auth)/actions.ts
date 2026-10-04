"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  hasErrors,
  validateCredentials,
  validateSignUp,
  type AuthFormState,
} from "@/lib/validation";

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const errors = validateSignUp({ name, email, password });
  if (hasErrors(errors)) return { errors };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });

  if (error) {
    if (/already (been )?registered/i.test(error.message)) {
      return { errors: { email: "An account with this email already exists." } };
    }
    return { message: "Sign up failed. Please try again." };
  }

  if (!data.session) {
    return { message: "Check your email to confirm your account, then log in." };
  }

  redirect("/");
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const errors = validateCredentials({ email, password });
  if (hasErrors(errors)) return { errors };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { errors: { password: "Email or password is incorrect." } };
  }

  redirect("/");
}