import { auth, signIn } from "@/auth";
import { redirect } from "next/navigation";
import Image from "next/image";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0e] to-[#050508] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="relative bg-[#11111a]/80 backdrop-blur-xl border border-[#2a2a3a] rounded-2xl shadow-2xl shadow-[#000]/50 p-8">
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-1 bg-gradient-to-r from-[#FFD700]/20 via-[#FFA500]/50 to-[#FFD700]/20 rounded-full"></div>

          <div className="mb-8 flex justify-center">
            <Image
              src="/multisaas-logo.svg"
              alt="MultiSaaS Logo"
              width={120}
              height={120}
              priority
            />
          </div>

          <h1 className="text-3xl font-bold text-[#e8e8f0] tracking-tight mb-2">
            Welcome to MultiSaaS
          </h1>
          <p className="text-[#a0a0b0] text-sm mb-8">
            Sign in to manage your WhatsApp campaigns
          </p>

          <form
            action={async () => {
              "use server";
              await signIn("google");
            }}
          >
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-800 font-semibold py-3.5 px-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl border border-[#e8e8f0]/10"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M22.5582 10.2314H22.4V10.25H12V14.25H17.5348C16.6614 16.7808 14.0235 18.5 11.25 18.5C7.25274 18.5 3.99618 15.2435 3.99618 11.25C3.99618 7.25614 7.25274 4 11.25 4C13.0977 4 14.7865 4.7575 16.0287 5.94831L18.0946 3.88238C16.4052 2.07238 14.0287 1 11.25 1C6.69359 1 3.05 4.64362 3.05 9.2C3.05 13.7564 6.69359 17.4 11.25 17.4C14.5398 17.4 17.3807 15.2135 18.6668 12.0265L15.5 8.8595C14.5446 10.1051 13.4294 11.1366 12.2064 11.7697C12.5 12.7697 13.053 13.6173 13.6959 14.2623C12.8394 14.6224 11.8394 14.8246 10.75 14.8246C9.65547 14.8246 8.65547 14.6224 7.79913 14.2623C7.35648 13.6173 6.80355 13.7649 6.35648 12.7697C5.90941 11.7697 5.85648 10.7697 6.25 9.76965C6.64352 8.76959 7.35648 7.82455 8.25 7.26965C8.69707 7.05305 9.15591 7 9.65648 7.10552C9.65648 7.10552 9.65648 7.10552 9.65648 7.10552C9.65648 7.10552 9.65648 7.10552 9.65648 7.10552C10.75 7.10552 11.75 8.00639 11.75 9.25C11.75 9.76965 11.5 10.2305 11.25 10.7305C10.9959 11.2305 10.75 11.7305 10.625 12.2305C11.028 12.1051 11.4307 12 11.8394 12C12.1232 12 12.4036 12.0665 12.6775 12.1974C13.2064 12.3246 13.6664 12.6224 14.0449 13.0531C13.7114 13.2382 13.3555 13.3951 12.9774 13.5127C12.7446 13.6173 12.5079 13.713 12.2751 13.8015C12.5579 14.0063 12.8356 14.1954 13.1064 14.3775C13.4064 14.5746 13.6935 14.7564 14 14.9224C13.4307 15.2633 12.8164 15.525 12.1564 15.6875" fill="#4285F4"/>
                <path d="M6.74453 14.7305C6.53984 14.3008 6.38065 13.8465 6.27595 13.3674C6.19785 13.0073 6.14062 12.6388 6.10078 12.2547C6.06367 11.8706 6.04492 11.4844 6.04492 11.0961C6.04492 10.7081 6.06406 10.3223 6.10312 9.93828C6.14297 9.55426 6.20234 9.17383 6.28125 8.79766C6.375 8.38516 6.48437 7.97656 6.61484 7.57422C6.48437 7.69375 6.36484 7.81641 6.25781 7.94609C6.15078 8.07578 6.05078 8.20977 5.95703 8.34844C5.69531 8.38516 5.95703 8.34844C5.69531 8.72461 5.46016 9.11719 5.25547 15.0016C5.46016 15.4093 5.69531 15.79 5.95703 16.1562C6.05078 16.2949 6.15078 16.4289 6.25781 16.5586C6.36484 16.6882 6.48437 16.8109 6.61484 16.9305C6.14297 16.9859 5.69531 17.0461 5.25547 17.0961C5.06484 17.1195 4.89141 17.1336 4.73789 17.1414" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
          </form>

          <p className="mt-6 text-xs text-[#888899] leading-relaxed">
            By continuing, you agree to our <span className="text-[#a0a0b0]">Terms of Service</span> and{" "}
            <span className="text-[#a0a0b0]">Privacy Policy</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
