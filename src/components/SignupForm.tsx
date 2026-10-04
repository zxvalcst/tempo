"use client";

import { useActionState } from "react";
import { signUp } from "@/app/(auth)/actions";
import { AuthFooter } from "@/components/AuthFooter";
import { Field, FormCard, SubmitButton, inputClassName } from "@/components/form";

export function SignupForm() {
  const [state, action, pending] = useActionState(signUp, {});

  return (
    <FormCard
      title="Create your account"
      subtitle="Start planning your week."
      notice={state.message}
    >
      <form action={action} className="space-y-4">
        <Field id="name" label="Name" error={state.errors?.name}>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            className={inputClassName()}
          />
        </Field>

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

        <Field
          id="password"
          label="Password"
          hint="At least 8 characters."
          error={state.errors?.password}
        >
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className={inputClassName()}
          />
        </Field>

        <SubmitButton pending={pending}>Create account</SubmitButton>
      </form>

      <AuthFooter action="Already have an account?" href="/login" link="Log in" />
    </FormCard>
  );
}