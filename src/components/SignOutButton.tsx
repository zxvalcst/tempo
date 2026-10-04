import { signOut } from "@/app/(app)/actions";
import { secondaryButtonClassName } from "@/components/form";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button type="submit" className={secondaryButtonClassName()}>
        Sign out
      </button>
    </form>
  );
}
