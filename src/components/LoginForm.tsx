"use client";

import { useActionState } from "react";
import { signIn } from "@/app/(auth)/actions";
import { AuthFooter } from "@/components/AuthFooter";
import { Field, FormCard, SubmitButton, inputClassName } from "@/components/form";

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, {});

  return (
    <FormCard title="Log in" subtitle="Welcome back to Tempo." notice={state.message}>
      <form action={action} className="space-y-4">
        <Field id="email" label="Email" error={state.errors?.email}>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className={inputClassName()}
          />
        </Field>

        <Field id="password" label="Password" error={state.errors?.password}>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className={inputClassName()}
          />
        </Field>

        <SubmitButton pending={pending}>Log in</SubmitButton>
      </form>

      <AuthFooter action="New to Tempo?" href="/signup" link="Create an account" />
    </FormCard>
  );
}