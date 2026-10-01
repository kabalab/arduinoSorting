import { HelpButton } from "@/components/help/help-button";
import { LoginForm } from "@/components/auth/login-form";
import { getRepository } from "@/src/data";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  let siteName = "Equipment storage";
  let problem: string | null = null;
  try {
    const store = await getRepository().read();
    siteName = store.settings.siteName;
  } catch (error) {
    problem = error instanceof Error ? error.message : "The equipment store is unavailable.";
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-stroke bg-card p-6">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs tracking-wide text-muted uppercase">Equipment</p>
            <h1 className="mt-1 text-2xl font-semibold">{siteName}</h1>
            <p className="mt-2 text-sm text-muted">Enter the access code you were given.</p>
          </div>
          <HelpButton audience="guest" />
        </div>
        {problem ? <p className="mb-4 text-sm text-danger">{problem}</p> : <LoginForm />}
      </div>
    </main>
  );
}
